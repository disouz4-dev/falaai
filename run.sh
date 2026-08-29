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
# PT-BR: detecta o IP local (Linux e macOS). EN: detect LAN IP (Linux and macOS).
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then
  # macOS
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
fi

if [ "$1" == "--https" ]; then
  # PT-BR: Gera certificado autoassinado (necessário p/ microfone via rede no celular).
  # EN:    Generate a self-signed cert (needed for mic over LAN on the phone).
  mkdir -p certs
  # PT-BR: prefere o certificado CONFIÁVEL do mkcert (cadeado verde). Senão, autoassinado.
  # EN: prefer the TRUSTED mkcert certificate (green lock). Otherwise, self-signed.
  if [ -f certs/openlingo.local.pem ] && [ -f certs/openlingo.local-key.pem ]; then
    CERT="../certs/openlingo.local.pem"; KEY="../certs/openlingo.local-key.pem"; TRUSTED=1
  else
    CERT="../certs/cert.pem"; KEY="../certs/key.pem"; TRUSTED=0
    if [ ! -f certs/key.pem ]; then
      echo "==> Gerando certificado autoassinado…"
      openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
        -keyout certs/key.pem -out certs/cert.pem \
        -subj "/CN=openlingo.local" \
        -addext "subjectAltName=DNS:openlingo.local,DNS:localhost,IP:127.0.0.1${LAN_IP:+,IP:$LAN_IP}" >/dev/null 2>&1
    fi
  fi
  echo ""
  echo "🦜 OpenLingo (HTTPS)"
  echo "   Nome na rede: https://openlingo.local:$PORT   ← use este em qualquer dispositivo"
  echo "   PC:           https://localhost:$PORT"
  [ -n "$LAN_IP" ] && echo "   (ou por IP:   https://$LAN_IP:$PORT)"
  if [ "$TRUSTED" = "1" ]; then
    echo "   ✅ Certificado confiável (mkcert) — sem aviso de segurança."
  else
    echo "   ⚠️  Certificado autoassinado — para cadeado verde rode: ./setup-cert.sh"
  fi
  echo ""
  cd backend
  OPENLINGO_HTTPS=1 OPENLINGO_PORT="$PORT" exec uvicorn main:app --host "$HOST" --port "$PORT" \
    --ssl-keyfile "$KEY" --ssl-certfile "$CERT"
else
  echo ""
  echo "🦜 OpenLingo (HTTP)"
  echo "   Nome na rede: http://openlingo.local:$PORT   ← use este em qualquer dispositivo"
  echo "   PC:           http://localhost:$PORT"
  echo "   (para microfone no celular rode: ./run.sh --https)"
  echo ""
  cd backend
  OPENLINGO_PORT="$PORT" exec uvicorn main:app --host "$HOST" --port "$PORT"
fi
