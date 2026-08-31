#!/usr/bin/env bash
# PT-BR: Lançador do OpenLingo (Linux) — sobe o servidor na porta 80 (HTTPS) e abre o app.
# EN:    OpenLingo launcher (Linux) — starts the server on port 80 (HTTPS) and opens the app.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"   # project root

# Precisa de sudo para porta 80. Se já tiver rodando, abre direto.
if ! curl -k -s -o /dev/null "https://localhost/api/health" 2>/dev/null; then
  # Usa pkexec (GUI sudo) ou sudo no terminal
  if command -v pkexec >/dev/null 2>&1; then
    pkexec "$HERE/run.sh" --https >/tmp/openlingo.log 2>&1 &
  else
    # Fallback: abre terminal pedindo sudo
    if command -v gnome-terminal >/dev/null 2>&1; then
      gnome-terminal -- bash -c "cd '$HERE' && sudo ./run.sh --https; exec bash"
    elif command -v konsole >/dev/null 2>&1; then
      konsole -e bash -c "cd '$HERE' && sudo ./run.sh --https; exec bash"
    elif command -v xterm >/dev/null 2>&1; then
      xterm -e bash -c "cd '$HERE' && sudo ./run.sh --https; exec bash"
    else
      notify-send "OpenLingo" "Execute manualmente: sudo $HERE/run.sh --https"
      exit 1
    fi
  fi
  # espera o servidor responder
  for _ in $(seq 1 60); do
    curl -k -s -o /dev/null "https://localhost/api/health" 2>/dev/null && break
    sleep 0.5
  done
fi

# abre no navegador
xdg-open "https://localhost" 2>/dev/null || open "https://localhost" 2>/dev/null || echo "Abra https://localhost no navegador."
