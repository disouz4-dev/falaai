#!/usr/bin/env bash
# PT-BR: Cria o Fala A.I..app (com ícone) em ~/Applications no macOS.
# EN:    Creates Fala A.I..app (with icon) in ~/Applications on macOS.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Applications/Fala A.I..app"

chmod +x "$HERE/falaai-launch.sh"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# PT-BR: executável que chama o lançador. EN: executable that calls the launcher.
cat > "$APP/Contents/MacOS/Fala A.I." <<EOF
#!/bin/bash
exec "$HERE/falaai-launch.sh"
EOF
chmod +x "$APP/Contents/MacOS/Fala A.I."

# PT-BR: gera o ícone .icns a partir do PNG (ferramentas nativas do macOS).
# EN: generate the .icns icon from the PNG (native macOS tools).
if command -v sips >/dev/null && command -v iconutil >/dev/null; then
  ICONSET="$(mktemp -d)/icon.iconset"; mkdir -p "$ICONSET"
  for s in 16 32 64 128 256 512; do
    sips -z $s $s "$HERE/build/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$HERE/build/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/icon.icns"
fi

# PT-BR: Info.plist. EN: Info.plist.
cat > "$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Fala A.I.</string>
  <key>CFBundleDisplayName</key><string>Fala A.I.</string>
  <key>CFBundleIdentifier</key><string>dev.disouz4.falaai</string>
  <key>CFBundleExecutable</key><string>Fala A.I.</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1.0</string>
</dict></plist>
EOF

echo "✅ Fala A.I..app criado em ~/Applications (aparece no Launchpad e no Spotlight)."
echo "   Arraste para o Dock se quiser."
