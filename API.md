# Easy Eat Mock API

> 目前沒有獨立 HTTP 伺服器；`easy-eat-front/src/api/` 直接呼叫 [`mock/server.ts`](easy-eat-front/src/mock/server.ts) 的非同步函式。下列路徑是未來後端 API 的對應介面，現行資料則持久化於 `localStorage`。

## 資料模型

### 訂單

```ts
type OrderStatus = "draft" | "pending" | "completed" | "cancelled";
type EditableOrderStatus = "draft" | "pending";

interface Order {
  id: string;
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string; // ISO 8601
}

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

interface CreateOrderInput {
  restaurantId: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    note: string;
  }>;
}

type UpdateOrderInput = CreateOrderInput;
```

狀態轉換：

```text
draft ──送出──> pending ──> completed
                         └─> cancelled
```

- `draft` 與 `pending` 可修改餐廳及餐點內容。
- 只有 `draft` 可透過送出操作轉為 `pending`。
- 只有 `pending` 可轉為 `completed` 或 `cancelled`。
- 草稿會與其他訂單一樣寫入 `localStorage`，重新整理後仍保留。

### 餐廳、餐點與分類

```ts
interface Restaurant {
  id: string;
  name: string;
  enabled: boolean;
  menuItems: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  enabled: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  enabled: boolean;
}
```

餐點以 `categoryId` 關聯 `MenuCategory`，不再儲存自由文字 `category`。建立或更新訂單時，餐廳、餐點及其分類皆須為啟用狀態。

## 訂單介面

| Method   | Path                      | Mock 函式                           | 說明                                             |
| -------- | ------------------------- | ----------------------------------- | ------------------------------------------------ |
| `GET`    | `/api/orders`             | `listOrders()`                      | 依建立時間由新到舊取得訂單                       |
| `GET`    | `/api/orders/{id}`        | `getOrderById(id)`                  | 取得單筆訂單，不存在時回傳 `null`                |
| `POST`   | `/api/orders`             | `createOrder(payload, status)`      | 建立 `draft` 或 `pending` 訂單；預設為 `pending` |
| `PUT`    | `/api/orders/{id}`        | `updateOrder(id, payload)`          | 更新 `draft` 或 `pending` 的內容與總額           |
| `POST`   | `/api/orders/{id}/submit` | `submitOrder(id)`                   | 重新驗證內容並將草稿送出為 `pending`             |
| `PATCH`  | `/api/orders/{id}/status` | `updateOrderStatus(id, { status })` | 依允許的狀態流程更新                             |
| `DELETE` | `/api/orders/{id}`        | `deleteOrder(id)`                   | 刪除訂單                                         |
| `GET`    | `/api/orders/statistics`  | `listMealStatistics()`              | 取得餐點數量與金額統計                           |

新增與更新訂單使用 `CreateOrderInput`／`UpdateOrderInput`。餐點不可重複、數量須為大於 `0` 的整數，且至少須有一項餐點。統計包含 `pending` 與 `completed`，排除 `draft` 與 `cancelled`。

## 餐廳介面

| Method   | Path                            | Mock 函式                           | 說明               |
| -------- | ------------------------------- | ----------------------------------- | ------------------ |
| `GET`    | `/api/restaurants`              | `listRestaurants()`                 | 取得所有餐廳及菜單 |
| `POST`   | `/api/restaurants`              | `createRestaurant(payload)`         | 新增餐廳，預設啟用 |
| `PUT`    | `/api/restaurants/{id}`         | `updateRestaurant(id, payload)`     | 修改餐廳名稱       |
| `PATCH`  | `/api/restaurants/{id}/enabled` | `setRestaurantEnabled(id, enabled)` | 啟用或停用餐廳     |
| `DELETE` | `/api/restaurants/{id}`         | `deleteRestaurant(id)`              | 刪除餐廳           |

```ts
interface RestaurantInput {
  name: string;
}
```

若餐廳仍有 `draft` 或 `pending` 訂單，刪除會被拒絕。

## 餐點介面

| Method   | Path                                           | Mock 函式                                           | 說明                 |
| -------- | ---------------------------------------------- | --------------------------------------------------- | -------------------- |
| `POST`   | `/api/restaurants/{id}/items`                  | `createMenuItem(restaurantId, payload)`             | 新增餐點，預設啟用   |
| `PUT`    | `/api/restaurants/{id}/items/{itemId}`         | `updateMenuItem(restaurantId, itemId, payload)`     | 修改名稱、價格與分類 |
| `PATCH`  | `/api/restaurants/{id}/items/{itemId}/enabled` | `setMenuItemEnabled(restaurantId, itemId, enabled)` | 啟用或停用餐點       |
| `DELETE` | `/api/restaurants/{id}/items/{itemId}`         | `deleteMenuItem(restaurantId, itemId)`              | 刪除餐點             |

```ts
interface MenuItemInput {
  name: string;
  price: number;
  categoryId: string;
}
```

價格須為大於 `0` 的整數，且 `categoryId` 必須存在。若餐點仍被 `draft` 或 `pending` 訂單使用，刪除會被拒絕。

## 分類介面

| Method   | Path                           | Mock 函式                         | 說明               |
| -------- | ------------------------------ | --------------------------------- | ------------------ |
| `GET`    | `/api/categories`              | `listCategories()`                | 取得所有分類       |
| `POST`   | `/api/categories`              | `createCategory(payload)`         | 新增分類，預設啟用 |
| `PUT`    | `/api/categories/{id}`         | `updateCategory(id, payload)`     | 修改分類名稱       |
| `PATCH`  | `/api/categories/{id}/enabled` | `setCategoryEnabled(id, enabled)` | 啟用或停用分類     |
| `DELETE` | `/api/categories/{id}`         | `deleteCategory(id)`              | 刪除分類           |

```ts
interface MenuCategoryInput {
  name: string;
}
```

分類名稱不可為空或重複。只要仍有任何餐點使用該分類，刪除就會被拒絕。

## Mock 儲存與遷移

- 儲存鍵：`easy-eat-mock-db-v1`
- 現行 schema：`version: 2`
- `readDatabase()` 讀取後會正規化並回寫資料；無資料或 JSON 損毀時才重建預設資料。
- 舊資料中的餐廳、餐點、訂單與流水號會盡量保留。
- 舊餐點的 `category` 字串會對應既有分類，必要時建立分類，再轉存為 `categoryId`。
- 舊資料缺少 `enabled` 時視為 `true`；未知訂單狀態會正規化為 `pending`。

重置介面：

| Method | Path              | Mock 函式               | 說明                               |
| ------ | ----------------- | ----------------------- | ---------------------------------- |
| `POST` | `/api/mock/reset` | `resetMockServerData()` | 清空訂單並還原預設分類、餐廳及餐點 |

## 相關文件

- [專案入口](README.md)
- [前端開發說明](easy-eat-front/README.md)
- [外部參考來源](docs/REFERENCES.md)
