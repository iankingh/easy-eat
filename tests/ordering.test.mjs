import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLocalD1 } from "../scripts/local-d1.mjs";
import {
  assertContentSyncSafe,
  importSitesSnapshot,
} from "../scripts/sync-repositories.mjs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import worker from "../dist/server/index.js";
const tomorrow = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(
    new Date(Date.now() + 86400000),
  );
function fixture() {
  const DB = createLocalD1(),
    env = { DB, LUNCH_ADMIN_CODE: "test-admin" };
  const fetch = (query = "", body, admin = false) =>
    worker.fetch(
      new Request(`http://test/api/ordering${query}`, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...(admin ? { "x-admin-code": "test-admin" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
      {},
    );
  async function post(body, admin = true, status = 200) {
    const res = await fetch("", body, admin);
    assert.equal(res.status, status, await res.clone().text());
    return res.json();
  }
  return { DB, fetch, post };
}
async function setup(t) {
  const f = fixture();
  t.after(() => f.DB.close());
  const { restaurantId } = await f.post({
    action: "create-restaurant",
    name: "午餐測試店",
  });
  await f.post({
    action: "add-menu-item",
    restaurantId,
    name: "雞腿餐",
    description: "附湯",
    price: 120,
  });
  const { roundId } = await f.post({
    action: "create-round",
    restaurantId,
    orderDate: tomorrow(),
    deadline: "23:59",
  });
  const snapshot = await (
    await f.fetch(`?roundId=${roundId}`, undefined, true)
  ).json();
  return { ...f, restaurantId, roundId, menuItemId: snapshot.menu[0].id };
}
test("public response hides all employee details; authentication protects admin APIs", async (t) => {
  const f = await setup(t);
  assert.equal((await f.fetch("?view=restaurants")).status, 401);
  await f.post({ action: "toggle-round", roundId: f.roundId }, false, 401);
  await f.post({ action: "admin-check" }, false, 401);
  const snapshot = await (await f.fetch(`?roundId=${f.roundId}`)).json();
  assert.deepEqual(snapshot.orders, []);
  assert.deepEqual(snapshot.restaurants, []);
  assert.deepEqual(snapshot.rounds, []);
});
test("saved restaurant menus are reused; round availability does not affect other rounds", async (t) => {
  const f = await setup(t);
  const second = await f.post({
    action: "create-round",
    restaurantId: f.restaurantId,
    orderDate: tomorrow(),
    deadline: "23:59",
  });
  await f.post({
    action: "toggle-menu-item",
    roundId: f.roundId,
    menuItemId: f.menuItemId,
  });
  const one = await (await f.fetch(`?roundId=${f.roundId}`)).json(),
    two = await (await f.fetch(`?roundId=${second.roundId}`)).json();
  assert.equal(one.menu[0].available, 0);
  assert.equal(two.menu[0].available, 1);
  await f.post(
    {
      action: "update-round",
      roundId: f.roundId,
      title: "午餐測試店",
      deadline: "23:59",
      openAfterSave: true,
    },
    true,
    409,
  );
});
test("full lifecycle: open, place, replay, duplicate, append, replace, preserve old prices and confirm", async (t) => {
  const f = await setup(t);
  const payload = {
    action: "place-order",
    roundId: f.roundId,
    requestId: crypto.randomUUID(),
    name: "測試同事",
    account: "employee-test",
    note: "不辣",
    items: [{ menuItemId: f.menuItemId, quantity: 2 }],
  };
  await f.post(payload, false, 409);
  await f.post({
    action: "update-round",
    roundId: f.roundId,
    title: "午餐測試店",
    deadline: "23:59",
    openAfterSave: true,
  });
  const receipt = await f.post(payload, false);
  const replay = await f.post(payload, false);
  assert.equal(replay.orderId, receipt.orderId);
  assert.equal(replay.replayed, true);
  await f.post({ ...payload, note: "內容不同" }, false, 409);
  const duplicate = await f.post(
    { ...payload, requestId: crypto.randomUUID() },
    false,
    409,
  );
  assert.equal(duplicate.code, "duplicate-order");
  await f.post(
    {
      ...payload,
      requestId: crypto.randomUUID(),
      mode: "replace",
      replaceOrderId: crypto.randomUUID(),
    },
    false,
    403,
  );
  await f.post({
    action: "update-menu-item",
    restaurantId: f.restaurantId,
    menuItemId: f.menuItemId,
    name: "新雞腿餐",
    description: "",
    price: 150,
  });
  let snapshot = await (
    await f.fetch(`?roundId=${f.roundId}`, undefined, true)
  ).json();
  assert.equal(snapshot.orders[0].items[0].name, "雞腿餐");
  assert.equal(snapshot.orderTotal, 240);
  await f.post(
    {
      ...payload,
      requestId: crypto.randomUUID(),
      mode: "append",
      items: [{ menuItemId: f.menuItemId, quantity: 1 }],
    },
    false,
  );
  await f.post(
    {
      ...payload,
      requestId: crypto.randomUUID(),
      mode: "replace",
      replaceOrderId: receipt.orderId,
      items: [{ menuItemId: f.menuItemId, quantity: 1 }],
    },
    false,
  );
  await f.post({ action: "toggle-order", orderId: receipt.orderId });
  snapshot = await (
    await f.fetch(`?roundId=${f.roundId}`, undefined, true)
  ).json();
  assert.equal(snapshot.orderCount, 2);
  assert.equal(snapshot.personCount, 1);
  assert.equal(snapshot.mealCount, 2);
  assert.equal(snapshot.orderTotal, 300);
  assert.equal(
    snapshot.orders.find((o) => o.id === receipt.orderId).status,
    "received",
  );
  const publicData = await (await f.fetch(`?roundId=${f.roundId}`)).json();
  assert.deepEqual(publicData.orders, []);
  await f.post({ action: "toggle-round", roundId: f.roundId });
  await f.post(
    { ...payload, requestId: crypto.randomUUID(), mode: "append" },
    false,
    409,
  );
});
test("invalid and unavailable menu entries never create orders", async (t) => {
  const f = await setup(t);
  await f.post({ action: "toggle-round", roundId: f.roundId });
  const body = {
    action: "place-order",
    roundId: f.roundId,
    name: "同事",
    account: "invalid-test",
    items: [{ menuItemId: f.menuItemId, quantity: 21 }],
  };
  await f.post(body, false, 400);
  await f.post(
    {
      ...body,
      items: [
        { menuItemId: f.menuItemId, quantity: 1 },
        { menuItemId: f.menuItemId, quantity: 1 },
      ],
    },
    false,
    400,
  );
  await f.post({
    action: "remove-menu-item",
    restaurantId: f.restaurantId,
    menuItemId: f.menuItemId,
  });
  await f.post(
    { ...body, items: [{ menuItemId: f.menuItemId, quantity: 1 }] },
    false,
    409,
  );
  assert.equal(
    f.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM orders").get().n,
    0,
  );
});
test("order writes recheck round and menu state atomically", async (t) => {
  const changes = {
    closed: (f) =>
      f.DB.sqlite
        .prepare("UPDATE order_rounds SET status = 'closed' WHERE id = ?")
        .run(f.roundId),
    expired: (f) =>
      f.DB.sqlite
        .prepare(
          "UPDATE order_rounds SET closes_at = '2000-01-01T10:30:00+08:00' WHERE id = ?",
        )
        .run(f.roundId),
    soldOut: (f) =>
      f.DB.sqlite
        .prepare(
          "INSERT INTO round_menu_availability (round_id, menu_item_id, available) VALUES (?, ?, 0)",
        )
        .run(f.roundId, f.menuItemId),
    removed: (f) =>
      f.DB.sqlite
        .prepare("UPDATE restaurant_menu_items SET active = 0 WHERE id = ?")
        .run(f.menuItemId),
    repriced: (f) =>
      f.DB.sqlite
        .prepare(
          "UPDATE restaurant_menu_items SET price = price + 10 WHERE id = ?",
        )
        .run(f.menuItemId),
  };
  for (const mode of ["new", "append", "replace"]) {
    for (const [change, mutate] of Object.entries(changes)) {
      await t.test(
        `${mode}: ${change} before commit leaves no partial writes`,
        async (t) => {
          const f = await setup(t);
          await f.post({ action: "toggle-round", roundId: f.roundId });
          const payload = {
            action: "place-order",
            roundId: f.roundId,
            name: "同事",
            account: "atomic-test",
            items: [{ menuItemId: f.menuItemId, quantity: 1 }],
            requestId: crypto.randomUUID(),
          };
          const original = mode === "new" ? null : await f.post(payload, false);
          const before = {
            orders: f.DB.sqlite
              .prepare("SELECT * FROM orders ORDER BY id")
              .all(),
            items: f.DB.sqlite
              .prepare("SELECT * FROM order_items ORDER BY id")
              .all(),
            snapshots: f.DB.sqlite
              .prepare("SELECT * FROM menu_items ORDER BY id")
              .all(),
            requests: f.DB.sqlite
              .prepare("SELECT * FROM order_requests ORDER BY id")
              .all(),
          };
          const batch = f.DB.batch.bind(f.DB);
          f.DB.batch = async (statements) => {
            mutate(f);
            return batch(statements);
          };
          await f.post(
            {
              ...payload,
              mode,
              replaceOrderId: original?.orderId,
              requestId: crypto.randomUUID(),
              items: [{ menuItemId: f.menuItemId, quantity: 2 }],
            },
            false,
            409,
          );
          assert.deepEqual(
            f.DB.sqlite.prepare("SELECT * FROM orders ORDER BY id").all(),
            before.orders,
          );
          assert.deepEqual(
            f.DB.sqlite.prepare("SELECT * FROM order_items ORDER BY id").all(),
            before.items,
          );
          assert.deepEqual(
            f.DB.sqlite.prepare("SELECT * FROM menu_items ORDER BY id").all(),
            before.snapshots,
          );
          assert.deepEqual(
            f.DB.sqlite
              .prepare("SELECT * FROM order_requests ORDER BY id")
              .all(),
            before.requests,
          );
        },
      );
    }
  }
});
test("concurrent replacement retries cannot overwrite a newer order", async (t) => {
  for (const samePayload of [true, false])
    await t.test(
      samePayload ? "matching retry" : "conflicting payload",
      async (t) => {
        const f = await setup(t);
        await f.post({ action: "toggle-round", roundId: f.roundId });
        const base = {
          action: "place-order",
          roundId: f.roundId,
          name: "同事",
          account: "retry-race",
          items: [{ menuItemId: f.menuItemId, quantity: 1 }],
          requestId: crypto.randomUUID(),
        };
        const { orderId } = await f.post(base, false);
        const retry = {
          ...base,
          mode: "replace",
          replaceOrderId: orderId,
          requestId: crypto.randomUUID(),
          note: "retry",
          items: [{ menuItemId: f.menuItemId, quantity: 2 }],
        };
        const batch = f.DB.batch.bind(f.DB);
        f.DB.batch = async (statements) => {
          f.DB.batch = batch;
          await f.post(
            { ...retry, note: samePayload ? retry.note : "different request" },
            false,
          );
          await f.post(
            {
              ...retry,
              requestId: crypto.randomUUID(),
              note: "latest",
              items: [{ menuItemId: f.menuItemId, quantity: 3 }],
            },
            false,
          );
          await f.post({ action: "toggle-round", roundId: f.roundId });
          return batch(statements);
        };
        const response = await f.post(retry, false, samePayload ? 200 : 409);
        if (samePayload) assert.equal(response.replayed, true);
        const saved = await (
          await f.fetch(`?roundId=${f.roundId}`, undefined, true)
        ).json();
        assert.equal(saved.orders.length, 1);
        assert.equal(saved.orders[0].note, "latest");
        assert.equal(saved.orders[0].items[0].quantity, 3);
      },
    );
});
test("a 30-item order stays within D1 bind limits and keeps each snapshot", async (t) => {
  const f = await setup(t);
  for (let i = 1; i < 30; i++)
    await f.post({
      action: "add-menu-item",
      restaurantId: f.restaurantId,
      name: `餐點 ${i}`,
      price: 100 + i,
    });
  await f.post({ action: "toggle-round", roundId: f.roundId });
  const menu = (await (await f.fetch(`?roundId=${f.roundId}`)).json()).menu;
  const prepare = f.DB.prepare;
  f.DB.prepare = (sql) => {
    const statement = prepare(sql);
    const bind = statement.bind;
    statement.bind = (...args) => {
      assert.ok(args.length <= 100, "D1 limits a statement to 100 bindings");
      return bind(...args);
    };
    return statement;
  };
  await f.post(
    {
      action: "place-order",
      roundId: f.roundId,
      name: "同事",
      account: "large-order",
      requestId: crypto.randomUUID(),
      items: menu.map((item) => ({ menuItemId: item.id, quantity: 1 })),
    },
    false,
  );
  const snapshot = await (
    await f.fetch(`?roundId=${f.roundId}`, undefined, true)
  ).json();
  assert.equal(snapshot.orders[0].items.length, 30);
  assert.equal(
    snapshot.orderTotal,
    menu.reduce((sum, item) => sum + item.price, 0),
  );
  const rows = f.DB.sqlite
    .prepare(
      "SELECT oi.item_name, m.name FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id",
    )
    .all();
  assert.ok(rows.every((row) => row.item_name === row.name));
});
test("Worker serves built Vue assets and refuses unknown APIs and unsupported methods", async () => {
  const response = await worker.fetch(new Request("http://test/"), {}, {});
  assert.equal(response.status, 200);
  assert.match(await response.text(), /id="app"/);
  assert.match(
    response.headers.get("content-security-policy"),
    /script-src 'self'/,
  );
  const head = await worker.fetch(
    new Request("http://test/", { method: "HEAD" }),
    {},
    {},
  );
  assert.equal(await head.text(), "");
  assert.equal(
    (await worker.fetch(new Request("http://test/api/missing"), {}, {})).status,
    404,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("http://test/api/ordering", { method: "DELETE" }),
        {},
        {},
      )
    ).status,
    405,
  );
});
test("content sync imports independent Site history and preserves concurrent changes", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "easy-eat-sync-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, remote = false, allowFailure = false, input) => ({
    ok: true,
    output: execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      input,
    }).trim(),
  });
  git(["init", "-q"]);
  git(["config", "user.name", "Sync Test"]);
  git(["config", "user.email", "sync@example.invalid"]);
  writeFileSync(path.join(root, "menu.txt"), "original menu\n");
  git(["add", "."]);
  git(["commit", "-qm", "GitHub original"]);
  const github = git(["rev-parse", "HEAD"]).output,
    base = git(["rev-parse", "HEAD^{tree}"]).output;
  const siteRoot = git(
    ["commit-tree", base],
    false,
    false,
    "Independent Site history\n",
  ).output;
  writeFileSync(path.join(root, "menu.txt"), "edited in Sites\n");
  git(["add", "."]);
  const siteTree = git(["write-tree"]).output,
    site = git(
      ["commit-tree", siteTree, "-p", siteRoot],
      false,
      false,
      "Edit from Sites\n",
    ).output;
  const imported = importSitesSnapshot(git, github, site);
  assert.equal(git(["show", `${imported}:menu.txt`]).output, "edited in Sites");
  assert.equal(git(["rev-parse", `${imported}^{tree}`]).output, siteTree);
  assert.equal(git(["show", `${github}:menu.txt`]).output, "original menu");
  assertContentSyncSafe(siteTree, siteTree, base);
  assertContentSyncSafe(siteTree, base, base);
  assert.throws(
    () => assertContentSyncSafe("other-github-tree", siteTree, base),
    /不同修改/,
  );
});
