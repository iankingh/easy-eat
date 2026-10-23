import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLocalD1 } from "../scripts/local-d1.mjs";
import { syncPlan } from "../scripts/sync-repositories.mjs";
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
test("bidirectional sync accepts either remote advancing and blocks conflicting histories", () => {
  const ancestor = (a, b) =>
    a === b || ({ a: ["b", "c"], b: ["c"], c: [] }[a] || []).includes(b);
  assert.deepEqual(syncPlan("a", "b", "a", ancestor), {
    target: "b",
    fastForward: true,
    publishable: false,
  });
  assert.deepEqual(syncPlan("a", "a", "b", ancestor), {
    target: "b",
    fastForward: true,
    publishable: false,
  });
  assert.deepEqual(syncPlan("c", "a", "b", ancestor), {
    target: "c",
    fastForward: false,
    publishable: true,
  });
  assert.throws(() => syncPlan("a", "b", "fork", ancestor), /分歧/);
  assert.throws(() => syncPlan("fork", "a", "b", ancestor), /分歧/);
});
