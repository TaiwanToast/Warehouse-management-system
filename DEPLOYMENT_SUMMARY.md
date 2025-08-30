# 倉儲管理系統 - 部署總結

## 🎯 已完成的功能

### 核心功能
- ✅ 物品管理（新增、查詢、編輯、刪除）
- ✅ 樓層/區域管理
- ✅ 圖片上傳和預覽
- ✅ 狀態管理（可用、借出、已歸還）
- ✅ 借用人/借用地點追蹤
- ✅ 時間戳記（借出時間、歸還時間）

### 使用者介面
- ✅ iOS 風格設計
- ✅ 響應式佈局
- ✅ 圖片點擊放大
- ✅ 狀態徽章（顏色區分）
- ✅ 樓層排序（中文數字排序：一樓、二樓、三樓）

### 技術架構
- ✅ Node.js + Express.js 後端
- ✅ SQLite 資料庫
- ✅ 靜態檔案服務
- ✅ 檔案上傳處理
- ✅ CORS 支援

## 🚀 部署選項

### 1. Tunnelmole（推薦 - 快速外網存取）

**優點：**
- 無需設定路由器
- 自動 HTTPS
- 簡單易用
- 免費使用

**步驟：**
```bash
# 1. 啟動伺服器
start /B node src/server.js

# 2. 啟動隧道
tunnelmole 3000

# 3. 使用提供的網址存取
```

### 2. NAS Docker 部署（推薦 - 長期使用）

**優點：**
- 穩定可靠
- 自動重啟
- 資料持久化
- 適合生產環境

**步驟：**
```bash
# 1. 上傳檔案到 NAS
# 2. 執行 Docker Compose
docker-compose up -d
```

### 3. 本地網路部署

**優點：**
- 無需外網
- 速度快
- 資料安全

**步驟：**
```bash
# 1. 啟動伺服器
node src/server.js

# 2. 使用區域網路 IP 存取
# http://192.168.x.x:3000
```

## 📁 檔案結構

```
warehouse-management-system/
├── src/
│   ├── server.js          # Express 伺服器
│   ├── db.js             # 資料庫操作
│   └── schema.sql        # 資料庫結構
├── public/
│   ├── index.html        # 新增物品頁面
│   ├── search.html       # 查詢頁面
│   ├── manage.html       # 管理頁面
│   ├── locations.html    # 樓層/區域管理
│   ├── app.js           # 新增頁面邏輯
│   ├── search.js        # 查詢頁面邏輯
│   ├── manage.js        # 管理頁面邏輯
│   ├── locations.js     # 樓層/區域管理邏輯
│   └── styles.css       # 全域樣式
├── uploads/             # 上傳圖片目錄
├── warehouse.db         # SQLite 資料庫
├── package.json         # Node.js 依賴
├── start-tunnelmole.bat # Tunnelmole 快速啟動
└── README.md           # 專案說明
```

## 🔧 技術細節

### 資料庫結構
- `floors`: 樓層資訊
- `rooms`: 區域資訊
- `items`: 物品資訊（包含狀態、借用人等欄位）

### API 端點
- `GET /api/floors` - 取得樓層列表
- `POST /api/floors` - 新增樓層
- `DELETE /api/floors/:id` - 刪除樓層
- `GET /api/rooms` - 取得區域列表
- `POST /api/rooms` - 新增區域
- `DELETE /api/rooms/:id` - 刪除區域
- `GET /api/items` - 查詢物品
- `POST /api/items` - 新增物品
- `PUT /api/items/:id` - 更新物品
- `DELETE /api/items/:id` - 刪除物品

### 狀態管理
- `available`: 可用（綠色）
- `borrowed`: 借出（紅色）
- `returned`: 已歸還（黃色）

## 🎉 使用建議

1. **測試環境**：使用 Tunnelmole 快速部署
2. **生產環境**：使用 NAS Docker 部署
3. **內部使用**：使用本地網路部署

## 📞 支援

如有問題，請檢查：
1. Node.js 是否正確安裝
2. 依賴套件是否完整安裝
3. 端口 3000 是否被佔用
4. 防火牆設定是否正確
