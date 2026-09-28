@echo off
rem Stops the DCW biometric bridge and removes it from this PC.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'dahua-bridge\.mjs|run-agent\.cmd' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DCW Biometric Bridge.vbs" 2>nul
rmdir /s /q "%LOCALAPPDATA%\DCWBiometric" 2>nul
echo DCW Biometric Bridge removed.
pause
