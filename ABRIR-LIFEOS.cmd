@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INICIAR-LIFEOS.ps1"
if errorlevel 1 pause
