"""
PT-BR: Síntese de voz (TTS) no servidor para o OpenLingo. Gera o áudio da fala do professor
       localmente com o Piper (voz neural) e, se faltar, com o espeak-ng. Assim a voz funciona
       em QUALQUER aparelho, sem depender de voz instalada no navegador/celular.
EN:    Server-side TTS for OpenLingo. Generates the teacher's speech locally with Piper
       (neural voice), falling back to espeak-ng. Works on ANY device regardless of the
       browser/phone having a TTS voice installed.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

# PT-BR: locais onde procurar modelos de voz Piper (.onnx). EN: where to look for Piper voices.
_VOICE_DIRS = [
    os.environ.get("OPENLINGO_VOICE_DIR", ""),
    str(Path.home() / ".local/share/praxis/voices"),
    str(Path.home() / ".local/share/piper/voices"),
    str(Path(__file__).resolve().parent / "voices"),
]
# PT-BR: ordem de preferência de vozes (US clara primeiro). EN: preferred voices (clear US first).
_VOICE_PREFS = [
    "en_US-lessac-medium", "en_US-lessac-low", "en_US-kusal-medium",
    "en_US-arctic-medium", "en_GB-alan-medium", "en_GB-alan-low",
]

_PIPER = shutil.which("piper")
_ESPEAK = shutil.which("espeak-ng") or shutil.which("espeak")


def _find_voice():
    """PT-BR: acha o melhor modelo Piper disponível. EN: find the best available Piper voice."""
    for d in _VOICE_DIRS:
        if not d:
            continue
        base = Path(d)
        if not base.is_dir():
            continue
        # PT-BR: respeita a ordem de preferência. EN: honour preference order.
        for name in _VOICE_PREFS:
            m = base / f"{name}.onnx"
            if m.exists() and (base / f"{name}.onnx.json").exists():
                return str(m)
        # PT-BR: senão, qualquer voz en_*. EN: otherwise, any en_* voice.
        for m in sorted(base.glob("en_*.onnx")):
            if (Path(str(m) + ".json")).exists():
                return str(m)
    return None


_VOICE_MODEL = _find_voice()


def available():
    """PT-BR: TTS disponível? EN: is TTS available?"""
    return bool((_PIPER and _VOICE_MODEL) or _ESPEAK)


def engine_name():
    if _PIPER and _VOICE_MODEL:
        return f"piper:{Path(_VOICE_MODEL).stem}"
    if _ESPEAK:
        return "espeak-ng"
    return "none"


def synth(text: str) -> bytes:
    """
    PT-BR: Gera o áudio WAV da fala. Tenta Piper; se falhar, usa espeak-ng.
    EN:    Generate speech WAV bytes. Tries Piper first; falls back to espeak-ng.
    """
    text = (text or "").strip()[:1200]  # PT-BR: limita tamanho. EN: cap length.
    if not text:
        return b""

    # --- Piper (voz neural) ---
    if _PIPER and _VOICE_MODEL:
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                out = tmp.name
            subprocess.run(
                [_PIPER, "-m", _VOICE_MODEL, "-f", out],
                input=text.encode("utf-8"),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=30, check=True,
            )
            data = Path(out).read_bytes()
            os.unlink(out)
            if data:
                return data
        except Exception:
            pass

    # --- espeak-ng (fallback robótico, mas sempre funciona) ---
    if _ESPEAK:
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                out = tmp.name
            subprocess.run(
                [_ESPEAK, "-v", "en-us", "-s", "150", "-w", out, text],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=30, check=True,
            )
            data = Path(out).read_bytes()
            os.unlink(out)
            return data
        except Exception:
            pass

    return b""
