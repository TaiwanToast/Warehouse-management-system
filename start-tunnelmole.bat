@echo off
echo === 倉儲管理系統 - Tunnelmole 部署 ===
echo.

echo 1. 檢查 Node.js 是否安裝...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安裝，請先安裝 Node.js
    pause
    exit /b 1
)
echo ✅ Node.js 已安裝

echo.
echo 2. 安裝依賴套件...
npm install
if errorlevel 1 (
    echo ❌ 依賴套件安裝失敗
    pause
    exit /b 1
)
echo ✅ 依賴套件安裝完成

echo.
echo 3. 啟動伺服器...
start /B node src/server.js
timeout /t 3 /nobreak >nul

echo.
echo 4. 測試伺服器...
curl -s http://localhost:3000/api/floors >nul 2>&1
if errorlevel 1 (
    echo ❌ 伺服器啟動失敗
    pause
    exit /b 1
)
echo ✅ 伺服器啟動成功

echo.
echo 5. 檢查 Tunnelmole 是否安裝...
tunnelmole --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Tunnelmole 未安裝，正在安裝...
    npm install -g tunnelmole
    if errorlevel 1 (
        echo ❌ Tunnelmole 安裝失敗
        pause
        exit /b 1
    )
    echo ✅ Tunnelmole 安裝完成
) else (
    echo ✅ Tunnelmole 已安裝
)

echo.
echo === 部署完成 ===
echo.
echo 本地存取: http://localhost:3000
echo.
echo 啟動 Tunnelmole 隧道：
echo 1. 開啟新的命令提示字元
echo 2. 執行: tunnelmole 3000
echo 3. 使用提供的網址存取系統
echo.
pause
