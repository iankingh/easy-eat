import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type MenuRow = { id: number; name: string; description: string; price: number; available: number };
type RoundRow = { id: number; title: string; restaurantId: number | null; orderDate: string; closesAt: string; status: "open" | "closed" };

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

function displayTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

function isAdmin(request: Request) {
  const secret = env.LUNCH_ADMIN_CODE;
  return Boolean(secret && request.headers.get("x-admin-code") === secret);
}

async function ensureRestaurant(database: D1Database, name: string) {
  await database.prepare("INSERT OR IGNORE INTO restaurants (name) VALUES (?)").bind(name).run();
  const restaurant = await database.prepare("SELECT id FROM restaurants WHERE name = ?").bind(name).first<{ id: number }>();
  if (!restaurant) throw new Error("建立店家資料失敗，請再試一次。");
  return restaurant.id;
}

async function ensureStarterData(database: D1Database) {
  const now = taipeiNow();
  const date = taipeiDate();
  let round = await database.prepare("SELECT id, title, status FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(date).first<{ id: number; title: string; status: "open" | "closed" }>();
  if (!round) {
    const previous = await database.prepare("SELECT id FROM order_rounds ORDER BY id DESC LIMIT 1").first<{ id: number }>();
    if (previous) await database.prepare("UPDATE menu_items SET round_id = ? WHERE round_id IS NULL").bind(previous.id).run();
    const close = `${date}T10:30:00+08:00`;
    await database.prepare("INSERT INTO order_rounds (title, order_date, closes_at, status) SELECT '尚未設定今日團購', ?, ?, 'closed' WHERE NOT EXISTS (SELECT 1 FROM order_rounds WHERE order_date = ?)").bind(date, close, date).run();
    round = await database.prepare("SELECT id, title, status FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(date).first<{ id: number; title: string; status: "open" | "closed" }>();
  } else {
    const defaultTitle = `${now.getMonth() + 1}/${now.getDate()} 午餐團購`;
    if (round.title === defaultTitle && round.status === "open") {
      await database.prepare("UPDATE order_rounds SET title = '尚未設定今日團購', restaurant_id = NULL, status = 'closed' WHERE id = ?").bind(round.id).run();
    }
  }
  if (round) await database.prepare("UPDATE menu_items SET round_id = ? WHERE round_id IS NULL").bind(round.id).run();
}

async function getSnapshot(database: D1Database, request: Request, includeOrders: boolean) {
  const requestedRoundId = new URL(request.url).searchParams.get("roundId");
  let round: RoundRow | null = null;
  if (requestedRoundId) {
    const id = Number(requestedRoundId);
    if (!Number.isInteger(id) || id < 1) throw new Error("團購連結不正確。");
    round = await database.prepare("SELECT id, title, restaurant_id AS restaurantId, order_date AS orderDate, closes_at AS closesAt, status FROM order_rounds WHERE id = ?").bind(id).first<RoundRow>();
  } else {
    await ensureStarterData(database);
    round = await database.prepare("SELECT id, title, restaurant_id AS restaurantId, order_date AS orderDate, closes_at AS closesAt, status FROM order_rounds WHERE order_date = ? ORDER BY id DESC LIMIT 1").bind(taipeiDate()).first<RoundRow>();
  }
  if (!round) throw new Error("找不到這個團購，請確認點餐連結。");
  const openRounds = await database.prepare("SELECT id, closes_at AS closesAt FROM order_rounds WHERE status = 'open'").all<{ id: number; closesAt: string }>();
  const expiredIds = openRounds.results.filter(item => Date.now() >= Date.parse(item.closesAt)).map(item => item.id);
  if (expiredIds.length) await database.batch(expiredIds.map(id => database.prepare("UPDATE order_rounds SET status = 'closed' WHERE id = ?").bind(id)));
  if (round.status === "open" && Date.now() >= Date.parse(round.closesAt)) round.status = "closed";
  const menu = round.restaurantId === null ? { results: [] as MenuRow[] } : await database.prepare("SELECT m.id, m.name, m.description, m.price, COALESCE(a.available, 1) AS available FROM restaurant_menu_items m LEFT JOIN round_menu_availability a ON a.menu_item_id = m.id AND a.round_id = ? WHERE m.restaurant_id = ? AND m.active = 1 ORDER BY m.id").bind(round.id, round.restaurantId).all<MenuRow>();
  const summary = await database.prepare("SELECT COUNT(DISTINCT o.account) AS count, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.round_id = ?").bind(round.id).first<{ count: number; total: number }>();
  let rounds: (RoundRow & { orderCount: number; orderTotal: number })[] = [];
  if (includeOrders) {
    const result = await database.prepare("SELECT r.id, r.title, r.restaurant_id AS restaurantId, r.order_date AS orderDate, r.closes_at AS closesAt, r.status, COUNT(DISTINCT o.account) AS orderCount, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS orderTotal FROM order_rounds r LEFT JOIN orders o ON o.round_id = r.id LEFT JOIN order_items oi ON oi.order_id = o.id GROUP BY r.id ORDER BY r.order_date DESC, r.id DESC LIMIT 100").all<RoundRow & { orderCount: number; orderTotal: number }>();
    rounds = result.results.map(item => ({ ...item, status: item.status === "open" && Date.now() >= Date.parse(item.closesAt) ? "closed" : item.status }));
  }
  let restaurants: { id: number; name: string; menuCount: number }[] = [];
  if (includeOrders) {
    restaurants = (await database.prepare("SELECT r.id, r.name, COUNT(m.id) AS menuCount FROM restaurants r LEFT JOIN restaurant_menu_items m ON m.restaurant_id = r.id AND m.active = 1 GROUP BY r.id ORDER BY r.name").all<{ id: number; name: string; menuCount: number }>()).results;
  }
  let orders: unknown[] = [];
  if (includeOrders) {
    const rows = await database.prepare("SELECT o.id, o.employee_name AS name, o.account, o.note, o.status, COALESCE(oi.item_name, i.name) AS itemName, oi.quantity, oi.unit_price AS price FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN menu_items i ON i.id = oi.menu_item_id WHERE o.round_id = ? ORDER BY o.created_at DESC, o.id").bind(round.id).all<{ id: string; name: string; account: string; note: string; status: "new" | "received"; itemName: string | null; quantity: number | null; price: number | null }>();
    const byId = new Map<string, { id: string; name: string; account: string; note: string; status: "new" | "received"; items: { name: string; quantity: number; price: number }[]; total: number }>();
    for (const row of rows.results) {
      let order = byId.get(row.id);
      if (!order) { order = { id: row.id, name: row.name, account: row.account, note: row.note, status: row.status, items: [], total: 0 }; byId.set(row.id, order); }
      if (row.itemName && row.quantity && row.price !== null) { order.items.push({ name: row.itemName, quantity: row.quantity, price: row.price }); order.total += row.quantity * row.price; }
    }
    orders = [...byId.values()];
  }
  return Response.json({ round, menu: menu.results, orderCount: summary?.count ?? 0, orderTotal: summary?.total ?? 0, orders, rounds, restaurants }, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try { return await getSnapshot(db(), request, isAdmin(request)); }
  catch (error) {
    if (error instanceof Error && ["團購連結不正確。", "找不到這個團購，請確認點餐連結。", "資料庫目前無法使用，請稍後再試。"].includes(error.message)) return Response.json({ error: error.message }, { status: 503 });
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error("ordering-read", errorId, error);
    return Response.json({ error: `無法載入點餐資料。請重新整理後再試；若持續失敗，請提供錯誤編號 ${errorId} 給系統管理者。`, errorId }, { status: 503 });
  }
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
    if (action !== "place-order" && !isAdmin(request)) return Response.json({ error: "管理驗證未通過。請重新輸入管理碼並登入後台，再執行此操作。" }, { status: 401 });

    if (action === "create-round") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
      const orderDate = typeof body.orderDate === "string" ? body.orderDate : "";
      const deadline = typeof body.deadline === "string" ? body.deadline : "";
      if (!title) return Response.json({ error: "店家名稱尚未填寫。請選擇一家店，或輸入店家名稱。", field: "title" }, { status: 400 });
      const parsedDate = new Date(`${orderDate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== orderDate) return Response.json({ error: "團購日期不正確。請使用日期欄位選擇有效日期。", field: "orderDate" }, { status: 400 });
      if (orderDate < taipeiDate()) return Response.json({ error: `團購日期 ${orderDate} 已過期。請選擇今天（${taipeiDate()}）或之後的日期。`, field: "orderDate" }, { status: 400 });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)) return Response.json({ error: "截止時間不正確。請輸入 00:00～23:59 的時間，例如 13:30。", field: "deadline" }, { status: 400 });
      const closesAt = `${orderDate}T${deadline}:00+08:00`;
      if (!Number.isFinite(Date.parse(closesAt))) return Response.json({ error: "請填寫有效的日期與截止時間。" }, { status: 400 });
      const restaurantId = await ensureRestaurant(database, title);
      const reusable = await database.prepare("SELECT r.id FROM order_rounds r WHERE r.order_date = ? AND r.title = '尚未設定今日團購' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.round_id = r.id) AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.round_id = r.id) ORDER BY r.id DESC LIMIT 1").bind(orderDate).first<{ id: number }>();
      if (reusable) {
        await database.prepare("UPDATE order_rounds SET title = ?, restaurant_id = ?, closes_at = ?, status = 'closed' WHERE id = ?").bind(title, restaurantId, closesAt, reusable.id).run();
        return Response.json({ ok: true, roundId: reusable.id });
      }
      const created = await database.prepare("INSERT INTO order_rounds (title, restaurant_id, order_date, closes_at, status) VALUES (?, ?, ?, ?, 'closed') RETURNING id").bind(title, restaurantId, orderDate, closesAt).first<{ id: number }>();
      if (!created) throw new Error("建立團購失敗，請再試一次。");
      return Response.json({ ok: true, roundId: created.id });
    }

    if (action === "place-order") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
      const account = typeof body.account === "string" ? body.account.trim().slice(0, 80) : "";
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 160) : "";
      const items = Array.isArray(body.items) ? body.items as { menuItemId?: unknown; quantity?: unknown }[] : [];
      if (!name) return Response.json({ error: "姓名尚未填寫。請輸入姓名後再送出訂單。" }, { status: 400 });
      if (!account) return Response.json({ error: "帳號尚未填寫。請輸入帳號後再送出訂單。" }, { status: 400 });
      if (!items.length) return Response.json({ error: "尚未選擇餐點。請將至少一項餐點的數量設為 1 以上。" }, { status: 400 });
      if (items.length > 30) return Response.json({ error: "一張訂單最多可選擇 30 種餐點。請減少餐點種類後再送出。" }, { status: 400 });
      const roundId = Number(body.roundId);
      if (!Number.isInteger(roundId) || roundId < 1) return Response.json({ error: "點餐連結不正確。" }, { status: 400 });
      const round = await database.prepare("SELECT id, restaurant_id AS restaurantId, status, closes_at AS closesAt FROM order_rounds WHERE id = ?").bind(roundId).first<{ id: number; restaurantId: number | null; status: "open" | "closed"; closesAt: string }>();
      if (!round) return Response.json({ error: "找不到這張團購訂單。請向管理者索取正確的點餐連結。" }, { status: 404 });
      if (Date.now() >= Date.parse(round.closesAt)) return Response.json({ error: `這團已於 ${displayTime(round.closesAt)} 截止，無法送出訂單。請聯絡管理者調整截止時間。` }, { status: 409 });
      if (round.status !== "open") return Response.json({ error: "這團目前關閉中。請聯絡管理者開放點餐後再送出。" }, { status: 409 });
      if (round.restaurantId === null) return Response.json({ error: "這團尚未指定店家。請聯絡管理者先設定店家與菜單。" }, { status: 409 });
      const normalized: { item: MenuRow; quantity: number }[] = [];
      for (const line of items) {
        const id = Number(line.menuItemId); const quantity = Number(line.quantity);
        if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return Response.json({ error: "餐點數量不正確。" }, { status: 400 });
        const item = await database.prepare("SELECT m.id, m.name, m.description, m.price, COALESCE(a.available, 1) AS available FROM restaurant_menu_items m LEFT JOIN round_menu_availability a ON a.menu_item_id = m.id AND a.round_id = ? WHERE m.id = ? AND m.restaurant_id = ? AND m.active = 1").bind(round.id, id, round.restaurantId).first<MenuRow>();
        if (!item) return Response.json({ error: "所選餐點已從這家店的菜單移除。請重新整理頁面並重新選餐。" }, { status: 409 });
        if (!item.available) return Response.json({ error: `「${item.name}」已售完。請將此餐點數量設為 0，或重新整理後改選其他餐點。` }, { status: 409 });
        normalized.push({ item, quantity });
      }
      const orderId = crypto.randomUUID();
      const snapshots: { item: MenuRow; quantity: number; snapshotId: number }[] = [];
      for (const { item, quantity } of normalized) {
        const snapshot = await database.prepare("INSERT INTO menu_items (round_id, name, description, price, available) VALUES (?, ?, ?, ?, 1) RETURNING id").bind(round.id, item.name, item.description, item.price).first<{ id: number }>();
        if (!snapshot) throw new Error("保存餐點快照失敗，請再試一次。");
        snapshots.push({ item, quantity, snapshotId: snapshot.id });
      }
      await database.batch([
        database.prepare("INSERT INTO orders (id, round_id, employee_name, account, note, status) VALUES (?, ?, ?, ?, ?, 'new')").bind(orderId, round.id, name, account, note),
        ...snapshots.map(({ item, quantity, snapshotId }) => database.prepare("INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)").bind(orderId, snapshotId, item.name, quantity, item.price)),
      ]);
      return Response.json({ ok: true });
    }
    if (action === "update-round") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
      const deadline = typeof body.deadline === "string" ? body.deadline : "";
      if (!title) return Response.json({ error: "店家名稱尚未填寫。請選擇店家或輸入名稱。" }, { status: 400 });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)) return Response.json({ error: "截止時間不正確。請輸入 00:00～23:59 的時間。" }, { status: 400 });
      const roundId = Number(body.roundId);
      if (!Number.isInteger(roundId) || roundId < 1) return Response.json({ error: "找不到這張團購訂單。請重新整理頁面，再從「所有團次」選擇訂單。" }, { status: 400 });
      const round = await database.prepare("SELECT title, restaurant_id AS restaurantId, order_date AS orderDate, status FROM order_rounds WHERE id = ?").bind(roundId).first<{ title: string; restaurantId: number | null; orderDate: string; status: "open" | "closed" }>();
      if (!round) return Response.json({ error: "找不到這張團購訂單。請重新整理頁面，再從「所有團次」選擇訂單。" }, { status: 404 });
      const date = round.orderDate;
      const closesAt = `${date}T${deadline}:00+08:00`;
      const openAfterSave = body.openAfterSave === true;
      if ((openAfterSave || round.status === "open") && Date.parse(closesAt) <= Date.now()) return Response.json({ error: `截止時間 ${displayTime(closesAt)} 已過期。這團日期是 ${date}，請將時間調整至現在之後；若要改為其他日期，請建立新訂單。` }, { status: 400 });
      if (openAfterSave && round.title !== title) return Response.json({ error: "店家已修改但尚未儲存。請先按「儲存店家與時間」，確認新店家的餐點後，再開放點餐。" }, { status: 409 });
      if (openAfterSave) {
        const count = await database.prepare("SELECT COUNT(*) AS count FROM restaurant_menu_items m LEFT JOIN round_menu_availability a ON a.menu_item_id = m.id AND a.round_id = ? WHERE m.restaurant_id = ? AND m.active = 1 AND COALESCE(a.available, 1) = 1").bind(roundId, round.restaurantId).first<{ count: number }>();
        if (!count?.count) return Response.json({ error: `「${round.title}」沒有供應中的餐點。請在「設定餐點」新增餐點，或將售完餐點改為供應中，再開放點餐。` }, { status: 409 });
      }
      if (round.title !== title) {
        const orderCount = await database.prepare("SELECT COUNT(*) AS count FROM orders WHERE round_id = ?").bind(roundId).first<{ count: number }>();
        if (orderCount?.count) return Response.json({ error: "這團已有訂單，無法更換店家；請建立新團以保留訂單紀錄。" }, { status: 409 });
        const restaurantId = await ensureRestaurant(database, title);
        await database.prepare("UPDATE order_rounds SET title = ?, restaurant_id = ?, closes_at = ? WHERE id = ?").bind(title, restaurantId, closesAt, roundId).run();
        return Response.json({ ok: true });
      }
      if (round.restaurantId === null) {
        const restaurantId = await ensureRestaurant(database, title);
        await database.prepare("UPDATE order_rounds SET restaurant_id = ?, closes_at = ? WHERE id = ?").bind(restaurantId, closesAt, roundId).run();
      } else {
        await database.prepare("UPDATE order_rounds SET title = ?, closes_at = ?, status = CASE WHEN ? = 1 THEN 'open' ELSE status END WHERE id = ?").bind(title, closesAt, openAfterSave ? 1 : 0, roundId).run();
      }
      return Response.json({ ok: true });
    }
    if (action === "add-menu-item") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 160) : "";
      const price = Number(body.price);
      if (!name) return Response.json({ error: "餐點名稱尚未填寫。請輸入名稱後再新增。" }, { status: 400 });
      if (!Number.isInteger(price) || price < 1 || price > 10000) return Response.json({ error: "餐點價格不正確。請輸入 1～10,000 元的整數金額。" }, { status: 400 });
      const roundId = Number(body.roundId);
      const round = Number.isInteger(roundId) ? await database.prepare("SELECT id, restaurant_id AS restaurantId FROM order_rounds WHERE id = ?").bind(roundId).first<{ id: number; restaurantId: number | null }>() : null;
      if (!round) return Response.json({ error: "找不到這張團購訂單。請重新整理頁面，再從「所有團次」選擇訂單。" }, { status: 404 });
      if (round.restaurantId === null) return Response.json({ error: "請先設定這團的店家。" }, { status: 409 });
      await database.prepare("INSERT INTO restaurant_menu_items (restaurant_id, name, description, price, active) VALUES (?, ?, ?, ?, 1)").bind(round.restaurantId, name, description, price).run();
      return Response.json({ ok: true });
    }
    if (action === "update-menu-item") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 160) : "";
      const price = Number(body.price);
      if (!name) return Response.json({ error: "餐點名稱尚未填寫。請輸入名稱後再儲存。" }, { status: 400 });
      if (!Number.isInteger(price) || price < 1 || price > 10000) return Response.json({ error: "餐點價格不正確。請輸入 1～10,000 元的整數金額。" }, { status: 400 });
      const roundId = Number(body.roundId);
      const itemId = Number(body.menuItemId);
      if (!Number.isInteger(roundId) || !Number.isInteger(itemId)) return Response.json({ error: "餐點資料不正確。請重新整理菜單後再編輯。" }, { status: 400 });
      const item = await database.prepare("SELECT m.id FROM restaurant_menu_items m JOIN order_rounds r ON r.restaurant_id = m.restaurant_id WHERE r.id = ? AND m.id = ? AND m.active = 1").bind(roundId, itemId).first<{ id: number }>();
      if (!item) return Response.json({ error: "這項餐點不屬於所選店家，或已被移除。請重新整理菜單後再編輯。" }, { status: 404 });
      await database.prepare("UPDATE restaurant_menu_items SET name = ?, description = ?, price = ? WHERE id = ? AND active = 1").bind(name, description, price, itemId).run();
      return Response.json({ ok: true });
    }
    if (action === "toggle-menu-item") {
      const roundId = Number(body.roundId);
      const round = Number.isInteger(roundId) ? await database.prepare("SELECT id, restaurant_id AS restaurantId FROM order_rounds WHERE id = ?").bind(roundId).first<{ id: number; restaurantId: number | null }>() : null;
      if (!round) return Response.json({ error: "找不到這張團購訂單。請重新整理頁面，再從「所有團次」選擇訂單。" }, { status: 404 });
      if (round.restaurantId === null) return Response.json({ error: "請先設定這團的店家。" }, { status: 409 });
      const menuItemId = Number(body.menuItemId);
      const item = await database.prepare("SELECT m.id, COALESCE(a.available, 1) AS available FROM restaurant_menu_items m LEFT JOIN round_menu_availability a ON a.menu_item_id = m.id AND a.round_id = ? WHERE m.id = ? AND m.restaurant_id = ? AND m.active = 1").bind(round.id, menuItemId, round.restaurantId).first<{ id: number; available: number }>();
      if (!item) return Response.json({ error: "找不到這項店家餐點。" }, { status: 404 });
      await database.prepare("INSERT INTO round_menu_availability (round_id, menu_item_id, available) VALUES (?, ?, ?) ON CONFLICT(round_id, menu_item_id) DO UPDATE SET available = excluded.available").bind(round.id, item.id, item.available ? 0 : 1).run();
      return Response.json({ ok: true });
    }
    if (action === "remove-menu-item") {
      const roundId = Number(body.roundId);
      const round = Number.isInteger(roundId) ? await database.prepare("SELECT id, restaurant_id AS restaurantId FROM order_rounds WHERE id = ?").bind(roundId).first<{ id: number; restaurantId: number | null }>() : null;
      if (!round) return Response.json({ error: "找不到這張團購訂單。請重新整理頁面，再從「所有團次」選擇訂單。" }, { status: 404 });
      if (round.restaurantId === null) return Response.json({ error: "請先設定這團的店家。" }, { status: 409 });
      const itemId = Number(body.menuItemId);
      const item = await database.prepare("SELECT id FROM restaurant_menu_items WHERE id = ? AND restaurant_id = ? AND active = 1").bind(itemId, round.restaurantId).first<{ id: number }>();
      if (!item) return Response.json({ error: "找不到這項餐點。" }, { status: 404 });
      await database.prepare("UPDATE restaurant_menu_items SET active = 0 WHERE id = ? AND restaurant_id = ?").bind(itemId, round.restaurantId).run();
      return Response.json({ ok: true });
    }
    if (action === "toggle-round") {
      const roundId = Number(body.roundId);
      const currentRound = Number.isInteger(roundId) ? await database.prepare("SELECT id, status, closes_at AS closesAt FROM order_rounds WHERE id = ?").bind(roundId).first<{ id: number; status: "open" | "closed"; closesAt: string }>() : null;
      if (!currentRound) return Response.json({ error: "找不到這張團購訂單。請重新整理頁面，再從「所有團次」選擇訂單。" }, { status: 404 });
      if (Date.now() >= Date.parse(currentRound.closesAt)) return Response.json({ error: `這團的截止時間為 ${displayTime(currentRound.closesAt)}，目前已過期。請先在「設定店家與截止時間」調整截止時間，再開放點餐。` }, { status: 409 });
      if (currentRound.status === "closed") {
        const count = await database.prepare("SELECT COUNT(*) AS count FROM order_rounds r JOIN restaurant_menu_items m ON m.restaurant_id = r.restaurant_id AND m.active = 1 LEFT JOIN round_menu_availability a ON a.round_id = r.id AND a.menu_item_id = m.id WHERE r.id = ? AND COALESCE(a.available, 1) = 1").bind(currentRound.id).first<{ count: number }>();
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
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error("ordering-operation", errorId, error);
    return Response.json({ error: `系統未能完成這次操作。請重新整理並確認訂單狀態後再試；若持續失敗，請提供錯誤編號 ${errorId} 給系統管理者。`, errorId }, { status: 500 });
  }
}
