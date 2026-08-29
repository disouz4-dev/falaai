#!/usr/bin/env bash
# =============================================================================
# PT-BR: HTTPS confiável (cadeado verde, sem aviso "não seguro") com mkcert.
#        Cria uma Autoridade Certificadora LOCAL confiável e um certificado para
#        openlingo.local. Rode UMA vez:   ./setup-cert.sh
#        (pede a senha do sudo para instalar o certutil e confiar na CA)
# EN:    Trusted local HTTPS via mkcert. Run once: ./setup-cert.sh
# =============================================================================
set -e
cd "$(dirname "$0")"

# PT-BR: garante o mkcert no PATH. EN: ensure mkcert on PATH.
export PATH="$HOME/.local/bin:$PATH"
if ! command -v mkcert >/dev/null 2>&1; then
  echo "==> Baixando o mkcert..."
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/mkcert" \
    "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64"
  chmod +x "$HOME/.local/bin/mkcert"
fi

# PT-BR: certutil é necessário para o Chrome/Firefox confiarem na CA.
# EN: certutil is required for Chrome/Firefox to trust the CA.
if ! command -v certutil >/dev/null 2>&1; then
  echo "==> Instalando o certutil (libnss3-tools) — precisa da sua senha..."
  if command -v apt-get >/dev/null 2>&1; then sudo apt-get update -qq && sudo apt-get install -y libnss3-tools
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y nss-tools
  elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --noconfirm nss
  else echo "   Instale o pacote nss-tools/libnss3-tools manualmente."; fi
fi

# PT-BR: cria e instala a CA local (no sistema + navegadores). EN: create & trust the local CA.
echo "==> Instalando a Autoridade Certificadora local (mkcert -install)..."
mkcert -install

# PT-BR: gera o certificado confiável para os nomes/IPs do OpenLingo.
# EN: generate the trusted certificate for OpenLingo's names/IPs.
mkdir -p certs
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "==> Gerando certificado confiável para openlingo.local..."
mkcert -cert-file certs/openlingo.local.pem -key-file certs/openlingo.local-key.pem \
  openlingo.local localhost 127.0.0.1 ${LAN_IP:+$LAN_IP}

echo ""
echo "✅ Pronto! Reinicie o servidor (./run.sh --https) e abra https://openlingo.local:8000"
echo "   No PC o cadeado fica verde, sem aviso."
echo ""
echo "📱 Para o CELULAR ficar seguro também, instale a CA no aparelho:"
echo "   Arquivo da CA: $(mkcert -CAROOT)/rootCA.pem"
echo "   Android: Config > Segurança > Instalar certificado > Certificado de CA."
echo "   iOS: envie o rootCA.pem, instale o perfil e ative em Ajustes > Geral > Sobre > Confiança de certificados."
