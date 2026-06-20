@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================
echo   사이트현황 Android 앱 빌드
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js가 필요합니다.
  echo Install: https://nodejs.org/
  pause
  exit /b 1
)

echo [1/4] npm install...
call npm install
if errorlevel 1 goto fail

echo [2/4] 웹 파일 동기화...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync-web.ps1"
if errorlevel 1 goto fail

echo [3/4] Capacitor Android 동기화...
if not exist "android" (
  call npx cap add android
)
call npx cap sync android
if errorlevel 1 goto fail

echo [4/4] Android Studio 열기...
echo Android Studio에서 Run ^(▶^) 버튼으로 APK 설치/실행
call npx cap open android
goto end

:fail
echo.
echo 빌드 준비 중 오류가 발생했습니다.
pause
exit /b 1

:end
echo.
pause
