# 公司與家裡接續開發

GitHub 是兩台電腦交換程式的共同來源。長期保留 `main` 放已完成且通過檢查的程式；每項未完成功能只開一條工作分支，例如 `work/order-edit`，兩台電腦接續同一條。不要依電腦、日期或每個 commit 另開分支。

## 每台電腦第一次設定

```sh
git clone https://github.com/iankingh/easy-eat.git
cd easy-eat
git config pull.ff only
npm --prefix easy-eat-front ci
```

已有專案時不必重新 clone。在該目錄設定 `git config pull.ff only` 即可；這是該台電腦的本機設定，不會改動其他專案。它會在兩邊歷史分歧時停止，讓你先處理衝突。

## 開始一項新功能：只在第一台建立一次分支

先確認 `git status` 沒有尚未處理的檔案，再執行：

```sh
git switch main
git pull --ff-only
git switch -c work/order-edit
```

`work/order-edit` 是範例，請改成這次功能的名稱。同一功能後續繼續用這個名稱；第二台電腦不要再另開一條。

## 下班或換電腦前：commit 加 push

```sh
git status
git add -A
git commit -m "wip: 保存訂單編輯進度"
git push -u origin work/order-edit
```

先檢查要提交的內容，再執行 `git add -A`。功能尚未完成也能提交到工作分支，暫時不合併 `main`。沒有新的修改時不用再 commit；仍可 push 尚未上傳的提交。第一次 push 設定 upstream 後，之後可以直接用 `git push`。

**未 commit 的檔案不會上傳；只 commit、沒有 push 的提交也不會出現在家裡。** 本機 stash 不會隨 push 傳到另一台電腦。

## 回家接續：先 pull，再修改

先確認目前工作目錄沒有需要保留的未提交修改。

第一次在這台電腦接續已存在的功能：

```sh
git fetch --prune origin
git switch --track origin/work/order-edit
git pull --ff-only
```

如果這台已經有該分支，改用：

```sh
git fetch --prune origin
git switch work/order-edit
git pull --ff-only
```

接著開發，結束前再 commit、push。回到公司也做相同動作。兩台電腦不要同時修改同一條分支而不先取得對方的提交。

## 功能完成：同一個 PR 持續更新

先把最新 main 合併進目前的工作分支，再驗證：

```sh
git fetch origin
git merge origin/main
npm run build
npm test
git push
```

UI 行為修改另跑 `npm --prefix easy-eat-front run test:e2e` 並檢查瀏覽器操作。main 合併有衝突時，先解決衝突並提交，再執行檢查。

到 GitHub 建立「工作分支 → main」的 PR。已有該分支的 PR 時只要繼續 commit、push，GitHub 就會更新同一個 PR，不需要新建。也可在已登入 GitHub CLI 的電腦執行一次：

```sh
gh pr create --base main --head work/order-edit
```

PR 必須通過 `verify`、包含最新 main，再使用 merge commit 合併。專用的 `branch-cleanup.yml` Action 會刪除已合併且沒有新增提交的遠端工作分支；它會保留 main、未合併內容、其他 repository 的分支及合併後又繼續開發的分支。

兩台電腦各自收尾：

```sh
git switch main
git pull --ff-only
git fetch --prune origin
git branch -d work/order-edit
```

`fetch --prune` 清掉已不存在的遠端分支參照，不會刪除本機工作檔案。`branch -d` 若拒絕，表示仍有需要確認的提交，請保留並檢查，不要改成強制刪除。

## pull 失敗時

- 有未提交修改：先 commit 並保留；不要用 reset 丟棄檔案。
- 兩台都有新提交：先 `git fetch origin`，在工作分支執行 `git merge origin/work/order-edit`，解決衝突、提交並測試後再 push。不要 force-push 覆蓋另一台的工作。
- 有更新的 main：在工作分支合併 `origin/main`，通過檢查後再更新原 PR。

## Sites 與本機資料

日常跨電腦接續只需要 GitHub，不需要 Sites 憑證。`.env`、管理碼及本機 SQLite 不會隨程式上傳，兩台電腦各自設定；本機測試資料也不會進入正式 D1。

從本工作環境整合 Sites 或正式發布時，才使用 README 的雙向同步／發布流程：

- `sync:pull` 會先取得目前工作分支的遠端更新，只允許 fast-forward；有分歧就停止，保留兩邊提交。
- `sync:push` 更新目前工作分支、設定 upstream，建立或重用同一分支的開啟中 PR，不再產生 `sync/<commit>` 分支。
- main 有未審查提交時，腳本要求先切到工作分支。Sites 有待匯入的修改時，也不會直接寫進 main。
- 功能合併 main 後才同步 Sites。工作分支的 WIP push 不會發布網站。

GitHub 分支整理與網站發布是兩件事；不需要為了換電腦開發搬移主機或更換目前網址。
