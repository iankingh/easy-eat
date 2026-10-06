# 餐點統計規格 / Meal Statistics Specification

## Purpose

聚合訂單中的餐點資料，產生各餐點的數量與金額統計，供統計頁面呈現。統計僅納入有效訂單，排除草稿與取消訂單。

## Requirements

### Requirement: 統計資料模型

系統 SHALL 以 `MealStatistic` 結構回傳每筆統計，包含：

- `name`: 餐點名稱
- `price`: 餐點單價
- `quantity`: 該餐點的總數量
- `total`: 該餐點的總金額（`price * quantity`）

##### Example:

```json
{ "name": "牛肉麵", "price": 120, "quantity": 5, "total": 600 }
```

### Requirement: 納入訂單範圍

系統 SHALL 僅納入 `pending` 與 `completed` 訂單的餐點。系統 SHALL 排除 `draft` 與 `cancelled` 訂單。

##### Example:

四筆訂單各含「牛肉麵 x1」：

| 訂單狀態 | 納入統計？ |
|----------|-----------|
| draft | 否 |
| pending | 是 |
| completed | 是 |
| cancelled | 否 |

結果：`{ name: "牛肉麵", price: 120, quantity: 2, total: 240 }`。

### Requirement: 餐點分組鍵

系統 SHALL 以 `name` 與 `price` 的組合作為分組鍵。相同名稱但不同單價的餐點 SHALL 分別計算。

##### Example:

兩筆訂單：
- 訂單 A：`{ name: "牛肉麵", price: 120, quantity: 1 }`
- 訂單 B：`{ name: "牛肉麵", price: 150, quantity: 1 }`

結果為兩筆統計：
- `{ name: "牛肉麵", price: 120, quantity: 1, total: 120 }`
- `{ name: "牛肉麵", price: 150, quantity: 1, total: 150 }`

### Requirement: 排序規則

系統 SHALL 依 `quantity` 由大到小排序。數量相同時，SHALL 依 `name` 以中文語系（`zh-TW`）由小到大排序。

##### Example:

三筆統計：

| name | price | quantity |
|------|-------|----------|
| 牛肉麵 | 120 | 5 |
| 豬肉飯 | 80 | 5 |
| 湯 | 30 | 3 |

排序結果：`[牛肉麵(5), 豬肉飯(5), 湯(3)]`（牛肉麵與豬肉飯數量相同，`zh-TW` 排序下「牛肉麵」<「豬肉飯」）。

### Requirement: 聚合計算

對於分組鍵相同的餐點項目，系統 SHALL 累加 `quantity` 並累加 `total`（`price * quantity`）。

##### Example:

同一分組鍵 `牛肉麵:120` 出現於三筆 `completed` 訂單，數量分別為 1、2、1：
- `quantity = 1 + 2 + 1 = 4`
- `total = 120*1 + 120*2 + 120*1 = 480`