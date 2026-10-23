# 遷移驗證（2026-10-23）

- Vue 型別檢查與 Vite 正式建置通過。
- Worker 建置為單一 ESM `default.fetch`，包含 Vue 資產及既有 `/api/ordering`。
- 6 組 Node 測試通過：管理權限／公開隱私、共用菜單／分團供應、下單完整生命週期、防無效送單、Worker 路由／安全標頭、雙向同步分歧保護。
- E2E TypeScript 型別檢查通過；Playwright 自動化案例已加入 GitHub CI，當地尚未執行該測試 runner。
- 本機瀏覽器實測：登入、獨立新增餐廳／菜單、開團、自動沿用菜單、儲存時間並開放、列表進入點餐、送出 2 份、修改為 1 份。修改後統計維持 1 筆訂單且金額從 240 變成 120。
- 本機服務重啟後，SQLite 餐廳與菜單資料仍保留。
- 390×844 手機畫面及桌面畫面已檢視，導覽、列表、點餐表單沒有橫向溢出。
- 第 18 版 `app/api/ordering/route.ts` 與本版 `worker/ordering.ts` 逐位元組一致；所有 D1 SQL／schema 與 hosting 綁定逐檔比對一致。
- Sites 官方封裝 helper 已成功產生部署封裝，未呼叫正式版本儲存或部署工具。
- Impeccable 檢測只有原有 Arial 字型的風格提醒；依使用者要求保留現有網站視覺。
- 本機沒有 Docker CLI／引擎，未在本機執行 image build；Docker 建置已納入 CI。Docker 仍僅供本機預覽，與正式 D1 隔離。

以上不代表已發布 Vue 版或修改正式 D1 資料。
