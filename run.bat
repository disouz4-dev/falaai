@echo off
REM PT-BR: Sobe o Fala A.I. no Windows. Use "run.bat https" para liberar o microfone no celular.
REM EN:    Starts Fala A.I. on Windows. Use "run.bat https" to unlock the mic on your phone.
setlocal
cd /d "%~dp0"

REM PT-BR: cria/usa o ambiente virtual. EN: create/use the virtual environment.
if not exist ".venv\" (
  echo ==^> Criando ambiente virtual (venv)...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
echo ==^> Instalando dependencias...
pip install -q -r backend\requirements.txt

set HOST=0.0.0.0
set PORT=8000

if /I "%1"=="https" goto https

echo.
echo Fala A.I. (HTTP)
echo    PC: http://localhost:%PORT%
echo    (para microfone no celular use: run.bat https)
echo.
cd backend
uvicorn main:app --host %HOST% --port %PORT%
goto end

:https
if not exist "certs\" mkdir certs
if not exist "certs\cert.pem" (
  echo ==^> Gerando certificado autoassinado...
  where openssl >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] openssl nao encontrado. Instale o OpenSSL ou rode sem https.
    goto end
  )
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 -keyout certs\key.pem -out certs\cert.pem -subj "/CN=Fala A.I."
)
echo.
echo Fala A.I. (HTTPS)
echo    PC:      https://localhost:%PORT%
echo    Celular: use o IP da sua maquina (ipconfig) em https://SEU_IP:%PORT%
echo.
cd backend
uvicorn main:app --host %HOST% --port %PORT% --ssl-keyfile ..\certs\key.pem --ssl-certfile ..\certs\cert.pem

:end
endlocal
