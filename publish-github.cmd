@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Git / GitHub CLI (PATH may be missing in new terminals)
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\Git\bin;C:\Program Files\GitHub CLI;%PATH%"

echo ========================================
echo   Camping PWA - GitHub Pages Deploy
echo ========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] git not found.
  echo Install: https://git-scm.com/download/win
  echo Then open a NEW terminal and run this file again.
  pause
  exit /b 1
)

where gh >nul 2>&1
if errorlevel 1 (
  echo [ERROR] GitHub CLI ^(gh^) not found.
  echo Install: https://cli.github.com/
  echo Then open a NEW terminal and run this file again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-github.ps1" %*

if errorlevel 1 (
  echo.
  echo Deploy failed. See messages above.
  pause
  exit /b 1
)

echo.
pause
