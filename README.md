# easy-eat

餐廳點餐系統前端專案，提供客服小姐管理訂單、點餐統計及後台參數設定功能。

---

## Tech Stack

| 技術 | 版本 |
|------|------|
| Vue.js | 3.2 |
| TypeScript | 4.8 |
| Vue Router | 4.x |
| Pinia | 3.x |
| Vite | 4.x |

---

## 專案結構

```
easy-eat/
├── easy-eat-front/         # Vue 3 前端應用程式
│   ├── src/
│   │   ├── views/              # 頁面組件
│   │   │   ├── OrderListView       # 訂單清單（首頁）
│   │   │   ├── OrderAddView        # 新增訂單
│   │   │   ├── OrderDetailView     # 訂單詳細
│   │   │   ├── MealStatisticsView  # 餐點統計表
│   │   │   └── AdminView           # 後台管理（餐廳、餐點 CRUD）
│   │   ├── router/             # Vue Router 路由設定
│   │   ├── stores/             # Pinia 狀態管理
│   │   ├── components/         # 共用元件件
│   │   └── assets/             # 靜態資源
│   ├── package.json
│   └── vite.config.ts
├── page/                   # 靜態原型頁面
├── reference/              # 參考資料
└── API.md                  # API 文件
```

---

## 快速開始

**環境需求**：Node.js 18+

```bash
cd easy-eat-front

# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 編譯生產版
npm run build
```

---

## 頁面路由

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/` | OrderListView | 訂單清單（首頁） |
| `/orders/add` | OrderAddView | 新增訂單 |
| `/orders/:id` | OrderDetailView | 訂單詳細 |
| `/statistics` | MealStatisticsView | 餐點統計表 |
| `/admin` | AdminView | 後台管理 |

---

## 參考資源

- [AdminLTE](https://github.com/ColorlibHQ/AdminLTE)
- [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)
- [vue-admin-template](https://github.com/PanJiaChen/vue-admin-template)
- [vue3-realworld-example-app](https://github.com/mutoe/vue3-realworld-example-app)

