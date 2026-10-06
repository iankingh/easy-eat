# 餐點分類規格 / Menu Categories Specification

## Purpose

管理餐點分類的建立、查詢、更名、啟用停用與刪除。分類透過 `categoryId` 被餐點引用，其啟用狀態連動影響餐點能否被加入訂單。分類的刪除受到餐點使用狀態保護。

## Requirements

### Requirement: 分類資料模型

系統 SHALL 以 `MenuCategory` 結構保存每個分類，包含：

- `id`: 唯一識別碼
- `name`: 分類名稱
- `enabled`: 啟用狀態

##### Example:

```json
{ "id": "c1", "name": "主餐", "enabled": true }
```

### Requirement: 查詢分類清單

系統 SHALL 回傳所有分類。回傳順序 SHALL 維持建立順序。

### Requirement: 建立分類

系統 SHALL 允許以 `MenuCategoryInput`（含 `name`）建立分類。建立時 SHALL：

- 驗證 `name` 非空（trim 後）
- 驗證 `name` 不與現有分類重複（不分大小寫）
- 新分類預設 `enabled` 為 `true`

##### Example:

建立 `{ name: "主餐" }` → 回傳 `{ id: "c3", name: "主餐", enabled: true }`。
建立 `{ name: "主餐" }` 而 `主餐` 已存在 → 拒絕，錯誤訊息「分類名稱不可重複」。
建立 `{ name: "MAIN" }` 而 `main` 已存在 → 拒絕（不分大小寫比對）。

### Requirement: 更新分類名稱

系統 SHALL 允許以 `MenuCategoryInput` 更新分類名稱。更新時 SHALL：

- 驗證 `name` 非空（trim 後）
- 驗證 `name` 不與其他分類重複（排除自身，不分大小寫）
- 分類不存在時 SHALL 拋出錯誤

##### Example:

分類 `c1` 更新為 `{ name: "主餐類" }` 而無其他分類同名 → 允許。
分類 `c1` 更新為與 `c2` 同名 → 拒絕，錯誤訊息「分類名稱不可重複」。

### Requirement: 啟用停用分類

系統 SHALL 允許切換分類的 `enabled` 狀態。停用分類 SHALL 連動使該分類下的餐點無法被加入新訂單（即使餐點本身啟用）。

##### Example:

分類 `c1` 停用 → 其下餐點 `m1`（啟用）無法被加入訂單，錯誤訊息「餐點『牛肉麵』目前未啟用」。

### Requirement: 刪除分類保護

系統 SHALL 拒絕刪除仍被任何餐點引用的分類，不分餐點啟用狀態。系統 SHALL 允許刪除無任何餐點引用的分類。

##### Example:

分類 `c1` 下有餐點 `m1`（不論啟停用）→ 刪除被拒絕，錯誤訊息「此分類仍有餐點使用，無法刪除」。
分類 `c2` 無餐點引用 → 刪除允許。

### Requirement: 識別碼產生

系統 SHALL 為新分類產生格式為 `c<序號>` 的 ID，序號為全域遞增整數。