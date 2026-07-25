# easy-eat-front

Vue 3 + TypeScript 的訂餐系統前端，已完成「無後端可運行」的 mock 架構。

## 新版工具鏈

- Vue 3.5
- Vue Router 4.6
- Pinia 3
- Vite 8
- TypeScript 6
- vue-tsc 3

## 快速開始

```bash
npm install
npm run dev
```

## 目前功能

- 訂單清單
- 新增訂單
- 訂單明細
- 餐點統計
- 後台管理（餐廳/餐點 CRUD）
- Mock 資料重置

## 前端架構

```text
src/
    api/                # API 介面層（目前接 mock server）
        orderApi.ts
        restaurantApi.ts
    mock/               # Mock backend（localStorage + async latency）
        db.ts
        server.ts
    services/           # 服務層（封裝業務行為/資料轉換）
        orderService.ts
        restaurantService.ts
    stores/             # Pinia 狀態管理（頁面唯一資料入口）
        order.ts
        restaurant.ts
    types/              # 共用型別
        order.ts
        restaurant.ts
    views/              # 頁面
    components/         # 共用元件
```

## 資料流

頁面互動路徑如下：

1. View 觸發 Store Action
2. Store 呼叫 Service
3. Service 呼叫 API
4. API 轉到 Mock Server
5. Mock Server 讀寫 localStorage（模擬資料庫）
6. 回傳結果後更新 Store，再反映到 UI

## Mock 設計

- Mock DB 儲存在 localStorage key: `easy-eat-mock-db-v1`
- 預設資料包含餐廳與餐點
- 所有 API 為 async，含模擬延遲（貼近真實後端）
- 可在後台頁面使用「重置 Mock 資料」恢復預設狀態

## 開發指令

```bash
# 啟動開發
npm run dev

# 型別檢查 + 打包
npm run build

# 僅型別檢查
npm run type-check
```

## 未來串接真後端方式

只需替換 `src/api/*.ts` 的實作（改為 fetch/axios 呼叫後端），其餘層（services/stores/views）可維持不動。
