@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   DANG TAT HE THONG POS...
echo ========================================
echo.

echo Dang tim va tat tien trinh danh rieng cho POS (Node.js)...
powershell -NoProfile -Command "Get-WmiObject Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'backend[\\\\/]src[\\\\/]app.js' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo He thong da duoc tat thanh cong!
echo.
pause
