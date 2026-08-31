#!/usr/bin/env bash
# PT-BR: Sobe o OpenLingo e cria um TÚNEL Cloudflare (trycloudflare) para acessar de fora de casa.
#        O link funciona em QUALQUER navegador (celular/PC) — sem instalar nada no aparelho.
# EN:    Starts OpenLingo + a Cloudflare quick tunnel to access from anywhere. Link works on any browser.
set -e
cd "$(dirname "$0")"

CLOUDFLARED="$HOME/.local/bin/cloudflared"
if [ ! -x "$CLOUDFLARED" ]; then
  echo "==> Instalando cloudflared…"
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$CLOUDFLARED" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$CLOUDFLARED"
fi

# PT-BR: sobe o OpenLingo em segundo plano (HTTPS, porta 8000 — necessário p/ microfone no celular).
# EN:    start OpenLingo in background (HTTPS, port 8000 — needed for phone microphone).
echo "==> Subindo o OpenLingo (https://localhost:8000)…"
BASE_URL="https://localhost:8000"
if ! curl -kfsS "$BASE_URL/api/health" >/dev/null 2>&1; then
  nohup ./run.sh --https >/tmp/openlingo.log 2>&1 &
  # PT-BR: aguarda o servidor subir. EN: wait for the server.
  for i in $(seq 1 30); do
    if curl -kfsS "$BASE_URL/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

echo "==> Criando túnel Cloudflare…"
echo "   (careful: o endereço abaixo é temporário — some quando este processo fechar)"
echo ""

# PT-BR: cria o túnel. A URL trycloudflare.com aparece no log.
#        --no-tls-verify: ignora o certificado autoassinado do OpenLingo (origem).
# EN:    create the tunnel. URL shows in log.
#        --no-tls-verify: ignore OpenLingo's self-signed origin cert.
"$CLOUDFLARED" tunnel --no-tls-verify --url "$BASE_URL"
