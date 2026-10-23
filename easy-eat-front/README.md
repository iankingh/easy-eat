# 同事午餐團訂 Vue 3 前端

這是公開 Sites「點餐系統」第 18 版的 Vue 3 移植。完整安裝、Workers／D1、Docker 與雙向同步流程見根目錄 [README](../README.md)。

`npm run build` 執行型別檢查與 Vite 建置。根目錄 `npm run build` 另外產生包含前端與 API 的 Sites Worker。

`npm run dev` 供修改 Vue 時使用，`/api` 代理至根目錄本機服務的 8787 連接埠。`npm run test:e2e` 驗證同事點餐與後台流程，需先在根目錄完成建置。
