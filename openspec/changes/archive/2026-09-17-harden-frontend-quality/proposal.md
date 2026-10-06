## Why

目前測試主要覆蓋 mock server、Store、API 與 Service，缺少從瀏覽器操作到持久化結果的端對端保護；同時主要頁面的載入提示與可存取狀態仍不一致。下一階段新增管理功能與訂單效率功能前，需要先建立可重複執行的關鍵流程與無障礙品質基線，降低後續變更造成回歸的風險。

## What Changes

- 建立 Playwright 端對端測試基礎設施，以隔離且可重置的 localStorage 資料執行瀏覽器測試。
- 保護訂單核心生命週期：建立草稿、編輯、送出、完成，並驗證重新載入後資料仍存在。
- 保護後台核心管理流程：建立餐廳、分類與餐點，並驗證建立的資料可用於新訂單。
- 在主要路由執行自動化無障礙掃描，將 Critical 與 Serious 違規視為測試失敗。
- 修正主要路由的表單標籤、狀態宣告、鍵盤操作與焦點可見性問題，使關鍵流程可由鍵盤與輔助技術完成。
- 將 App 啟動、統計、後台與訂單編輯頁面的載入提示統一使用現有 LoadingSpinner，並提供一致的 role=status、可讀標籤與 aria-busy 狀態。

## Capabilities

### New Capabilities

- `frontend-quality`: 定義瀏覽器級關鍵流程驗證、測試資料隔離、主要路由無障礙掃描與鍵盤可操作性的品質契約。

### Modified Capabilities

- `async-feedback`: 擴充載入回饋要求，規範主要頁面須以一致且可由輔助技術辨識的狀態呈現非同步載入。

## Impact

- Affected specs: `frontend-quality`, `async-feedback`
- Affected code:
  - New:
    - `easy-eat-front/playwright.config.ts`
    - `easy-eat-front/e2e/fixtures.ts`
    - `easy-eat-front/e2e/fixture-isolation.spec.ts`
    - `easy-eat-front/e2e/order-lifecycle.spec.ts`
    - `easy-eat-front/e2e/admin-management.spec.ts`
    - `easy-eat-front/e2e/accessibility.spec.ts`
  - Modified:
    - `easy-eat-front/.gitignore`
    - `easy-eat-front/README.md`
    - `easy-eat-front/package.json`
    - `easy-eat-front/package-lock.json`
    - `easy-eat-front/src/App.vue`
    - `easy-eat-front/src/assets/main.css`
    - `easy-eat-front/src/components/AppSidebar.vue`
    - `easy-eat-front/src/components/LoadingSpinner.vue`
    - `easy-eat-front/src/components/LoadingSpinner.test.ts`
    - `easy-eat-front/src/components/admin/CategoryManagement.vue`
    - `easy-eat-front/src/components/admin/MenuItemManagement.vue`
    - `easy-eat-front/src/components/admin/RestaurantManagement.vue`
    - `easy-eat-front/src/components/orders/OrderForm.vue`
    - `easy-eat-front/src/views/AdminView.vue`
    - `easy-eat-front/src/views/MealStatisticsView.vue`
    - `easy-eat-front/src/views/LoadingFeedback.test.ts`
    - `easy-eat-front/src/views/OrderEditView.vue`
  - Removed: none
- Dependencies: 新增 Playwright 測試執行器與 axe Playwright 整合套件；不新增執行階段依賴。
