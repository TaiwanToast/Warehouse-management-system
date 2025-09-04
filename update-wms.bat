@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ============================================
REM  Warehouse Management System - Update Script (ASCII only)
REM  Steps:
REM    1) Stop running node process
REM    2) Backup warehouse.db and uploads/
REM    3) Git fetch + hard reset to origin/main
REM    4) npm ci and start server
REM  Optional args:
REM    /PORT=xxxx  set server port (default 3000)
REM ============================================

REM Go to repo root (this script's directory)
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Default port
set "PORT=3000"
for %%A in (%*) do (
  echo %%A | findstr /I /B "/PORT=" >nul && (
    for /f "tokens=2 delims==" %%P in ("%%A") do set "PORT=%%P"
  )
)

echo.
echo [1/5] Stopping old node service (if any)...
taskkill /f /im node.exe >nul 2>&1

echo.
echo [2/5] Creating backup of database and uploads...
REM Get timestamp in yyyymmdd_hhmmss (WMIC output is locale independent)
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value 2^>nul') do set ldt=%%i
set "TS=%ldt:~0,8%_%ldt:~8,6%"
set "BACKUP_DIR=backup\%TS%"
mkdir "%BACKUP_DIR%" >nul 2>&1
if exist warehouse.db (
  copy /Y warehouse.db "%BACKUP_DIR%\warehouse.db" >nul 2>&1
)
if exist uploads (
  robocopy uploads "%BACKUP_DIR%\uploads" /MIR >nul 2>&1
)
echo Backup done: %BACKUP_DIR%

echo.
echo [3/5] Git fetch and reset to origin/main...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: Not a git repository. Please clone first.
  goto :END
)
git fetch --all
if errorlevel 1 (
  echo ERROR: git fetch failed.
  goto :END
)
git reset --hard origin/main
if errorlevel 1 (
  echo ERROR: git reset failed.
  goto :END
)

echo.
echo [4/5] Installing dependencies (npm ci)...
call npm ci
if errorlevel 1 (
  echo ERROR: npm ci failed.
  goto :END
)

echo.
echo [5/5] Starting server on PORT=%PORT% ...
set "PORT=%PORT%"
start /B node src/server.js
timeout /t 1 >nul

echo.
echo ============================================
echo Update completed.
echo URL: http://localhost:%PORT%
echo Backup: %BACKUP_DIR%
echo ============================================

:END
endlocal


