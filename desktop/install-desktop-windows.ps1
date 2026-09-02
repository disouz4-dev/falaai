# PT-BR: Cria o atalho do Fala A.I. (com ícone) na Área de trabalho e no Menu Iniciar (Windows).
# EN:    Creates the Fala A.I. shortcut (with icon) on the Desktop and Start Menu (Windows).
$ErrorActionPreference = "Stop"
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$launch  = Join-Path $here "falaai-launch.bat"
$icon    = Join-Path $here "build\icon.ico"

function New-Shortcut($path) {
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut($path)
  $sc.TargetPath       = $launch
  $sc.WorkingDirectory = $here
  $sc.IconLocation     = $icon
  $sc.Description       = "Fala A.I. — aprenda inglês com IA local"
  $sc.Save()
}

# PT-BR: Área de trabalho. EN: Desktop.
New-Shortcut (Join-Path ([Environment]::GetFolderPath("Desktop")) "Fala A.I..lnk")
# PT-BR: Menu Iniciar. EN: Start Menu.
$startMenu = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"
New-Shortcut (Join-Path $startMenu "Fala A.I..lnk")

Write-Host "✅ Atalho do Fala A.I. criado na Área de trabalho e no Menu Iniciar."
