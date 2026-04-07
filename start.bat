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

REM ========================================
REM Tu dong kiem tra cap nhat tu GitHub
REM - Co mang + co git + la repo git: tu dong cap nhat
REM - Mat mang / loi: bo qua, chay ban hien tai
REM ========================================
set "AUTO_UPDATED=0"
set "FORCE_RESTART_BACKEND=0"

echo   Dang kiem tra cap nhat...

if not exist "%SCRIPT_DIR%.git" (
    echo   [Bo qua] Thu muc hien tai khong phai Git repository.
    goto AUTO_UPDATE_DONE
)

where git >nul 2>&1
if errorlevel 1 (
    echo   [Bo qua] Khong tim thay Git tren may.
    goto AUTO_UPDATE_DONE
)

call :HAS_INTERNET
if errorlevel 1 (
    echo   [Bo qua] Khong co ket noi mang. Se chay ban hien tai.
    goto AUTO_UPDATE_DONE
)

for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%a"
if "%BRANCH%"=="" (
    echo   [Bo qua] Khong xac dinh duoc nhanh Git hien tai.
    goto AUTO_UPDATE_DONE
)

git fetch origin >nul 2>&1
if errorlevel 1 (
    echo   [Bo qua] Khong lay duoc thong tin phien ban moi.
    goto AUTO_UPDATE_DONE
)

for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set "LOCAL_SHA=%%a"
for /f "tokens=*" %%a in ('git rev-parse origin/%BRANCH% 2^>nul') do set "REMOTE_SHA=%%a"

if "%LOCAL_SHA%"=="" goto AUTO_UPDATE_DONE
if "%REMOTE_SHA%"=="" goto AUTO_UPDATE_DONE

if /I "%LOCAL_SHA%"=="%REMOTE_SHA%" (
    echo   Da su dung phien ban moi nhat.
    goto AUTO_UPDATE_DONE
)

echo   Phat hien phien ban moi. Dang cap nhat...

set "ENV_FILE=%SCRIPT_DIR%backend\.env"
set "ENV_BACKUP=%TEMP%\pos_backend_env_%RANDOM%%RANDOM%.bak"
set "HAS_ENV_BACKUP=0"
if exist "%ENV_FILE%" (
    copy /Y "%ENV_FILE%" "%ENV_BACKUP%" >nul
    if exist "%ENV_BACKUP%" set "HAS_ENV_BACKUP=1"
)

git reset --hard origin/%BRANCH% >nul 2>&1
if errorlevel 1 (
    echo   [Canh bao] Cap nhat that bai. Se chay ban hien tai.
    if "%HAS_ENV_BACKUP%"=="1" if exist "%ENV_BACKUP%" del "%ENV_BACKUP%" >nul 2>&1
    goto AUTO_UPDATE_DONE
)

if "%HAS_ENV_BACKUP%"=="1" (
    if exist "%ENV_BACKUP%" (
        copy /Y "%ENV_BACKUP%" "%ENV_FILE%" >nul
        del "%ENV_BACKUP%" >nul 2>&1
    )
)

set "AUTO_UPDATED=1"
set "FORCE_RESTART_BACKEND=1"
echo   Cap nhat thanh cong.

:AUTO_UPDATE_DONE
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

set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "BACKEND_PACKAGE_JSON=%BACKEND_DIR%\package.json"
set "NPM_CLI_JS=%SCRIPT_DIR%node\node_modules\npm\bin\npm-cli.js"

if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs" >nul 2>&1

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

REM Chi kiem tra/cai dependency khi VUA CAP NHAT PHIEN BAN MOI
if "%AUTO_UPDATED%"=="1" (
    set "DEPENDENCY_SYNC_REQUIRED=0"
    if exist "%BACKEND_PACKAGE_JSON%" (
        call :CHECK_BACKEND_DEPENDENCIES
        if errorlevel 1 set "DEPENDENCY_SYNC_REQUIRED=1"
    )

    if "%DEPENDENCY_SYNC_REQUIRED%"=="1" (
        echo.
        echo   Dang dong bo thu vien backend ^(phat hien goi moi/thieu^)...
        call :INSTALL_BACKEND_DEPENDENCIES
        if errorlevel 1 (
            echo.
            echo   [LOI] Khong the cap nhat thu vien backend!
            echo   Vui long kiem tra internet hoac lien he ho tro ky thuat.
            echo.
            pause
            exit /b 1
        )
        set "FORCE_RESTART_BACKEND=1"
        echo   Dong bo thu vien thanh cong.
        echo.
    )
)

REM Kiem tra backend POS da chay chua
set "POS_RUNNING=0"
powershell -NoProfile -Command "$p = Get-WmiObject Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'backend[\\/]src[\\/]app.js' }; if($p){ exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 set "POS_RUNNING=1"

if "%POS_RUNNING%"=="1" (
    if "%FORCE_RESTART_BACKEND%"=="1" (
        echo   Dang dung backend cu de chay ban moi...
        call :STOP_POS_BACKEND
        goto START_BACKEND
    )
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

:START_BACKEND
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

:HAS_INTERNET
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'https://github.com' -Method Head -TimeoutSec 5 -UseBasicParsing; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:STOP_POS_BACKEND
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "backend\src\app.js" >nul
    if not errorlevel 1 (
        taskkill /F /PID %%a >nul 2>&1
    )
)
timeout /t 1 >nul
exit /b 0

:CHECK_BACKEND_DEPENDENCIES
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $pkgPath = '%BACKEND_PACKAGE_JSON%'; $nmRoot = '%BACKEND_DIR%\node_modules'; if (!(Test-Path $pkgPath)) { exit 1 }; if (!(Test-Path $nmRoot)) { exit 1 }; $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json; $deps = @(); if ($pkg.dependencies) { $deps = $pkg.dependencies.PSObject.Properties.Name }; $missing = @(); foreach ($dep in $deps) { if ($dep -match '^@[^/]+/.+$') { $parts = $dep.Split('/'); $depPath = Join-Path (Join-Path $nmRoot $parts[0]) $parts[1] } else { $depPath = Join-Path $nmRoot $dep }; if (!(Test-Path $depPath)) { $missing += $dep } }; if ($missing.Count -gt 0) { Set-Content -Path '%SCRIPT_DIR%logs\missing-deps.log' -Value ($missing -join ', '); exit 1 } else { exit 0 }" >nul 2>&1
exit /b %errorlevel%

:INSTALL_BACKEND_DEPENDENCIES
pushd "%BACKEND_DIR%"
if exist "%NPM_CLI_JS%" (
    "%NODE_EXE%" "%NPM_CLI_JS%" ci --omit=dev --no-audit --no-fund
    set "INSTALL_CODE=%errorlevel%"
    if not "%INSTALL_CODE%"=="0" (
        "%NODE_EXE%" "%NPM_CLI_JS%" install --omit=dev --no-audit --no-fund
        set "INSTALL_CODE=%errorlevel%"
    )
) else (
    where npm >nul 2>&1
    if errorlevel 1 (
        set "INSTALL_CODE=1"
    ) else (
        npm ci --omit=dev --no-audit --no-fund
        set "INSTALL_CODE=%errorlevel%"
        if not "%INSTALL_CODE%"=="0" (
            npm install --omit=dev --no-audit --no-fund
            set "INSTALL_CODE=%errorlevel%"
        )
    )
)
popd
exit /b %INSTALL_CODE%
