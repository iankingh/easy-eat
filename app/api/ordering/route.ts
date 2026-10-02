import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type MenuRow = { id: number; name: string; description: string; price: number; available: number };

function db() {
  if (!env.DB) throw new Error("資料庫目前無法使用，請稍後再試。");
  return env.DB;
}

function taipeiNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

function taipeiDate() {
  const now = taipeiNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isAdmin(request: Request) {
  const secret = env.LUNCH_ADMIN_CODE;
  return Boolean(secret && request.headers.get("x-admin-code") === secret);
}

async function ensureStarterData(database: D1Database) {
  const now = taipeiNow();
  const date = taipeiDate();
  let round = await database.prepare("SELECT id FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(date).first<{ id: number }>();
  if (!round) {
    const previous = await database.prepare("SELECT id FROM order_rounds ORDER BY id DESC LIMIT 1").first<{ id: number }>();
    if (previous) await database.prepare("UPDATE menu_items SET round_id = ? WHERE round_id IS NULL").bind(previous.id).run();
    const close = `${date}T10:30:00+08:00`;
    await database.prepare("INSERT INTO order_rounds (title, order_date, closes_at, status) SELECT '尚未設定今日團購', ?, ?, 'closed' WHERE NOT EXISTS (SELECT 1 FROM order_rounds WHERE order_date = ?)").bind(date, close, date).run();
    round = await database.prepare("SELECT id FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(date).first<{ id: number }>();
  }
  if (round) await database.prepare("UPDATE menu_items SET round_id = ? WHERE round_id IS NULL").bind(round.id).run();
}

async function getSnapshot(database: D1Database, includeOrders: boolean) {
  await ensureStarterData(database);
  const round = await database.prepare("SELECT id, title, order_date AS orderDate, closes_at AS closesAt, status FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(taipeiDate()).first<{ id: number; title: string; orderDate: string; closesAt: string; status: "open" | "closed" }>();
  if (!round) throw new Error("目前沒有開放中的團購。");
  if (round.status === "open" && Date.now() >= Date.parse(round.closesAt)) {
    await database.prepare("UPDATE order_rounds SET status = 'closed' WHERE id = ?").bind(round.id).run();
    round.status = "closed";
  }
  const menu = await database.prepare("SELECT id, name, description, price, available FROM menu_items WHERE round_id = ? ORDER BY id").bind(round.id).all<MenuRow>();
  const summary = await database.prepare("SELECT COUNT(DISTINCT o.account) AS count, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.round_id = ?").bind(round.id).first<{ count: number; total: number }>();
  let orders: unknown[] = [];
  if (includeOrders) {
    const rows = await database.prepare("SELECT o.id, o.employee_name AS name, o.account, o.note, o.status, i.name AS itemName, oi.quantity, oi.unit_price AS price FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN menu_items i ON i.id = oi.menu_item_id WHERE o.round_id = ? ORDER BY o.created_at DESC, o.id").bind(round.id).all<{ id: string; name: string; account: string; note: string; status: "new" | "received"; itemName: string | null; quantity: number | null; price: number | null }>();
    const byId = new Map<string, { id: string; name: string; account: string; note: string; status: "new" | "received"; items: { name: string; quantity: number; price: number }[]; total: number }>();
    for (const row of rows.results) {
      let order = byId.get(row.id);
      if (!order) { order = { id: row.id, name: row.name, account: row.account, note: row.note, status: row.status, items: [], total: 0 }; byId.set(row.id, order); }
      if (row.itemName && row.quantity && row.price !== null) { order.items.push({ name: row.itemName, quantity: row.quantity, price: row.price }); order.total += row.quantity * row.price; }
    }
    orders = [...byId.values()];
  }
  return Response.json({ round, menu: menu.results, orderCount: summary?.count ?? 0, orderTotal: summary?.total ?? 0, orders }, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try { return await getSnapshot(db(), isAdmin(request)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "資料讀取失敗。" }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const database = db();
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (action === "admin-check") {
      if (!env.LUNCH_ADMIN_CODE) return Response.json({ error: "管理功能尚未設定，請聯絡系統管理者。" }, { status: 503 });
      if (!isAdmin(request)) return Response.json({ error: "管理碼不正確。" }, { status: 401 });
      return Response.json({ ok: true });
    }
    if (action !== "place-order" && !isAdmin(request)) return Response.json({ error: "請先登入管理後台。" }, { status: 401 });

    if (action === "place-order") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
      const account = typeof body.account === "string" ? body.account.trim().slice(0, 80) : "";
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 160) : "";
      const items = Array.isArray(body.items) ? body.items as { menuItemId?: unknown; quantity?: unknown }[] : [];
      if (!name || !account || !items.length || items.length > 30) return Response.json({ error: "請填寫姓名、帳號並選擇餐點。" }, { status: 400 });
      await ensureStarterData(database);
      const round = await database.prepare("SELECT id, status, closes_at AS closesAt FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(taipeiDate()).first<{ id: number; status: "open" | "closed"; closesAt: string }>();
      if (!round || round.status !== "open" || Date.now() >= Date.parse(round.closesAt)) return Response.json({ error: "本團已截止，暫時無法送出訂單。" }, { status: 409 });
      const normalized: { item: MenuRow; quantity: number }[] = [];
      for (const line of items) {
        const id = Number(line.menuItemId); const quantity = Number(line.quantity);
        if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return Response.json({ error: "餐點數量不正確。" }, { status: 400 });
        const item = await database.prepare("SELECT id, name, description, price, available FROM menu_items WHERE id = ? AND round_id = ?").bind(id, round.id).first<MenuRow>();
        if (!item || !item.available) return Response.json({ error: "有餐點已售完，請更新菜單後再送出。" }, { status: 409 });
        normalized.push({ item, quantity });
      }
      const orderId = crypto.randomUUID();
      await database.batch([
        database.prepare("INSERT INTO orders (id, round_id, employee_name, account, note, status) VALUES (?, ?, ?, ?, ?, 'new')").bind(orderId, round.id, name, account, note),
        ...normalized.map(({ item, quantity }) => database.prepare("INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)").bind(orderId, item.id, quantity, item.price)),
      ]);
      return Response.json({ ok: true });
    }
    if (action === "update-round") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
      const deadline = typeof body.deadline === "string" ? body.deadline : "";
      if (!title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)) return Response.json({ error: "請填寫團購名稱和有效的截止時間。" }, { status: 400 });
      await ensureStarterData(database);
      const date = taipeiDate();
      const closesAt = `${date}T${deadline}:00+08:00`;
      if (Date.parse(closesAt) <= Date.now()) return Response.json({ error: "截止時間必須晚於現在。" }, { status: 400 });
      await database.prepare("UPDATE order_rounds SET title = ?, closes_at = ? WHERE order_date = ?").bind(title, closesAt, date).run();
      return Response.json({ ok: true });
    }
    if (action === "add-menu-item") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 160) : "";
      const price = Number(body.price);
      if (!name || !Number.isInteger(price) || price < 1 || price > 10000) return Response.json({ error: "請確認餐點名稱與價格。" }, { status: 400 });
      await ensureStarterData(database);
      const round = await database.prepare("SELECT id FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(taipeiDate()).first<{ id: number }>();
      if (!round) return Response.json({ error: "今日團購尚未建立。" }, { status: 409 });
      await database.prepare("INSERT INTO menu_items (round_id, name, description, price, available) VALUES (?, ?, ?, ?, 1)").bind(round.id, name, description, price).run();
      return Response.json({ ok: true });
    }
    if (action === "toggle-menu-item") {
      await ensureStarterData(database);
      const round = await database.prepare("SELECT id FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(taipeiDate()).first<{ id: number }>();
      if (!round) return Response.json({ error: "今日團購尚未建立。" }, { status: 409 });
      await database.prepare("UPDATE menu_items SET available = CASE available WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND round_id = ?").bind(Number(body.menuItemId), round.id).run();
      return Response.json({ ok: true });
    }
    if (action === "toggle-round") {
      await ensureStarterData(database);
      const currentRound = await database.prepare("SELECT id, status, closes_at AS closesAt FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(taipeiDate()).first<{ id: number; status: "open" | "closed"; closesAt: string }>();
      if (!currentRound || Date.now() >= Date.parse(currentRound.closesAt)) return Response.json({ error: "已超過今日截止時間，明天會自動開啟新一團。" }, { status: 409 });
      if (currentRound.status === "closed") {
        const count = await database.prepare("SELECT COUNT(*) AS count FROM menu_items WHERE round_id = ? AND available = 1").bind(currentRound.id).first<{ count: number }>();
        if (!count?.count) return Response.json({ error: "請先新增至少一項供應中的餐點，再開放同事點餐。" }, { status: 409 });
      }
      await database.prepare("UPDATE order_rounds SET status = CASE status WHEN 'open' THEN 'closed' ELSE 'open' END WHERE id = ?").bind(currentRound.id).run();
      return Response.json({ ok: true });
    }
    if (action === "toggle-order") {
      await database.prepare("UPDATE orders SET status = CASE status WHEN 'new' THEN 'received' ELSE 'new' END WHERE id = ?").bind(String(body.orderId)).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "不支援的操作。" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "操作失敗，請稍後再試。" }, { status: 500 });
  }
}
