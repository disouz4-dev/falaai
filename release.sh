#!/usr/bin/env bash
# =============================================================================
# PT-BR: Lança uma nova versão do Guaralingo. Uso:  ./release.sh 1.0.1 "notas da versão"
#        Atualiza o VERSION, faz commit + push e cria a release no GitHub (gh).
#        Os usuários passam a ver a notificação de atualização no app.
# EN:    Ship a new Guaralingo version. Usage: ./release.sh 1.0.1 "release notes"
# =============================================================================
set -e
cd "$(dirname "$0")"

VER="$1"
NOTES="${2:-Nova versão do Guaralingo.}"
if [ -z "$VER" ]; then
  echo "Uso: ./release.sh <versão> [notas]   ex.: ./release.sh 1.0.1 \"Correções e melhorias\""
  exit 1
fi
VER="${VER#v}"  # PT-BR: remove 'v' se vier. EN: strip leading 'v'.

echo "==> Atualizando VERSION para $VER..."
printf "%s\n" "$VER" > VERSION

echo "==> Commit + push..."
git add VERSION
git commit -m "release: v$VER" || echo "   (nada a commitar no VERSION)"
git push origin main

echo "==> Criando a release v$VER no GitHub..."
gh release create "v$VER" --title "Guaralingo v$VER 🦜" --notes "$NOTES"

echo ""
echo "✅ Release v$VER publicada. Os usuários verão a notificação de atualização no app."
