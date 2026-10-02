"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MenuItem = { id: number; name: string; description: string; price: number; available: number };
type Round = { id: number; title: string; orderDate: string; closesAt: string; status: "open" | "closed" };
type RoundSummary = Round & { orderCount: number; orderTotal: number };
type Order = { id: number; name: string; account: string; note: string; status: "new" | "received"; items: { name: string; quantity: number; price: number }[]; total: number };
type Data = { round: Round; menu: MenuItem[]; orders: Order[]; orderCount: number; orderTotal: number; rounds: RoundSummary[] };

const money = (amount: number) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(amount);
const restaurantChoices = ["藍色給力", "綠色給力", "八方"];
const todayInTaipei = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());

export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"order" | "admin">("order");
  const [adminCode, setAdminCode] = useState("");
  const [adminReady, setAdminReady] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "" });
  const [groupTitle, setGroupTitle] = useState("");
  const [deadline, setDeadline] = useState("10:30");
  const [selectedRoundId, setSelectedRoundId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("round") || "");
  const [newRound, setNewRound] = useState({ title: "", orderDate: todayInTaipei(), deadline: "10:30" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const query = selectedRoundId ? `?roundId=${encodeURIComponent(selectedRoundId)}` : "";
      const response = await fetch(`/api/ordering${query}`, { cache: "no-store", headers: tab === "admin" && adminReady ? { "x-admin-code": adminCode } : {} });
      if (!response.ok) throw new Error("目前無法讀取點餐資料。");
      setData(await response.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "讀取失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }, [adminCode, adminReady, selectedRoundId, tab]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!data) return;
    setGroupTitle(data.round.title);
    setDeadline(data.round.closesAt.slice(11, 16));
  }, [data?.round.id, data?.round.title, data?.round.closesAt]);

  const selectedTotal = useMemo(() => data?.menu.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 0), 0) ?? 0, [data, quantities]);
  const selectedCount = useMemo(() => Object.values(quantities).reduce((sum, qty) => sum + qty, 0), [quantities]);

  async function mutate(body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/ordering", { method: "POST", headers: { "content-type": "application/json", ...(body.action === "place-order" ? {} : { "x-admin-code": adminCode }) }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "操作失敗，請稍後再試。");
    await refresh();
    return result;
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const items = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ menuItemId: Number(id), quantity }));
      await mutate({ action: "place-order", roundId: data?.round.id, name: employeeName.trim(), account: account.trim(), note: note.trim(), items });
      setQuantities({}); setNote("");
      setMessage("訂單已送出，管理者可以在後台查看。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "送出失敗。"); }
  }

  async function addMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutate({ action: "add-menu-item", roundId: data?.round.id, ...newItem, price: Number(newItem.price) });
      setNewItem({ name: "", description: "", price: "" });
      setMessage("餐點已加入菜單。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "新增失敗。"); }
  }

  async function saveRound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await mutate({ action: "update-round", roundId: data?.round.id, title: groupTitle, deadline }); setMessage("團購設定已儲存。"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "設定儲存失敗。"); }
  }

  function selectRound(roundId: number | string) {
    const id = String(roundId);
    setSelectedRoundId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("round", id);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function createRound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await mutate({ action: "create-round", ...newRound }) as { roundId: number };
      setNewRound({ title: "", orderDate: todayInTaipei(), deadline: "10:30" });
      selectRound(result.roundId);
      setMessage("新團已建立；新增餐點後即可產生點餐連結並開放。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "建立團購失敗。"); }
  }

  async function copyRoundLink(roundId: number) {
    const link = `${window.location.origin}/?round=${roundId}`;
    try { await navigator.clipboard.writeText(link); setMessage("這團的點餐連結已複製。"); }
    catch { window.prompt("複製這團的點餐連結", link); }
  }

  async function verifyAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch("/api/ordering", { method: "POST", headers: { "content-type": "application/json", "x-admin-code": adminCode }, body: JSON.stringify({ action: "admin-check" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "管理碼不正確。");
      const query = selectedRoundId ? `?roundId=${encodeURIComponent(selectedRoundId)}` : "";
      const snapshot = await fetch(`/api/ordering${query}`, { cache: "no-store", headers: { "x-admin-code": adminCode } });
      if (!snapshot.ok) throw new Error("無法載入管理資料，請重試。");
      setData(await snapshot.json());
      setAdminReady(true);
      setMessage("後台已解鎖。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "無法解鎖後台。"); }
  }

  async function runAdmin(action: string, extra: Record<string, unknown> = {}) {
    try {
      await mutate({ action, roundId: data?.round.id, ...extra });
      const messages: Record<string, string> = { "toggle-round": "團購狀態已更新。", "toggle-order": "訂單狀態已更新。", "toggle-menu-item": "餐點供應狀態已更新。", "remove-menu-item": "餐點已從今日菜單移除。" };
      setMessage(messages[action] || "設定已更新。");
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "操作失敗。"); }
  }

  useEffect(() => {
    type ToolContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: unknown) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ToolContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const reportError = (error: unknown) => console.error("點餐工具註冊失敗", error);
    void Promise.resolve(context.registerTool({
      name: "read_lunch_menu",
      title: "查看今日午餐菜單",
      description: "讀取目前這團的名稱、截止時間、餐點、價格與供應狀態。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute() {
        const query = selectedRoundId ? `?roundId=${encodeURIComponent(selectedRoundId)}` : "";
        const response = await fetch(`/api/ordering${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("目前無法讀取午餐菜單。");
        const snapshot = await response.json() as Data;
        return { roundId: snapshot.round.id, round: snapshot.round, menu: snapshot.menu.map(item => ({ id: item.id, name: item.name, description: item.description, price: item.price, available: Boolean(item.available) })) };
      },
    }, { signal: lifecycle.signal })).catch(reportError);
    void Promise.resolve(context.registerTool({
      name: "submit_lunch_order",
      title: "送出午餐訂單",
      description: "替同事送出今日午餐訂單，需提供姓名、帳號和至少一份可供應的餐點。送出後會建立正式訂單。",
      inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 60 }, account: { type: "string", minLength: 1, maxLength: 80 }, note: { type: "string", maxLength: 160 }, items: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", properties: { menuItemId: { type: "integer" }, quantity: { type: "integer", minimum: 1, maximum: 20 } }, required: ["menuItemId", "quantity"], additionalProperties: false } } }, required: ["name", "account", "items"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const query = selectedRoundId ? `?roundId=${encodeURIComponent(selectedRoundId)}` : "";
        const snapshotResponse = await fetch(`/api/ordering${query}`, { cache: "no-store" });
        const snapshot = await snapshotResponse.json() as Data;
        const response = await fetch("/api/ordering", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(input as Record<string, unknown>), roundId: snapshot.round.id, action: "place-order" }) });
        const result = await response.json();
        if (!response.ok) throw new Error((result as { error?: string }).error || "訂單送出失敗。");
        await refresh();
        setMessage("訂單已送出。");
        return { status: "submitted", message: "午餐訂單已送出。" };
      },
    }, { signal: lifecycle.signal })).catch(reportError);
    return () => lifecycle.abort();
  }, [refresh, selectedRoundId]);

  const totalOrders = data?.orderCount ?? 0;
  const orderTotal = data?.orderTotal ?? 0;

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#18202b]">
      <header className="border-b border-[#e1e6eb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <a href="#main" className="flex items-center gap-3" aria-label="同事午餐團訂首頁">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#163d35] text-xl text-white" aria-hidden="true">午</span>
            <span><span className="block text-base font-bold tracking-tight">午餐團訂</span><span className="block text-sm text-[#65727e]">今天吃什麼，一起決定</span></span>
          </a>
          <nav className="flex rounded-xl bg-[#f1f4f5] p-1" aria-label="主要功能">
            <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "order" ? "bg-white text-[#163d35] shadow-sm" : "text-[#65727e]"}`} onClick={() => setTab("order")}>我要點餐</button>
            <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "admin" ? "bg-white text-[#163d35] shadow-sm" : "text-[#65727e]"}`} onClick={() => setTab("admin")}>管理後台</button>
          </nav>
        </div>
      </header>

      <div id="main" className="mx-auto grid max-w-6xl gap-7 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:py-10">
        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-bold tracking-wide text-[#a65c36]">{tab === "order" ? "DAILY LUNCH" : "ORDER CONTROL"}</p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tab === "order" ? (data?.round.title || "團購點餐") : "團購管理"}</h1>
              <p className="mt-2 text-base text-[#65727e]">{tab === "order" ? "選好餐點、留下姓名與帳號，送出就完成。" : "建立團次、查看不同訂單，並管理各團點餐連結。"}</p>
            </div>
            <button onClick={() => void refresh()} className="rounded-xl border border-[#d9e0e4] bg-white px-4 py-2.5 text-sm font-semibold text-[#40505c] hover:bg-[#f8fafb]">重新整理</button>
          </div>

          {message && <div role="status" className="mb-5 rounded-xl border border-[#c7ded3] bg-[#edf7f1] px-4 py-3 text-sm font-medium text-[#245c45]">{message}</div>}
          {loading && <div className="rounded-2xl border border-[#e1e6eb] bg-white p-8 text-[#65727e]">載入點餐資料中…</div>}
          {!loading && data && (tab === "order" ? (
            <form onSubmit={submitOrder} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#163d35] p-5 text-white sm:p-6">
                <div><p className="text-sm font-medium text-white/70">{data.round.title}</p><p className="mt-1 text-lg font-bold">{data.round.status === "open" ? "開放點餐中" : "本團已截止"}</p></div>
                <div className="rounded-xl bg-white/10 px-4 py-2 text-sm"><span className="text-white/70">截止時間</span><span className="ml-2 font-semibold">{new Date(data.round.closesAt).toLocaleString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span></div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.menu.map(item => <article key={item.id} className={`rounded-2xl border bg-white p-5 ${item.available ? "border-[#e1e6eb]" : "border-[#eceff1] opacity-55"}`}>
                  <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-1 text-sm text-[#65727e]">{item.description}</p></div><span className="whitespace-nowrap text-lg font-bold text-[#a65c36]">{money(item.price)}</span></div>
                  <div className="mt-5 flex items-center justify-between"><span className={`text-sm font-medium ${item.available ? "text-[#537367]" : "text-[#8b5d55]"}`}>{item.available ? "供應中" : "今日售完"}</span><div className="flex items-center gap-3"><button type="button" aria-label={`減少${item.name}`} disabled={!item.available || !(quantities[item.id] ?? 0)} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 0) - 1) }))} className="h-9 w-9 rounded-lg border border-[#d9e0e4] text-lg font-semibold disabled:opacity-35">−</button><span className="w-5 text-center font-bold">{quantities[item.id] ?? 0}</span><button type="button" aria-label={`增加${item.name}`} disabled={!item.available} onClick={() => setQuantities(q => ({ ...q, [item.id]: (q[item.id] ?? 0) + 1 }))} className="h-9 w-9 rounded-lg bg-[#163d35] text-lg font-semibold text-white disabled:opacity-35">＋</button></div></div>
                </article>)}
              </div>

              <div className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6">
                <h2 className="text-lg font-bold">填寫訂購資料</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">姓名<input required maxLength={60} value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="例如：王小明" className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal outline-none focus:border-[#568174] focus:ring-2 focus:ring-[#568174]/20" /></label>
                  <label className="text-sm font-semibold">帳號<input required maxLength={80} value={account} onChange={e => setAccount(e.target.value)} placeholder="公司帳號或員工編號" className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal outline-none focus:border-[#568174] focus:ring-2 focus:ring-[#568174]/20" /></label>
                </div>
                <label className="mt-4 block text-sm font-semibold">備註 <span className="font-normal text-[#7a8791]">（選填）</span><input maxLength={160} value={note} onChange={e => setNote(e.target.value)} placeholder="例如：不要香菜、醬料分開" className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal outline-none focus:border-[#568174] focus:ring-2 focus:ring-[#568174]/20" /></label>
              </div>
              <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dce4e5] bg-white/95 p-4 shadow-[0_8px_28px_rgba(22,61,53,0.10)] backdrop-blur sm:px-6"><div><p className="text-sm text-[#65727e]">{selectedCount} 份餐點</p><p className="text-xl font-bold">合計 {money(selectedTotal)}</p></div><button disabled={data.round.status !== "open" || selectedCount === 0} className="rounded-xl bg-[#163d35] px-6 py-3 text-base font-bold text-white hover:bg-[#21574b] disabled:cursor-not-allowed disabled:bg-[#9eaaa6]">{data.round.status === "open" ? "送出訂單" : "已截止"}</button></div>
            </form>
          ) : !adminReady ? (
            <form onSubmit={verifyAdmin} className="max-w-xl rounded-2xl border border-[#e1e6eb] bg-white p-6">
              <h2 className="text-xl font-bold">管理者登入</h2><p className="mt-2 text-base leading-6 text-[#65727e]">輸入管理碼以查看同事訂單與調整菜單。管理碼只會在你的瀏覽器中使用。</p>
              <label className="mt-5 block text-sm font-semibold">管理碼<input required type="password" autoComplete="current-password" value={adminCode} onChange={e => setAdminCode(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal outline-none focus:border-[#568174] focus:ring-2 focus:ring-[#568174]/20" /></label>
              <button className="mt-4 rounded-xl bg-[#163d35] px-5 py-3 font-bold text-white">登入管理後台</button>
            </form>
          ) : (
            <div className="space-y-5">
              <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6">
                <div className="mb-4"><h2 className="text-lg font-bold">建立新團</h2><p className="mt-1 text-sm text-[#65727e]">每一團都有自己的訂單、菜單與點餐連結；建立後先關閉，準備好再開放。</p></div>
                <div className="mb-4"><p className="mb-2 text-sm font-semibold">快速選店</p><div className="flex flex-wrap gap-2">
                  {restaurantChoices.map(restaurant => <button key={restaurant} type="button" aria-pressed={newRound.title === restaurant} onClick={() => setNewRound(value => ({ ...value, title: restaurant }))} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${newRound.title === restaurant ? "border-[#163d35] bg-[#163d35] text-white" : "border-[#d9e0e4] text-[#40505c] hover:bg-[#f4f6f8]"}`}>{restaurant}</button>)}
                  <button type="button" onClick={() => setNewRound(value => ({ ...value, title: restaurantChoices[Math.floor(Math.random() * restaurantChoices.length)] }))} className="rounded-xl border border-[#d9e0e4] bg-[#fff7ef] px-4 py-2.5 text-sm font-bold text-[#8f4f2d] hover:bg-[#fff0e2]">🎲 隨機選一家</button>
                </div></div>
                <form onSubmit={createRound} className="grid gap-4 sm:grid-cols-[1fr_170px_150px_auto] sm:items-end">
                  <label className="text-sm font-semibold">團購名稱<input required maxLength={100} value={newRound.title} onChange={e => setNewRound(value => ({ ...value, title: e.target.value }))} placeholder="例如：八方" className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal" /></label>
                  <label className="text-sm font-semibold">團購日期<input required type="date" min={todayInTaipei()} value={newRound.orderDate} onChange={e => setNewRound(value => ({ ...value, orderDate: e.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal" /></label>
                  <label className="text-sm font-semibold">截止時間<input required type="time" value={newRound.deadline} onChange={e => setNewRound(value => ({ ...value, deadline: e.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal" /></label>
                  <button className="h-12 rounded-xl bg-[#163d35] px-5 font-bold text-white">建立團購</button>
                </form>
              </section>

              <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">所有團次</h2><p className="mt-1 text-sm text-[#65727e]">選擇團次查看訂單，或複製該團的點餐連結。</p></div><span className="rounded-full bg-[#f1f4f5] px-3 py-1 text-sm font-semibold">{data.rounds.length} 團</span></div>
                {data.rounds.length === 0 ? <p className="rounded-xl bg-[#f5f7f8] p-4 text-sm text-[#65727e]">目前沒有團次。</p> : <div className="space-y-2">{data.rounds.map(round => <article key={round.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${String(round.id) === selectedRoundId ? "border-[#7a9a8f] bg-[#f2f7f4]" : "border-[#e7ecef]"}`}><div className="min-w-[180px] flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{round.title}</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${round.status === "open" ? "bg-[#e8f4ed] text-[#286148]" : "bg-[#f1f4f5] text-[#65727e]"}`}>{round.status === "open" ? "開放中" : "已關閉"}</span></div><p className="mt-1 text-sm text-[#65727e]">{round.orderDate}　·　{round.orderCount} 人　·　{money(round.orderTotal)}</p></div><div className="flex flex-wrap gap-2">{round.status === "open" && <button onClick={() => void runAdmin("toggle-round", { roundId: round.id })} className="rounded-lg border border-[#d9e0e4] px-3 py-2 text-sm font-semibold text-[#934c29]">關閉訂單</button>}<button onClick={() => selectRound(round.id)} className="rounded-lg border border-[#d9e0e4] px-3 py-2 text-sm font-semibold">管理這團</button><button onClick={() => void copyRoundLink(round.id)} className="rounded-lg bg-[#163d35] px-3 py-2 text-sm font-semibold text-white">複製點餐連結 🔗</button></div></article>)}</div>}
              </section>

              <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6">
                <div className="mb-4"><h2 className="text-lg font-bold">設定所選團次</h2><p className="mt-1 text-sm text-[#65727e]">更新團名或截止時間；完成菜單後，可以在訂單狀態區開放點餐。</p></div>
                <div className="mb-4">
                  <p className="mb-2 text-sm font-semibold">快速選店</p>
                  <div className="flex flex-wrap gap-2">
                    {restaurantChoices.map(restaurant => <button key={restaurant} type="button" aria-pressed={groupTitle === restaurant} onClick={() => setGroupTitle(restaurant)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${groupTitle === restaurant ? "border-[#163d35] bg-[#163d35] text-white" : "border-[#d9e0e4] bg-white text-[#40505c] hover:bg-[#f4f6f8]"}`}>{restaurant}</button>)}
                    <button type="button" onClick={() => setGroupTitle(restaurantChoices[Math.floor(Math.random() * restaurantChoices.length)])} className="rounded-xl border border-[#d9e0e4] bg-[#fff7ef] px-4 py-2.5 text-sm font-bold text-[#8f4f2d] hover:bg-[#fff0e2]">🎲 隨機選一家</button>
                  </div>
                </div>
                <form onSubmit={saveRound} className="grid gap-4 sm:grid-cols-[1fr_170px_auto] sm:items-end">
                  <label className="text-sm font-semibold">團購名稱<input required maxLength={100} value={groupTitle} onChange={e => setGroupTitle(e.target.value)} placeholder="例如：小林海南雞飯" className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal" /></label>
                  <label className="text-sm font-semibold">截止時間<input required type="time" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] px-3 text-base font-normal" /></label>
                  <button className="h-12 rounded-xl bg-[#163d35] px-5 font-bold text-white">儲存團購設定</button>
                </form>
              </section>
              <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#65727e]">{data.round.title}</p><h2 className="mt-1 text-2xl font-bold">{totalOrders} 筆訂單 <span className="text-[#a65c36]">· {money(orderTotal)}</span></h2><p className="mt-1 text-sm text-[#65727e]">目前{data.round.status === "open" ? "開放中" : "已截止"}，截止時間 {new Date(data.round.closesAt).toLocaleString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p></div><button onClick={() => void runAdmin("toggle-round")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${data.round.status === "open" ? "bg-[#fff0e6] text-[#934c29]" : "bg-[#e8f4ed] text-[#286148]"}`}>{data.round.status === "open" ? "結束本次團購" : "重新開放點餐"}</button></div>
              </section>

              <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">訂單明細</h2><button onClick={() => window.print()} className="rounded-lg border border-[#d9e0e4] px-3 py-2 text-sm font-semibold">列印／另存</button></div>
                {data.orders.length === 0 ? <p className="rounded-xl bg-[#f5f7f8] p-5 text-base text-[#65727e]">還沒有同事送出訂單。</p> : <div className="space-y-3">{data.orders.map(order => <article key={order.id} className="rounded-xl border border-[#e7ecef] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{order.name}<span className="ml-2 text-sm font-medium text-[#65727e]">{order.account}</span></p><p className="mt-1 text-sm text-[#65727e]">{order.items.map(item => `${item.name} × ${item.quantity}`).join("、")}{order.note ? `　｜　${order.note}` : ""}</p></div><div className="flex items-center gap-3"><strong>{money(order.total)}</strong><button onClick={() => void runAdmin("toggle-order", { orderId: order.id })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${order.status === "received" ? "bg-[#e8f4ed] text-[#286148]" : "bg-[#f1f4f5] text-[#576672]"}`}>{order.status === "received" ? "已確認" : "未確認"}</button></div></div></article>)}</div>}
              </section>

              <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">管理今日菜單</h2><form onSubmit={addMenuItem} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr_110px_auto]"><input required maxLength={80} value={newItem.name} onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))} placeholder="餐點名稱" className="h-11 rounded-lg border border-[#d9e0e4] px-3 text-base"/><input maxLength={160} value={newItem.description} onChange={e => setNewItem(v => ({ ...v, description: e.target.value }))} placeholder="簡短說明" className="h-11 rounded-lg border border-[#d9e0e4] px-3 text-base"/><input required min="1" type="number" value={newItem.price} onChange={e => setNewItem(v => ({ ...v, price: e.target.value }))} placeholder="價格" className="h-11 rounded-lg border border-[#d9e0e4] px-3 text-base"/><button className="h-11 rounded-lg bg-[#163d35] px-4 font-bold text-white">新增餐點</button></form><div className="mt-4 divide-y divide-[#edf0f2]">{data.menu.map(item => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div><span className="font-semibold">{item.name}</span><span className="ml-3 text-sm text-[#65727e]">{money(item.price)}</span></div><div className="flex items-center gap-2"><button onClick={() => void runAdmin("toggle-menu-item", { menuItemId: item.id })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${item.available ? "bg-[#e8f4ed] text-[#286148]" : "bg-[#f1f4f5] text-[#65727e]"}`}>{item.available ? "供應中" : "售完"}</button><button onClick={() => { if (window.confirm(`確定從今日菜單移除「${item.name}」？`)) void runAdmin("remove-menu-item", { menuItemId: item.id }); }} className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#8a514a] hover:bg-[#fff1ef]">移除</button></div></div>)}</div>{data.menu.length === 0 && <p className="mt-4 text-sm text-[#65727e]">先新增今日供應的餐點，再開放同事點餐。</p>}</section>
            </div>
          ))}
        </section>

        <aside className="space-y-4 lg:pt-[76px]">
          <section className="rounded-2xl border border-[#e1e6eb] bg-white p-5"><p className="text-sm font-semibold text-[#65727e]">本團點餐狀況</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f4f6f8] p-3"><p className="text-sm text-[#65727e]">訂購人數</p><p className="mt-1 text-2xl font-bold">{totalOrders}<span className="ml-1 text-sm font-medium">人</span></p></div><div className="rounded-xl bg-[#f4f6f8] p-3"><p className="text-sm text-[#65727e]">訂單總額</p><p className="mt-1 text-xl font-bold">{money(orderTotal)}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-[#edf0f2] pt-4 text-sm"><span className="text-[#65727e]">團購狀態</span><span className={`font-bold ${data?.round.status === "open" ? "text-[#286148]" : "text-[#934c29]"}`}>● {data?.round.status === "open" ? "開放中" : "已截止"}</span></div></section>
          <section className="rounded-2xl bg-[#e8efec] p-5"><p className="font-bold text-[#254b41]">點餐小提醒</p><p className="mt-2 text-sm leading-6 text-[#526b63]">送出前請確認姓名、帳號與餐點。若要修改已送出的內容，請聯絡團購管理者。</p></section>
        </aside>
      </div>
    </main>
  );
}
