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
# PT-BR: no Windows 'python' e 'python3' podem ser stubs da Store. Prefere 'py' launcher ou caminho completo.
function Find-Python {
  # PT-BR: 'py' launcher (vem com o Python instalado, NÃO é stub da Store). EN: 'py' launcher.
  if (Get-Command py -ErrorAction SilentlyContinue) { return "py" }
  # PT-BR: caminhos reais onde o winget instala o Python. EN: real install paths from winget.
  $candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WindowsApps\python3.exe"
    "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe"
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe"
    "$env:ProgramFiles\Python312\python.exe"
    "$env:ProgramFiles\Python311\python.exe"
    "$env:ProgramFiles\Python310\python.exe"
    "${env:ProgramFiles(x86)}\Python312\python.exe"
    "${env:ProgramFiles(x86)}\Python311\python.exe"
    "${env:ProgramFiles(x86)}\Python310\python.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  # PT-BR: fallback — tenta python/python3 por último. EN: fallback.
  if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
  if (Get-Command python3 -ErrorAction SilentlyContinue) { return "python3" }
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