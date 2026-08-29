"""
PT-BR: Verificador de versão do OpenLingo. Compara a versão local (arquivo VERSION) com a
       última release no GitHub e diz se há atualização. Também executa a atualização
       (git pull + rebuild + reinício) a pedido do app.
EN:    OpenLingo version checker. Compares the local version (VERSION file) with the latest
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

REPO = os.environ.get("OPENLINGO_REPO", "disouz4-dev/openlingo")
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
            headers={"Accept": "application/vnd.github+json", "User-Agent": "OpenLingo"},
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
