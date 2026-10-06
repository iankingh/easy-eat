## Context

Easy Eat 是以 Vue、Pinia 與 Vue Router 建構的純前端應用，資料透過 mock server 寫入 localStorage 的 `easy-eat-mock-db-v1`。現有 Vitest 測試已保護資料層、Store、API、Service 與部分元件，但尚未驗證使用者從路由、表單、非同步狀態到持久化結果的完整流程。既有 `LoadingSpinner` 已提供 `role="status"`，但 App 啟動、統計、後台與訂單編輯仍使用不同的文字載入樣式，頁面容器也未一致標示 busy 狀態。

此 change 會影響測試工具、測試資料隔離與多個 UI 元件，因此需要明確定義可重複執行的瀏覽器契約。使用者仍以桌面與行動瀏覽器操作相同 SPA；本 change 不改變領域模型、mock server API 或 localStorage schema。

## Goals / Non-Goals

**Goals:**

- 提供單一命令執行的 Chromium 端對端測試，保護訂單生命週期與後台資料建立流程。
- 確保每個瀏覽器測試擁有獨立、可預測的預設資料，不受前一測試執行結果影響。
- 對 `/`、`/orders/add`、`/statistics`、`/admin` 與不存在路由建立 axe 自動掃描基線，Critical 與 Serious 違規數必須為零。
- 讓關鍵表單與操作可透過鍵盤完成，且互動元件具有可見焦點。
- 統一主要頁面的載入視覺、狀態宣告與 busy 語意。

**Non-Goals:**

- 不建立 GitHub Actions、部署流程或跨瀏覽器測試矩陣。
- 不新增後端、網路 API、認證、權限或多租戶能力。
- 不新增搜尋、匯出、批次操作等業務功能。
- 不承諾在本 change 清除所有 Moderate 或 Minor axe 違規；這些結果不得被隱藏，但不作為失敗門檻。
- 不修改 `easy-eat-mock-db-v1` 的資料格式或現有領域規則。

## Decisions

### Decision: Playwright 使用單一 Chromium 專案作為瀏覽器品質基線

新增 Playwright 測試執行器，設定 `webServer` 以開發伺服器啟動應用，並以 Chromium 執行 `easy-eat-front/e2e` 下的規格。`package.json` 提供 `test:e2e` 與 `test:e2e:ui` scripts；預設命令採 headless 模式並在失敗時保留 trace、截圖與影片。

選擇 Playwright 而非 Cypress，因為 Playwright 原生支援瀏覽器 context 隔離、語意 locator、trace 與 axe Playwright 整合，且未來可在另一個 change 擴展 Firefox/WebKit。此階段只跑 Chromium，避免三倍執行時間與不同瀏覽器修正擴大範圍。

### Decision: 共用 fixture 以特定 storage key 建立確定性測試資料

`easy-eat-front/e2e/fixtures.ts` 擴充 Playwright test fixture，在每個測試 context 首次導覽前透過 `page.addInitScript` 檢查 sessionStorage sentinel；sentinel 尚不存在時才移除 `easy-eat-mock-db-v1` 並立即寫入 sentinel。應用第一次讀取資料時沿用現有 `createDefaultDatabase` 行為建立預設餐廳、分類與空訂單清單。fixture SHALL 僅移除 Easy Eat 的 storage key，不清除其他 origin storage；同一頁面的後續 reload 因 sentinel 已存在而保留測試建立的資料。

此設計優於透過後台「重置 Mock 資料」按鈕準備每個測試，因為 UI 重置本身也是受測行為，不能同時作為所有測試的前置依賴。fixture 不直接複製預設資料 JSON，避免測試資料與 `mock/db.ts` 漂移。

### Decision: 端對端測試使用使用者可感知的語意定位

測試優先使用 `getByRole`、`getByLabel` 與可見文字定位，不依賴 CSS class、DOM 層級或固定 timeout。只有在一個控制項無法建立合理的可存取名稱、且新增語意會誤導使用者時，才允許加入穩定的 `data-testid`。非同步等待 SHALL 觀察按鈕狀態、狀態訊息、URL 或資料列等可見結果。

此決策讓 E2E 同時驗證可存取名稱，並降低樣式重構造成脆弱測試的機率。替代方案是大量使用 test id，雖穩定但無法暴露標籤與角色缺失，因此不採用。

### Decision: axe 只以 Critical 與 Serious 違規作為本階段阻擋門檻

`accessibility.spec.ts` 使用 `@axe-core/playwright` 掃描主要路由完整頁面。測試 SHALL 將完整 axe 結果附加至 Playwright test artifacts，再將 impact 為 `critical` 或 `serious` 的 violations 過濾後斷言為空；失敗輸出 SHALL 保留 rule id、impact、help URL 與受影響節點，讓修正者能定位問題。掃描須在 App 完成初始載入後執行。

本階段不以 Moderate／Minor 作為阻擋條件，避免一次處理所有既有視覺與語意細節，但測試程式不得停用 axe rules 或排除整個主要內容區。未來提高門檻應建立獨立 change。

### Decision: LoadingSpinner 擁有單一可存取狀態名稱

`LoadingSpinner` 新增可選 `label` prop，預設為「載入中」，並以該值提供 `aria-label`。使用 spinner 的頁面 SHALL 傳入情境化文字，例如「統計資料載入中」；外層頁面或主要內容容器以 `aria-busy` 表示資料是否仍在載入，但不得再建立另一個包含相同文字的 `role="status"`，避免輔助技術重複宣告。

App 啟動、統計、後台與訂單編輯頁面改用此契約。此設計保留現有純 CSS 元件，不引入 UI framework，也不建立第二個 loading abstraction。

### Decision: 鍵盤焦點採全域 focus-visible 基線加元件語意修正

`easy-eat-front/src/assets/main.css` 為 link、button、input、select、textarea 與具有 tabindex 的互動元素提供一致且高對比的 `:focus-visible` outline。元件本身補足關聯 label、button type、aria-expanded、aria-pressed、aria-describedby 與動態錯誤的 `role="alert"`；不以 tabindex 將非互動元素偽裝成控制項。

替代方案是在每個元件重複焦點 CSS，但會造成顏色、寬度與 offset 漂移，因此不採用。

## Implementation Contract

### Browser test commands

**Behavior:** 在 `easy-eat-front` 執行 `npm run test:e2e` SHALL 自動啟動或重用 Vite server，以 headless Chromium 執行全部 E2E；任何斷言、page error、Critical／Serious axe violation 或伺服器啟動失敗 SHALL 使命令以非零狀態結束。`npm run test:e2e:ui` SHALL 啟動 Playwright UI 模式供本機除錯。

**Artifacts:** 失敗時 SHALL 產生 Playwright HTML report、trace、截圖與影片；成功執行不得要求人工清理 localStorage。

**Acceptance:** `npm run test:e2e` 通過，且刻意破壞一個核心按鈕可存取名稱時 accessibility 或流程測試會失敗。

### Isolated fixture

**Behavior:** 每個測試 context 在應用程式首次執行前，以 sessionStorage sentinel 保證只移除一次 `easy-eat-mock-db-v1`，首次讀取後得到預設餐廳、預設分類與空訂單清單。單一測試重新載入頁面時 SHALL 保留該測試建立的訂單與管理資料；下一個測試使用新 context 與新 sentinel，SHALL 看不到前一測試建立的資料。fixture 亦 SHALL 監聽未處理的 page error，發生時直接使目前測試失敗。

**Failure mode:** fixture 無法在首次導覽前註冊 init script 時 SHALL 直接使測試失敗，不得以共用既有瀏覽器資料繼續執行。

**Acceptance:** 連續執行兩次完整 E2E 套件結果相同；order lifecycle 測試 reload 後仍找到其草稿，而另一個測試起始時訂單清單為空。

### Protected workflows

**Order lifecycle:** 測試 SHALL 從新增訂單頁選擇預設餐廳與餐點，建立 draft，重新載入確認持久化，編輯數量或備註，送出為 pending，再更新為 completed；每一步 SHALL 以畫面狀態、明細內容與可用操作驗證允許的狀態轉換。

**Admin management:** 測試 SHALL 建立名稱為「E2E 分類」的分類、名稱為「E2E 餐廳」的餐廳與名稱為「E2E 套餐」且價格為 180 的餐點，然後從新增訂單頁選到該餐廳與餐點並成功建立 pending 訂單。

**Accessibility:** `/`、`/orders/add`、`/statistics`、`/admin` 與 `/route-that-does-not-exist` 在初始載入完成後 SHALL 無 Critical 或 Serious axe violations。主要導覽、訂單表單、後台 tabs 與 CRUD 按鈕 SHALL 可使用 Tab／Shift+Tab 到達，並可透過 Enter 或 Space 執行其原生控制項行為。

### Accessible loading feedback

**Interface:** `LoadingSpinner` 接受 `size?: 'sm' | 'md' | 'lg'` 與 `label?: string`，`label` 預設為「載入中」。元件 root SHALL 維持 `role="status"`，並將 `aria-label` 設為 label。App 或頁面資料載入期間，其主要內容容器 SHALL 設定 `aria-busy="true"`，完成後 SHALL 為 `false` 或移除該屬性。

**Acceptance:** `LoadingSpinner.test.ts` 驗證預設與自訂 label；E2E 或元件測試驗證 App 啟動、統計、後台與訂單編輯載入期間存在單一具情境化名稱的 status，完成後主要內容不再 busy。

### Scope boundaries

**In scope:** Playwright/axe dev dependencies、E2E config/fixture/specs、主要路由可存取性修正、全域 focus-visible 樣式、LoadingSpinner contract 與受影響元件測試。

**Out of scope:** CI workflow、部署、Firefox/WebKit、視覺回歸快照、效能預算、後端整合、領域規則修改、Moderate／Minor axe 零違規承諾。

## Risks / Trade-offs

- [風險] 180ms mock latency 與 Vue 非同步渲染使 E2E 偶發失敗 → 緩解：使用 Playwright 自動等待與可見狀態斷言，禁止固定 sleep。
- [風險] axe 掃描受 transition 或尚未完成載入的 DOM 影響 → 緩解：以頁面 busy 狀態結束或明確的主要內容可見作為掃描前置條件。
- [風險] 管理流程測試同時覆蓋多個實體，失敗定位較長 → 緩解：每次建立後立即斷言資料列，再繼續下一個實體。
- [取捨] 單一 Chromium 無法發現 Firefox/WebKit 差異 → 緩解：保留 Playwright projects 擴充點，跨瀏覽器矩陣由後續 change 處理。
- [取捨] Critical／Serious 門檻不代表完整符合 WCAG → 緩解：明確保留 Moderate／Minor 報告，並將鍵盤流程列為獨立驗收項目。
