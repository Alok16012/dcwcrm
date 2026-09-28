@echo off
rem Double-click this once. Installs the DCW biometric bridge and starts it on every login.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
