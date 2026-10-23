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

## 同事午餐團訂（目前產品）

以公開 Sites「點餐系統」第 18 版為基準，已取代舊 Easy Eat Mock UI。前端 Vue 3，正式後端 Cloudflare Workers／D1；未獲使用者新要求不要改成 Spring Boot。`openspec/` 中舊 Easy Eat 規格屬於歷史，不得據此覆蓋現在的功能。

- 原網址、project ID、D1 綁定與 GitHub 對應見 `.openai/repository-link.json`；不得新建另一個 Site。
- 使用者明確要求 GitHub ↔ Sites 原始碼雙向同步。從任何一端開始工作，都先保留本機修改，再取得原生 Sites 短效 Git 憑證，透過 `scripts/sync-repositories.mjs pull` 取回兩端最新版本。
- 修改後執行根目錄 `npm run build`、`npm test`。UI 行為變更另跑 `npm --prefix easy-eat-front run test:e2e` 與瀏覽器檢查。
- 提交後用同一同步腳本 `push` 推到 GitHub 與 Sites，確認兩端與本機的 Git tree SHA（完整原始碼內容）完全一致；commit SHA 可不同。分歧須先合併並測試；禁止 force-push、丟棄任一端修改或宣稱只有單邊成功即已同步。
- 憑證只經隱藏 stdin 傳入，不能存檔、提交、寫入 shell 參數或輸出。必要時重新取得原生憑證。
- GitHub 與 Sites 各自保留 commit 歷史；發布時先用 Sites source workflow 開啟獨立 Sites checkout，再在那裡建置／封裝，不要把 GitHub checkout 當作 Sites checkout。
- 同步不會部署。只有需要正式發布時才用 Sites 既有 source workflow 與原生部署工具；保留公開權限、D1 `DB`、`LUNCH_ADMIN_CODE` 與原網址。
- 第 18 版 API 在 `worker/ordering.ts`；不可因前端移植而改商業規則、重建資料庫或改既有遷移。新 schema 必須追加遷移。
- 本機／Docker 使用獨立 SQLite，不能將它當作正式資料庫，不要把本機測試資料與 `.env` 提交。
