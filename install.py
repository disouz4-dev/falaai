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
    if has("git"): return True
    log("==> git não encontrado — tentando instalar...")
    try:
        if OS_NAME == "Linux":
            run(["sudo", "apt-get", "update", "-qq"], check=False)
            run(["sudo", "apt-get", "install", "-y", "git"], check=True); return has("git")
        elif OS_NAME == "Darwin" and has("brew"):
            run(["brew", "install", "git"], check=True); return has("git")
        elif OS_NAME == "Windows" and has("winget"):
            run(["winget", "install", "--id", "Git.Git", "-e", "--accept-source-agreements", "--accept-package-agreements"], check=True); return has("git")
    except Exception as e: log(f"   falha ao instalar git: {e}")
    log("   Instale o git manualmente: https://git-scm.com/downloads"); return False

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

def clone_or_update():
    if (DIR / ".git").exists():
        log(f"==> Atualizando {DIR}...")
        run(["git", "-C", str(DIR), "pull", "--ff-only"], check=False)
    else:
        log(f"==> Baixando em {DIR}...")
        DIR.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", REPO, str(DIR)], check=True)
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

def launch():
    log("\n✅ Pronto! Iniciando o Guaralingo...\n")
    if OS_NAME == "Windows":
        # PT-BR: usa run.bat. EN: use run.bat.
        bat = DIR / "run.bat"
        if bat.exists(): run([str(bat)], check=False)
        else: run([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"], cwd=str(DIR / "backend"), check=False)
    else:
        sh = DIR / "run.sh"
        if sh.exists():
            sh.chmod(0o755)
            run([str(sh)], check=False)
        else:
            run([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"], cwd=str(DIR / "backend"), check=False)

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

def main():
    use_dev = "--dev" in sys.argv
    log(f"🦜 Instalando o Guaralingo ({OS_NAME}) em {DIR}...")
    py = ensure_python()
    if not py: sys.exit(1)
    if not ensure_git(): sys.exit(1)
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
                        run(["git", "clone", "--depth", "1", REPO, td], check=False)
                        mf = Path(td) / "Modelfile"
                        if mf.exists(): run(["ollama", "create", "small-english-teacher", "-f", str(mf)], check=False)
                except Exception: pass
            log("\n✅ Pronto! Abra o Guaralingo pelo menu de apps ou rode: guaralingo  /  /usr/bin/app")
            return

    ensure_venv_deps()
    clone_or_update()
    setup_model_and_voice(py)
    launch()

if __name__ == "__main__": main()
