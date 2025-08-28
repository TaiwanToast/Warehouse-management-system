## �� NAS 伺服器架設完整步驟

### 📋 前置檢查清單

**NAS 需求：**
- ✅ 支援 Docker（DSM 6.2+ / QTS 4.3.4+ / TrueNAS）
- ✅ 已安裝 Docker 套件
- ✅ 至少 512MB RAM
- ✅ 1GB 可用儲存空間
- ✅ SSH 功能已啟用

---

## �� 步驟 1：準備檔案

### 1.1 建立專案資料夾
```bash
# 在你的電腦上建立資料夾
mkdir warehouse-nas-deploy
cd warehouse-nas-deploy
```

### 1.2 複製必要檔案
確保以下檔案都在專案資料夾中：
```
warehouse-nas-deploy/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── package.json
├── src/
│   ├── server.js
│   ├── db.js
│   └── schema.sql
├── public/
│   ├── index.html
│   ├── search.html
│   ├── manage.html
│   ├── locations.html
│   ├── app.js
│   ├── search.js
│   ├── manage.js
│   ├── locations.js
│   └── styles.css
└── README.md
```

---

## �� 步驟 2：上傳到 NAS

### 2.1 建立 NAS 目錄
```bash
# SSH 連接到 NAS
ssh admin@your-nas-ip

# 建立目錄
mkdir -p /volume1/docker/warehouse-system
```

### 2.2 上傳檔案
**方法 A：使用 SCP**
```bash
# 在你的電腦上執行
scp -r warehouse-nas-deploy/* admin@your-nas-ip:/volume1/docker/warehouse-system/
```

**方法 B：使用檔案總管**
1. 開啟 NAS 檔案總管
2. 進入 `/volume1/docker/`
3. 建立 `warehouse-system` 資料夾
4. 上傳所有檔案到該資料夾

---

## �� 步驟 3：部署服務

### 3.1 SSH 連接到 NAS
```bash
ssh admin@your-nas-ip
```

### 3.2 進入專案目錄
```bash
cd /volume1/docker/warehouse-system
```

### 3.3 檢查檔案
```bash
# 確認檔案存在
ls -la

# 應該看到：
# Dockerfile, docker-compose.yml, src/, public/, package.json 等
```

### 3.4 建立並啟動容器
```bash
# 建立 Docker 映像並啟動服務
docker-compose up -d

# 查看狀態
docker-compose ps

# 查看日誌
docker-compose logs -f warehouse-system
```

---

## �� 步驟 4：驗證部署

### 4.1 檢查服務狀態
```bash
# 查看容器狀態
docker ps

# 查看日誌
docker-compose logs warehouse-system

# 應該看到：
# "Server running on http://localhost:3000"
# "=== 倉儲管理系統伺服器已啟動 ==="
```

### 4.2 測試存取
- **本機測試：** `http://your-nas-ip:3000`
- **區域網路測試：** 其他裝置開啟 `http://your-nas-ip:3000`

---

## �� 步驟 5：設定自動啟動

### 5.1 確認自動重啟
```bash
# 檢查 docker-compose.yml 中的 restart 設定
cat docker-compose.yml | grep restart
# 應該顯示：restart: unless-stopped
```

### 5.2 測試重啟
```bash
# 重啟 NAS 或重啟 Docker 服務
docker-compose restart

# 確認服務自動恢復
docker-compose ps
```

---

## �� 步驟 6：安全設定

### 6.1 更改端口（可選）
```bash
# 編輯 docker-compose.yml
nano docker-compose.yml

# 修改端口映射
ports:
  - "8080:3000"  # 改用 8080 端口
```

### 6.2 重新啟動服務
```bash
docker-compose down
docker-compose up -d
```

### 6.3 設定防火牆
在 NAS 管理介面：
1. 控制台 → 安全性 → 防火牆
2. 允許端口 3000（或 8080）
3. 設定來源 IP 限制（可選）

---

## �� 步驟 7：資料備份設定

### 7.1 建立備份腳本
```bash
# 建立備份目錄
mkdir -p /volume1/backup/warehouse

# 建立備份腳本
nano /volume1/backup/warehouse-backup.sh
```

### 7.2 備份腳本內容
```bash
#!/bin/bash
# 備份資料庫
cp /volume1/docker/warehouse-data/warehouse.db /volume1/backup/warehouse/warehouse-$(date +%Y%m%d_%H%M%S).db

# 備份上傳圖片
tar -czf /volume1/backup/warehouse/uploads-$(date +%Y%m%d_%H%M%S).tar.gz /volume1/docker/warehouse-uploads/

# 保留最近 30 天的備份
find /volume1/backup/warehouse/ -name "*.db" -mtime +30 -delete
find /volume1/backup/warehouse/ -name "*.tar.gz" -mtime +30 -delete

echo "備份完成: $(date)"
```

### 7.3 設定執行權限
```bash
chmod +x /volume1/backup/warehouse-backup.sh
```

---

## �� 步驟 8：監控與維護

### 8.1 查看系統狀態
```bash
# 查看容器狀態
docker-compose ps

# 查看資源使用
docker stats warehouse-management

# 查看日誌
docker-compose logs -f warehouse-system
```

### 8.2 更新系統
```bash
# 停止服務
docker-compose down

# 重新建立映像
docker-compose build --no-cache

# 啟動服務
docker-compose up -d
```

### 8.3 清理舊映像
```bash
# 清理未使用的 Docker 映像
docker image prune -f

# 清理未使用的容器
docker container prune -f
```

---

## 📱 使用指南

### 存取網址
- **主要網址：** `http://your-nas-ip:3000`
- **備用網址：** `http://your-nas-ip:8080`（如果更改端口）

### 功能說明
1. **新增物品：** 建立樓層/房間 → 新增物品（含照片）
2. **查詢物品：** 依名稱、樓層、房間篩選
3. **管理物品：** 編輯、刪除現有物品
4. **樓層房間管理：** 建立與管理結構

### 多裝置支援
- **電腦：** 任何現代瀏覽器
- **手機/平板：** 支援觸控操作
- **同時使用：** 多人可同時存取

---

## 🔧 故障排除

### 常見問題
1. **端口被占用：** 更改 docker-compose.yml 中的端口
2. **權限問題：** 檢查資料夾權限設定
3. **記憶體不足：** 在 docker-compose.yml 加入記憶體限制
4. **無法存取：** 檢查防火牆設定

### 緊急恢復
```bash
# 重新啟動服務
docker-compose restart

# 完全重建
docker-compose down
docker-compose up -d

# 查看詳細錯誤
docker-compose logs warehouse-system
```

---

## ✅ 部署完成檢查清單

- [ ] 檔案已上傳到 NAS
- [ ] Docker 容器已啟動
- [ ] 服務可正常存取
- [ ] 自動重啟功能正常
- [ ] 備份腳本已設定
- [ ] 防火牆已設定
- [ ] 多裝置測試通過

現在你的倉儲管理系統已經成功部署在 NAS 上了！🎉