#!/bin/bash
# Sidecar entrypoint for Fala A.I. Python backend (desktop app)
# PT-BR: Sobe o backend local do app desktop em HTTP na porta 8000 (sem root, autônomo).
# EN:    Starts the desktop app's local backend over HTTP on port 8000 (no root, standalone).

set -e

# Get the resource directory from Tauri (set automatically)
# When running as sidecar, Tauri sets TAURI_RESOURCE_DIR
RESOURCE_DIR="${TAURI_RESOURCE_DIR:-}"

if [ -n "$RESOURCE_DIR" ]; then
    # Running from Tauri bundle
    PROJECT_ROOT="$RESOURCE_DIR"
else
    # Running in development - find project root
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

echo "[Fala A.I. Sidecar] Starting backend from $PROJECT_ROOT"

# PT-BR: diretório onde fica o código do backend dentro do pacote / repo.
#        O Tauri pode mapear os resources embaixo de _up_/_up_ (quando o recurso é
#        referenciado com ../..). Procuramos por um diretório chamado "backend".
# EN: directory holding the backend code inside the bundle / repo. Tauri may place the
#     resources under _up_/_up_ (when the resource is referenced with ../..), so we
#     search for a directory named "backend".
if [ -d "$PROJECT_ROOT/backend" ]; then
    BACKEND_DIR="$PROJECT_ROOT/backend"
else
    MAYBE="$(find "$PROJECT_ROOT" -type d -name backend 2>/dev/null | head -1)"
    if [ -n "$MAYBE" ]; then
        BACKEND_DIR="$MAYBE"
    else
        BACKEND_DIR="$PROJECT_ROOT"
    fi
fi
echo "[Fala A.I. Sidecar] Backend dir: $BACKEND_DIR"

# PT-BR: cria/usa venv e instala as dependências se necessário (primeira execução).
#        O venv fica no diretório de dados do usuário (gravável), não em resources (root).
# EN: create/use venv and install deps if needed (first run). The venv lives in the user
#     data dir (writable), not in resources (root).
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/falaai"
mkdir -p "$DATA_DIR"
VENV_DIR="$DATA_DIR/venv"
PYTHON=""
if [ -x "$VENV_DIR/bin/python" ]; then
    PYTHON="$VENV_DIR/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON="$(command -v python3)"
fi

if [ -z "$PYTHON" ]; then
    echo "[Fala A.I. Sidecar] No Python found (precisa de python3)."
    exit 1
fi

# PT-BR: cria o venv local na primeira execução (se há python3-venv) para instalar as deps
#        sem afetar o sistema. EN: create a local venv on first run to install deps w/o
#        touching the system.
if [ ! -x "$VENV_DIR/bin/python" ] && command -v python3 >/dev/null 2>&1; then
    if python3 -m venv "$VENV_DIR" >/dev/null 2>&1; then
        PYTHON="$VENV_DIR/bin/python"
    fi
fi

# PT-BR: garante que as dependências estejam presentes (instala se faltar).
# EN: make sure deps are present (install if missing).
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
    REQ="$BACKEND_DIR/requirements.txt"
    if ! "$PYTHON" -c "import fastapi, uvicorn, pydantic" >/dev/null 2>&1; then
        echo "[Fala A.I. Sidecar] Installing dependencies... (primeira execução pode demorar)"
        "$PYTHON" -m pip install --quiet -r "$REQ" >/dev/null 2>&1 || true
    fi
fi

echo "[Fala A.I. Sidecar] Using Python: $PYTHON"

# PT-BR: ambiente — HTTP, porta 8000, sem mDNS (evita conflito); DESKTOP=1 indica ao
#        backend que está no app desktop (o /api/update baixa o .deb e instala por cima).
# EN: env — HTTP, port 8000, no mDNS (avoid conflict); DESKTOP=1 tells the backend it is
#     running in the desktop app (so /api/update downloads the .deb and installs it over).
export FALA_AI_HTTPS=0
export FALA_AI_PORT=8000
export FALA_AI_MDNS=0
export FALA_AI_DESKTOP=1

# PT-BR: diretório de dados gravável do usuário (banco + identidade local + memória).
# EN: writable user data dir (DB + local identity + memory).
export FALA_AI_DATA_DIR="$DATA_DIR"
echo "[Fala A.I. Sidecar] Data dir: $DATA_DIR"

# Start the backend on port 8000 (HTTP, no root needed)
echo "[Fala A.I. Sidecar] Starting uvicorn on port 8000 (HTTP)..."
cd "$PROJECT_ROOT"
exec "$PYTHON" -m uvicorn main:app \
    --app-dir "$BACKEND_DIR" \
    --host 127.0.0.1 \
    --port 8000
