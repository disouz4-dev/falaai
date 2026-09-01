#!/usr/bin/env bash
# =============================================================================
# PT-BR: HTTPS confiável (cadeado verde, sem aviso "não seguro") com mkcert.
#        Cria uma Autoridade Certificadora LOCAL confiável e um certificado para
#        guaralingo.local. Rode UMA vez:   ./setup-cert.sh
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

# PT-BR: gera o certificado confiável para os nomes/IPs do Guaralingo.
# EN: generate the trusted certificate for Guaralingo's names/IPs.
mkdir -p certs
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "==> Gerando certificado confiável para guaralingo.local..."
mkcert -cert-file certs/guaralingo.local.pem -key-file certs/guaralingo.local-key.pem \
  guaralingo.local localhost 127.0.0.1 ${LAN_IP:+$LAN_IP}

# PT-BR: disponibiliza a CA para o celular baixar do próprio servidor (web/public persiste no build;
#        web/dist serve na hora se já houver build). EN: expose the CA for the phone to download.
mkdir -p web/public
cp "$(mkcert -CAROOT)/rootCA.pem" web/public/guaralingo-ca.crt 2>/dev/null || true
[ -d web/dist ] && cp "$(mkcert -CAROOT)/rootCA.pem" web/dist/guaralingo-ca.crt 2>/dev/null || true

echo ""
echo "✅ Pronto! Reinicie o servidor (./run.sh --https) e abra https://guaralingo.local:8000"
echo "   No PC o cadeado fica verde, sem aviso."
echo ""
echo "📱 Para o CELULAR ficar seguro também (uma vez só):"
echo "   1) No celular, abra:  https://guaralingo.local:8000/guaralingo-ca.crt"
echo "      (aceite o aviso desta vez só, para baixar o certificado)"
echo "   2) Instale o certificado baixado:"
echo "      Android: Config > Segurança > Mais > Instalar certificado > Certificado de CA."
echo "      iOS: instale o perfil e ative em Ajustes > Geral > Sobre > Confiança de certificados."
echo "   3) Reabra https://guaralingo.local:8000 — agora sem aviso e com o microfone."
