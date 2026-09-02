#!/usr/bin/env bash
# =============================================================================
# PT-BR: Instala o Fala A.I. como SERVIÇO do sistema (systemd) capaz de abrir a
#        porta 80 (HTTPS) SEM rodar tudo como root. Usa CAP_NET_BIND_SERVICE:
#        o processo continua rodando como o usuário normal, mas ganha permissão
#        só para fazer bind em portas privilegiadas (< 1024). Modo servidor web
#        (legado); o app desktop atual é autônomo e não precisa disso.
#        Rode uma vez com sudo:
#          sudo ./install-service.sh --https
# EN:    Install Fala A.I. as a systemd service able to bind privileged port 80
#        without running everything as root (CAP_NET_BIND_SERVICE). Keeps file
#        ownership intact. Legacy web-server mode; the current desktop app is
#        standalone and does not need this.
# =============================================================================
set -e
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
RUN_USER="$(id -un)"
MODE=" --https"
SERVICE=/etc/systemd/system/falaai.service

echo "==> Instalando o serviço falaai (usuário: $RUN_USER, porta 80 via capability)…"

sudo tee "$SERVICE" >/dev/null <<EOF
[Unit]
Description=Fala A.I. — servidor local de ensino de inglês (porta 80 HTTPS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
Group=$(id -gn)
WorkingDirectory=$PROJECT_DIR
ExecStart=/bin/bash $PROJECT_DIR/run.sh$MODE
Restart=always
RestartSec=3
# PT-BR: permite abrir a porta 80 (privilegiada) sem rodar o processo como root.
# EN:    allows binding privileged port 80 without running the process as root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
# PT-BR: mantém o HOME do usuário p/ venv/npm. EN: keep HOME for venv/npm.
Environment=HOME=/home/$RUN_USER

[Install]
WantedBy=multi-user.target
EOF

echo "==> Ativando e iniciando…"
sudo systemctl daemon-reload
sudo systemctl enable falaai.service
sudo systemctl restart falaai.service
sleep 3
sudo systemctl --no-pager status falaai.service | head -12 || true

echo ""
echo "✅ Fala A.I. roda como serviço (porta 80 HTTPS, sem rodar como root)."
echo "   Acesse:   https://localhost  /  https://falaai.local"
echo "   Comandos: sudo systemctl {status|restart|stop} falaai"
echo "   Logs:     journalctl -u falaai -f"
