#!/usr/bin/env bash
# =============================================================================
# PT-BR: Lança uma nova versão do Guaralingo. Uso:  ./release.sh 1.0.1 "notas"
#        Atualiza VERSION, tauri.conf.json e README automaticamente,
#        faz commit + push e cria a release no GitHub (gh).
#        Os usuários passam a ver a notificação de atualização no app.
# EN:    Ship a new Guaralingo version. Usage: ./release.sh 1.0.1 "notes"
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

echo "==> Versão: v$VER"

# PT-BR: atualiza VERSION (fonte única da verdade). EN: update VERSION (single source of truth).
printf "%s\n" "$VER" > VERSION

# PT-BR: atualiza tauri.conf.json (product version do app). EN: update tauri app version.
sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"$VER\"/" web/src-tauri/tauri.conf.json
echo "   tauri.conf.json → version $VER"

# PT-BR: atualiza todas as referências de versão no README. EN: update all version refs in README.
sed -i -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$VER/g; s/Guaralingo_[0-9]+\.[0-9]+\.[0-9]+_amd64\.deb/Guaralingo_$VER\_amd64.deb/g" README.md
echo "   README.md → v$VER"

echo "==> Commit + push..."
git add VERSION web/src-tauri/tauri.conf.json README.md
git commit -m "release: v$VER" || echo "   (nada a commitar)"
git push origin main

# PT-BR: cria/atualiza a release no GitHub com notes. EN: create/update release on GitHub.
if gh release view "v$VER" >/dev/null 2>&1; then
  echo "==> Release v$VER já existe — atualizando notes..."
  gh release edit "v$VER" --title "Guaralingo v$VER 🦜" --notes "$NOTES"
else
  echo "==> Criando a release v$VER no GitHub..."
  gh release create "v$VER" --title "Guaralingo v$VER 🦜" --notes "$NOTES"
fi

echo ""
echo "✅ Release v$VER publicada. Os usuários verão a notificação de atualização no app."
echo "   Para gerar e subir o .deb, rode: cd web && npx tauri build && gh release upload v$VER web/src-tauri/target/release/bundle/deb/Guaralingo_$VER\_amd64.deb --clobber"