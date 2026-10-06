## Context

Easy Eat 前端目前有 84 個通過的測試，但覆蓋率集中在 store 層與 mock server。API 層（`orderApi.ts`、`restaurantApi.ts`）與 Service 層（`orderService.ts`、`restaurantService.ts`）覆蓋率僅 ~6%，幾乎完全由 store 測試間接覆蓋。此外，7 個 View 元件中每個都手動重複 loading ref + try/catch + toast 的錯誤處理模式，且載入狀態只有純文字「載入中...」。

資料流為 `View → Store → Service → API → Mock Server → localStorage`。API 層是未來替換 mock server 為真實後端的交接點，其測試缺失是最大的技術債。

## Goals / Non-Goals

**Goals:**

- API 層與 Service 層達到可直接驗證的測試覆蓋率（目標 ≥80% statements）
- 消除 View 中重複的 loading + try/catch + toast 模式，統一為可重用 composable
- 載入狀態有視覺回饋（spinner），取代純文字提示

**Non-Goals:**

- 不新增業務功能或改變現有行為
- 不引入外部 UI 框架或依賴
- 不改動 mock server 或 API 介面契約
- 不補 View 元件測試（範圍過大，留待後續）
- 不補 store 層覆蓋率缺口（已達 70-83%，優先級較低）

## Decisions

### Decision: API 層測試以 mock server 為樁靶，驗證轉發與回傳

API 層（`orderApi.ts`、`restaurantApi.ts`）的職責是將呼叫轉發至 `mock/server.ts` 的對應函式並回傳結果。測試 SHALL 以 `vi.mock` 樁靶化 mock server 函式，驗證：
1. 正確的 mock server 函式被呼叫（含參數轉發）
2. 回傳值正確傳遞
3. 預設參數行為（如 `createOrder` 預設 status 為 `pending`）

**理由**: API 層是薄轉發層，測試重點在「轉發正確」而非「業務邏輯正確」（後者由 mock server 測試覆蓋）。

### Decision: Service 層測試以 API 層為樁靶，驗證呼叫與資料轉換

Service 層（`orderService.ts`、`restaurantService.ts`）的職責是呼叫 API 層並處理資料轉換（如 `mapOrderItemsToCreateInput`）。測試 SHALL 以 `vi.mock` 樁靶化 API 層，驗證：
1. 正確的 API 方法被呼叫
2. `mapOrderItemsToCreateInput` 正確將 `OrderItem[]` 轉為 `CreateOrderItemInput[]`
3. 回傳值正確傳遞

**理由**: 與 API 層相同邏輯，Service 層也是薄轉發 + 少量轉換，測試重點在轉發與轉換正確。

### Decision: useAsyncAction composable 封裝 loading + error + toast

抽出 `useAsyncAction` composable，提供 `run(action, options)` 方法，自動管理 loading ref 並在 try/catch 中呼叫 toast。View 元件以 `const { loading, run } = useAsyncAction()` 取代手動重複的 loading ref + try/catch + toast 模式。

**介面**:
```ts
function useAsyncAction(): {
  loading: Ref<boolean>
  run<T>(
    action: () => Promise<T>,
    options?: {
      successMessage?: string
      errorMessage?: string
    },
  ): Promise<T | undefined>
}
```

**理由**: 各 View 的錯誤處理模式高度一致（loading ref → try → toast.success → catch → toast.error → finally → loading = false），抽取後可消除約 20 處重複，同時確保錯誤處理行為統一。

### Decision: LoadingSpinner 以純 CSS 實作，不引入依賴

建立 `LoadingSpinner.vue` 元件，以 CSS animation 實作旋轉指示器。取代 `OrderListView` 與 `OrderDetailView` 中的純文字載入提示。

**理由**: 專案刻意不使用 UI 框架，一個輕量 CSS spinner 不需要任何新依賴，符合簡約原則。

## Implementation Contract

### useAsyncAction composable

**行為**: 呼叫 `run(action, options)` 時，`loading` ref 設為 `true`，執行 `action()`。成功時若有 `successMessage` 則呼叫 `toast.success`。失敗時呼叫 `toast.error(getErrorMessage(error, errorMessage))`。無論結果，`loading` ref 最終設為 `false`。

**介面**:
```ts
function useAsyncAction(): {
  loading: Readonly<Ref<boolean>>
  run<T>(action: () => Promise<T>, options?: { successMessage?: string; errorMessage?: string }): Promise<T | undefined>
}
```

**失敗模式**: `action()` 拋出錯誤時，`run` 回傳 `undefined`，錯誤訊息透過 toast 顯示，不重新拋出。

**驗收條件**:
- `useAsyncAction.test.ts` 驗證 loading 在呼叫前為 `false`、執行中為 `true`、完成後為 `false`
- 驗證成功時呼叫 `toast.success`（當提供 `successMessage`）
- 驗證失敗時呼叫 `toast.error` 且 `run` 回傳 `undefined`
- 驗證成功時 `run` 回傳 `action()` 的結果

**範圍**:
- In scope: `useAsyncAction.ts`、`useAsyncAction.test.ts`、4 個 View 的錯誤處理重構
- Out of scope: store 層的 loading 管理（store 有自己的 `loading` ref，不受此 composable 影響）

### LoadingSpinner 元件

**行為**: 接受 `size` prop（`'sm' | 'md' | 'lg'`，預設 `'md'`），顯示一個旋轉的 CSS spinner。無邏輯，純展示元件。

**介面**:
```ts
defineProps<{ size?: 'sm' | 'md' | 'lg' }>()
```

**驗收條件**:
- 元件渲染時 DOM 中存在帶有 `loading-spinner` class 的元素
- `size` prop 正確對應 CSS class（`loading-spinner--sm` / `loading-spinner--md` / `loading-spinner--lg`）

**範圍**:
- In scope: `LoadingSpinner.vue`、`OrderListView` 與 `OrderDetailView` 中替換純文字載入提示
- Out of scope: 其他 View 的載入狀態（除非目前已有純文字載入提示）

### API 層測試

**行為**: 測試 SHALL 樁靶化 `mock/server.ts` 的匯出函式，驗證 `orderApi` 與 `restaurantApi` 的每個方法正確轉發呼叫並回傳結果。

**驗收條件**:
- `orderApi.test.ts` 覆蓋 `orderApi` 的所有 8 個方法（list, detail, create, update, submit, remove, updateStatus, statistics）
- `restaurantApi.test.ts` 覆蓋 `restaurantApi` 的所有 14 個方法
- 每個測試驗證：對應的 mock server 函式被呼叫一次、參數正確轉發、回傳值正確傳遞
- `orderApi.create` 驗證預設 `status` 參數為 `pending`

**範圍**:
- In scope: `orderApi.test.ts`、`restaurantApi.test.ts`
- Out of scope: mock server 內部邏輯（已有 `server.test.ts` 覆蓋）

### Service 層測試

**行為**: 測試 SHALL 樁靶化 API 層，驗證 `orderService` 與 `restaurantService` 正確呼叫 API 並處理資料轉換。

**驗收條件**:
- `orderService.test.ts` 覆蓋所有 service 方法
- `orderService.mapOrderItemsToCreateInput` 驗證：將 `OrderItem[]` 正確轉為 `CreateOrderItemInput[]`（保留 `menuItemId`、`quantity`、`note`）
- `orderService.createOrder` 驗證預設 `status` 為 `pending`
- `restaurantService.test.ts` 覆蓋所有 service 方法

**範圍**:
- In scope: `orderService.test.ts`、`restaurantService.test.ts`
- Out of scope: API 層轉發邏輯（由 API 測試覆蓋）

## Risks / Trade-offs

- [風險] useAsyncAction 改變了 View 中的錯誤處理流程，可能影響 toast 的顯示時機 → 緩解：重構後逐個 View 手動驗證 toast 行為不變
- [風險] API/Service 測試以 vi.mock 樁靶化，若 mock server 介面變更，測試不會捕捉到 → 緩解：mock server 已有獨立測試（`server.test.ts`），介面變更會在那裡被捕捉
- [取捨] useAsyncAction 的 `run` 在失敗時回傳 `undefined` 而非重新拋出，這與直接 try/catch 行為不同 → 理由：View 中本來就不在 catch 中做恢復邏輯，回傳 undefined 更安全（避免呼叫端存取 undefined 結果）
