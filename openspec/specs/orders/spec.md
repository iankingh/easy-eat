# 訂單規格 / Orders Specification

## Purpose

管理訂單的完整生命週期：建立草稿或處理中訂單、編輯內容、送出草稿、更新狀態、刪除，以及查詢訂單清單與單筆明細。訂單是系統的核心實體，連結餐廳與餐點，並驅動餐點統計。

## Requirements

### Requirement: 訂單資料模型

系統 SHALL 以 `Order` 結構保存每筆訂單，包含以下欄位：

- `id`: 系統內部唯一識別碼
- `orderId`: 對外顯示的訂單編號（格式 `YYYYMMDD-HHMMSS-NNNNN`）
- `restaurantId`: 關聯餐廳 ID
- `restaurantName`: 下單時的餐廳名稱快照
- `items`: `OrderItem[]`，每項含 `menuItemId`、`name`、`price`、`quantity`、`note`
- `totalAmount`: 訂單總金額（各項 `price * quantity` 之總和）
- `status`: `draft` | `pending` | `completed` | `cancelled`
- `createdAt`: ISO 8601 建立時間

##### Example:

```json
{
  "id": "o17247648000001",
  "orderId": "20240827-120000-00001",
  "restaurantId": "r1",
  "restaurantName": "好吃餐廳",
  "items": [
    { "menuItemId": "m1", "name": "牛肉麵", "price": 120, "quantity": 2, "note": "不要蔥" }
  ],
  "totalAmount": 240,
  "status": "pending",
  "createdAt": "2024-08-27T04:00:00.000Z"
}
```

### Requirement: 訂單狀態轉換

系統 SHALL 僅允許以下狀態轉換：

- `draft` → `pending`（送出草稿）
- `pending` → `completed`
- `pending` → `cancelled`
- `completed` 與 `cancelled` 為終態，不可再轉換

系統 SHALL 在收到不允許的轉換時拒絕操作。

##### Example:

| 當前狀態 | 目標狀態 | 結果 |
|----------|----------|------|
| draft | pending | 允許 |
| draft | completed | 拒絕 |
| pending | completed | 允許 |
| pending | cancelled | 允許 |
| completed | cancelled | 拒絕 |
| cancelled | pending | 拒絕 |

### Requirement: 建立訂單

系統 SHALL 允許建立 `draft` 或 `pending` 訂單，預設為 `pending`。建立時 SHALL 驗證：

- 餐廳必須存在且為啟用狀態
- 每項餐點必須存在於該餐廳、為啟用狀態，且其分類也為啟用狀態
- 餐點不可重複（同一 `menuItemId` 不可出現兩次）
- 數量必須為大於 0 的整數
- 至少須包含一項餐點
- `note` 會被 trim，缺失時為空字串

系統 SHALL 在訂單建立後，將其插入訂單清單最前方。

##### Example:

建立 `{ restaurantId: "r1", items: [{ menuItemId: "m1", quantity: 2, note: "不要蔥" }] }`：
- 餐廳 `r1` 存在且啟用 → 通過
- 餐點 `m1` 存在且啟用 → 通過
- 數量 `2` 為正整數 → 通過
- 結果：建立一筆 `pending` 訂單，`totalAmount = price * 2`

### Requirement: 更新訂單內容

系統 SHALL 僅允許 `draft` 或 `pending` 訂單更新內容（餐廳、餐點項目）。更新時 SHALL 重新驗證所有餐點條件（與建立相同），並重算 `totalAmount`。終態訂單（`completed`、`cancelled`）不可編輯。

##### Example:

訂單狀態為 `completed` 時呼叫更新 → 拒絕，錯誤訊息「只有草稿或處理中的訂單可以編輯」。

### Requirement: 送出草稿

系統 SHALL 僅允許 `draft` 訂單送出為 `pending`。送出時 SHALL 重新驗證餐廳與所有餐點的啟用狀態，並重算 `totalAmount` 與更新餐廳名稱快照。非草稿訂單送出 SHALL 被拒絕。

##### Example:

訂單狀態為 `pending` 時呼叫送出 → 拒絕，錯誤訊息「只有草稿訂單可以送出」。

### Requirement: 更新訂單狀態

系統 SHALL 接受 `UpdateOrderStatusInput`（含 `status` 欄位）更新訂單狀態。系統 SHALL 驗證：

- `status` 為有效值（`draft` | `pending` | `completed` | `cancelled`）
- 該轉換符合狀態轉換規則

##### Example:

`{ status: "completed" }` 作用於 `pending` 訂單 → 允許，訂單變為 `completed`。
`{ status: "invalid" }` → 拒絕，錯誤訊息「無效的訂單狀態」。

### Requirement: 刪除訂單

系統 SHALL 允許刪除任意訂單，不論狀態。刪除不存在的訂單 SHALL 不變更任何資料，也不 SHALL 報錯。

##### Example:

刪除 ID `o999`（不存在）→ 訂單清單不變，不拋出錯誤。

### Requirement: 查詢訂單清單

系統 SHALL 回傳所有訂單，依 `createdAt` 由新到舊排序。

##### Example:

三筆訂單建立時間為 `T1 < T2 < T3` → 回傳順序為 `[T3, T2, T1]`。

### Requirement: 查詢單筆訂單

系統 SHALL 依 ID 回傳單筆訂單。不存在時 SHALL 回傳 `null`，不 SHALL 拋出錯誤。

##### Example:

查詢 ID `o999`（不存在）→ 回傳 `null`。

### Requirement: 草稿持久化

系統 SHALL 將草稿（`draft`）訂單與其他訂單一併寫入持久化儲存，重新整理後仍保留。