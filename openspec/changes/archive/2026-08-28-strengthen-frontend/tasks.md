## 1. API 層測試

- [x] [P] 1.1 建立 `easy-eat-front/src/api/orderApi.test.ts`（Decision: API 層測試以 mock server 為樁靶，驗證轉發與回傳），以 `vi.mock` 樁靶化 `mock/server.ts` 的匯出函式，驗證 `orderApi` 的所有 8 個方法（list, detail, create, update, submit, remove, updateStatus, statistics）正確轉發呼叫、參數傳遞、回傳值。驗證 `create` 的預設 `status` 參數為 `'pending'`。驗證方式：`npm test -- orderApi` 全部通過，覆蓋率報告顯示 `orderApi.ts` ≥80% statements。
- [x] [P] 1.2 建立 `easy-eat-front/src/api/restaurantApi.test.ts`（Decision: API 層測試以 mock server 為樁靶，驗證轉發與回傳），以 `vi.mock` 樁靶化 `mock/server.ts` 的所有相關匯出函式，驗證 `restaurantApi` 的所有 14 個方法正確轉發呼叫、參數傳遞、回傳值。驗證方式：`npm test -- restaurantApi` 全部通過，覆蓋率報告顯示 `restaurantApi.ts` ≥80% statements。

## 2. Service 層測試

- [x] [P] 2.1 建立 `easy-eat-front/src/services/orderService.test.ts`（Decision: Service 層測試以 API 層為樁靶，驗證呼叫與資料轉換），以 `vi.mock` 樁靶化 `api/orderApi`，驗證 `orderService` 的所有方法正確呼叫 API 層。驗證 `mapOrderItemsToCreateInput` 將 `OrderItem[]` 正確轉為 `CreateOrderItemInput[]`（保留 `menuItemId`、`quantity`、`note`）。驗證 `createOrder` 預設 `status` 為 `'pending'`。驗證方式：`npm test -- orderService` 全部通過，覆蓋率報告顯示 `orderService.ts` ≥80% statements。
- [x] [P] 2.2 建立 `easy-eat-front/src/services/restaurantService.test.ts`（Decision: Service 層測試以 API 層為樁靶，驗證呼叫與資料轉換），以 `vi.mock` 樁靶化 `api/restaurantApi`，驗證 `restaurantService` 的所有方法正確呼叫 API 層並回傳結果。驗證方式：`npm test -- restaurantService` 全部通過，覆蓋率報告顯示 `restaurantService.ts` ≥80% statements。

## 3. useAsyncAction composable

- [x] 3.1 建立 `easy-eat-front/src/composables/useAsyncAction.test.ts`（Decision: useAsyncAction composable 封裝 loading + error + toast），定義失敗測試驗證 Async action composable 的完整行為契約：`loading` 初始為 `false`、執行中為 `true`、完成後為 `false`；`run` 成功時回傳結果並在有 `successMessage` 時呼叫 `toast.success`；`run` 失敗時呼叫 `toast.error` 並回傳 `undefined`，不重新拋出。驗證方式：`npm test -- useAsyncAction` 執行後所有測試為 failing（Red 階段）。
- [x] 3.2 實作 `easy-eat-front/src/composables/useAsyncAction.ts`（Decision: useAsyncAction composable 封裝 loading + error + toast），提供 `loading`（read-only ref）與 `run(action, options)` 方法，封裝 loading 狀態管理與 toast 成功/錯誤通知。`run` 在失敗時回傳 `undefined` 並透過 `getErrorMessage` 處理錯誤訊息，不重新拋出。驗證方式：`npm test -- useAsyncAction` 全部通過（Green 階段）。

## 4. LoadingSpinner component

- [x] 4.1 建立 `easy-eat-front/src/components/LoadingSpinner.test.ts`（Decision: LoadingSpinner 以純 CSS 實作，不引入依賴 — LoadingSpinner 元件），定義失敗測試驗證 Loading spinner component 行為：預設 `size` 為 `'md'`；渲染元素帶有 `loading-spinner` class 與對應 size 修飾 class（`loading-spinner--sm` / `loading-spinner--md` / `loading-spinner--lg`）。驗證方式：`npm test -- LoadingSpinner` 執行後所有測試為 failing（Red 階段）。
- [x] 4.2 實作 `easy-eat-front/src/components/LoadingSpinner.vue`（Decision: LoadingSpinner 以純 CSS 實作，不引入依賴 — LoadingSpinner 元件），以純 CSS animation 實作旋轉指示器，接受 `size` prop（`'sm' | 'md' | 'lg'`，預設 `'md'`），不引入外部依賴。驗證方式：`npm test -- LoadingSpinner` 全部通過（Green 階段）。

## 5. View 重構

- [x] [P] 5.1 重構 `easy-eat-front/src/views/OrderListView.vue`，以 `useAsyncAction` 取代手動 loading ref + try/catch + toast 模式（`submitDraft`、`deleteOrder`、`changeStatus`），以 `LoadingSpinner` 取代純文字載入提示。驗證方式：`npm test -- OrderListView` 通過且 `npm run type-check` 無錯誤；手動驗證 toast 成功/錯誤訊息與重構前一致。
- [x] [P] 5.2 重構 `easy-eat-front/src/views/OrderDetailView.vue`，以 `useAsyncAction` 取代手動 loading ref + try/catch + toast 模式（`submitDraft`、`changeStatus`），以 `LoadingSpinner` 取代純文字載入提示。驗證方式：`npm test -- OrderDetailView` 通過且 `npm run type-check` 無錯誤；手動驗證 toast 成功/錯誤訊息與重構前一致。
- [x] [P] 5.3 重構 `easy-eat-front/src/views/OrderAddView.vue`，以 `useAsyncAction` 取代手動 saving ref + try/catch + toast 模式（`createOrder`）。驗證方式：`npm run type-check` 無錯誤；手動驗證 toast 成功/錯誤訊息與重構前一致。
- [x] [P] 5.4 重構 `easy-eat-front/src/views/OrderEditView.vue`，以 `useAsyncAction` 取代手動 loading ref + try/catch + toast 模式。驗證方式：`npm run type-check` 無錯誤；手動驗證 toast 成功/錯誤訊息與重構前一致。

## 6. 驗證

- [x] 6.1 執行完整測試套件與覆蓋率報告，驗證 API 層與 Service 層覆蓋率 ≥80% statements，且所有測試通過。驗證方式：`npm test -- --coverage` 全部通過，覆蓋率報告確認 `api/` 與 `services/` 目錄 ≥80%。
- [x] 6.2 執行型別檢查、lint 與格式檢查，確認無錯誤。驗證方式：`npm run check` 全部通過。
