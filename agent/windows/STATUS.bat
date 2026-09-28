@echo off
rem Shows whether the DCW biometric bridge is running, and its latest log lines.
set "DIR=%LOCALAPPDATA%\DCWBiometric"
echo.
tasklist /v /fi "imagename eq node.exe" | find /i "node.exe" >nul && (echo Agent: RUNNING) || (echo Agent: NOT RUNNING - restart the PC or run INSTALL.bat again)
echo.
echo ---- last 25 log lines ----
powershell -NoProfile -Command "if (Test-Path '%DIR%\logs\agent.log') { Get-Content '%DIR%\logs\agent.log' -Tail 25 } else { 'No log yet' }"
echo.
pause
