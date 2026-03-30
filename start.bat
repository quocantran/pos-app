@echo off
REM ========================================
REM POS System - Start Script
REM ========================================
REM Double-click this file to start the POS system
REM ========================================

setlocal enabledelayedexpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Display startup message
echo.
echo ========================================
echo   POS System - Starting...
echo ========================================
echo.

REM Read version
if exist "%SCRIPT_DIR%version.txt" (
    set /p VERSION=<"%SCRIPT_DIR%version.txt"
    echo Version: !VERSION!
) else (
    echo Version: Unknown
)
echo.

REM Check for Node.js
set "NODE_EXE=%SCRIPT_DIR%node\node.exe"
if not exist "%NODE_EXE%" (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
        echo Portable Node.js not found, using system Node.js.
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
        echo Portable Node.js not found, using system Node.js.
    ) else (
        echo ERROR: Node.js not found!
        echo.
        echo Expected portable runtime: %SCRIPT_DIR%node\node.exe
        echo You can either:
        echo   1. Re-download this package with node\node.exe included, or
        echo   2. Install Node.js system-wide from https://nodejs.org
        echo.
        pause
        exit /b 1
    )
)

REM Check for backend
set "BACKEND_APP=%SCRIPT_DIR%backend\src\app.js"
if not exist "%BACKEND_APP%" (
    echo ERROR: Backend not found!
    echo.
    echo Expected location: %BACKEND_APP%
    echo.
    pause
    exit /b 1
)

REM Check for .env
if not exist "%SCRIPT_DIR%backend\.env" (
    echo WARNING: .env file not found!
    echo.
    echo Creating from template...
    if exist "%SCRIPT_DIR%backend\.env.example" (
        copy "%SCRIPT_DIR%backend\.env.example" "%SCRIPT_DIR%backend\.env"
        echo.
        echo IMPORTANT: Please edit backend\.env with your database settings!
        echo.
        notepad "%SCRIPT_DIR%backend\.env"
        pause
        exit /b 1
    )
)

REM Get port from .env
set "PORT=5000"
for /f "tokens=1,2 delims==" %%a in ('findstr /B "PORT=" "%SCRIPT_DIR%backend\.env" 2^>nul') do (
    set "PORT=%%b"
)
if "%PORT%"=="" set "PORT=5000"

REM Check if server already running on this port
call :CHECK_PORT %PORT%
if not errorlevel 1 (
    echo Backend is already running on port %PORT%.
    goto OPEN_BROWSER
)

echo Starting backend server on port %PORT%...
echo.

REM Start backend in background
start "POS Backend" /min "%NODE_EXE%" "%BACKEND_APP%"

REM Wait for server to start (check every second, max 45 seconds)
echo Waiting for server to start...
set /a WAIT_COUNT=0
:WAIT_LOOP
call :CHECK_PORT %PORT%
if not errorlevel 1 goto OPEN_BROWSER
set /a WAIT_COUNT+=1
if !WAIT_COUNT! geq 45 (
    echo.
    echo ERROR: Backend did not start successfully.
    echo Please check backend\.env and ensure MySQL is running.
    echo.
    pause
    exit /b 1
)
timeout /t 1 >nul
goto WAIT_LOOP

:OPEN_BROWSER
echo.
echo ========================================
echo   Opening POS System in Chrome
echo ========================================
echo.

REM Find Chrome
set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

REM Open in Chrome kiosk mode
if defined CHROME_PATH (
    echo Opening Chrome in kiosk/app mode...
    start "" "%CHROME_PATH%" --new-window --no-first-run --disable-session-crashed-bubble --disable-restore-session-state --disable-features=TranslateUI --app="http://localhost:%PORT%" --start-fullscreen --kiosk
) else (
    echo Chrome not found. Opening in default browser...
    start "" "http://localhost:%PORT%"
)

echo.
echo ========================================
echo   POS System Started Successfully!
echo ========================================
echo.
echo Server running at: http://localhost:%PORT%
echo.
echo To update code later, run update.bat
echo.
exit /b 0

:CHECK_PORT
powershell -NoProfile -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', %1); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
exit /b %errorlevel%
