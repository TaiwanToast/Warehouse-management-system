# 倉儲管理系統

一個簡單易用的網頁版倉儲管理系統，支援物品管理、樓層/區域管理、圖片上傳等功能。

## 功能特色

- 📦 物品管理：新增、查詢、編輯、刪除物品
- 🏢 樓層/區域管理：動態新增樓層和區域
- 📸 圖片上傳：支援物品圖片上傳和預覽
- 🔍 多種查詢：依名稱、樓層、區域查詢
- 📱 響應式設計：支援手機和電腦瀏覽
- 🔄 狀態管理：物品借用狀態追蹤

## 部署方式

### 方式一：Tunnelmole（推薦 - 快速外網存取）

最簡單的部署方式，適合測試和臨時使用：

1. **執行快速啟動腳本**
   ```bash
   start-tunnelmole.bat
   ```

2. **或手動執行**
   ```bash
   npm install
   start /B node src/server.js
   tunnelmole 3000
   ```

3. **使用提供的網址存取系統**

詳細說明請參考：[TUNNELMOLE_DEPLOYMENT.md](TUNNELMOLE_DEPLOYMENT.md)

### 方式二：NAS Docker 部署（推薦 - 長期使用）

適合在 NAS 上長期部署：

#### 系統需求
- NAS 支援 Docker（Synology DSM 6.2+、QNAP QTS 4.3.4+、TrueNAS 等）
- 至少 512MB RAM
- 1GB 可用儲存空間

### 方式一：Docker Compose（推薦）

1. **上傳檔案到 NAS**
   - 將整個專案資料夾上傳到 NAS 的共享資料夾
   - 例如：`/volume1/docker/warehouse-system/`

2. **SSH 連接到 NAS**
   ```bash
   ssh admin@your-nas-ip
   ```

3. **進入專案目錄**
   ```bash
   cd /volume1/docker/warehouse-system/
   ```

4. **啟動服務**
   ```bash
   docker-compose up -d
   ```

5. **查看狀態**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### 方式二：Docker 指令

1. **建立映像**
   ```bash
   docker build -t warehouse-system .
   ```

2. **建立資料目錄**
   ```bash
   mkdir -p /volume1/docker/warehouse-data
   mkdir -p /volume1/docker/warehouse-uploads
   ```

3. **啟動容器**
   ```bash
   docker run -d \
     --name warehouse-management \
     --restart unless-stopped \
     -p 3000:3000 \
     -v /volume1/docker/warehouse-data:/app/data \
     -v /volume1/docker/warehouse-uploads:/app/uploads \
     warehouse-system
   ```

## 存取方式

- **本機存取**：`http://your-nas-ip:3000`
- **區域網路**：`http://your-nas-ip:3000`
- **外網存取**：需要設定路由器端口轉發

## 資料備份

### 自動備份腳本
```bash
#!/bin/bash
# 備份資料庫
cp /volume1/docker/warehouse-data/warehouse.db /volume1/backup/warehouse-$(date +%Y%m%d).db

# 備份上傳圖片
tar -czf /volume1/backup/warehouse-uploads-$(date +%Y%m%d).tar.gz /volume1/docker/warehouse-uploads/
```

## 管理指令

### 查看日誌
```bash
docker-compose logs -f warehouse-system
```

### 重啟服務
```bash
docker-compose restart
```

### 停止服務
```bash
docker-compose down
```

### 更新系統
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 故障排除

### 端口衝突
如果 3000 端口被占用，修改 `docker-compose.yml`：
```yaml
ports:
  - "8080:3000"  # 改用 8080 端口
```

### 權限問題
確保 NAS 使用者有讀寫權限：
```bash
chmod -R 755 /volume1/docker/warehouse-data
chmod -R 755 /volume1/docker/warehouse-uploads
```

### 記憶體不足
在 `docker-compose.yml` 加入記憶體限制：
```yaml
services:
  warehouse-system:
    # ... 其他設定
    deploy:
      resources:
        limits:
          memory: 512M
```

## 安全建議

1. **更改預設端口**
2. **設定防火牆規則**
3. **定期備份資料**
4. **監控系統資源使用**
5. **設定 SSL 憑證（可選）**

## 支援的 NAS 型號

- **Synology**：DSM 6.2+ 支援 Docker
- **QNAP**：QTS 4.3.4+ 支援 Docker
- **TrueNAS**：支援 Docker
- **其他**：支援 Docker 的 NAS 系統
