#!/usr/bin/env bash
# =============================================================================
# PT-BR: Instalador único do Guaralingo para macOS e Linux.
#        Instala pré-requisitos, baixa o projeto, configura e sobe o app.
#        Uso (uma linha):
#          bash <(curl -fsSL https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.sh)
# EN:    One-command Guaralingo installer for macOS and Linux.
# =============================================================================
set -e

REPO="https://github.com/disouz4-dev/guaralingo.git"
DIR="${GUARALINGO_DIR:-$HOME/guaralingo}"
OS="$(uname -s)"

echo "🦜 Instalando o Guaralingo ($OS)..."

# --- 1. Ollama ---------------------------------------------------------------
if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Instalando o Ollama..."
  if [ "$OS" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then brew install --cask ollama || true; fi
    command -v ollama >/dev/null 2>&1 || { echo "   Baixe o Ollama para Mac em https://ollama.com/download e rode de novo."; }
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
fi

# --- 2. Pré-requisitos (git, python3) ---------------------------------------
command -v git >/dev/null 2>&1 || { echo "   Instale o git e rode de novo."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "   Instale o Python 3 e rode de novo."; exit 1; }

# --- 3. Baixar/atualizar o projeto ------------------------------------------
if [ -d "$DIR/.git" ]; then
  echo "==> Atualizando o projeto em $DIR..."
  git -C "$DIR" pull --ff-only || true
else
  echo "==> Baixando o projeto em $DIR..."
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

# --- 4. Setup (modelo + vozes) e execução -----------------------------------
chmod +x setup.sh run.sh
./setup.sh
echo ""
echo "✅ Pronto! Iniciando o Guaralingo..."
exec ./run.sh
