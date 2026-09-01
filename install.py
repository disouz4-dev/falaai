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

def main():
    log(f"🦜 Instalando o Guaralingo ({OS_NAME}) em {DIR}...")
    py = ensure_python()
    if not py: sys.exit(1)
    if not ensure_git(): sys.exit(1)
    ensure_ollama()
    ensure_venv_deps()
    clone_or_update()
    setup_model_and_voice(py)
    launch()

if __name__ == "__main__": main()
