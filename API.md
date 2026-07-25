# easy-eat API 文件

> 目前前端使用 **Mock Server**（`src/mock/server.ts`）模擬所有 API，資料持久化於 `localStorage`。  
> 換接真實後端時只需修改 `src/api/` 目錄下的實作即可，service / store 層不需調整。

---

## 資料模型

### OrderStatus

```ts
type OrderStatus = 'pending' | 'completed' | 'cancelled'
```

| 值 | 說明 |
|----|------|
| `pending` | 處理中（新建訂單預設） |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

### Order

```ts
interface Order {
  id: string            // 系統內部 ID
  orderId: string       // 顯示用訂單編號（格式：YYYYMMDD-HHmmss-NNNNN）
  restaurantId: string
  restaurantName: string
  items: OrderItem[]
  totalAmount: number
  status: OrderStatus
  createdAt: string     // ISO 8601
}
```

### OrderItem

```ts
interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  note: string
}
```

### Restaurant

```ts
interface Restaurant {
  id: string
  name: string
  menuItems: MenuItem[]
}
```

### MenuItem

```ts
interface MenuItem {
  id: string
  name: string
  price: number
  category: string   // '食物' | '飲料' | '點心' | '套餐' | '其他'
}
```

### MealStatistic

```ts
interface MealStatistic {
  name: string
  price: number
  quantity: number   // 所有訂單的總數量
  total: number      // 總金額
}
```

---

## 訂單管理

### 取得所有訂單

```
GET /api/orders
```

**Response** `Order[]`（依 `createdAt` 降序排列）

---

### 取得單筆訂單

```
GET /api/orders/{id}
```

**Response** `Order | null`

---

### 新增訂單

```
POST /api/orders
```

**Request Body** `CreateOrderInput`
```ts
interface CreateOrderInput {
  restaurantId: string
  items: CreateOrderItemInput[]
}

interface CreateOrderItemInput {
  menuItemId: string
  quantity: number   // 正整數
  note: string
}
```

**Response** `Order`（`status` 預設為 `"pending"`）

---

### 更新訂單狀態

```
PATCH /api/orders/{id}/status
```

**Request Body**
```json
{ "status": "completed" }
```

允許值：`"pending"` | `"completed"` | `"cancelled"`

**Response** `Order`（更新後的完整訂單）

---

### 刪除訂單

```
DELETE /api/orders/{id}
```

**Response** `void`

---

### 餐點統計表

```
GET /api/orders/statistics
```

**Response** `MealStatistic[]`（依總數量降序排列）

---

## 後台管理

### 餐廳 CRUD

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/api/restaurants` | 取得所有餐廳 |
| `POST` | `/api/restaurants` | 新增餐廳 |
| `PUT` | `/api/restaurants/{id}` | 修改餐廳名稱 |
| `DELETE` | `/api/restaurants/{id}` | 刪除餐廳（含其所有餐點） |

**新增 / 修改餐廳 Request Body**
```json
{ "name": "餐廳名稱" }
```

**Response** `Restaurant`

---

### 餐點 CRUD

| Method | Path | 說明 |
|--------|------|------|
| `POST` | `/api/restaurants/{id}/items` | 新增餐點 |
| `PUT` | `/api/restaurants/{id}/items/{itemId}` | 修改餐點 |
| `DELETE` | `/api/restaurants/{id}/items/{itemId}` | 刪除餐點 |

**新增 / 修改餐點 Request Body** `MenuItemInput`
```ts
interface MenuItemInput {
  name: string
  price: number      // 大於 0 的正整數
  category: string
}
```

**Response** `MenuItem`

---

### 重置 Mock 資料

```
POST /api/mock/reset
```

清空所有訂單，並還原 4 間預設餐廳及其菜單。

**Response** `void`
