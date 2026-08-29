# =============================================================================
# PT-BR: Instalador único do OpenLingo para Windows (PowerShell).
#        Uso (uma linha, no PowerShell):
#          irm https://raw.githubusercontent.com/disouz4-dev/openlingo/main/install.ps1 | iex
# EN:    One-command OpenLingo installer for Windows (PowerShell).
# =============================================================================
$ErrorActionPreference = "Stop"
$Repo = "https://github.com/disouz4-dev/openlingo.git"
$Dir  = if ($env:OPENLINGO_DIR) { $env:OPENLINGO_DIR } else { "$HOME\openlingo" }

Write-Host "🦜 Instalando o OpenLingo (Windows)..."

# --- 1. Ollama ---------------------------------------------------------------
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host "==> Instalando o Ollama..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
  } else {
    Write-Host "   Baixe o Ollama para Windows em https://ollama.com/download e rode de novo."
  }
}

# --- 2. Pré-requisitos (git, python) ----------------------------------------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Instale o Git e rode de novo: https://git-scm.com" }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Instale o Python 3 e rode de novo: https://python.org" }

# --- 3. Baixar/atualizar o projeto ------------------------------------------
if (Test-Path "$Dir\.git") {
  Write-Host "==> Atualizando o projeto em $Dir..."
  git -C $Dir pull --ff-only
} else {
  Write-Host "==> Baixando o projeto em $Dir..."
  git clone $Repo $Dir
}
Set-Location $Dir

# --- 4. Setup (modelo + voz) ------------------------------------------------
Write-Host "==> Criando o modelo do professor no Ollama..."
ollama create small-english-teacher -f Modelfile

Write-Host "==> Instalando o Piper (voz do professor)..."
python -m pip install --user piper-tts

# --- 5. Executar -------------------------------------------------------------
Write-Host "`n✅ Pronto! Iniciando o OpenLingo..."
.\run.bat
