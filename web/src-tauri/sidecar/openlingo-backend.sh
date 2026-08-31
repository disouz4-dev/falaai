#!/bin/bash
# Sidecar entrypoint for OpenLingo Python backend
# This script is called by Tauri to start the backend server

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

echo "[OpenLingo Sidecar] Starting backend from $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Use the venv Python - check multiple locations
VENV_PYTHON=""
for python_path in \
    "$PROJECT_ROOT/.venv/bin/python" \
    "$PROJECT_ROOT/backend/.venv/bin/python" \
    "$HOME/.local/bin/python3" \
    "$(which python3)"; do
    if [ -f "$python_path" ] && "$python_path" -c "import sys; sys.exit(0)" 2>/dev/null; then
        VENV_PYTHON="$python_path"
        break
    fi
done

if [ -z "$VENV_PYTHON" ]; then
    echo "[OpenLingo Sidecar] No Python found"
    exit 1
fi

echo "[OpenLingo Sidecar] Using Python: $VENV_PYTHON"

# Set environment variables
export OPENLINGO_HTTPS=1
export OPENLINGO_PORT=80
export OPENLINGO_MDNS=1

# Check for certs
CERT_KEY="$PROJECT_ROOT/certs/key.pem"
CERT_FILE="$PROJECT_ROOT/certs/cert.pem"

if [ ! -f "$CERT_KEY" ] || [ ! -f "$CERT_FILE" ]; then
    echo "[OpenLingo Sidecar] Generating self-signed certificates..."
    mkdir -p "$PROJECT_ROOT/certs"
    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
        -keyout "$CERT_KEY" -out "$CERT_FILE" \
        -subj "/CN=openlingo.local" \
        -addext "subjectAltName=DNS:openlingo.local,DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1
fi

# Start the backend
echo "[OpenLingo Sidecar] Starting uvicorn on port 80 (HTTPS)..."
exec "$VENV_PYTHON" -m uvicorn main:app \
    --app-dir "$PROJECT_ROOT/backend" \
    --host 0.0.0.0 \
    --port 80 \
    --ssl-keyfile "$CERT_KEY" \
    --ssl-certfile "$CERT_FILE"