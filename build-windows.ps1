# =============================================================================
# PT-BR: Script de build do Guaralingo para Windows (.msi).
#        Execute este script **no Windows** (PowerShell 5+ / PowerShell 7+).
# EN:    Guaralingo Windows build script (.msi). Run **on Windows**.
# =============================================================================

# Requisitos no Windows:
# - Rust toolchain estável (rustup-init.exe → rustup default stable)
# - Node.js 20+ LTS (inclui npm)
# - Visual Studio 2022 Build Tools (C++ desktop) OU
#   Visual Studio Community 2022 com "Desktop development with C++"
# - WebView2 Runtime (já incluso no Windows 10/11)
# - Git para clonar o repo

# Uso (PowerShell como Administrador NÃO é necessário para build):
#   irm https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/build-windows.ps1 | iex
# Ou clone o repo e rode localmente:
#   cd guaralingo
#   .\build-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Guaralingo - Build Windows (.msi) ===" -ForegroundColor Cyan

# --- 1. Verificar pré-requisitos ---------------------------------------------
Write-Host "`n[1/6] Verificando pré-requisitos..."

$missing = @()
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { $missing += "Rust (rustup-init.exe)" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { $missing += "Cargo" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js 20+" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { $missing += "npm" }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { $missing += "Git" }

if ($missing.Count -gt 0) {
    Write-Host "`n❌ Faltando: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Instale e rode novamente."
    Write-Host "  Rust: https://rustup.rs/"
    Write-Host "  Node.js: https://nodejs.org/"
    Write-Host "  VS Build Tools: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022"
    exit 1
}

# Verificar target Windows no Rust
$targets = rustup target list --installed
if ($targets -notmatch "x86_64-pc-windows") {
    Write-Host "`n⚠️ Target x86_64-pc-windows-msvc não instalado." -ForegroundColor Yellow
    Write-Host "Instalando..."
    rustup target add x86_64-pc-windows-msvc
}

Write-Host "✅ Pré-requisitos OK" -ForegroundColor Green

# --- 2. Clonar/atualizar repo ------------------------------------------------
$Repo = "https://github.com/disouz4-dev/guaralingo.git"
$Dir  = if ($env:GUARALINGO_DIR) { $env:GUARALINGO_DIR } else { "$PWD\guaralingo-build" }

Write-Host "`n[2/6] Preparando código em $Dir..."

if (Test-Path "$Dir\.git") {
    Write-Host "==> Atualizando..."
    git -C $Dir pull --ff-only
} else {
    Write-Host "==> Clonando..."
    git clone $Repo $Dir
}
Set-Location $Dir

# --- 3. Instalar dependências frontend ---------------------------------------
Write-Host "`n[3/6] Instalando dependências do frontend..."
cd web
npm ci
cd ..

# --- 4. Build do Tauri (gera .msi) ------------------------------------------
Write-Host "`n[4/6] Buildando com Tauri (gera .msi em web/src-tauri/target/release/bundle/msi/)..."
cd web
npx tauri build
cd ..

# --- 5. Localizar o instalador gerado ----------------------------------------
Write-Host "`n[5/6] Localizando instalador..."
$msi = Get-ChildItem "web/src-tauri/target/release/bundle/msi/" -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $msi) {
    Write-Host "❌ .msi não encontrado. Verifique o log do Tauri acima." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Instalador gerado: $($msi.FullName)" -ForegroundColor Green

# --- 6. Copiar para pasta de release -----------------------------------------
$releaseDir = "$Dir\release"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$dest = Join-Path $releaseDir $msi.Name
Copy-Item $msi.FullName -Destination $dest -Force

Write-Host "`n[6/6] Copiado para: $dest" -ForegroundColor Cyan
Write-Host "`n🎉 Build concluído! O instalador .msi está em: $releaseDir" -ForegroundColor Green
Write-Host "   Para distribuir: suba $($msi.Name) como asset na release do GitHub."