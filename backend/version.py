"""
PT-BR: Verificador de versão do Guaralingo. Compara a versão local (arquivo VERSION) com a
       última release no GitHub e diz se há atualização. Também executa a atualização
       (git pull + rebuild + reinício) a pedido do app.
EN:    Guaralingo version checker. Compares the local version (VERSION file) with the latest
       GitHub release and reports whether an update exists. Also performs the update.
"""

import json
import os
import re
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

REPO = os.environ.get("GUARALINGO_REPO", "disouz4-dev/guaralingo")
ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "VERSION"

_cache = {"t": 0, "data": None}
_CACHE_TTL = 1800  # PT-BR: 30 min. EN: 30 min.


def current():
    """PT-BR: versão local. EN: local version."""
    try:
        return VERSION_FILE.read_text(encoding="utf-8").strip() or "0.0.0"
    except Exception:
        return "0.0.0"


def _tuple(v):
    """PT-BR: '1.2.3' -> (1,2,3) para comparar. EN: parse to comparable tuple."""
    nums = re.findall(r"\d+", v or "")
    return tuple(int(x) for x in nums[:3]) + (0,) * (3 - len(nums[:3]))


def check(force=False):
    """
    PT-BR: verifica a última release no GitHub (com cache). EN: check the latest GitHub release (cached).
    """
    now = time.time()
    if not force and _cache["data"] and now - _cache["t"] < _CACHE_TTL:
        return _cache["data"]

    cur = current()
    latest, url = None, f"https://github.com/{REPO}/releases"
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/releases/latest",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "Guaralingo"},
        )
        with urllib.request.urlopen(req, timeout=6) as r:
            d = json.loads(r.read().decode("utf-8"))
        latest = (d.get("tag_name") or "").lstrip("v") or None
        url = d.get("html_url") or url
    except Exception:
        pass  # PT-BR: offline/sem release — segue sem quebrar. EN: offline/no release.

    update = bool(latest) and _tuple(latest) > _tuple(cur)
    data = {"current": cur, "latest": latest, "update_available": update, "url": url}
    _cache.update(t=now, data=data)
    return data


def _git(*args):
    return subprocess.run(["git", *args], cwd=str(ROOT), capture_output=True, text=True, timeout=120)


def perform_update():
    """
    PT-BR: atualiza o projeto (git pull), força rebuild do frontend e agenda o reinício do
           servidor. O run.sh (loop) sobe de novo com o código novo, reinstalando deps e
           recompilando o React. EN: git pull + force frontend rebuild + schedule restart.
    """
    before = current()
    try:
        pull = _git("pull", "--ff-only")
    except Exception as e:
        return {"ok": False, "error": str(e)}

    out = (pull.stdout or "") + (pull.stderr or "")
    if pull.returncode != 0:
        return {"ok": False, "error": out.strip() or "git pull falhou", "current": before}

    changed = "Already up to date" not in out and "atualizado" not in out.lower()

    if changed:
        # PT-BR: remove o build para o run.sh recompilar o React no reinício.
        # EN: drop the build so run.sh rebuilds the React app on restart.
        try:
            import shutil
            shutil.rmtree(ROOT / "web" / "dist", ignore_errors=True)
        except Exception:
            pass
        # PT-BR: sinaliza reinício e agenda a saída do processo. EN: signal restart + schedule exit.
        (ROOT / ".restart").write_text("1", encoding="utf-8")
        threading.Timer(1.2, lambda: os._exit(0)).start()

    return {"ok": True, "changed": changed, "from": before, "to": current(), "log": out.strip()[-800:]}


# --------------------------------------------------------------------------- #
# PT-BR: Auto-update do App DESKTOP (Linux) — baixa o novo .deb da release e o
#        instala POR CIMA do atual (dpkg -i), sem desinstalar. Depois o frontend
#        reinicia o app para usar o binário novo.
# EN:    DESKTOP app auto-update (Linux) — download the new .deb from the release and
#        install it OVER the current one (dpkg -i), without uninstalling. The frontend
#        then relaunches the app so it uses the new binary.
# --------------------------------------------------------------------------- #

def _latest_release():
    """PT-BR: retorna a última release (tag + lista de assets .deb/.AppImage) ou None.
    EN: return the latest release (tag + list of .deb/.AppImage assets) or None."""
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/releases/latest",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "Guaralingo"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            d = json.loads(r.read().decode("utf-8"))
        assets = [
            a for a in (d.get("assets") or [])
            if a.get("name", "").lower().endswith((".deb", ".appimage"))
        ]
        return {"tag": (d.get("tag_name") or "").lstrip("v"), "url": d.get("html_url") or "", "assets": assets}
    except Exception:
        return None


def _arch():
    """PT-BR: detecta a arquitetura (amd64/arm64). EN: detect the architecture (amd64/arm64)."""
    try:
        import platform
        m = platform.machine().lower()
        if m in ("x86_64", "amd64"):
            return "amd64"
        if m in ("aarch64", "arm64"):
            return "arm64"
        return m
    except Exception:
        return "amd64"


def perform_update_desktop():
    """
    PT-BR: modo desktop: baixa o .deb da última release e instala por cima via dpkg.
           Requer privilégio (pkexec/sudo) para instalar o pacote. Retorna o resultado
           para o frontend, que reinicia o app depois.
    EN:    desktop mode: download the .deb from the latest release and install it over the
           current one via dpkg. Requires privilege (pkexec/sudo) to install the package.
           Returns the result to the frontend, which relaunches the app afterwards.
    """
    rel = _latest_release()
    if not rel or not rel["assets"]:
        return {"ok": False, "error": "Nenhuma release/asset encontrada no GitHub." + ("" if rel else " (sem release)")}

    tag = rel["tag"] or ""
    arch = _arch()
    # PT-BR: escolhe um .deb que contenha a arquitetura no nome (ex: amd64).
    # EN: pick a .deb whose name contains the architecture (e.g. amd64).
    deb = None
    for a in rel["assets"]:
        name = a["name"].lower()
        if name.endswith(".deb") and arch in name:
            deb = a
            break
    if not deb and any(a["name"].lower().endswith(".deb") for a in rel["assets"]):
        deb = next(a for a in rel["assets"] if a["name"].lower().endswith(".deb"))

    if not deb:
        return {"ok": False, "error": "Nenhum pacote .deb encontrado no release."}

    # PT-BR: baixa o .deb para um diretório gravável pelo usuário. EN: download it to a writable dir.
    dl_dir = Path(os.path.expanduser("~/.cache/guaralingo"))
    dl_dir.mkdir(parents=True, exist_ok=True)
    dest = dl_dir / deb["name"]
    try:
        req = urllib.request.Request(deb["browser_download_url"], headers={"User-Agent": "Guaralingo"})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            # PT-BR: copia em blocos para não carregar tudo em memória. EN: copy in chunks.
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
    except Exception as e:
        return {"ok": False, "error": f"Falha ao baixar o .deb: {e}"}

    # PT-BR: instala por cima com privilégio (pkexec → diálogo gráfico; fallback sudo).
    # EN: install over the current package with privilege (pkexec → GUI prompt; sudo fallback).
    import shutil
    pkexec = shutil.which("pkexec")
    cmd = [pkexec, "dpkg", "-i", str(dest)] if pkexec else ["sudo", "dpkg", "-i", str(dest)]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except Exception as e:
        return {"ok": False, "error": f"Falha ao executar a instalação: {e}"}

    if proc.returncode != 0:
        return {"ok": False, "error": (proc.stderr or proc.stdout or "").strip()[-800:]}
    return {"ok": True, "from": current(), "to": tag, "log": (proc.stdout or "").strip()[-800:]}
