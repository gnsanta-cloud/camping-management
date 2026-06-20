@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================
echo   Google Sheets 동기화 자동 설정
echo ========================================
echo.
echo Google 로그인 창이 뜨면 승인해 주세요. (최초 1회)
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 필요: https://nodejs.org/
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-google-sheets.ps1"
if errorlevel 1 (
  echo.
  echo 설정 중 오류. 위 메시지를 확인하세요.
  pause
  exit /b 1
)

echo.
pause
