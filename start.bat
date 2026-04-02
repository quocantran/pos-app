@echo off
chcp 65001 >nul 2>&1
REM ========================================
REM POS System - Khoi dong he thong
REM ========================================

setlocal enabledelayedexpansion

REM Di chuyen den thu muc chua file
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Hien thi thong bao
echo.
echo ========================================
echo   HE THONG BAN HANG POS
echo   Dang khoi dong, vui long doi...
echo ========================================
echo.

REM Doc phien ban
set "VERSION=unknown"
if exist "%SCRIPT_DIR%version.txt" (
    set /p VERSION=<"%SCRIPT_DIR%version.txt"
    echo   Phien ban: !VERSION!
) else (
    echo   Phien ban: Khong xac dinh
)
echo.

REM Kiem tra Node.js
set "NODE_EXE=%SCRIPT_DIR%node\node.exe"
if not exist "%NODE_EXE%" (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
    ) else (
        echo.
        echo   [LOI] Khong tim thay Node.js!
        echo   Vui long lien he ho tro ky thuat.
        echo.
        pause
        exit /b 1
    )
)

REM Kiem tra backend
set "BACKEND_APP=%SCRIPT_DIR%backend\src\app.js"
if not exist "%BACKEND_APP%" (
    echo   [LOI] Khong tim thay du lieu he thong!
    echo   Vui long lien he ho tro ky thuat.
    echo.
    pause
    exit /b 1
)

REM Kiem tra file cau hinh
if not exist "%SCRIPT_DIR%backend\.env" (
    echo   [CANH BAO] Thieu file cau hinh he thong!
    echo   Dang tao tu ban mau...
    if exist "%SCRIPT_DIR%backend\.env.example" (
        copy "%SCRIPT_DIR%backend\.env.example" "%SCRIPT_DIR%backend\.env" >nul
        echo.
        echo   QUAN TRONG: Vui long cau hinh ket noi co so du lieu!
        echo.
        notepad "%SCRIPT_DIR%backend\.env"
        pause
        exit /b 1
    )
)

REM Lay cong tu file cau hinh
set "PORT=5000"
for /f "tokens=1,2 delims==" %%a in ('findstr /B "PORT=" "%SCRIPT_DIR%backend\.env" 2^>nul') do (
    set "PORT=%%b"
)
if "%PORT%"=="" set "PORT=5000"

REM Kiem tra backend POS da chay chua
set "POS_RUNNING=0"
powershell -NoProfile -Command "$p = Get-WmiObject Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'backend[\\/]src[\\/]app.js' }; if($p){ exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 set "POS_RUNNING=1"

if "%POS_RUNNING%"=="1" (
    echo   Da phat hien backend POS dang chay. Se mo lai giao dien...
    goto WAIT_SERVER
)

REM Kiem tra cong neu backend POS chua chay
call :CHECK_PORT %PORT%
if not errorlevel 1 (
    echo.
    echo   [LOI] Cong %PORT% dang duoc su dung boi ung dung khac!
    echo   Vui long tat ung dung dang dung cong nay roi thu lai.
    echo.
    pause
    exit /b 1
)

echo   Dang khoi dong may chu...

REM Khoi dong backend an trong nen
start "POS Backend" /min "%NODE_EXE%" "%BACKEND_APP%"

REM Cho may chu khoi dong (toi da 45 giay)
:WAIT_SERVER
echo   Vui long doi...
set /a WAIT_COUNT=0
:WAIT_LOOP
call :CHECK_PORT %PORT%
if not errorlevel 1 goto SERVER_READY
set /a WAIT_COUNT+=1
if !WAIT_COUNT! geq 45 (
    echo.
    echo   [LOI] He thong khong khoi dong duoc!
    echo   Vui long kiem tra ket noi co so du lieu
    echo   hoac lien he ho tro ky thuat.
    echo.
    pause
    exit /b 1
)
timeout /t 1 >nul
goto WAIT_LOOP

:SERVER_READY
echo.
echo ========================================
echo   Khoi dong thanh cong!
echo   Dang mo ung dung...
echo ========================================
echo.

:OPEN_BROWSER
set "APP_URL=http://localhost:%PORT%/?v=!VERSION!&t=%RANDOM%"

REM Tim trinh duyet Chrome
set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

REM Mo ung dung trong Chrome
if defined CHROME_PATH (
    start "" "%CHROME_PATH%" --new-window --no-first-run --disable-session-crashed-bubble --disable-restore-session-state --disable-features=TranslateUI --app="!APP_URL!" --start-maximized
) else (
    start "" "!APP_URL!"
)

REM Doi 2 giay de dam bao trinh duyet da mo
timeout /t 2 >nul

REM Tat cua so terminal nay - he thong van chay nen
exit /b 0

:CHECK_PORT
powershell -NoProfile -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', %1); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
exit /b %errorlevel%
