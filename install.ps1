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

# PT-BR: encontra Python 3.10+ que REALMENTE funciona. EN: find Python 3.10+ that actually works.
# PT-BR: NÃO usa 'python' — no Windows é stub da Store. Prefere python3, py ou caminho completo.
function Find-Python {
  if (Get-Command python3 -ErrorAction SilentlyContinue) { return "python3" }
  if (Get-Command python3.exe -ErrorAction SilentlyContinue) { return "python3.exe" }
  # PT-BR: launcher 'py' (vem com o Python). EN: 'py' launcher (comes with Python).
  if (Get-Command py -ErrorAction SilentlyContinue) { return "py" }
  # PT-BR: winget instala em WindowsApps. EN: winget installs to WindowsApps.
  $wa = "$env:LOCALAPPDATA\Microsoft\WindowsApps"
  if (Test-Path "$wa\python.exe") { return "$wa\python.exe" }
  if (Test-Path "$env:ProgramFiles\Python312\python.exe") { return "$env:ProgramFiles\Python312\python.exe" }
  if (Test-Path "$env:ProgramFiles\Python311\python.exe") { return "$env:ProgramFiles\Python311\python.exe" }
  if (Test-Path "$env:ProgramFiles\Python310\python.exe") { return "$env:ProgramFiles\Python310\python.exe" }
  # PT-BR: fallback — tenta 'python' por último. EN: fallback — try 'python' last.
  if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
  return $null
}
$py = Find-Python

if (-not $py) {
  Write-Host "==> Python não encontrado — instalando via winget..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
    # PT-BR: refresca o PATH para a sessão atual. EN: refresh PATH for current session.
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    $py = Find-Python
  }
  if (-not $py) { throw "Instale Python 3.10+ em https://python.org e rode de novo." }
}
Write-Host "==> Usando: $py"

# PT-BR: baixa o install.py e roda. EN: fetch and run install.py.
$localPy = Join-Path $scriptDir "install.py"
if (Test-Path $localPy) {
  & $py $localPy @args
  exit $LASTEXITCODE
}
Write-Host "Baixando instalador universal (install.py)..."
$tmp = [System.IO.Path]::GetTempFileName() + ".py"
try { Invoke-WebRequest -Uri $Url -OutFile $tmp; & $py $tmp @args } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }