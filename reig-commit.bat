@echo off
REM ============================================================================
REM reig-commit.bat — wrapper de commits para gestion-reig desde Cowork
REM ============================================================================
REM Resuelve dos problemas conocidos del flujo Cowork -> CMD -> git:
REM   1) Ghost lock: el mount Cowork deja .git\index.lock fantasma cada vez
REM      que Claude intenta operaciones de escritura. Borrar el lock de
REM      forma idempotente al inicio.
REM   2) CMD multilinea: `git commit -F-` con stdin pegado NO funciona en
REM      CMD de Windows (cada Enter ejecuta la linea como un comando).
REM      Solucion: leer el mensaje desde un fichero con `git commit -F`.
REM
REM Uso (desde cualquier directorio — el script hace cd al repo):
REM   reig-commit.bat ^<fichero_o_patron^> ^<fichero_mensaje^>
REM
REM Ejemplos:
REM   reig-commit.bat src\lib\nomina\calculadores.ts .commit-msg.txt
REM   reig-commit.bat "src\lib\nomina\*.ts" .commit-msg.txt
REM
REM Flujo del script:
REM   1. cd al repo
REM   2. borra .git\index.lock si existe (idempotente)
REM   3. git add ^<arg1^>
REM   4. git commit -F ^<arg2^>
REM   5. git push origin main
REM   6. git log -1 --oneline (muestra el commit creado)
REM   7. borra el fichero de mensaje (limpieza, ya esta en git)
REM
REM Aborta en cuanto falla cualquier paso (no commit a medias, no push fallido).
REM
REM Documentado en REIG-BASE/00-SISTEMA/optimizaciones-candidatas.md
REM (oportunidades 2026-04-06 #3 y 2026-04-07 #3, resueltas en sesion 8).
REM Creado: 2026-04-07 cierre sesion 8.
REM ============================================================================

setlocal

cd /d C:\Users\Ventas\gestion-reig
if errorlevel 1 (
  echo [reig-commit] ERROR: no se pudo entrar a C:\Users\Ventas\gestion-reig
  exit /b 1
)

REM ---- Borrar ghost lock si existe (no falla si no hay lock) ----
if exist .git\index.lock (
  echo [reig-commit] Borrando .git\index.lock fantasma...
  del .git\index.lock 2>nul
)

REM ---- Validar argumentos ----
if "%~1"=="" (
  echo [reig-commit] ERROR: falta primer argumento [fichero o patron a anyadir]
  echo Uso: reig-commit.bat ^<fichero^> ^<fichero_mensaje^>
  exit /b 1
)
if "%~2"=="" (
  echo [reig-commit] ERROR: falta segundo argumento [fichero con mensaje de commit]
  echo Uso: reig-commit.bat ^<fichero^> ^<fichero_mensaje^>
  exit /b 1
)
if not exist "%~2" (
  echo [reig-commit] ERROR: el fichero de mensaje "%~2" no existe
  exit /b 1
)

REM ---- git add ----
echo [reig-commit] git add %~1
git add %~1
if errorlevel 1 (
  echo [reig-commit] ERROR en git add — abortado
  exit /b 1
)

REM ---- git commit -F ----
echo [reig-commit] git commit -F %~2
git commit -F "%~2"
if errorlevel 1 (
  echo [reig-commit] ERROR en git commit — abortado
  exit /b 1
)

REM ---- git push ----
echo [reig-commit] git push origin main
git push origin main
if errorlevel 1 (
  echo [reig-commit] ERROR en git push — abortado (commit creado en local pero NO subido)
  exit /b 1
)

REM ---- Resumen ----
echo.
echo [reig-commit] OK — commit y push completados:
git log -1 --oneline

REM ---- Limpiar fichero de mensaje (ya esta en git, no hace falta el txt) ----
del "%~2" 2>nul
echo [reig-commit] %~2 eliminado.

endlocal
exit /b 0
