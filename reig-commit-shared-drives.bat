@echo off
REM Helper de un solo uso para commitear el parche de Shared Drives
REM (sesion 9, fix #2). Despues se autodestruye.
cd /d C:\Users\Ventas\gestion-reig
if exist .git\index.lock del .git\index.lock 2>nul
call reig-commit.bat "src\lib\nomina\storage\google-drive.ts" ".commit-msg-shared-drives.txt"
if errorlevel 1 (
  echo.
  echo [helper] reig-commit.bat fallo. Revisa la salida de arriba.
  pause
  exit /b 1
)
echo.
echo [helper] OK. Borrando este helper...
del "%~f0" 2>nul
echo [helper] Hecho.
pause
