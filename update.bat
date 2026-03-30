@echo off
REM ========================================
REM POS System - Update Script
REM ========================================
REM This script updates the POS system from GitHub
REM Uses: git fetch + git reset --hard (NO merge conflicts)
REM ========================================

setlocal enabledelayedexpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo ========================================
echo   POS System - Update
echo ========================================
echo.

REM Read current version
if exist "%SCRIPT_DIR%version.txt" (
    set /p OLD_VERSION=<"%SCRIPT_DIR%version.txt"
    echo Current version: !OLD_VERSION!
) else (
    echo Current version: Unknown
)
echo.

REM Step 1: Stop running processes
echo [1/4] Stopping running processes...

REM Remove lock file
del "%SCRIPT_DIR%pos.lock" 2>nul

REM Kill Node.js processes running from this directory
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "%SCRIPT_DIR:\=\\%" >nul
    if not errorlevel 1 (
        echo Stopping Node.js process %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Alternative: Kill all node.exe from our node folder
for /f "tokens=2" %%a in ('wmic process where "ExecutablePath like '%%%SCRIPT_DIR:\=\\%%%node%%'" get ProcessId 2^>nul ^| findstr /R "[0-9]"') do (
    echo Stopping process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

REM Wait a moment for processes to stop
timeout /t 2 >nul
echo Done.
echo.

REM Step 2: Check for Git
echo [2/4] Checking Git...
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo.
    echo Please install Git from: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
echo Git found.
echo.

REM Step 3: Fetch and reset
echo [3/4] Fetching updates from GitHub...
echo.

REM Backup client environment file
set "ENV_FILE=%SCRIPT_DIR%backend\.env"
set "ENV_BACKUP=%TEMP%\pos_backend_env_%RANDOM%%RANDOM%.bak"
set "HAS_ENV_BACKUP=0"
if exist "%ENV_FILE%" (
    copy /Y "%ENV_FILE%" "%ENV_BACKUP%" >nul
    if exist "%ENV_BACKUP%" (
        set "HAS_ENV_BACKUP=1"
        echo Backed up backend\.env
    )
)

REM Check if this is a git repository
if not exist "%SCRIPT_DIR%.git" (
    echo ERROR: This is not a Git repository!
    echo.
    echo Please clone the repository first:
    echo   git clone [your-repo-url] pos-production
    echo.
    pause
    exit /b 1
)

REM Fetch updates
git fetch origin
if errorlevel 1 (
    echo ERROR: Failed to fetch updates!
    echo.
    echo Please check your internet connection.
    echo.
    pause
    exit /b 1
)

REM Get current branch
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%a"
echo Current branch: %BRANCH%

REM Reset to remote
echo.
echo Applying updates (force sync with remote)...
git reset --hard origin/%BRANCH%
if errorlevel 1 (
    echo ERROR: Failed to apply updates!
    echo.
    if "%HAS_ENV_BACKUP%"=="1" if exist "%ENV_BACKUP%" del "%ENV_BACKUP%" >nul 2>&1
    pause
    exit /b 1
)

REM Restore client environment file
if "%HAS_ENV_BACKUP%"=="1" (
    if exist "%ENV_BACKUP%" (
        copy /Y "%ENV_BACKUP%" "%ENV_FILE%" >nul
        del "%ENV_BACKUP%" >nul 2>&1
        echo Restored backend\.env
    )
)

REM Clean untracked files (optional, keeps data safe)
REM git clean -fd

echo.
echo Updates applied successfully!
echo.

REM Step 4: Show new version
echo [4/4] Verifying update...
if exist "%SCRIPT_DIR%version.txt" (
    set /p NEW_VERSION=<"%SCRIPT_DIR%version.txt"
    echo New version: !NEW_VERSION!
) else (
    echo New version: Unknown
)
echo.

echo ========================================
echo   Update Complete!
echo ========================================
echo.
echo Previous version: %OLD_VERSION%
echo Current version:  !NEW_VERSION!
echo.

REM Ask to restart
echo.
set /p RESTART="Start POS system now? (Y/N): "
if /i "%RESTART%"=="Y" (
    echo.
    echo Starting POS system...
    call "%SCRIPT_DIR%start.bat"
) else (
    echo.
    echo To start later, double-click start.bat
    echo.
    pause
)
