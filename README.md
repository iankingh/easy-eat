# easy-eat

餐廳點餐系統前端專案，提供客服小姐管理訂單、點餐統計及後台參數設定功能。

---

## Tech Stack

| 技術 | 版本 |
|------|------|
| Vue.js | 3.5 |
| TypeScript | 6.x |
| Vue Router | 4.x |
| Pinia | 3.x |
| Vite | 8.x |
| Vitest | 4.x |

---

## 功能特色

- **訂單管理** — 新增、查看、刪除訂單；支援狀態流程 `處理中 → 已完成 / 已取消`
- **訂單篩選** — 依狀態、餐廳名稱、日期區間即時過濾訂單
- **訂單詳細** — 展示完整明細並可於詳細頁更新訂單狀態
- **餐點統計** — 統計各餐點總數量與總金額，附排名徽章
- **後台管理** — 餐廳與餐點的完整 CRUD（含分類管理）
- **Toast 通知** — 以非侵入式 Toast 取代 `alert()`，提升使用體驗

---

## 專案結構

```
easy-eat/
├── easy-eat-front/         # Vue 3 前端應用程式
│   ├── src/
│   │   ├── api/                # API 呼叫層（對接 mock 或真實後端）
│   │   ├── composables/        # 共用 Composition API（useToast）
│   │   ├── components/         # 共用元件（AppSidebar, ToastNotification）
│   │   ├── mock/               # Mock server（localStorage 模擬後端）
│   │   ├── router/             # Vue Router 路由設定
│   │   ├── services/           # 業務邏輯服務層
│   │   ├── stores/             # Pinia 狀態管理
│   │   ├── types/              # TypeScript 型別定義
│   │   └── views/              # 頁面元件
│   │       ├── OrderListView       # 訂單清單（首頁）+ 篩選
│   │       ├── OrderAddView        # 新增訂單
│   │       ├── OrderDetailView     # 訂單詳細 + 狀態更新
│   │       ├── MealStatisticsView  # 餐點統計表
│   │       └── AdminView           # 後台管理（餐廳、餐點 CRUD）
│   ├── package.json
│   └── vite.config.ts          # Vite + Vitest 設定
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

# 執行測試
npm test

# 執行測試（watch 模式）
npm run test:watch

# 執行測試並產生覆蓋率報告
npm run test:coverage

# 編譯生產版
npm run build
```

---

## 頁面路由

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/` | OrderListView | 訂單清單（含篩選） |
| `/orders/add` | OrderAddView | 新增訂單 |
| `/orders/:id` | OrderDetailView | 訂單詳細 + 更新狀態 |
| `/statistics` | MealStatisticsView | 餐點統計表 |
| `/admin` | AdminView | 後台管理 |

---

## 訂單狀態流程

```
pending（處理中）
    ├─→ completed（已完成）
    └─→ cancelled（已取消）
```

---

## 測試覆蓋範圍

| 測試檔案 | 說明 |
|---------|------|
| `src/mock/server.test.ts` | Mock server 完整 CRUD 與邊界測試（29 tests） |
| `src/stores/order.test.ts` | 訂單 Store 行為測試（filter、status、statistics） |
| `src/stores/restaurant.test.ts` | 餐廳 Store CRUD 測試 |

---

## 參考資源

- [AdminLTE](https://github.com/ColorlibHQ/AdminLTE)
- [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)
- [vue-admin-template](https://github.com/PanJiaChen/vue-admin-template)
- [vue3-realworld-example-app](https://github.com/mutoe/vue3-realworld-example-app)


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
| `/` | OrderListView | 訂單清單（含篩選） |
| `/orders/add` | OrderAddView | 新增訂單 |
| `/orders/:id` | OrderDetailView | 訂單詳細 + 更新狀態 |
| `/statistics` | MealStatisticsView | 餐點統計表 |
| `/admin` | AdminView | 後台管理 |

---

## 訂單狀態流程

```
pending（處理中）
    ├─→ completed（已完成）
    └─→ cancelled（已取消）
```

---

## 測試覆蓋範圍

| 測試檔案 | 說明 |
|---------|------|
| `src/mock/server.test.ts` | Mock server 完整 CRUD 與邊界測試（29 tests） |
| `src/stores/order.test.ts` | 訂單 Store 行為測試（filter、status、statistics） |
| `src/stores/restaurant.test.ts` | 餐廳 Store CRUD 測試 |

---

## 參考資源

- [AdminLTE](https://github.com/ColorlibHQ/AdminLTE)
- [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)
- [vue-admin-template](https://github.com/PanJiaChen/vue-admin-template)
- [vue3-realworld-example-app](https://github.com/mutoe/vue3-realworld-example-app)

