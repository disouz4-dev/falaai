#!/usr/bin/env bash
# PT-BR: Instala o ícone e o atalho do OpenLingo no Linux (menu de apps + Área de trabalho).
# EN:    Installs the OpenLingo icon and launcher on Linux (app menu + Desktop).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

chmod +x "$HERE/openlingo-launch.sh" "$ROOT/run.sh" 2>/dev/null || true

# PT-BR: instala o ícone. EN: install the icon.
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
mkdir -p "$ICON_DIR"
cp "$HERE/build/icon_256.png" "$ICON_DIR/openlingo.png"

# PT-BR: cria o arquivo .desktop. EN: create the .desktop entry.
APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPS_DIR"
DESKTOP_FILE="$APPS_DIR/openlingo.desktop"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=OpenLingo
Comment=Aprenda inglês com IA local
Exec=$HERE/openlingo-launch.sh
Icon=openlingo
Terminal=false
Categories=Education;Languages;
EOF
chmod +x "$DESKTOP_FILE"

# PT-BR: copia também para a Área de trabalho. EN: also copy to the Desktop.
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$DESKTOP_DIR" ]; then
  cp "$DESKTOP_FILE" "$DESKTOP_DIR/openlingo.desktop"
  chmod +x "$DESKTOP_DIR/openlingo.desktop"
  gio set "$DESKTOP_DIR/openlingo.desktop" metadata::trusted true 2>/dev/null || true
fi

update-desktop-database "$APPS_DIR" 2>/dev/null || true
echo "✅ OpenLingo instalado no menu de aplicativos e na Área de trabalho."
echo "   Clique no ícone 🦜 para abrir."
