## 1. Playwright 基礎設施與隔離

- [ ] 1.1 依「Decision: Playwright 使用單一 Chromium 專案作為瀏覽器品質基線」與「Browser test commands」在 `easy-eat-front/package.json`、`easy-eat-front/package-lock.json`、`easy-eat-front/playwright.config.ts` 建立 **Executable browser test command**：`npm run test:e2e` 以 headless Chromium 啟動或重用 Vite server，失敗時保留 HTML report、trace、screenshot、video，`npm run test:e2e:ui` 啟動 UI mode；以 `npm run test:e2e -- --list` 驗證設定可載入且命令失敗會回傳非零狀態。
- [ ] 1.2 建立 `easy-eat-front/e2e/fixture-isolation.spec.ts` 的 Red 測試，明確驗證 **Deterministic browser test isolation** 與「Isolated fixture」契約：同一測試 reload 保留 draft、下一測試只看見預設餐廳／分類且訂單為空；在 fixture 尚未完成前執行 `npm run test:e2e -- fixture-isolation` SHALL 因隔離契約未滿足而失敗。
- [ ] 1.3 實作「Decision: 共用 fixture 以特定 storage key 建立確定性測試資料」於 `easy-eat-front/e2e/fixtures.ts`，以 sessionStorage sentinel 保證每個 context 只在首次導覽移除一次 `easy-eat-mock-db-v1`、後續 reload 保留資料，並監聽未處理 page error 使測試直接失敗；以 `npm run test:e2e -- fixture-isolation` 驗證 1.2 測試轉為 Green，連續執行兩次結果一致。

## 2. 可存取載入回饋

- [ ] 2.1 [P] 擴充 `easy-eat-front/src/components/LoadingSpinner.test.ts` 並建立 `easy-eat-front/src/views/LoadingFeedback.test.ts` 的 Red 測試以鎖定 **Loading spinner component** 與「Accessible loading feedback」介面：預設 label 為「載入中」、自訂 label 會成為唯一 status 名稱，App 啟動、統計、後台與訂單編輯在 loading 時具有情境化 status 與 `aria-busy="true"`、完成或失敗後清除 busy；以 `npm test -- LoadingSpinner LoadingFeedback` 驗證新增斷言在實作前失敗。
- [ ] 2.2 實作「Decision: LoadingSpinner 擁有單一可存取狀態名稱」：在 `easy-eat-front/src/components/LoadingSpinner.vue` 加入 `label` prop，並在 `easy-eat-front/src/App.vue`、`easy-eat-front/src/views/AdminView.vue`、`easy-eat-front/src/views/MealStatisticsView.vue`、`easy-eat-front/src/views/OrderEditView.vue` 改用情境化 spinner 與正確 `aria-busy`，不得產生重複 status；以 `npm test -- LoadingSpinner LoadingFeedback` 與 `npm run type-check` 驗證介面、頁面 busy 生命週期及成功／失敗路徑。

## 3. 無障礙與鍵盤品質門檻

- [ ] 3.1 [P] 建立 `easy-eat-front/e2e/accessibility.spec.ts` 實作 **Automated accessibility gate** 與「Decision: axe 只以 Critical 與 Serious 違規作為本階段阻擋門檻」，掃描 `/`、`/orders/add`、`/statistics`、`/admin`、`/route-that-does-not-exist`，將完整 axe 結果附加至 test artifacts，且讓 Critical／Serious 失敗輸出包含 rule id、impact、help URL、target nodes；以 `npm run test:e2e -- accessibility` 記錄修正前基線，確認未停用 rules 或排除主要內容。
- [ ] 3.2 [P] 依「Decision: 鍵盤焦點採全域 focus-visible 基線加元件語意修正」在 `easy-eat-front/src/assets/main.css`、`easy-eat-front/src/components/orders/OrderForm.vue` 與 `easy-eat-front/src/components/AppSidebar.vue` 建立 **Keyboard-operable critical controls**：互動元素有至少 2px 可見 focus outline，主要導覽與訂單表單維持原生鍵盤操作且無正 tabindex；以 Playwright keyboard 操作 sidebar 到新增訂單送出按鈕，並以 computed style 斷言焦點可見。
- [ ] 3.3 [P] 依「Decision: 鍵盤焦點採全域 focus-visible 基線加元件語意修正」修正 `easy-eat-front/src/components/admin/RestaurantManagement.vue` 與 `easy-eat-front/src/components/admin/MenuItemManagement.vue` 的 label、button type、expanded/pressed state、錯誤關聯與 focus 保留；以 `npm run test:e2e -- accessibility` 及鍵盤展開餐廳、建立餐點的斷言驗證 **Keyboard-operable critical controls**。
- [ ] 3.4 [P] 依「Decision: 鍵盤焦點採全域 focus-visible 基線加元件語意修正」修正 `easy-eat-front/src/components/admin/CategoryManagement.vue` 與 `easy-eat-front/src/views/AdminView.vue` 的 label、button type、tab 選取狀態、錯誤關聯與 focus 保留；以 `npm run test:e2e -- accessibility` 及鍵盤啟用兩個 admin tabs 的斷言驗證 **Keyboard-operable critical controls**。
- [ ] 3.5 在 3.2、3.3、3.4 修正完成後執行 `npm run test:e2e -- accessibility`，逐一清除五個必要路由的 Critical／Serious axe violations，確認「Automated accessibility gate」轉為 Green；若仍失敗，測試輸出 SHALL 能直接指出 rule id、help URL 與 target nodes。

## 4. 核心使用者流程保護

- [ ] 4.1 [P] 依「Decision: 端對端測試使用使用者可感知的語意定位」與「Protected workflows」建立 `easy-eat-front/e2e/order-lifecycle.spec.ts` 的 **Order lifecycle browser protection**：只使用 role、label、可見文字與可觀察狀態完成 draft 建立、reload、內容編輯、送出 pending、完成 completed，且不直接呼叫 Store、Service、API、mock server 或 localStorage；以 `npm run test:e2e -- order-lifecycle` 驗證狀態、明細與禁用操作符合 spec。
- [ ] 4.2 [P] 依「Decision: 端對端測試使用使用者可感知的語意定位」與「Protected workflows」建立 `easy-eat-front/e2e/admin-management.spec.ts` 的 **Admin-to-order browser protection**：透過 UI 建立「E2E 分類」、「E2E 餐廳」、「E2E 套餐」價格 180，逐步確認清單後建立 pending 訂單；以 `npm run test:e2e -- admin-management` 驗證訂單明細顯示新餐廳、餐點與單價，且測試不直接 seed storage。

## 5. 範圍、文件與完整驗證

- [ ] 5.1 更新 `easy-eat-front/README.md` 與 `easy-eat-front/.gitignore`，記錄 `test:e2e`、`test:e2e:ui`、Chromium 安裝方式、失敗 artifacts 位置，並忽略 Playwright report、test-results 與 blob-report；文件 SHALL 明確保留「Scope boundaries」中的 CI、部署、Firefox/WebKit、視覺回歸與後端排除項，以 README 指令逐項人工核對可執行名稱。
- [ ] 5.2 執行 `npm run test:e2e` 兩次，驗證每次皆通過且沒有測試資料洩漏；再執行 `npm test`、`npm run check`、`npm run build`，確認新增工具與 UI 語意修正未破壞既有單元測試、格式、型別或 production build。
- [ ] 5.3 進行失敗模式驗證：依序暫時在本機破壞一個主要按鈕的可存取名稱、一個 E2E 斷言，並在測試頁觸發未處理 page error，確認 `npm run test:e2e` 三種情況皆以非零狀態結束且產生 HTML report、trace、screenshot、video；恢復檔案後重新執行完整 E2E 為 Green，不得將刻意破壞提交到 change。
