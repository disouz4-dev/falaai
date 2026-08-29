#!/usr/bin/env bash
# PT-BR: Sobe o OpenLingo. Use HTTPS (--https) para liberar o microfone no CELULAR.
# EN:    Starts OpenLingo. Use HTTPS (--https) to unlock the microphone on your PHONE.
set -e
cd "$(dirname "$0")"

# PT-BR: Cria/usa venv e instala dependências. EN: Create/use venv and install deps.
if [ ! -d ".venv" ]; then
  echo "==> Criando ambiente virtual (venv)…"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
echo "==> Instalando dependências…"
pip install -q -r backend/requirements.txt

HOST="0.0.0.0"
PORT="8000"
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if [ "$1" == "--https" ]; then
  # PT-BR: Gera certificado autoassinado (necessário p/ microfone via rede no celular).
  # EN:    Generate a self-signed cert (needed for mic over LAN on the phone).
  mkdir -p certs
  if [ ! -f certs/key.pem ]; then
    echo "==> Gerando certificado autoassinado…"
    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
      -keyout certs/key.pem -out certs/cert.pem \
      -subj "/CN=OpenLingo" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1${LAN_IP:+,IP:$LAN_IP}" >/dev/null 2>&1
  fi
  echo ""
  echo "🦜 OpenLingo (HTTPS)"
  echo "   PC:      https://localhost:$PORT"
  [ -n "$LAN_IP" ] && echo "   Celular: https://$LAN_IP:$PORT  (aceite o aviso de certificado)"
  echo ""
  cd backend
  exec uvicorn main:app --host "$HOST" --port "$PORT" \
    --ssl-keyfile ../certs/key.pem --ssl-certfile ../certs/cert.pem
else
  echo ""
  echo "🦜 OpenLingo (HTTP)"
  echo "   PC: http://localhost:$PORT"
  echo "   (para microfone no celular rode: ./run.sh --https)"
  echo ""
  cd backend
  exec uvicorn main:app --host "$HOST" --port "$PORT"
fi
