# Easy Eat 訂餐系統

Easy Eat 是以 Vue 3 與 TypeScript 開發的單頁訂餐管理系統。目前採純前端架構，透過非同步 Mock API 與 `localStorage` 模擬後端資料持久化，提供訂單、餐點統計及餐廳／餐點後台管理功能。

## 技術棧

- Vue `3.5.x`、Vue Router `4.6.x`、Pinia `3.0.x`
- TypeScript `6.0.x`、Vite `8.0.x`
- Vitest、Vue Test Utils、ESLint、Prettier

## 環境需求

- Node.js `^20.19.0`、`^22.13.0` 或 `>=24`
- npm

## 專案架構

```text
easy-eat/
├── easy-eat-front/
│   └── src/
│       ├── api/          # API 介面層
│       ├── components/   # 共用 Vue 元件
│       ├── composables/  # Composition API 工具
│       ├── constants/    # 狀態標籤、轉換規則與分頁設定
│       ├── mock/         # localStorage Mock server
│       ├── router/       # Vue Router 設定
│       ├── services/     # 業務服務層
│       ├── stores/       # Pinia 狀態管理
│       ├── types/        # TypeScript 型別
│       ├── utils/        # 共用工具
│       └── views/        # 路由頁面
├── docs/                 # 專案文件
└── API.md                # API 規格
```

資料流為 `View → Store → Service → API → Mock Server → localStorage`；未來串接後端時，可由 API 層替換實作。

## 開發指令

```bash
cd easy-eat-front
npm ci
npm run dev            # 啟動開發伺服器
npm run build          # 型別檢查並建立正式版
npm run type-check     # 僅執行型別檢查
npm test               # 執行測試
npm run test:watch     # 監看模式執行測試
npm run test:coverage  # 產生測試覆蓋率
npm run preview        # 預覽正式版
npm run lint           # ESLint
npm run format:check   # 檢查 Prettier 格式
npm run check          # type-check + lint + format:check
```

正式版輸出至 `easy-eat-front/dist/`。專案沒有獨立部署 script。

## 設定與限制

- 不需 `.env` 或秘密設定；Vite 的 `BASE_URL` 由執行環境提供給 router。
- 資料只保存在目前瀏覽器的 `localStorage`，不會跨裝置或使用者同步，清除網站資料也會刪除本機訂單。
- 目前沒有真正的 HTTP server、使用者登入或權限控制；[`API.md`](API.md) 記錄的是 Mock API 與未來後端的對應介面。

## 現有路由

| 路徑               | 功能                 |
| ------------------ | -------------------- |
| `/`                | 訂單清單             |
| `/orders/add`      | 新增訂單             |
| `/orders/:id/edit` | 編輯草稿或處理中訂單 |
| `/orders/:id`      | 訂單明細             |
| `/statistics`      | 餐點統計             |
| `/admin`           | 餐廳與餐點後台管理   |
| `/:pathMatch(.*)*` | 找不到頁面（404）    |

## 延伸文件

- [前端說明](easy-eat-front/README.md)
- [API 規格](API.md)
- [設計與實作參考來源](docs/REFERENCES.md)
