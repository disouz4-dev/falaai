#!/usr/bin/env bash
# =============================================================================
# PT-BR: Instala o Fala A.I. como SERVIÇO do sistema (systemd) RODANDO COMO ROOT,
#        para abrir a porta 80 (HTTPS) no modo servidor web (legado). O app desktop
#        atual é autônomo e não precisa disso.
#        Rode uma vez com sudo:
#          sudo ./install-service.sh --https
# EN:    Install Fala A.I. as a ROOT systemd service to bind privileged port 80
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
SERVICE=/etc/systemd/system/falaai.service

echo "==> Instalando o serviço falaai como ROOT (pasta: $PROJECT_DIR)…"

sudo tee "$SERVICE" >/dev/null <<EOF
[Unit]
Description=Fala A.I. — servidor local de ensino de inglês (porta 80 HTTPS)
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
sudo systemctl enable falaai.service
sudo systemctl restart falaai.service
sleep 3
sudo systemctl --no-pager status falaai.service | head -10 || true

echo ""
echo "✅ Fala A.I. agora roda como serviço (root, porta 80 HTTPS)."
echo "   Acesse:   https://localhost  /  https://falaai.local"
echo "   Comandos: sudo systemctl {status|restart|stop} falaai"
echo "   Logs:     journalctl -u falaai -f"
