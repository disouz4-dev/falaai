#!/usr/bin/env bash
# PT-BR: Sobe o Fala A.I.. Use HTTPS (--https) para liberar o microfone no CELULAR.
# EN:    Starts Fala A.I.. Use HTTPS (--https) to unlock the microphone on your PHONE.
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

# PT-BR: build do frontend React se necessário (senão, usa o frontend legado automaticamente).
# EN: build the React frontend if needed (otherwise it falls back to the legacy frontend).
if [ -f web/package.json ] && [ ! -d web/dist ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Compilando o frontend (React/Vite)…"
    (cd web && npm install --silent && npm run build >/dev/null)
  else
    echo "==> (Node/npm ausente — usando o frontend clássico. Instale o Node p/ o React.)"
  fi
fi

HOST="0.0.0.0"
# PT-BR: Porta 80 (padrão) no modo servidor web (legado). Nota: porta <1024 exige
#        sudo ao iniciar (./run.sh --https com sudo). O app desktop atual é autônomo
#        e sobe o backend na porta 8000 (HTTP, sem root).
# EN:    Port 80 (default) in the legacy web-server mode. NOTE: ports <1024 need sudo
#        when starting (run ./run.sh --https with sudo). The current desktop app is
#        standalone and runs its backend on port 8000 (HTTP, no root).
PORT="80"
# PT-BR: detecta o IP local (Linux e macOS). EN: detect LAN IP (Linux and macOS).
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then
  # macOS
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
fi

SSL_ARGS=""
OL_HTTPS=0
if [ "$1" == "--https" ]; then
  # PT-BR: prefere o certificado CONFIÁVEL do mkcert; senão, autoassinado. EN: prefer mkcert, else self-signed.
  mkdir -p certs
  if [ -f certs/falaai.local.pem ] && [ -f certs/falaai.local-key.pem ]; then
    CERT="certs/falaai.local.pem"; KEY="certs/falaai.local-key.pem"; TRUSTED=1
  else
    CERT="certs/cert.pem"; KEY="certs/key.pem"; TRUSTED=0
    if [ ! -f certs/key.pem ]; then
      echo "==> Gerando certificado autoassinado…"
      openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
        -keyout certs/key.pem -out certs/cert.pem \
        -subj "/CN=falaai.local" \
        -addext "subjectAltName=DNS:falaai.local,DNS:localhost,IP:127.0.0.1${LAN_IP:+,IP:$LAN_IP}" >/dev/null 2>&1
    fi
  fi
  SSL_ARGS="--ssl-keyfile $KEY --ssl-certfile $CERT"
  OL_HTTPS=1
  echo ""
  echo "🐺 Fala A.I. (HTTPS)"
  if [ "$PORT" = "80" ]; then
    echo "   Nome na rede: https://falaai.local   ← use este em qualquer dispositivo"
    echo "   PC:           https://localhost          ← (porta 80, modo servidor web legado)"
    [ -n "$LAN_IP" ] && echo "   (ou por IP:   https://$LAN_IP)"
  else
    echo "   Nome na rede: https://falaai.local:$PORT   ← use este em qualquer dispositivo"
    echo "   PC:           https://localhost:$PORT"
    [ -n "$LAN_IP" ] && echo "   (ou por IP:   https://$LAN_IP:$PORT)"
  fi
  if [ "$TRUSTED" = "1" ]; then
    echo "   ✅ Certificado confiável (mkcert) — sem aviso de segurança."
  else
    echo "   ⚠️  Certificado autoassinado — para cadeado verde rode: ./setup-cert.sh"
  fi
  echo ""
else
  echo ""
  echo "🐺 Fala A.I. (HTTP)"
  echo "   Nome na rede: http://falaai.local:$PORT   ← use este em qualquer dispositivo"
  echo "   PC:           http://localhost:$PORT"
  echo "   (para microfone no celular rode: ./run.sh --https)"
  echo ""
fi

# PT-BR: LOOP DE REINÍCIO — o botão "Atualizar" do app (/api/update) faz o servidor sair com o
#        sinal .restart; aqui reinstalamos deps, recompilamos o React e subimos o código novo.
# EN: RESTART LOOP — the app's "Update" button triggers a .restart signal; here we reinstall,
#     rebuild the React app and relaunch with the new code.
set +e
while true; do
  FALA_AI_HTTPS="$OL_HTTPS" FALA_AI_PORT="$PORT" \
    uvicorn main:app --app-dir backend --host "$HOST" --port "$PORT" $SSL_ARGS
  code=$?
  if [ -f .restart ]; then
    rm -f .restart
    echo "==> 🔄 Atualização aplicada — reinstalando dependências e recompilando o app…"
    pip install -q -r backend/requirements.txt
    if [ -f web/package.json ] && command -v npm >/dev/null 2>&1; then
      (cd web && npm install --silent && npm run build >/dev/null)
    fi
    continue
  fi
  exit $code
done
