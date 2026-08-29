@echo off
REM PT-BR: Lançador do OpenLingo (Windows) — sobe o servidor e abre o app no navegador.
REM EN:    OpenLingo launcher (Windows) — starts the server and opens the app in the browser.
setlocal
set "ROOT=%~dp0.."
set "PORT=8000"

REM PT-BR: sobe o servidor minimizado se não estiver no ar. EN: start server if not running.
curl -s -o NUL "http://localhost:%PORT%/api/health" 2>NUL
if errorlevel 1 (
  start "OpenLingo" /min cmd /c ""%ROOT%\run.bat""
  timeout /t 6 /nobreak >NUL
)
start "" "http://localhost:%PORT%"
endlocal
