#!/usr/bin/env bash
# =============================================================================
# PT-BR: Instala o Guaralingo como SERVIÇO do sistema (systemd) RODANDO COMO ROOT,
#        para abrir a porta 80 (HTTPS) no modo servidor web (legado). O app desktop
#        atual é autônomo e não precisa disso.
#        Rode uma vez com sudo:
#          sudo ./install-service.sh --https
# EN:    Install Guaralingo as a ROOT systemd service to bind privileged port 80
#        (HTTPS) in the legacy web-server mode. The current desktop app is
#        standalone and does not need this.
# =============================================================================
set -e
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
ORIGINAL_USER="$(id -un)"
MODE=""
[ "$1" == "--https" ] && MODE=" --https"
[ -n "$MODE" ] || MODE=" --https"
SERVICE=/etc/systemd/system/guaralingo.service

echo "==> Instalando o serviço guaralingo como ROOT (pasta: $PROJECT_DIR)…"

sudo tee "$SERVICE" >/dev/null <<EOF
[Unit]
Description=Guaralingo — servidor local de ensino de inglês (porta 80 HTTPS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$PROJECT_DIR
ExecStart=/bin/bash $PROJECT_DIR/run.sh$MODE
Restart=always
RestartSec=3
# PT-BR: mantém o HOME do usuário p/ venv/npm. EN: keep HOME for venv/npm.
Environment=HOME=/home/$ORIGINAL_USER

[Install]
WantedBy=multi-user.target
EOF

echo "==> Ativando e iniciando…"
sudo systemctl daemon-reload
sudo systemctl enable guaralingo.service
sudo systemctl restart guaralingo.service
sleep 3
sudo systemctl --no-pager status guaralingo.service | head -10 || true

echo ""
echo "✅ Guaralingo agora roda como serviço (root, porta 80 HTTPS)."
echo "   Acesse:   https://localhost  /  https://guaralingo.local"
echo "   Comandos: sudo systemctl {status|restart|stop} guaralingo"
echo "   Logs:     journalctl -u guaralingo -f"
