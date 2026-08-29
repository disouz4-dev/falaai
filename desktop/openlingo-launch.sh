#!/usr/bin/env bash
# PT-BR: Lançador do OpenLingo (Linux/macOS) — sobe o servidor (se preciso) e abre o app.
# EN:    OpenLingo launcher (Linux/macOS) — starts the server if needed and opens the app.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"   # PT-BR: raiz do projeto. EN: project root.
PORT="${OPENLINGO_PORT:-8000}"
URL="http://localhost:$PORT"

# PT-BR: sobe o servidor em segundo plano se ainda não estiver no ar.
# EN: start the server in the background if it isn't running yet.
if ! curl -s -o /dev/null "http://localhost:$PORT/api/health" 2>/dev/null; then
  nohup "$HERE/run.sh" >/tmp/openlingo.log 2>&1 &
  # PT-BR: espera o servidor responder. EN: wait for the server to answer.
  for _ in $(seq 1 40); do
    curl -s -o /dev/null "http://localhost:$PORT/api/health" 2>/dev/null && break
    sleep 0.5
  done
fi

# PT-BR: abre no navegador padrão. EN: open in the default browser.
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
elif command -v open >/dev/null 2>&1; then open "$URL"      # macOS
else echo "Abra $URL no navegador."; fi
