@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "TARGET=%SCRIPT_DIR%start.bat"
set "SHORTCUT=%USERPROFILE%\Desktop\POS System.lnk"
set "ICON=%SCRIPT_DIR%icon-cart-shortcut.ico"

if not exist "%ICON%" (
    echo [LOI] Khong tim thay file icon: %ICON%
    pause
    exit /b 1
)

set "ICON_HEADER="
for /f "delims=" %%H in ('powershell -NoProfile -Command "$b=[System.IO.File]::ReadAllBytes('%ICON%'); if($b.Length -ge 4){ '{0},{1},{2},{3}' -f $b[0],$b[1],$b[2],$b[3] }"') do set "ICON_HEADER=%%H"
if not "%ICON_HEADER%"=="0,0,1,0" (
    echo [CANH BAO] File icon dang dung khong dung dinh dang ICO chuan.
    echo          Header hien tai: %ICON_HEADER%
    echo          Shortcut co the hien icon trang.
)

echo Dang tao shortcut tren Desktop...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.IconLocation = '%ICON%,0'; $s.WindowStyle = 7; $s.Save()"

if exist "%SHORTCUT%" (
    echo Hoan tat! Shortcut da duoc tao tai: %SHORTCUT%
) else (
    echo Khong the tao shortcut.
)

pause
