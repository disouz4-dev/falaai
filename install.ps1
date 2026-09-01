# =============================================================================
# PT-BR: Instalador do Guaralingo para Windows — wrapper fino que garante
#        Python 3.10+ e delega ao instalador universal install.py (um código só).
#        Uso (uma linha):
#          irm https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.ps1 | iex
#          ou: irm https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py | python -
# EN:    Guaralingo installer for Windows — thin wrapper ensuring Python 3.10+
#        then delegating to the universal install.py (one code for all OS).
# =============================================================================
$ErrorActionPreference = "Stop"
$Url = "https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py"

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

# PT-BR: se há install.py local (repo clonado), usa-o; senão baixa. EN: use local or fetch.
$localPy = Join-Path $PSScriptRoot "install.py"
if (Test-Path $localPy) { & $py $localPy @args; exit $LASTEXITCODE }

Write-Host "Baixando instalador universal (install.py)..."
# PT-BR: baixa e executa o install.py. EN: fetch and run install.py.
$tmp = [System.IO.Path]::GetTempFileName() + ".py"
try { Invoke-WebRequest -Uri $Url -OutFile $tmp; & $py $tmp @args } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
