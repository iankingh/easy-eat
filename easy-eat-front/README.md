# Easy Eat Frontend

Easy Eat 的 Vue 3 + TypeScript 單頁應用程式。現階段由 Mock API 與 `localStorage` 提供可持久化的前端資料層，不需啟動後端服務。

## 環境需求

- Node.js `^20.19.0`、`^22.13.0` 或 `>=24`
- npm

## 快速開始

```bash
npm install
npm run dev
```

## 目前功能

- 訂單草稿建立、保存、編輯與送出
- `draft`／`pending` 訂單內容編輯
- `pending` 訂單完成或取消
- 訂單關鍵字搜尋、狀態／餐廳／日期篩選、多欄排序及每頁 20 筆分頁
- 餐點統計（排除草稿與取消訂單）
- 餐廳、餐點、餐點分類 CRUD 與啟用狀態管理
- 刪除餐廳、餐點及分類時的關聯資料保護
- Mock schema 自動遷移及預設資料重置

## 架構

```text
src/
├── api/          # 前端 API 介面，目前委派給 Mock Server
├── components/   # 共用與訂單元件
├── composables/  # Composition API 工具
├── constants/    # 狀態標籤、轉換規則與分頁設定
├── mock/         # localStorage 資料庫、遷移與非同步 Mock Server
├── router/       # Vue Router
├── services/     # 業務資料轉換與 API 封裝
├── stores/       # Pinia 狀態、搜尋、篩選、排序與分頁
├── types/        # Order、Restaurant、MenuItem、MenuCategory 型別
├── utils/        # 共用工具
└── views/        # 路由頁面
```

資料流：

```text
View → Pinia Store → Service → API → Mock Server → localStorage
```

Mock DB 使用 `easy-eat-mock-db-v1`，目前 schema 版本為 `2`。讀取舊資料時會保留可用的餐廳、餐點及訂單，將舊 `category` 字串遷移為 `categoryId`，並為缺少的 `enabled` 補上啟用狀態。

## 訂單規則

```text
draft ──送出──> pending ──> completed
                         └─> cancelled
```

- `draft` 與 `pending` 可編輯內容。
- `draft` 儲存後會持久化，可稍後繼續編輯及送出。
- 停用的餐廳、餐點或分類不可用於建立、更新或送出訂單。

## 現有路由

| 路徑               | 功能                 |
| ------------------ | -------------------- |
| `/`                | 訂單清單             |
| `/orders/add`      | 新增訂單             |
| `/orders/:id/edit` | 編輯草稿或處理中訂單 |
| `/orders/:id`      | 訂單明細             |
| `/statistics`      | 餐點統計             |
| `/admin`           | 餐廳、餐點與分類管理 |
| `/:pathMatch(.*)*` | 找不到頁面（404）    |

## 開發指令

```bash
npm run dev            # 開發伺服器
npm run build          # 型別檢查並建立正式版
npm run build-only     # 僅建立正式版
npm run preview        # 預覽正式版
npm run type-check     # TypeScript / Vue 型別檢查
npm test               # 執行測試
npm run test:watch     # 監看模式測試
npm run test:coverage  # 測試覆蓋率
npm run lint           # ESLint 檢查
npm run lint:fix       # 自動修正 ESLint 問題
npm run format         # Prettier 格式化
npm run format:check   # Prettier 格式檢查
npm run check          # type-check + lint + format:check
```

## 相關文件

- [專案入口](../README.md)
- [Mock API 與資料模型](../API.md)
- [外部參考來源](../docs/REFERENCES.md)

舊 `reference/` 目錄已移除；外部設計與實作參考請以 [`docs/REFERENCES.md`](../docs/REFERENCES.md) 為準。
