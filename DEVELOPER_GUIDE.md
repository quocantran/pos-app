# POS System - Developer Deployment Guide

## Overview

This guide explains how to build and deploy the POS system for client machines.

## Prerequisites (Developer Machine)

- Node.js 20.x installed
- npm installed
- Git installed
- Access to the source code (`pos/` folder)
- Access to the production repo (`pos-production/` folder)

---

## Step-by-Step Deployment Process

### Step 1: Build Frontend

```cmd
cd d:\Workspace\Fullstack\pos\Web-pos
npm install
npm run build
```

This creates the `dist/` folder with optimized production files.

### Step 2: Prepare Production Directory

Create the folder structure:

```cmd
mkdir d:\Workspace\Fullstack\pos-production\backend\src
mkdir d:\Workspace\Fullstack\pos-production\frontend\dist
mkdir d:\Workspace\Fullstack\pos-production\node
```

### Step 3: Copy Frontend Build

```cmd
xcopy /E /Y "d:\Workspace\Fullstack\pos\Web-pos\dist\*" "d:\Workspace\Fullstack\pos-production\frontend\dist\"
```

### Step 4: Copy Backend Source

```cmd
REM Copy all source files
xcopy /E /Y "d:\Workspace\Fullstack\pos\backend\src\*" "d:\Workspace\Fullstack\pos-production\backend\src\"

REM Copy package files
copy "d:\Workspace\Fullstack\pos\backend\package.json" "d:\Workspace\Fullstack\pos-production\backend\"
copy "d:\Workspace\Fullstack\pos\backend\package-lock.json" "d:\Workspace\Fullstack\pos-production\backend\"
copy "d:\Workspace\Fullstack\pos\backend\.sequelizerc" "d:\Workspace\Fullstack\pos-production\backend\"

REM Copy migrations and seeders
xcopy /E /Y "d:\Workspace\Fullstack\pos\backend\migrations\*" "d:\Workspace\Fullstack\pos-production\backend\migrations\"
xcopy /E /Y "d:\Workspace\Fullstack\pos\backend\seeders\*" "d:\Workspace\Fullstack\pos-production\backend\seeders\"
```

### Step 5: Modify Backend app.js

Replace `pos-production\backend\src\app.js` with the modified version that:
1. Serves static files from `../frontend/dist`
2. Implements SPA fallback
3. Shows version on startup

The modified app.js is already created in the production folder.

### Step 6: Install Production Dependencies

```cmd
cd d:\Workspace\Fullstack\pos-production\backend
npm ci --omit=dev
```

If `npm ci` fails, use:
```cmd
npm install --omit=dev
```

### Step 7: Download Portable Node.js

1. Go to: https://nodejs.org/dist/v20.11.1/
2. Download: `node-v20.11.1-win-x64.zip`
3. Extract the ZIP file
4. Copy `node.exe` to `d:\Workspace\Fullstack\pos-production\node\`

**Direct download link:**
https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip

### Step 8: Configure Environment

Create/update `pos-production\backend\.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=pos_system
DB_USER=root
DB_PASSWORD=client_password_here

# JWT Configuration
JWT_SECRET=generate_a_secure_random_string
JWT_EXPIRES_IN=1d
```

### Step 9: Update Version

Edit `pos-production\version.txt`:
```
1.0.0
```

### Step 10: Test Locally

1. Make sure MySQL is running
2. Double-click `start.bat`
3. Verify the application works correctly
4. Test all features

### Step 11: Initialize Git Repository (First Time Only)

```cmd
cd d:\Workspace\Fullstack\pos-production

REM Initialize repo
git init
git branch -M main

REM Add remote
git remote add origin https://github.com/YOUR_USERNAME/pos-production.git

REM Create .gitignore
echo .env > .gitignore
echo pos.lock >> .gitignore

REM Initial commit
git add -A
git commit -m "Initial production release v1.0.0"

REM Push
git push -u origin main
```

### Step 12: Push Updates

For subsequent updates:

```cmd
cd d:\Workspace\Fullstack\pos-production

REM Update version.txt
echo 1.0.1 > version.txt

REM Commit and push
git add -A
git commit -m "Release v1.0.1 - Description of changes"
git push origin main
```

---

## Client Deployment Instructions

### First-Time Setup (On Client Machine)

1. **Install Git**
   - Download: https://git-scm.com/download/win
   - Install with default options

2. **Install MySQL**
   - Download: https://dev.mysql.com/downloads/installer/
   - Create database: `pos_system`

3. **Clone Repository**
   ```cmd
   cd C:\
   git clone https://github.com/YOUR_USERNAME/pos-production.git
   cd pos-production
   ```

4. **Configure Database**
   - Open `backend\.env` in Notepad
   - Update database credentials

5. **Run Database Migrations** (if needed)
   ```cmd
   cd backend
   ..\node\node.exe node_modules\.bin\sequelize db:migrate
   ..\node\node.exe node_modules\.bin\sequelize db:seed:all
   ```

6. **Start System**
   - Double-click `start.bat`

### Updating (On Client Machine)

1. Double-click `update.bat`
2. Wait for download
3. System restarts automatically

---

## Files Created

| File | Purpose |
|------|---------|
| `start.bat` | Starts backend + opens Chrome kiosk |
| `update.bat` | Updates from GitHub (git reset --hard) |
| `build.bat` | Developer tool to rebuild production |
| `version.txt` | Current version number |
| `README.md` | User documentation |
| `DEVELOPER_GUIDE.md` | This file |
| `backend/src/app.js` | Modified to serve frontend |
| `backend/.env.example` | Environment template |

---

## Troubleshooting

### Build Issues

**"npm not found"**
- Install Node.js on developer machine

**"Cannot find module"**
- Run `npm install` in the source folder first
- Run `npm ci --omit=dev` in production backend folder

### Runtime Issues

**"ECONNREFUSED" or database error**
- Check MySQL is running
- Verify `.env` credentials
- Test connection: `mysql -u root -p pos_system`

**"Port already in use"**
- Run `update.bat` to kill existing processes
- Or manually: `taskkill /F /IM node.exe`

**Chrome not opening**
- Verify Chrome is installed
- Check default browser settings

### Update Issues

**"Not a git repository"**
- Client needs to clone, not just copy the folder

**"Failed to fetch"**
- Check internet connection
- Verify GitHub repo is accessible

---

## Security Notes

1. **Never commit `.env` with real credentials**
   - `.gitignore` should include `.env`
   - Use `.env.example` as template

2. **Change JWT_SECRET in production**
   - Generate secure random string
   - Different for each client if needed

3. **Database passwords**
   - Use strong passwords
   - Different for each client
