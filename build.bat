@echo off
REM ========================================
REM POS System - Build Script (Developer Tool)
REM ========================================
REM This script prepares the production package
REM Run this on your development machine ONLY
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   POS System - Production Build
echo ========================================
echo.

REM Set paths
set "SOURCE_DIR=%~dp0..\pos"
set "PROD_DIR=%~dp0"
set "FRONTEND_SRC=%SOURCE_DIR%\Web-pos"
set "BACKEND_SRC=%SOURCE_DIR%\backend"

REM Verify source exists
if not exist "%FRONTEND_SRC%\package.json" (
    echo ERROR: Frontend source not found at %FRONTEND_SRC%
    pause
    exit /b 1
)
if not exist "%BACKEND_SRC%\package.json" (
    echo ERROR: Backend source not found at %BACKEND_SRC%
    pause
    exit /b 1
)

REM Create directory structure
echo [1/8] Creating directory structure...
if not exist "%PROD_DIR%backend\src\config" mkdir "%PROD_DIR%backend\src\config"
if not exist "%PROD_DIR%backend\src\controllers" mkdir "%PROD_DIR%backend\src\controllers"
if not exist "%PROD_DIR%backend\src\middlewares" mkdir "%PROD_DIR%backend\src\middlewares"
if not exist "%PROD_DIR%backend\src\models" mkdir "%PROD_DIR%backend\src\models"
if not exist "%PROD_DIR%backend\src\routes" mkdir "%PROD_DIR%backend\src\routes"
if not exist "%PROD_DIR%backend\src\services" mkdir "%PROD_DIR%backend\src\services"
if not exist "%PROD_DIR%backend\src\utils" mkdir "%PROD_DIR%backend\src\utils"
if not exist "%PROD_DIR%backend\migrations" mkdir "%PROD_DIR%backend\migrations"
if not exist "%PROD_DIR%backend\seeders" mkdir "%PROD_DIR%backend\seeders"
if not exist "%PROD_DIR%frontend\dist" mkdir "%PROD_DIR%frontend\dist"
if not exist "%PROD_DIR%node" mkdir "%PROD_DIR%node"
echo Done.

REM Build frontend
echo.
echo [2/8] Building frontend...
cd /d "%FRONTEND_SRC%"
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

REM Copy frontend dist
echo.
echo [3/8] Copying frontend build...
xcopy /E /Y /I "%FRONTEND_SRC%\dist\*" "%PROD_DIR%frontend\dist\"

REM Copy backend source (excluding app.js which we have modified)
echo.
echo [4/8] Copying backend source...

REM Copy all subdirectories
xcopy /E /Y /I "%BACKEND_SRC%\src\config\*" "%PROD_DIR%backend\src\config\"
xcopy /E /Y /I "%BACKEND_SRC%\src\controllers\*" "%PROD_DIR%backend\src\controllers\"
xcopy /E /Y /I "%BACKEND_SRC%\src\middlewares\*" "%PROD_DIR%backend\src\middlewares\"
xcopy /E /Y /I "%BACKEND_SRC%\src\models\*" "%PROD_DIR%backend\src\models\"
xcopy /E /Y /I "%BACKEND_SRC%\src\routes\*" "%PROD_DIR%backend\src\routes\"
xcopy /E /Y /I "%BACKEND_SRC%\src\services\*" "%PROD_DIR%backend\src\services\"
xcopy /E /Y /I "%BACKEND_SRC%\src\utils\*" "%PROD_DIR%backend\src\utils\"

REM Copy package files
copy /Y "%BACKEND_SRC%\package.json" "%PROD_DIR%backend\"
copy /Y "%BACKEND_SRC%\package-lock.json" "%PROD_DIR%backend\" 2>nul
copy /Y "%BACKEND_SRC%\.sequelizerc" "%PROD_DIR%backend\" 2>nul

REM Copy migrations and seeders
xcopy /E /Y /I "%BACKEND_SRC%\migrations\*" "%PROD_DIR%backend\migrations\" 2>nul
xcopy /E /Y /I "%BACKEND_SRC%\seeders\*" "%PROD_DIR%backend\seeders\" 2>nul

REM Create modified app.js for serving frontend
echo.
echo [5/8] Creating production app.js...
(
echo const path = require^('path'^);
echo require^('dotenv'^).config^({ path: path.resolve^(__dirname, '../.env'^) }^);
echo.
echo const express = require^('express'^);
echo const cors = require^('cors'^);
echo const fs = require^('fs'^);
echo const { sequelize } = require^('./models'^);
echo const routes = require^('./routes'^);
echo const errorHandler = require^('./middlewares/errorHandler'^);
echo.
echo const app = express^(^);
echo const PORT = process.env.PORT ^|^| 5000;
echo.
echo // Path to frontend dist
echo const FRONTEND_PATH = path.resolve^(__dirname, '../../frontend/dist'^);
echo.
echo // Check if frontend exists
echo const frontendExists = fs.existsSync^(FRONTEND_PATH^);
echo if ^(frontendExists^) {
echo   console.log^('Frontend found at: ' + FRONTEND_PATH^);
echo } else {
echo   console.warn^('Warning: Frontend not found at ' + FRONTEND_PATH^);
echo }
echo.
echo // Middlewares
echo app.use^(cors^(^)^);
echo app.use^(express.json^({ limit: '10mb' }^)^);
echo app.use^(express.urlencoded^({ extended: true, limit: '10mb' }^)^);
echo.
echo // API Routes
echo app.use^('/api', routes^);
echo.
echo // Serve static frontend files
echo if ^(frontendExists^) {
echo   app.use^(express.static^(FRONTEND_PATH, { maxAge: '1d', etag: true }^)^);
echo }
echo.
echo // API 404 handler
echo app.use^('/api/*', ^(req, res^) =^> {
echo   res.status^(404^).json^({ success: false, message: 'API route not found' }^);
echo }^);
echo.
echo // SPA fallback
echo if ^(frontendExists^) {
echo   app.get^('*', ^(req, res^) =^> {
echo     res.sendFile^(path.join^(FRONTEND_PATH, 'index.html'^)^);
echo   }^);
echo }
echo.
echo // Error handler
echo app.use^(errorHandler^);
echo.
echo // Read version
echo const versionPath = path.resolve^(__dirname, '../../version.txt'^);
echo let version = '1.0.0';
echo try {
echo   if ^(fs.existsSync^(versionPath^)^) {
echo     version = fs.readFileSync^(versionPath, 'utf8'^).trim^(^);
echo   }
echo } catch ^(e^) {}
echo.
echo // Start server
echo const startServer = async ^(^) =^> {
echo   try {
echo     console.log^(''^);
echo     console.log^('========================================'^);
echo     console.log^('  POS System v' + version^);
echo     console.log^('========================================'^);
echo     console.log^(''^);
echo     console.log^('Connecting to database...'^);
echo     await sequelize.authenticate^(^);
echo     console.log^('Database connection established.'^);
echo     if ^(process.env.NODE_ENV !== 'production'^) {
echo       await sequelize.sync^(^);
echo       console.log^('Database synchronized.'^);
echo     } else {
echo       console.log^('Production mode: skip sequelize.sync ^(use migrations^).'^);
echo     }
echo     app.listen^(PORT, ^(^) =^> {
echo       console.log^(''^);
echo       console.log^('Server running on port ' + PORT^);
echo       console.log^('Application: http://localhost:' + PORT^);
echo       console.log^('API: http://localhost:' + PORT + '/api'^);
echo       console.log^(''^);
echo       console.log^('Press Ctrl+C to stop.'^);
echo       console.log^('========================================'^);
echo     }^);
echo   } catch ^(error^) {
echo     console.error^('ERROR: ' + error.message^);
echo     process.exit^(1^);
echo   }
echo };
echo.
echo startServer^(^);
echo module.exports = app;
) > "%PROD_DIR%backend\src\app.js"

REM Create .env.example
echo.
echo [6/8] Creating environment files...
(
echo # Server Configuration
echo PORT=5000
echo NODE_ENV=production
echo.
echo # Database Configuration
echo DB_HOST=localhost
echo DB_PORT=3306
echo DB_NAME=pos_system
echo DB_USER=root
echo DB_PASSWORD=your_password_here
echo.
echo # JWT Configuration
echo JWT_SECRET=change_this_to_a_secure_random_string
echo JWT_EXPIRES_IN=1d
) > "%PROD_DIR%backend\.env.example"

REM Copy .env.example to .env if not exists
if not exist "%PROD_DIR%backend\.env" (
    copy "%PROD_DIR%backend\.env.example" "%PROD_DIR%backend\.env"
)

REM Install production dependencies
echo.
echo [7/8] Installing production dependencies...
cd /d "%PROD_DIR%backend"
call npm ci --omit=dev 2>nul
if errorlevel 1 (
    echo npm ci failed, trying npm install...
    call npm install --omit=dev
)

REM Check Node.js portable
echo.
echo [8/8] Checking Node.js portable...
if exist "%PROD_DIR%node\node.exe" (
    echo Node.js portable found.
)
if not exist "%PROD_DIR%node\node.exe" (
    set "SYSTEM_NODE="
    if exist "%ProgramFiles%\nodejs\node.exe" set "SYSTEM_NODE=%ProgramFiles%\nodejs\node.exe"
    if not defined SYSTEM_NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "SYSTEM_NODE=%ProgramFiles(x86)%\nodejs\node.exe"

    if defined SYSTEM_NODE (
        copy /Y "%SYSTEM_NODE%" "%PROD_DIR%node\node.exe" >nul
        if exist "%PROD_DIR%node\node.exe" (
            echo Copied node.exe from local system installation.
        ) else (
            echo WARNING: Failed to copy node.exe from local system installation.
        )
    )
)
if not exist "%PROD_DIR%node\node.exe" (
    echo.
    echo ========================================
    echo   ACTION REQUIRED: Download Node.js
    echo ========================================
    echo.
    echo 1. Download from:
    echo    https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip
    echo.
    echo 2. Extract the ZIP
    echo.
    echo 3. Copy node.exe to:
    echo    %PROD_DIR%node\
    echo.
)

REM Update version from package.json
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"version\"" "%PROD_DIR%backend\package.json"') do (
    set "VER=%%a"
)
set "VER=%VER:"=%"
set "VER=%VER: =%"
echo %VER%> "%PROD_DIR%version.txt"

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Version: %VER%
echo.
echo Next steps:
echo   1. Ensure node.exe is in the 'node' folder
echo   2. Configure backend\.env with database settings
echo   3. Test by running start.bat
echo   4. Commit and push to GitHub
echo.
pause
