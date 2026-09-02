#!/usr/bin/env python3
# =============================================================================
# PT-BR: Instalador UNIVERSAL do Guaralingo — um código para TODOS os OS.
#        Verifica e baixa automaticamente todas as dependências.
#        Uso:
#          Linux/macOS: curl -fsSL https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py | python3 -
#          Windows:     irm https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/install.py | python -
#          Local:       python3 install.py
# EN:    UNIVERSAL Guaralingo installer — one code for ALL OS. Auto-downloads deps.
# =============================================================================
import os, sys, json, shutil, subprocess, platform, urllib.request
from pathlib import Path

REPO = "https://github.com/disouz4-dev/guaralingo.git"
DIR = Path(os.environ.get("GUARALINGO_DIR") or (Path.home() / "guaralingo"))
OS_NAME = platform.system()  # Linux, Darwin, Windows

def log(msg): print(msg, flush=True)
def run(cmd, **kw): return subprocess.run(cmd, **kw)
def has(cmd): return shutil.which(cmd) is not None

def ensure_git():
    if has("git"): return "git"
    # PT-BR: no Windows, git pode estar instalado mas não no PATH. EN: check common install paths.
    if OS_NAME == "Windows":
        for p in [
            r"C:\Program Files\Git\cmd\git.exe",
            r"C:\Program Files (x86)\Git\cmd\git.exe",
            Path(os.environ.get("LOCALAPPDATA","")) / r"Programs\Git\cmd\git.exe",
        ]:
            if Path(p).exists(): return str(p)
    log("==> git não encontrado — tentando instalar...")
    try:
        if OS_NAME == "Linux":
            run(["sudo", "apt-get", "update", "-qq"], check=False)
            run(["sudo", "apt-get", "install", "-y", "git"], check=True); return "git"
        elif OS_NAME == "Darwin" and has("brew"):
            run(["brew", "install", "git"], check=True); return "git"
        elif OS_NAME == "Windows" and has("winget"):
            run(["winget", "install", "--id", "Git.Git", "-e", "--accept-source-agreements", "--accept-package-agreements"], check=True); return "git"
    except Exception as e: log(f"   falha ao instalar git: {e}")
    log("   Instale o git manualmente: https://git-scm.com/downloads"); return None

def ensure_python():
    py = sys.executable
    v = sys.version_info
    if v.major >= 3 and v.minor >= 10: return py
    log(f"   Python {v.major}.{v.minor} muito antigo — use Python 3.10+ : https://python.org")
    return None

def ensure_ollama():
    if has("ollama"): return True
    log("==> Ollama não encontrado — instalando...")
    try:
        if OS_NAME == "Linux":
            # PT-BR: script oficial do Ollama. EN: official Ollama install script.
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".sh", delete=False) as f:
                url = "https://ollama.com/install.sh"
                log(f"   baixando {url} ...")
                with urllib.request.urlopen(url, timeout=30) as r: f.write(r.read())
                tmp = f.name
            run(["sh", tmp], check=True); os.unlink(tmp)
            return has("ollama")
        elif OS_NAME == "Darwin" and has("brew"):
            run(["brew", "install", "--cask", "ollama"], check=True); return has("ollama")
        elif OS_NAME == "Windows" and has("winget"):
            run(["winget", "install", "--id", "Ollama.Ollama", "-e", "--accept-source-agreements", "--accept-package-agreements"], check=True); return has("ollama")
    except Exception as e: log(f"   falha ao instalar Ollama: {e}")
    log("   Baixe manualmente: https://ollama.com/download"); return False

def ensure_venv_deps():
    # PT-BR: no Linux precisa de python3-venv para criar venv. EN: Linux needs python3-venv.
    if OS_NAME != "Linux": return
    # tenta criar venv; se falhar por falta de venv, instala
    import tempfile, venv as _v
    try:
        with tempfile.TemporaryDirectory() as td:
            _v.create(Path(td) / "probe", with_pip=True)
        return
    except SystemExit: pass
    except Exception: pass
    log("==> instalando python3-venv...")
    try: run(["sudo", "apt-get", "install", "-y", "python3-venv", "python3-pip"], check=True)
    except Exception as e: log(f"   falha: {e} — tente: sudo apt-get install python3-venv")

def clone_or_update(git_cmd):
    if (DIR / ".git").exists():
        log(f"==> Atualizando {DIR}...")
        run([git_cmd, "-C", str(DIR), "pull", "--ff-only"], check=False)
    else:
        log(f"==> Baixando em {DIR}...")
        DIR.parent.mkdir(parents=True, exist_ok=True)
        run([git_cmd, "clone", REPO, str(DIR)], check=True)
    os.chdir(DIR)

def setup_model_and_voice(py):
    # PT-BR: cria o modelo small-english-teacher no Ollama. EN: create Ollama model.
    if has("ollama"):
        log("==> Configurando modelo small-english-teacher no Ollama...")
        run(["ollama", "create", "small-english-teacher", "-f", "Modelfile"], check=False)
    else:
        log("   (Ollama ausente — modelo não criado; instale o Ollama e rode: ollama create small-english-teacher -f Modelfile)")
    # PT-BR: Piper (voz). EN: Piper TTS.
    log("==> Instalando Piper TTS...")
    run([py, "-m", "pip", "install", "--user", "-q", "piper-tts"], check=False)
    # PT-BR: backend deps. EN: backend deps.
    log("==> Instalando dependências do backend...")
    run([py, "-m", "pip", "install", "-q", "-r", "backend/requirements.txt"], check=False)

def create_windows_shortcuts():
    """PT-BR: cria atalhos reais do app no Windows (Menu Iniciar + Desktop),
       para o Guaralingo aparecer como programa instalado (com ícone e executável).
       EN: create real app shortcuts on Windows (Start Menu + Desktop)."""
    try:
        import win32com.client
    except Exception:
        # sem pywin32: fallback para um .bat de iniciar + atalho via PowerShell
        try:
            _create_shortcut_powershell()
            return True
        except Exception as e:
            log(f"   Falha ao criar atalhos: {e}")
            return False
    try:
        shell = win32com.client.Dispatch("WScript.Shell")
        cmd = str(DIR / "run.bat")
        icon = str(DIR / "web" / "src-tauri" / "icons" / "icon.ico")
        if not os.path.exists(icon):
            icon = str(DIR / "web" / "public" / "icon.svg")
        workdir = str(DIR)
        # PT-BR: alvos dos atalhos. EN: shortcut targets.
        desktop = os.path.join(os.path.expanduser("~"), "Desktop", "Guaralingo.lnk")
        startmenu = os.path.join(
            os.environ.get("APPDATA", ""),
            "Microsoft", "Windows", "Start Menu", "Programs", "Guaralingo.lnk",
        )
        for target in (desktop, startmenu):
            lnk = shell.CreateShortcut(target)
            lnk.TargetPath = "cmd.exe"
            lnk.Arguments = f'/k ""{cmd}""'
            lnk.WorkingDirectory = workdir
            lnk.Description = "Guaralingo — aprenda inglês com IA local"
            if os.path.exists(icon):
                lnk.IconLocation = f"{icon},0"
            lnk.Save()
            log(f"   Atalho criado: {target}")
        return True
    except Exception as e:
        log(f"   Falha ao criar atalhos: {e}")
        return False

def _create_shortcut_powershell():
    """PT-BR: cria os .lnk via PowerShell (sem pywin32). EN: create .lnk via PowerShell."""
    import tempfile
    cmd = str(DIR / "run.bat")
    icon = str(DIR / "web" / "src-tauri" / "icons" / "icon.ico")
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    startmenu = os.path.join(
        os.environ.get("APPDATA", ""),
        "Microsoft", "Windows", "Start Menu", "Programs",
    )
    ps = f'''
$ws = New-Object -ComObject WScript.Shell
$cmd = "{cmd}"
$icon = "{icon}"
foreach ($dir in @("{desktop}", "{startmenu}")) {{
  if (Test-Path $dir) {{
    $lnk = $ws.CreateShortcut("$dir\\Guaralingo.lnk")
    $lnk.TargetPath = "cmd.exe"
    $lnk.Arguments = "/k `"$cmd`""
    $lnk.WorkingDirectory = "{DIR}"
    $lnk.Description = "Guaralingo - aprenda ingles com IA local"
    if (Test-Path $icon) {{ $lnk.IconLocation = "$icon,0" }}
    $lnk.Save()
  }}
}}
'''
    with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False) as f:
        f.write(ps); tmp = f.name
    try:
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp], check=True)
    finally:
        try: os.unlink(tmp)
        except Exception: pass

def launch():
    log("\n✅ Pronto! Iniciando o Guaralingo...\n")
    if OS_NAME == "Windows":
        # PT-BR: cria os atalhos de programa (menu iniciar + desktop). EN: create app shortcuts.
        create_windows_shortcuts()
        # PT-BR: abre o app em janela própria e não prende o instalador. EN: launch in own window.
        bat = DIR / "run.bat"
        flags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        if bat.exists():
            subprocess.Popen(["cmd.exe", "/k", str(bat)], cwd=str(DIR), creationflags=flags)
            _open_browser()
        else:
            subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
                             cwd=str(DIR / "backend"), creationflags=flags)
            _open_browser("http://localhost:8000")
    else:
        sh = DIR / "run.sh"
        if sh.exists():
            sh.chmod(0o755)
            subprocess.Popen(["bash", str(sh)], cwd=str(DIR))
        else:
            subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
                             cwd=str(DIR / "backend"))

def _open_browser(url="http://localhost:8000"):
    """PT-BR: abre o navegador no endereço da app. EN: open browser on the app address."""
    try:
        import webbrowser
        if OS_NAME == "Windows":
            subprocess.Popen(["cmd", "/c", "start", "", url])
        else:
            webbrowser.open(url)
    except Exception as e:
        log(f"   Não foi possível abrir o navegador: {e}")

def install_deb_linux():
    """PT-BR: no Linux instala o .deb (aparece no menu). Tenta baixar a última release.
       EN: on Linux install the .deb (shows in app menu). Fetch latest release."""
    import tempfile
    api = "https://api.github.com/repos/disouz4-dev/guaralingo/releases/latest"
    try:
        req = urllib.request.Request(api, headers={"User-Agent": "Guaralingo", "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode())
        assets = [a for a in (d.get("assets") or []) if a.get("name", "").endswith(".deb")]
        if not assets:
            log("   Nenhum .deb na release — caindo para modo dev (clone).")
            return False
        # prefere amd64
        deb = next((a for a in assets if "amd64" in a["name"]), assets[0])
        url = deb["browser_download_url"]; name = deb["name"]
        log(f"==> Baixando {name} ...")
        dest = Path(tempfile.gettempdir()) / name
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Guaralingo"}), timeout=120) as r, open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk: break
                f.write(chunk)
        log(f"==> Instalando {name} (sudo dpkg -i)...")
        rc = run(["sudo", "dpkg", "-i", str(dest)]).returncode
        if rc != 0:
            log("   Corrigindo dependências (sudo apt-get install -f -y)...")
            run(["sudo", "apt-get", "install", "-f", "-y"], check=False)
            # tenta de novo se ainda não instalou
            if not has("guaralingo") and not Path("/usr/bin/guaralingo").exists():
                # PT-BR: o binário do .deb é /usr/bin/app; verifica instalação via dpkg
                out = run(["dpkg", "-l", "guaralingo"], capture_output=True, text=True)
                if out.returncode != 0:
                    log("   Falha ao instalar .deb — caindo para modo dev.")
                    return False
        log("✅ Guaralingo instalado via .deb — procure por 'Guaralingo' no menu de apps.")
        return True
    except Exception as e:
        log(f"   Falha ao instalar .deb: {e} — caindo para modo dev.")
        return False

def install_msi_windows():
    """PT-BR: no Windows baixa a última release e instala o .msi nativo (programa de verdade).
       EN: on Windows download the latest release and install the native .msi."""
    import tempfile
    api = "https://api.github.com/repos/disouz4-dev/guaralingo/releases/latest"
    try:
        req = urllib.request.Request(api, headers={"User-Agent": "Guaralingo", "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode())
        assets = [a for a in (d.get("assets") or []) if a.get("name", "").endswith(".msi")]
        if not assets:
            log("   Nenhum .msi na release — caindo para modo dev (clone).")
            return False
        msi = next((a for a in assets if "en-US" in a["name"]), assets[0])
        url = msi["browser_download_url"]; name = msi["name"]
        log(f"==> Baixando {name} ...")
        dest = Path(tempfile.gettempdir()) / name
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Guaralingo"}), timeout=180) as r, open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk: break
                f.write(chunk)
        log("==> Instalando o .msi (o Windows pedirá autorização de administrador)...")
        rc = run(["msiexec", "/i", str(dest), "/norestart"], check=False).returncode
        if rc != 0 and rc != 3010:
            log(f"   msiexec retornou {rc} — tente instalar manualmente: {url}")
            return False
        log("✅ Guaralingo instalado como programa do Windows — procure por 'Guaralingo' no menu Iniciar.")
        return True
    except Exception as e:
        log(f"   Falha ao instalar .msi: {e} — caindo para modo dev.")
        return False

def launch_msi_app():
    """PT-BR: inicia o app instalado via .msi. EN: start the app installed via .msi."""
    try:
        for p in [
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Guaralingo\Guaralingo.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\Guaralingo\Guaralingo.exe"),
            r"C:\Program Files\Guaralingo\Guaralingo.exe",
        ]:
            if os.path.exists(p):
                subprocess.Popen([p]); return
        # PT-BR: fallback — procura pelo nome no menu iniciar. EN: search by start menu.
        shell = "powershell -NoProfile -Command \"Start-Process 'Guaralingo'\""
        subprocess.run(shell, shell=True, check=False)
    except Exception as e:
        log(f"   Não foi possível abrir o app: {e}")

def setup_windows_post_msi(py):
    """PT-BR: após instalar o .msi, garante o modelo Ollama e as deps do backend
       (o MSI embute o backend, mas o Python precisa das libs e do modelo).
       EN: after .msi install, make sure the Ollama model and backend deps exist."""
    # PT-BR: tenta criar o modelo no Ollama a partir do Modelfile do repo.
    try:
        import tempfile as _tf
        with _tf.TemporaryDirectory() as td:
            mf = Path(td) / "Modelfile"
            run(["powershell", "-NoProfile", "-Command",
                 "Invoke-WebRequest -Uri https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/Modelfile -OutFile " + str(mf)],
                check=False)
            if mf.exists():
                run(["ollama", "create", "small-english-teacher", "-f", str(mf)], check=False)
            else:
                run([py, "-c", "import urllib.request; urllib.request.urlretrieve('https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/Modelfile', r'%s')" % str(mf)], check=False)
                if mf.exists():
                    run(["ollama", "create", "small-english-teacher", "-f", str(mf)], check=False)
    except Exception as e:
        log(f"   Modelo Ollama: {e} — rode depois: ollama create small-english-teacher -f Modelfile")
    # PT-BR: deps do backend no Python do sistema (o app usa python do PATH).
    log("==> Instalando dependências do backend...")
    run([py, "-m", "pip", "install", "-q", "-r", "https://raw.githubusercontent.com/disouz4-dev/guaralingo/main/backend/requirements.txt"], check=False)
    log("==> Instalando Piper TTS...")
    run([py, "-m", "pip", "install", "--user", "-q", "piper-tts"], check=False)

def main():
    use_dev = "--dev" in sys.argv
    log(f"🐺 Instalando o Guaralingo ({OS_NAME}) em {DIR}...")
    py = ensure_python()
    if not py: sys.exit(1)

    # PT-BR: Windows: instala o .msi nativo por padrão (programa de verdade). NÃO depende
    #        de git (o .msi já traz o app). Use --dev para o modo servidor (clone + run.bat).
    # EN: Windows: install the native .msi by default. Does NOT depend on git.
    if OS_NAME == "Windows" and not use_dev:
        ensure_ollama()
        if install_msi_windows():
            setup_windows_post_msi(py)
            launch_msi_app()
            log("\n✅ Pronto! O Guaralingo foi instalado como um app do Windows.")
            return

    git_cmd = ensure_git()
    if not git_cmd: sys.exit(1)
    ensure_ollama()

    # PT-BR: Linux: instala .deb por padrão (aparece no menu). Use --dev para clonar e rodar.
    # EN: Linux: install .deb by default (shows in menu). Use --dev to clone and run.
    if OS_NAME == "Linux" and not use_dev:
        if install_deb_linux():
            # PT-BR: ainda configura o modelo Ollama mesmo com .deb
            if (DIR / "Modelfile").exists():
                run(["ollama", "create", "small-english-teacher", "-f", str(DIR / "Modelfile")], check=False)
            elif has("ollama"):
                # tenta clonar só o Modelfile se ainda não tem
                try:
                    import tempfile as _tf
                    with _tf.TemporaryDirectory() as td:
                        run([git_cmd, "clone", "--depth", "1", REPO, td], check=False)
                        mf = Path(td) / "Modelfile"
                        if mf.exists(): run(["ollama", "create", "small-english-teacher", "-f", str(mf)], check=False)
                except Exception: pass
            log("\n✅ Pronto! Abra o Guaralingo pelo menu de apps ou rode: guaralingo  /  /usr/bin/app")
            return

    ensure_venv_deps()
    clone_or_update(git_cmd)
    setup_model_and_voice(py)
    launch()

if __name__ == "__main__": main()
