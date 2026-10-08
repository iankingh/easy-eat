"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Restaurant = { id: number; name: string; menuCount: number };
type Meal = { id: number; name: string; description: string; price: number };
type Catalog = { restaurants: Restaurant[]; restaurant: Restaurant | null; menu: Meal[] };
type Props = {
  adminCode: string;
  restaurantId: string;
  onSelect: (id: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  runTask: <T>(label: string, task: () => Promise<T>) => Promise<T>;
};
const inputClass = "mt-2 h-12 w-full rounded-xl border border-[#d9e0e4] bg-white px-3 text-base font-normal";
const emptyMeal = { name: "", description: "", price: "" };

async function readResponse<T>(response: Response): Promise<T> {
  let result: T & { error?: string };
  try { result = await response.json(); }
  catch { throw new Error("餐廳資料回應異常，請重新載入後再試。"); }
  if (!response.ok) throw new Error(result.error || "操作未完成，請重新載入餐廳資料後再試。");
  return result;
}

export default function RestaurantManager({ adminCode, restaurantId, onSelect, onSuccess, onError, runTask }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [meal, setMeal] = useState(emptyMeal);
  const [editing, setEditing] = useState<(typeof emptyMeal & { id: number }) | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const loadVersion = useRef(0);

  const load = useCallback(async (id = restaurantId) => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const query = id ? `&restaurantId=${encodeURIComponent(id)}` : "";
      const response = await fetch(`/api/ordering?view=restaurants${query}`, { cache: "no-store", headers: { "x-admin-code": adminCode }, signal: AbortSignal.timeout(20000) });
      const snapshot = await readResponse<Catalog>(response);
      if (version === loadVersion.current) setCatalog(snapshot);
    } finally { if (version === loadVersion.current) setLoading(false); }
  }, [adminCode, restaurantId]);

  useEffect(() => {
    setMeal(emptyMeal); setEditing(null); setRemoving(null);
    void load().catch(error => onError(error instanceof Error ? error.message : "餐廳資料讀取失敗，請重新載入。"));
    return () => { loadVersion.current++; };
  }, [load, onError]);

  async function save(body: Record<string, unknown>, label: string, success: string) {
    try {
      await runTask(label, async () => {
        const response = await fetch("/api/ordering", { method: "POST", headers: { "content-type": "application/json", "x-admin-code": adminCode }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
        const result = await readResponse<{ restaurantId?: number }>(response);
        const id = result.restaurantId ? String(result.restaurantId) : restaurantId || String(catalog?.restaurant?.id || "");
        // Reload the saved restaurant even if the server selected the first one for this visit.
        try { await load(id); }
        catch { onSuccess(`${success} 最新菜單尚未載入，請按「重新載入」確認，請勿重複新增。`); return; }
        if (result.restaurantId) { setName(""); onSelect(id); }
        setMeal(emptyMeal); setEditing(null); setRemoving(null);
        onSuccess(success);
      });
    } catch (error) {
      onError(error instanceof Error && error.name === "TimeoutError" ? "操作逾時，無法確認是否已儲存。請重新載入查看結果，再決定是否重試。" : error instanceof TypeError ? "網路連線中斷。請重新載入確認餐廳與餐點是否已新增，再決定是否重試。" : error instanceof Error ? error.message : "儲存失敗，請檢查輸入後再試。");
    }
  }

  const selected = catalog?.restaurant;
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="space-y-5 rounded-2xl border border-[#e1e6eb] bg-white p-5">
        <div><h2 className="text-lg font-bold">餐廳列表</h2><button type="button" onClick={() => void load().catch(error => onError(error instanceof Error ? error.message : "重新載入失敗。"))} className="mt-3 rounded-lg border border-[#d9e0e4] px-3 py-2 text-sm font-semibold">重新載入</button></div>
        <div className="space-y-2">{catalog?.restaurants.map(restaurant => <button type="button" key={restaurant.id} aria-pressed={selected?.id === restaurant.id} onClick={() => onSelect(String(restaurant.id))} className={`w-full rounded-xl border p-4 text-left ${selected?.id === restaurant.id ? "border-[#7a9a8f] bg-[#edf7f1]" : "border-[#e1e6eb] hover:bg-[#f4f6f8]"}`}><span className="block font-bold">{restaurant.name}</span><span className="mt-1 block text-sm text-[#65727e]">{restaurant.menuCount} 項餐點</span></button>)}</div>
        {!loading && !catalog?.restaurants.length && <p className="text-sm text-[#65727e]">還沒有餐廳，請先在下方新增。</p>}
        <form noValidate onSubmit={event => { event.preventDefault(); void save({ action: "create-restaurant", name }, "正在新增餐廳…", "餐廳已新增，可以開始輸入菜單。"); }} className="border-t border-[#e1e6eb] pt-5">
          <h3 className="font-bold">自訂新增餐廳</h3>
          <label className="mt-3 block text-sm font-semibold">餐廳名稱<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="自行輸入，例如：小巷健康餐" className={inputClass} /></label>
          <button type="submit" className="mt-3 w-full rounded-xl bg-[#163d35] px-4 py-3 font-bold text-white">新增餐廳</button>
        </form>
      </section>

      <section className="min-w-0 rounded-2xl border border-[#e1e6eb] bg-white p-5 sm:p-6" aria-busy={loading}>
        {loading ? <p role="status" className="p-5 text-[#65727e]">正在載入餐廳菜單…</p> : !selected ? <div className="p-5"><h2 className="text-xl font-bold">先新增餐廳，再輸入菜單</h2><p className="mt-3 text-[#65727e]">餐廳與菜單可獨立保存，準備完成後再到訂單管理開團。</p></div> : <>
          <h2 className="text-2xl font-bold">{selected.name} · 菜單管理</h2>
          <p className="mt-2 text-sm leading-6 text-[#65727e]">這份菜單會保存在餐廳中，之後每次開團都可沿用。名稱與價格的修改只更新菜單，已送出的訂單會保留原內容。</p>
          <form noValidate onSubmit={event => { event.preventDefault(); void save({ action: "add-menu-item", restaurantId: selected.id, ...meal, price: Number(meal.price) }, "正在新增餐點…", "餐點已加入這家餐廳的菜單。"); }} className="mt-5 rounded-xl bg-[#f4f6f8] p-4">
            <h3 className="font-bold">自訂輸入餐點</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
              <label className="text-sm font-semibold">餐點名稱<input required maxLength={80} value={meal.name} onChange={event => setMeal({ ...meal, name: event.target.value })} placeholder="例如：烤雞腿餐" className={inputClass} /></label>
              <label className="text-sm font-semibold">說明（選填）<input maxLength={160} value={meal.description} onChange={event => setMeal({ ...meal, description: event.target.value })} placeholder="例如：附湯、可選辣度" className={inputClass} /></label>
              <label className="text-sm font-semibold">價格<input required type="number" min="1" max="10000" value={meal.price} onChange={event => setMeal({ ...meal, price: event.target.value })} placeholder="元" className={inputClass} /></label>
            </div>
            <button type="submit" className="mt-4 rounded-xl bg-[#163d35] px-5 py-3 font-bold text-white">新增餐點</button>
          </form>
          <div className="mt-5 divide-y divide-[#edf0f2]">{catalog.menu.map(item => <div key={item.id} className="py-4">{editing?.id === item.id ? <form noValidate onSubmit={event => { event.preventDefault(); void save({ action: "update-menu-item", restaurantId: selected.id, menuItemId: editing.id, ...editing, price: Number(editing.price) }, "正在更新餐點…", "餐點已更新，已送出的訂單仍保留原名稱與價格。"); }} className="rounded-xl border border-[#dce8df] bg-[#f2f7f4] p-4"><div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px]"><label className="text-sm font-semibold">餐點名稱<input required maxLength={80} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} className={inputClass} /></label><label className="text-sm font-semibold">說明<input maxLength={160} value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} className={inputClass} /></label><label className="text-sm font-semibold">價格<input required type="number" min="1" max="10000" value={editing.price} onChange={event => setEditing({ ...editing, price: event.target.value })} className={inputClass} /></label></div><div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-[#163d35] px-4 py-2 font-bold text-white">儲存餐點</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-[#d9e0e4] bg-white px-4 py-2">取消編輯</button></div></form> : <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{item.name} <span className="ml-3 text-[#a65c36]">${item.price}</span></p>{item.description && <p className="mt-1 text-sm text-[#65727e]">{item.description}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => { setEditing({ ...item, price: String(item.price) }); setRemoving(null); }} className="rounded-lg border border-[#d9e0e4] px-3 py-2 text-sm font-semibold">編輯</button><button type="button" onClick={() => setRemoving(item.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#8a514a]">移除</button></div></div>}{removing === item.id && <div className="mt-3 rounded-xl bg-red-50 p-4 text-red-800"><p>確定從餐廳菜單移除「{item.name}」？同店各團的可選菜單會更新，已送出訂單會保留。</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void save({ action: "remove-menu-item", restaurantId: selected.id, menuItemId: item.id }, "正在移除餐點…", "餐點已從餐廳菜單移除。")} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white">確認移除</button><button type="button" onClick={() => setRemoving(null)} className="rounded-lg border border-red-200 bg-white px-4 py-2">取消</button></div></div>}</div>)}</div>
          {!catalog.menu.length && <p className="mt-5 rounded-xl bg-[#fff7ef] p-4 text-[#8f4f2d]">菜單尚無餐點，請在上方自行輸入名稱與價格。保存後開團就不必再輸入一次。</p>}
        </>}
      </section>
    </div>
  );
}
