# 餐廳規格 / Restaurants Specification

## Purpose

管理餐廳實體的建立、查詢、更名、啟用停用與刪除。餐廳是訂單的容器，其啟用狀態決定是否可被選用於新訂單。餐廳內含餐點清單，但餐點的 CRUD 屬於 menu-items capability。

## Requirements

### Requirement: 餐廳資料模型

系統 SHALL 以 `Restaurant` 結構保存每間餐廳，包含：

- `id`: 唯一識別碼
- `name`: 餐廳名稱
- `enabled`: 啟用狀態（`true` / `false`）
- `menuItems`: `MenuItem[]`，該餐廳的餐點清單

##### Example:

```json
{
  "id": "r1",
  "name": "好吃餐廳",
  "enabled": true,
  "menuItems": [
    { "id": "m1", "name": "牛肉麵", "price": 120, "categoryId": "c1", "enabled": true }
  ]
}
```

### Requirement: 查詢餐廳清單

系統 SHALL 回傳所有餐廳，包含其完整餐點清單。回傳順序 SHALL 維持建立順序。

### Requirement: 建立餐廳

系統 SHALL 允許以 `RestaurantInput`（含 `name`）建立餐廳。建立時 SHALL：

- 驗證 `name` 非空（trim 後）
- 新餐廳預設 `enabled` 為 `true`
- 新餐廳的 `menuItems` 為空陣列

##### Example:

建立 `{ name: "新餐廳" }` → 回傳 `{ id: "r5", name: "新餐廳", enabled: true, menuItems: [] }`。
建立 `{ name: "  " }` → 拒絕，錯誤訊息「餐廳名稱不可為空」。

### Requirement: 更新餐廳名稱

系統 SHALL 允許以 `RestaurantInput` 更新餐廳名稱。更新時 SHALL 驗證 `name` 非空（trim 後）。餐廳不存在時 SHALL 拋出錯誤。

##### Example:

更新不存在的餐廳 ID `r999` → 拋出「找不到餐廳資料」。

### Requirement: 啟用停用餐廳

系統 SHALL 允許切換餐廳的 `enabled` 狀態。停用餐廳不 SHALL 影響已存在的訂單，但該餐廳不可被選用於新訂單或訂單更新。

##### Example:

餐廳 `r1` 已停用，建立訂單 `{ restaurantId: "r1", items: [...] }` → 拒絕，錯誤訊息「此餐廳目前未啟用」。

### Requirement: 刪除餐廳保護

系統 SHALL 拒絕刪除仍有 `draft` 或 `pending` 訂單關聯的餐廳。系統 SHALL 允許刪除僅有 `completed` 或 `cancelled` 訂單（或無訂單）的餐廳。

##### Example:

餐廳 `r1` 有一筆 `pending` 訂單 → 刪除被拒絕，錯誤訊息「此餐廳仍有草稿或處理中的訂單，無法刪除」。
餐廳 `r2` 僅有 `completed` 訂單 → 刪除允許。

### Requirement: 識別碼產生

系統 SHALL 為新餐廳產生格式為 `r<序號>` 的 ID，序號為全域遞增整數。