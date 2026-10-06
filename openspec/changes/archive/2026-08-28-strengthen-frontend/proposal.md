## Why

前端測試覆蓋率存在明顯缺口：API 層與 Service 層僅 ~6% 覆蓋率，View 元件完全無測試。同時各 View 重複相同的 loading + try/catch + toast 錯誤處理模式，且載入狀態只有純文字提示。這些問題在未來串接後端時會放大風險——API 層是 mock 替換的交接點，缺乏測試保護將使替換引入難以察覺的 regression。

## What Changes

- 補充 `orderApi.ts`、`restaurantApi.ts` 的直接測試，驗證其正確轉發至 mock server 並回傳預期型別
- 補充 `orderService.ts`、`restaurantService.ts` 的測試，驗證其正確呼叫 API 層並處理 `mapOrderItemsToCreateInput` 等轉換邏輯
- 抽出 `useAsyncAction` composable，封裝 loading ref + try/catch + toast.error/success 的重複模式，取代各 View 中手動重複的錯誤處理
- 加入輕量 CSS載入 spinner 元件，取代現有「載入中...」純文字提示，用於 `OrderListView` 與 `OrderDetailView` 的載入狀態

## Non-Goals

- 不新增任何業務功能或改變現有行為
- 不引入 UI 框架或外部依賴（spinner 以純 CSS 實作）
- 不改動 mock server 或 API 層的介面契約
- 不處理 View 元件的測試（範圍過大，留待後續變更）
- 不處理 store 層的覆蓋率缺口（已達 70-83%，優先補 API/Service 層）

## Capabilities

### New Capabilities

- `async-feedback`: 非同步操作的使用者回饋模式，封裝 loading 狀態管理與 toast 成功/錯誤通知，以及載入中的視覺指示器

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `async-feedback` capability spec
- Affected code:
  - New:
    - `easy-eat-front/src/api/orderApi.test.ts`
    - `easy-eat-front/src/api/restaurantApi.test.ts`
    - `easy-eat-front/src/services/orderService.test.ts`
    - `easy-eat-front/src/services/restaurantService.test.ts`
    - `easy-eat-front/src/composables/useAsyncAction.ts`
    - `easy-eat-front/src/components/LoadingSpinner.vue`
  - Modified:
    - `easy-eat-front/src/views/OrderListView.vue`
    - `easy-eat-front/src/views/OrderDetailView.vue`
    - `easy-eat-front/src/views/OrderAddView.vue`
    - `easy-eat-front/src/views/OrderEditView.vue`
