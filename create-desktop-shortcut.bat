@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "TARGET=%SCRIPT_DIR%start.bat"
set "SHORTCUT=%USERPROFILE%\Desktop\POS System.lnk"

echo Creating Desktop shortcut...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.IconLocation = '%SystemRoot%\System32\SHELL32.dll,220'; $s.Save()"

if exist "%SHORTCUT%" (
    echo Done: %SHORTCUT%
) else (
    echo Failed to create shortcut.
)

pause
