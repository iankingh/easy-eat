# easy-eat API 文件

---

## 訂單管理

### 取得所有訂單

```
GET /api/orders
```

**Response**
```json
[
  {
    "id": 1,
    "restaurantName": "香港茶樓",
    "totalAmount": 250,
    "createdAt": "2024-01-15T12:00:00",
    "items": [...]
  }
]
```

---

### 新增訂單

```
POST /api/orders
```

**Request Body**
```json
{
  "restaurantId": 1,
  "items": [
    {
      "mealId": 101,
      "quantity": 2,
      "note": "少冰"
    }
  ]
}
```

**Response**
```json
{
  "id": 42,
  "restaurantName": "香港茶樓",
  "totalAmount": 150,
  "createdAt": "2024-01-15T12:30:00"
}
```

---

### 取得單筆訂單詳細

```
GET /api/orders/{id}
```

**Response**
```json
{
  "id": 42,
  "restaurantName": "香港茶樓",
  "items": [
    {
      "mealName": "炒飯",
      "quantity": 2,
      "price": 75,
      "note": "少冰"
    }
  ],
  "totalAmount": 150,
  "createdAt": "2024-01-15T12:30:00"
}
```

---

### 餐點統計表

```
GET /api/orders/statistics
```

**Response**
```json
[
  {
    "mealName": "炒飯",
    "totalQuantity": 15,
    "totalAmount": 1125
  }
]
```

---

## 後台管理

### 餐廳 CRUD

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/api/restaurants` | 取得所有餐廳 |
| `POST` | `/api/restaurants` | 新增餐廳 |
| `PUT` | `/api/restaurants/{id}` | 修改餐廳 |
| `DELETE` | `/api/restaurants/{id}` | 刪除餐廳 |

**新增餐廳 Request Body**
```json
{
  "name": "香港茶樓",
  "description": "港式美食"
}
```

---

### 餐點 CRUD

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/api/restaurants/{id}/meals` | 取得餐廳所有餐點 |
| `POST` | `/api/meals` | 新增餐點 |
| `PUT` | `/api/meals/{id}` | 修改餐點 |
| `DELETE` | `/api/meals/{id}` | 刪除餐點 |

**新增餐點 Request Body**
```json
{
  "restaurantId": 1,
  "name": "炒飯",
  "price": 75,
  "category": "主食"
}
```

