# 點餐系統｜同事午餐團訂（Easy Eat）

以目前公開的 [同事午餐團訂](https://team-lunch-orders.ianaa10716.chatgpt.site) 第 18 版為功能、資料與操作流程基準。前端改為 **Vue 3**，正式後端維持 **Cloudflare Workers + D1**。

GitHub 與 Sites 連接的是同一份程式碼，並各自保留 Git 歷史。公司與家裡透過 GitHub 接續開發：`main` 保存已完成程式，同一功能共用一條 `work/<功能名稱>` 工作分支。操作步驟見 [跨電腦開發指南](docs/DEVELOPMENT.md)。

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

1. 在工作分支修改並提交，保留其他工作的未提交檔案。先以有效 GitHub CLI 登入（`gh auth status`）；需要 repository 的 PR／內容寫入權限。
2. 透過 Sites 原生 `create_source_repository_write_credential`，對 `.openai/hosting.json` 中的同一個 project ID 取得短效 Git 憑證。不得將 token 存檔、寫入 Git、放進指令參數或日誌。
3. 執行 `npm run sync:status` 或 `npm run sync:pull`，在隱藏的 stdin 提示傳入原生回應 JSON。指令取回兩端最新提交；Sites 單邊修改可匯入工作分支，兩端同時修改則停止。人工合併時保留最新 Sites commit 為祖先（可由 `refs/remotes/sites/main` 合併；獨立歷史需明確使用 `--allow-unrelated-histories`），逐項處理衝突並測試，不可整棵覆蓋任一端。
4. 在工作分支（例如 `work/order-edit`）建置、測試並提交後執行 `npm run sync:push`。它會推送並設定目前分支的 upstream、更新同一個 PR，不再按 commit 另建 `sync/...` 分支。回傳 `state: awaiting_merge`、`synchronized: false`、`workingBranch` 及 PR 網址；不會推 main 或 Sites。腳本會先取得該工作分支的遠端更新；有分歧就停止，請合併並保留兩台電腦的提交。
5. PR 必須通過 `verify`，且包含最新 main；有新 main 時先合併進工作分支再測試。使用 **merge commit** 合併 PR，保留 Sites 匯入的祖先關係。不要求另一人審核。
6. 合併後，專用 Action 會刪除已合併且沒有新增提交的遠端工作分支。切回 main 取得最新程式，再執行 `sync:pull`、`sync:push`，各自經隱藏 stdin 傳入有效 Sites 憑證。工具取回合併後的 main，才同步 Sites 並核對兩端 tree SHA。只有 `state: synchronized`／`synchronized: true` 代表完成，`deployed` 仍為 `false`。
7. 若某一端推送失敗或遠端同時變動，保留本機提交，取回最新狀態再重試；不可 force-push，也不要重複開相同提交的 PR。

無背景排程，也沒有永久憑證；從這裡更新網站時，依 `AGENTS.md` 完成同步。若直接在外部 GitHub 編輯，回到這裡後先 `sync:pull`，再測試及同步另一端。**Vue 3 與雙向同步是兩項獨立設定，不會自動將 React／Java 等不同實作互相轉換。**

## main 保護

`easy-eat-main` repository ruleset 套用於 `refs/heads/main`：必須經 PR、由 GitHub Actions 提供的 `verify` 成功、分支包含最新 main、討論已解決；批准人數為 0、無指定審核者、無未歸屬變更的額外批准要求，僅允許 merge commit，禁止刪除與 force-push，無管理員或其他 bypass。工具明確設定這些欄位，避免沿用 GitHub 的額外批准預設值。

首次上線先以 PR 合併這套同步工具，等待合併後 main 的 CI 成功，再由 repository 管理員執行 `npm run protect:check` 查看設定、`npm run protect:apply` 套用並回讀驗證。重複套用會更新同名 repository ruleset。規則是 GitHub 伺服器設定，單純提交 YAML 並不代表保護已啟用；驗證 CI 的 token 維持唯讀，不持有管理權限。專用發布紀錄工作僅額外取得 `deployments: write`。

## 正式發布

原網址、公開權限、D1 綁定與 `LUNCH_ADMIN_CODE` 都沿用現有 Site。`npm run build` 產生自包含的 `dist/server/index.js`，將 Vue 靜態資產與既有 API 包在同一個 Worker，沒有額外主機。

發布前必須先核對並同步兩個原始碼庫。先用 Sites source workflow 開啟獨立的 Sites checkout（不要直接在 GitHub checkout 套用 Sites Git 歷史），在該 checkout 安裝前端依賴、建置，再包裝已驗證的 `dist/`，再使用原生 `save_site_version`／`deploy_site_version`；保留 project ID、D1 綁定、既有不可變的 SQL 遷移。不要把 `dist`、本機資料庫、測試資料、管理碼或憑證提交到 GitHub。部署不是 `git push` 的自動效果。

### 發布 commit 與結果追蹤

發布工具使用 GitHub CLI 的 Deployments 寫入權限。以下 `.release/` 檔案只保存非機密的來源與結果 JSON，已忽略；**不能把短效 Git 憑證或環境變數放進去**。

1. 確認 GitHub main 的完整 `verify` 成功，再從已同步、乾淨的 Sites checkout 執行原生 source workflow，依序執行前端依賴安裝（需要時）、`npm run build`、`npm test`，並封裝。不要在建置後修改原始碼。Worker 會標記建置時的 source commit／tree；無 Git 資訊的 Docker 預覽產物不能正式發布。
2. 將原生 workflow 的完整封裝結果放在 `{ "source": <結果> }`，透過 stdin 傳給 `node scripts/release.mjs check`。它驗證 GitHub main CI、來源 tree、乾淨的 Sites HEAD、封裝 project ID 與 Worker 來源標記，輸出檢查結果及封裝 SHA-256。保存這份非機密輸出供後續使用。
3. 使用原生 `save_site_version` 保存同一份封裝與 Sites commit。將 `{ "check": <檢查結果>, "savedVersion": <原生保存結果> }` 傳給 `node scripts/release.mjs start`；它再次檢查 main／CI／封裝雜湊，建立或重用 production Deployment，保存 GitHub commit、Sites commit、tree、版本 ID／號碼、CI 連結與封裝雜湊。失敗時停止，不可先發布。若 `alreadySucceeded: true`，不得再次部署。
4. 保存 `start` 輸出的 release，使用原生 `deploy_site_version` 發布該版本，對非終態結果依原生指引查詢狀態。將 `{ "release": <start輸出>, "result": <原生發布或狀態結果> }` 傳給 `node scripts/release.mjs finish`，記錄 pending／in_progress／success／failure。只有原生 `succeeded` 且版本、project、正式網址都正確，才記錄 success。
5. 若站已發布而 GitHub 寫入失敗，工具回報 `recordPending: true`。保留原生部署 ID 與上述輸入，只重試 `finish`，不可重複發布。遠端寫入結果不確定時，重試會先讀取既有紀錄。

例如 `node scripts/release.mjs check < .release/source-input.json > .release/check.json`；`start`、`finish` 也由 stdin 接收對應 JSON。原生 Sites 工具仍是唯一的發布操作，這些腳本本身不呼叫發布 API，也不會自動部署。每次發布可在 [GitHub Deployments](https://github.com/iankingh/easy-eat/deployments) 查看對應 commit 與結果；舊 v18 不冒認為後來的 Vue commit。

### GitHub App 沒有 Deployments 寫入權限時

使用 `.github/workflows/production-record.yml`，由 Actions 的臨時 token 寫入部署紀錄，不將 Sites 短效憑證放進 GitHub Secrets，也不擴大驗證 CI 的權限。此工作只處理紀錄；網站仍由 Sites 原生工具發布。

1. 在來源 checkout 完成上述 `check`，並保存同一封裝的 Sites 版本。保留 `check` 及 `savedVersion` 的非機密 JSON 收據。
2. 透過 workflow dispatch 呼叫 `production-record.yml`，`ref` 為 `main`，`operation` 為 `record-start`，`request_key` 為這次發布的辨識字串，`release_input` 為 `{ "check": <檢查結果>, "savedVersion": <保存結果> }` 的 JSON 字串。不得放入憑證。它會重新核對目前 main、CI、tree、版本及封裝收據，建立或重用 pending Deployment。
3. 等工作成功後，下載該 run 的 `production-record-<run ID>` artifact，保存其中的 `production-record.json` 為 release。沒有成功結果時不得先發布；若 `alreadySucceeded: true`，不得重複部署。
4. 使用 Sites 原生工具發布並取得終態，再以 `operation: finish`、`release_input: { "release": <release>, "result": <原生結果> }` dispatch 同一工作，保存輸出 artifact。只有原生成功才回寫 success。已上線但回寫失敗時，只重跑 finish。

`record-start` 僅能在此 repository 的 main workflow dispatch 環境執行；本機 `start` 仍會核對實體封裝雜湊。Actions 工作不會把本機路徑當成已驗證的遠端檔案，也不代表 Sites 已上線。從本工作環境交付時，CI 通過、兩端同步後，應主動完成原生發布與 finish；目前外部 GitHub push 本身仍不會自動觸發 Sites 發布。

詳見 [遷移記錄](docs/migration-plan.md) 與 [API 契約](API.md)。

首次同步以內容快照連接 Sites，避免把舊 Easy Eat 的約 63 MB 歷史重新上傳。GitHub 保留完整歷史；Sites 保留既有歷史及每次同步快照，commit 的 `GitHub-Commit` 記錄對應版本。兩端以 tree SHA 驗證所有檔案完全相同。
