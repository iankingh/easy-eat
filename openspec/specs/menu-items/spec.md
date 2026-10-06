# 餐點規格 / Menu Items Specification

## Purpose

管理餐廳內餐點的建立、更新、啟用停用與刪除。餐點透過 `categoryId` 關聯分類，其價格與啟用狀態影響訂單建立與統計。餐點的刪除受到訂單使用狀態保護。

## Requirements

### Requirement: 餐點資料模型

系統 SHALL 以 `MenuItem` 結構保存每項餐點，包含：

- `id`: 唯一識別碼
- `name`: 餐點名稱
- `price`: 價格（正整數）
- `categoryId`: 關聯的分類 ID
- `enabled`: 啟用狀態

##### Example:

```json
{ "id": "m1", "name": "牛肉麵", "price": 120, "categoryId": "c1", "enabled": true }
```

### Requirement: 建立餐點

系統 SHALL 允許在指定餐廳下以 `MenuItemInput`（含 `name`、`price`、`categoryId`）建立餐點。建立時 SHALL 驗證：

- 餐廳存在
- `name` 非空（trim 後）
- `price` 為大於 0 的整數
- `categoryId` 指向已存在的分類
- 新餐點預設 `enabled` 為 `true`

##### Example:

建立 `{ name: "豬肉飯", price: 80, categoryId: "c1" }` 於餐廳 `r1` → 回傳 `{ id: "m3", name: "豬肉飯", price: 80, categoryId: "c1", enabled: true }`。
建立 `{ name: "湯", price: 0, categoryId: "c1" }` → 拒絕，錯誤訊息「價格必須為大於 0 的整數」。
建立 `{ name: "湯", price: 50, categoryId: "c999" }` → 拒絕，錯誤訊息「找不到餐點分類」。

### Requirement: 更新餐點

系統 SHALL 允許更新餐點的 `name`、`price`、`categoryId`。更新時 SHALL 重新驗證與建立相同的條件。餐廳或餐點不存在時 SHALL 拋出錯誤。

##### Example:

更新餐廳 `r999` 的餐點 `m1` → 拋出「找不到餐廳資料」。

### Requirement: 啟用停用餐點

系統 SHALL 允許切換餐點的 `enabled` 狀態。停用餐點不可被加入新訂單或訂單更新。

##### Example:

餐點 `m1` 已停用，建立訂單包含 `menuItemId: "m1"` → 拒絕，錯誤訊息「餐點『牛肉麵』目前未啟用」。

### Requirement: 停用分類連動

當餐點所屬分類被停用時，該餐點 SHALL 不可被加入新訂單，即使餐點本身仍為啟用狀態。

##### Example:

餐點 `m1` 啟用、但其分類 `c1` 停用 → 建立訂單包含 `m1` → 拒絕，錯誤訊息「餐點『牛肉麵』目前未啟用」。

### Requirement: 刪除餐點保護

系統 SHALL 拒絕刪除仍被 `draft` 或 `pending` 訂單使用的餐點。系統 SHALL 允許刪除僅被 `completed` 或 `cancelled` 訂單使用（或未被使用）的餐點。

##### Example:

餐點 `m1` 在一筆 `pending` 訂單中 → 刪除被拒絕，錯誤訊息「此餐點仍在草稿或處理中的訂單內，無法刪除」。
餐點 `m2` 僅在 `completed` 訂單中 → 刪除允許。

### Requirement: 識別碼產生

系統 SHALL 為新餐點產生格式為 `m<序號>` 的 ID，序號為全域遞增整數。