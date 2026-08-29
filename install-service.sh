#!/usr/bin/env bash
# =============================================================================
# PT-BR: Instala o OpenLingo como SERVIÇO do sistema (systemd) — sobe no boot, reinicia
#        sozinho se cair e roda 24/7 sem depender de terminal aberto. Rode uma vez:
#          ./install-service.sh            (HTTP)
#          ./install-service.sh --https    (HTTPS, recomendado)
#        Pede a senha do sudo para instalar o serviço.
# EN:    Install OpenLingo as a systemd service (starts on boot, auto-restarts, runs 24/7).
# =============================================================================
set -e
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
RUN_USER="$(id -un)"
MODE=""
[ "$1" == "--https" ] && MODE=" --https"
SERVICE=/etc/systemd/system/openlingo.service

echo "==> Instalando o serviço openlingo (usuário: $RUN_USER, pasta: $PROJECT_DIR)…"

sudo tee "$SERVICE" >/dev/null <<EOF
[Unit]
Description=OpenLingo — servidor local de ensino de inglês
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/run.sh$MODE
Restart=always
RestartSec=3
# PT-BR: mantém o HOME correto p/ venv/npm. EN: keep HOME for venv/npm.
Environment=HOME=/home/$RUN_USER

[Install]
WantedBy=multi-user.target
EOF

echo "==> Ativando e iniciando…"
sudo systemctl daemon-reload
sudo systemctl enable openlingo.service
sudo systemctl restart openlingo.service
sleep 2
sudo systemctl --no-pager status openlingo.service | head -8 || true

echo ""
echo "✅ OpenLingo agora roda como serviço (sobe no boot e reinicia sozinho)."
echo "   Acesse:   https://openlingo.local:8000"
echo "   Comandos: sudo systemctl {status|restart|stop} openlingo"
echo "   Logs:     journalctl -u openlingo -f"
