# =============================================================================
# PT-BR: Instalador do Guaralingo para Windows — um código só.
#        Garante Python 3.10+ e delega ao install.py universal.
#        Uso (uma linha):
#          irm https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.ps1 | iex
# EN:    Guaralingo installer for Windows — one code for all.
# =============================================================================
$ErrorActionPreference = "Stop"
$Url = "https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py"

# PT-BR: se rodou via pipe (irm | iex), $PSScriptRoot fica vazio — usa o temp.
# EN: if piped (irm | iex), $PSScriptRoot is empty — use temp dir.
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { "$env:TEMP\guaralingo" }
if (-not (Test-Path $scriptDir)) { New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null }

# PT-BR: garante Python 3.10+. EN: ensure Python 3.10+.
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  if (Get-Command python3 -ErrorAction SilentlyContinue) { $py = "python3" } else { $py = $null }
} else { $py = "python" }
if (-not $py) {
  Write-Host "==> Python não encontrado — instalando..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
    $py = "python"
  }
  if (-not (Get-Command $py -ErrorAction SilentlyContinue)) { throw "Instale Python 3.10+ em https://python.org e rode de novo." }
}

# PT-BR: baixa o install.py e roda. EN: fetch and run install.py.
$localPy = Join-Path $scriptDir "install.py"
if (Test-Path $localPy) {
  & $py $localPy @args
  exit $LASTEXITCODE
}
Write-Host "Baixando instalador universal (install.py)..."
$tmp = [System.IO.Path]::GetTempFileName() + ".py"
try { Invoke-WebRequest -Uri $Url -OutFile $tmp; & $py $tmp @args } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }