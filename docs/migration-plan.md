# 第 18 版遷移記錄

## 最終採用方向

以目前公開的「點餐系統：同事午餐團訂」第 18 版為主。前端從 React 改成 Vue 3，後端與資料維持 Cloudflare Workers／D1。使用者後續選擇保留原後端，因此沒有採用 Spring Boot。

- GitHub：`https://github.com/iankingh/easy-eat`
- Site：`appgprj_6abf005ded5881918c1791853dc46c46`
- 現行網址：`https://team-lunch-orders.ianaa10716.chatgpt.site`
- 匯入原始提交：`f3979706fdd3c7a3e4caa244c8b9d8cd054def45`
- `worker/ordering.ts` 原封不動取自該提交的 `app/api/ordering/route.ts`。
- `drizzle/`、`db/`、D1 綁定沿用原始檔，既有 SQL 遷移不可修改。
- 原 Site Git 歷史已合入 Easy Eat，保留原始 React 前端以供版本還原。

## 驗收範圍

餐廳／共用菜單、團次、截止時間與開關、售完、訂單追加／修改、request ID 重試、價格快照、隱私、出餐彙總、WebMCP、Vue 型別與正式建置、雙向同步保護。

## 發布邊界

依使用者選擇，先完成 GitHub 專案、原始碼同步及 Docker 預覽檔。本次不部署新版本；現有公開網站維持原發布版本。同步原始碼不代表網站已發布，也不會遷移或覆寫正式 D1 資料。

Docker 的 SQLite 只供本機驗證，與正式 D1 分離。若以後要改用 Spring Boot，須另規劃後端主機及資料遷移。
