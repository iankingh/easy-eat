<!-- SPECTRA:START v1.3.0 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `$spectra-*` skills when:

- An explicitly requested Spectra decision needs structure → `$spectra-discuss`
- User explicitly requests a Spectra change proposal → `$spectra-propose`
- Continue tasks for an identified change → `$spectra-apply`
- Update requirements or plans for an identified change → `$spectra-ingest`
- Check implementation matches artifacts → `$spectra-verify`
- Review implementation quality and logic issues → `$spectra-review`
- Analyze artifact consistency before coding → `$spectra-analyze`
- Audit security sharp edges → `$spectra-audit`
- Check stale changes before resuming → `$spectra-drift`
- Debug a concrete bug systematically → `$spectra-debug`
- Implementation is done → `$spectra-archive`
- Commit only files related to a specific change → `$spectra-commit`

Explicit skill invocation takes precedence. Apply existing authorization within its unchanged scope.

## Workflow

discuss? → propose → apply ⇄ ingest → verify / review → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode (`/plan`) → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `$spectra-apply` and `$spectra-ingest` skills disclose parking and restore when the named operation is already explicitly requested; respect a known refusal, otherwise ask for missing authorization.

<!-- SPECTRA:END -->

## GitHub 與跨電腦開發

- `main` 只保留已完成、通過檢查且經 PR 合併的程式。
- 同一項功能只使用同一條工作分支，建議命名 `work/<功能名稱>`。公司與家裡接續該分支，不依電腦、日期或 commit 另開分支。
- 換電腦前 commit 並 push；另一台開始修改前先 fetch、切至同一分支並 `git pull --ff-only`。未提交檔案與本機 stash 不會跨電腦同步。
- 工作分支持續更新同一個 PR；不得新增 `sync/<commit>` 分支。`sync:push` 使用目前分支並設定 upstream，遠端與本機分歧時停止，保留兩邊提交。
- 功能完成後通過 verify，以 merge commit 合併 main。專用 `branch-cleanup.yml` 工作取得 `contents: write`／`pull-requests: read`，只清理已合併且沒有新增提交的遠端分支；不得刪除 main 或未合併工作。一般驗證 CI 維持唯讀。
- 人員在公司／家裡日常開發只需要 GitHub，不必取得 Sites 憑證。完整步驟在 `docs/DEVELOPMENT.md`；本環境整合 Sites／發布時再遵循下方規則。

## 同事午餐團訂（目前產品）

以公開 Sites「點餐系統」第 18 版為基準，已取代舊 Easy Eat Mock UI。前端 Vue 3，正式後端 Cloudflare Workers／D1；未獲使用者新要求不要改成 Spring Boot。`openspec/` 中舊 Easy Eat 規格屬於歷史，不得據此覆蓋現在的功能。

- 原網址、project ID、D1 綁定與 GitHub 對應見 `.openai/repository-link.json`；不得新建另一個 Site。
- 使用者明確要求 GitHub ↔ Sites 原始碼雙向同步。從任何一端開始工作，都先保留本機修改，在工作分支取得原生 Sites 短效 Git 憑證，透過 `scripts/sync-repositories.mjs pull` 取回兩端最新版本。
- 修改後執行根目錄 `npm run build`、`npm test`。UI 行為變更另跑 `npm --prefix easy-eat-front run test:e2e` 與瀏覽器檢查。
- 提交後用同一同步腳本 `push` 建立／重用 GitHub PR。`awaiting_merge` 不代表同步完成；必須等 `verify` 成功且包含最新 main，使用 merge commit 合併（不要求第二人批准），再 `pull`／`push` 同步 Sites。禁止直推 main 或使用管理員 bypass。僅 `synchronized: true` 且兩端與本機 tree SHA 相同代表完成；commit SHA 可不同。分歧須保留最新 Sites commit 的祖先關係，合併並測試；禁止 force-push、丟棄任一端修改或宣稱只有單邊成功即已同步。
- 憑證只經隱藏 stdin 傳入，不能存檔、提交、寫入 shell 參數或輸出。必要時重新取得原生憑證。
- GitHub 與 Sites 各自保留 commit 歷史；發布時先用 Sites source workflow 開啟獨立 Sites checkout，再在那裡建置／封裝，不要把 GitHub checkout 當作 Sites checkout。
- 同步不會部署。使用者已要求從這裡交付修改時，合併並同步後接續完成正式發布，除非明確要求不上線；保留公開權限、D1 `DB`、`LUNCH_ADMIN_CODE` 與原網址。外部 GitHub push 目前不會自行呼叫 Sites 發布，不得宣稱已接通無人值守部署。
- 正式發布依 README 的 release check／start／finish 流程：核對目前 main CI、Sites tree、封裝來源標記與 SHA-256；先建立 GitHub production Deployment 再用原生 Sites 發布，依原生終態記錄結果。若已發布但紀錄待補，只重試 finish，不重複部署。不得把未部署的 commit、模擬結果或舊 v18 記錄為新版本成功。
- main 規則由 `scripts/protect-main.mjs` 管理，必須經 PR、GitHub Actions 的 verify、最新 main，無 bypass、禁止刪除及 force-push；不得為讓同步成功而關閉保護。驗證 CI token 維持唯讀；使用者授權專用 `production-record.yml` 工作取得 `deployments: write`，以 GitHub 臨時 token 建立／更新發布紀錄。GitHub App 缺少 Deployments 權限時使用此工作，不要求使用者反覆調整 App 權限。不能保存憑證到專案。
- 第 18 版 API 在 `worker/ordering.ts`；不可因前端移植而改商業規則、重建資料庫或改既有遷移。新 schema 必須追加遷移。
- 本機／Docker 使用獨立 SQLite，不能將它當作正式資料庫，不要把本機測試資料與 `.env` 提交。
