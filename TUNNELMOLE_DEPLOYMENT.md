# Tunnelmole 部署指南

## 什麼是 Tunnelmole？

Tunnelmole 是一個簡單的隧道服務，可以讓您的本地伺服器透過網際網路存取，無需設定複雜的網路配置。

## 安裝步驟

### 1. 安裝 Tunnelmole

```bash
npm install -g tunnelmole
```

### 2. 啟動您的應用程式

```bash
# 在專案目錄中
npm install

# 啟動伺服器（Windows）
start /B node src/server.js

# 或使用 npm script
npm start
```

### 3. 驗證本地伺服器

在啟動 Tunnelmole 之前，先確認本地伺服器正常運作：

```bash
# 測試 API
curl http://localhost:3000/api/floors

# 測試主頁面
curl http://localhost:3000/
```

### 4. 啟動 Tunnelmole 隧道

開啟新的終端機視窗，執行：

```bash
tunnelmole 3000
```

Tunnelmole 會提供一個公開的網址，例如：
```
https://abc123.tunnelmole.com
```

### 5. 存取您的應用程式

使用 Tunnelmole 提供的網址即可從任何地方存取您的倉儲管理系統。

### 6. 測試功能

確保以下功能正常運作：
- ✅ 新增物品
- ✅ 查詢物品
- ✅ 管理物品
- ✅ 樓層/區域管理
- ✅ 圖片上傳和預覽

## 優點

- ✅ 無需設定路由器
- ✅ 無需靜態 IP
- ✅ 自動 HTTPS
- ✅ 簡單易用
- ✅ 免費使用

## 注意事項

- Tunnelmole 提供的網址是暫時的，每次重新啟動都會改變
- 適合測試和臨時使用
- 不適合生產環境的長期部署

## 故障排除

### 問題：無法連接到 Tunnelmole
- 確保您的 Node.js 伺服器正在運行
- 確保防火牆沒有阻擋連接
- 檢查網路連接

### 問題：API 請求失敗
- 確保伺服器正確配置了靜態檔案和 API 路由
- 檢查瀏覽器開發者工具中的網路請求

## 其他部署選項

如果您需要更穩定的部署方案，可以考慮：
- Vercel
- Heroku
- Railway
- 自架伺服器
