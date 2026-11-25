@echo off
rem Double-click on the office PC where the biometric software is installed.
rem Reconnects attendance to the CRM and fetches the punches it missed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix.ps1"
pause
