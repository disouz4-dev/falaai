#!/usr/bin/env bash
# =============================================================================
# PT-BR: Instalador do Guaralingo para macOS e Linux — wrapper fino que garante
#        Python 3.10+ e delega tudo ao instalador universal install.py (um código só).
#        Uso (uma linha):
#          bash <(curl -fsSL https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.sh)
#          ou:  curl -fsSL https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py | python3 -
# EN:    Guaralingo installer for macOS/Linux — thin wrapper that ensures Python 3.10+
#        and delegates to the universal install.py (one code for all OS).
# =============================================================================
set -e
OS="$(uname -s)"
URL="https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py"

# PT-BR: garante Python 3.10+; tenta instalar se faltar. EN: ensure Python 3.10+.
if ! command -v python3 >/dev/null 2>&1; then
  echo "==> Python 3 não encontrado — instalando..."
  if [ "$OS" = "Darwin" ] && command -v brew >/dev/null 2>&1; then brew install python@3.12
  elif [ "$OS" != "Darwin" ]; then sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip
  fi
  command -v python3 >/dev/null 2>&1 || { echo "Instale Python 3.10+ em https://python.org"; exit 1; }
fi

# PT-BR: se o repo já foi clonado localmente, usa o install.py local; senão baixa.
# EN: if repo already cloned locally, use local install.py; else fetch it.
LOCAL_PY="$(dirname "$0")/install.py"
if [ -f "$LOCAL_PY" ]; then
  exec python3 "$LOCAL_PY" "$@"
else
  echo "🦜 Baixando instalador universal (install.py)..."
  curl -fsSL "$URL" | python3 - "$@"
fi
