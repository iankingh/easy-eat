# 同事午餐團訂 API

正式後端為 Cloudflare Workers，資料庫為 D1。路徑沿用第 18 版 `/api/ordering`，前端同源呼叫。

## GET

| 查詢                                  | 用途                     |
| ------------------------------------- | ------------------------ |
| 無參數                                | 當天團次、菜單及匿名統計 |
| `?roundId=<id>`                       | 指定團次、菜單及匿名統計 |
| `?view=list`                          | 未截止且開放中的團次     |
| `?view=restaurants&restaurantId=<id>` | 管理員餐廳列表與共用菜單 |

傳入有效 `x-admin-code` 時，一般 snapshot 另外包含 `orders`、`rounds`、`restaurants`；未驗證訪客這三個欄位為空陣列。個別訂單、姓名與帳號不對外提供。

## POST

JSON body 內的 `action` 指定操作。除 `place-order` 外，皆需 `x-admin-code`。

| action              | 主要欄位                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `admin-check`       | 無；驗證管理碼                                                                            |
| `create-restaurant` | `name`                                                                                    |
| `add-menu-item`     | `restaurantId`, `name`, `description`, `price`                                            |
| `update-menu-item`  | `restaurantId`, `menuItemId`, `name`, `description`, `price`                              |
| `remove-menu-item`  | `restaurantId`, `menuItemId`；軟刪除                                                      |
| `create-round`      | `restaurantId` 或已存在的餐廳 `title`, `orderDate`, `deadline`                            |
| `update-round`      | `roundId`, `title`, `deadline`, 可選 `openAfterSave`                                      |
| `toggle-round`      | `roundId`                                                                                 |
| `toggle-menu-item`  | `roundId`, `menuItemId`；僅改本團供應狀態                                                 |
| `toggle-order`      | `orderId`                                                                                 |
| `place-order`       | `roundId`, `name`, `account`, `note`, `items`, `requestId`, 可選 `mode`, `replaceOrderId` |

`items` 格式為 `[{menuItemId,quantity}]`，每張最多 30 種，每項 1～20 份。價格由後端讀取，不接受前端指定。餐點名稱／單價在訂單內保留快照，改菜單不修改歷史訂單。

`requestId` 使用 UUID v4。同一 request ID 與相同內容重試回傳原訂單；內容改變會拒絕。`mode` 為 `new`、`append`、`replace`。`new` 遇到同團相同帳號回傳 `409` 與 `code=duplicate-order`；`replace` 需該瀏覽器保存的不可猜測 order ID 及相符帳號。

錯誤格式為 `{error, code?, field?, errorId?}`。未驗證為 401、修改權限不符為 403、資料不存在為 404、日期／供應狀態／重複下單衝突為 409。此遷移保留現有第 18 版後端行為，未擅自變更 D1 schema 或商業規則。
