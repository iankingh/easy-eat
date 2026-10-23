# 點餐系統｜同事午餐團訂（Easy Eat）

以目前公開的 [同事午餐團訂](https://team-lunch-orders.ianaa10716.chatgpt.site) 第 18 版為功能、資料與操作流程基準。前端改為 **Vue 3**，正式後端維持 **Cloudflare Workers + D1**。

GitHub 與 Sites 連接的是同一份程式碼，並各自保留 Git 歷史。這次同步原始碼，尚未發布新的 Vue 版；目前公開網站仍可使用。

## 專案結構

- `easy-eat-front/`：Vue 3／TypeScript／Vite 前端。
- `worker/ordering.ts`：線上第 18 版 API 原始碼，保持原有邏輯與 `/api/ordering` 契約。
- `drizzle/`、`db/`：原 D1 遷移檔及 schema，既有遷移不可修改。
- `.openai/hosting.json`：原 Sites ID、D1 `DB` 綁定，不建立新的 Site 或資料庫。
- `.openai/repository-link.json`：GitHub、Sites 原始碼庫及線上網址對應。
- `scripts/sync-repositories.mjs`：雙向同步與衝突保護。
- `scripts/local-server.mjs`：本機／Docker 預覽，以 SQLite 實作 D1 介面，與正式 D1 隔離。

舊 Easy Eat Mock 系統已被取代；舊版本可從 Git 歷史還原。`openspec/` 是舊系統的歷史規格，不能作為這版產品的需求來源；本版以原公開網站、`API.md` 及目前程式為準。

## 功能

- 首頁分為「我要點餐」、「點餐後台」，可列出開放團次及分享各團點餐連結。
- 餐廳與共用菜單獨立管理，支援新增、編輯與移除餐點；開團直接沿用菜單。
- 各團管理餐廳、日期、截止時間、開放／關閉與本團售完狀態；已有訂單禁止換店。
- 同事填寫姓名、帳號、餐點與備註；支援重複送單保護、明確追加及此瀏覽器上一筆訂單修改。
- 訂單保留送出當時餐點名稱與價格；後台可確認訂單、複製含備註的店家出餐彙總及列印。
- 公開 API 隱藏同事個別訂單與帳號。管理碼保留於本次頁面記憶體，不寫進 Git 或瀏覽器儲存。
- 保留 `read_lunch_menu` 與 `submit_lunch_order` WebMCP 工具。

## 安裝、建置與本機預覽

使用 Node.js 24.22.1 以上（前端工具鏈固定於 Node 24）。

```sh
npm --prefix easy-eat-front ci
npm run build
npm test
```

將 `.env.example` 複製為 `.env` 並修改管理碼。終端啟動預覽前，從 `.env` 載入 `LUNCH_ADMIN_CODE` 至程序環境，再執行 `npm run dev`。預覽網址是 `http://127.0.0.1:8787`。若沒有設定管理碼，後台保持停用。

本機 SQLite 預設放在 `.local-data/lunch.sqlite`，重啟仍會保存；它不是正式 D1 的備份。修改 Vue 時可另外在 `easy-eat-front` 執行 `npm run dev`，Vite 的 `/api` 會代理至 8787。

## Docker 預覽

```sh
cp .env.example .env
# 編輯 .env 設定本機管理碼
 docker compose up --build
```

服務僅綁定本機 `127.0.0.1:8787`，SQLite 保存在 `lunch-data` volume。Docker 用於本機驗證；正式 Sites 仍由 Workers 與 D1 執行，兩邊資料不會自動搬移。

## GitHub ↔ Sites 雙向同步

同步原始碼與部署網站是不同操作；此流程不會自動發布。

1. 確認已提交本機修改，在 `main` 分支操作。
2. 透過 Sites 原生 `create_source_repository_write_credential`，對 `.openai/hosting.json` 中的同一個 project ID 取得短效 Git 憑證。不得將 token 存檔、寫入 Git、放進指令參數或日誌。
3. 執行 `npm run sync:status` 或 `npm run sync:pull`，在隱藏的 stdin 提示傳入原生回應 JSON。指令取回 GitHub 與 Sites 最新提交；Sites 單邊修改可匯入 GitHub，兩端同時有不同內容時停止，先人工合併與測試。
4. 修改、建置、測試並提交後，執行 `npm run sync:push`，同樣經 stdin 傳入有效憑證。指令推送到 GitHub 與 Sites，並核對兩端 Git tree SHA（完整原始碼內容）完全一致。
5. 若某一端推送失敗，指令會報告尚未同步完成。保留本機提交，重新取得憑證／取回遠端狀態後重試，不可 force-push。

無背景排程，也沒有永久憑證；從這裡更新網站時，依 `AGENTS.md` 完成同步。若直接在外部 GitHub 編輯，回到這裡後先 `sync:pull`，再測試及同步另一端。**Vue 3 與雙向同步是兩項獨立設定，不會自動將 React／Java 等不同實作互相轉換。**

## 正式發布

原網址、公開權限、D1 綁定與 `LUNCH_ADMIN_CODE` 都沿用現有 Site。`npm run build` 產生自包含的 `dist/server/index.js`，將 Vue 靜態資產與既有 API 包在同一個 Worker，沒有額外主機。

發布前必須先核對並同步兩個原始碼庫。先用 Sites source workflow 開啟獨立的 Sites checkout（不要直接在 GitHub checkout 套用 Sites Git 歷史），在該 checkout 安裝前端依賴、建置，再包裝已驗證的 `dist/`，再使用原生 `save_site_version`／`deploy_site_version`；保留 project ID、D1 綁定、既有不可變的 SQL 遷移。不要把 `dist`、本機資料庫、測試資料、管理碼或憑證提交到 GitHub。部署不是 `git push` 的自動效果。

詳見 [遷移記錄](docs/migration-plan.md) 與 [API 契約](API.md)。

首次同步以內容快照連接 Sites，避免把舊 Easy Eat 的約 63 MB 歷史重新上傳。GitHub 保留完整歷史；Sites 保留既有歷史及每次同步快照，commit 的 `GitHub-Commit` 記錄對應版本。兩端以 tree SHA 驗證所有檔案完全相同。
