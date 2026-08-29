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
# PT-BR: ordem de preferência de vozes por idioma. EN: voice preference order per language.
_VOICE_PREFS = {
    "en": ["en_US-lessac-medium", "en_US-lessac-low", "en_US-kusal-medium",
           "en_US-arctic-medium", "en_GB-alan-medium", "en_GB-alan-low"],
    "pt": ["pt_BR-faber-medium", "pt_BR-cadu-medium", "pt_BR-edresson-low"],
}

_PIPER = shutil.which("piper")
_ESPEAK = shutil.which("espeak-ng") or shutil.which("espeak")


def _find_voice(lang="en"):
    """PT-BR: acha o melhor modelo Piper para o idioma. EN: find the best Piper voice for the language."""
    prefix = "pt_" if lang == "pt" else "en_"
    for d in _VOICE_DIRS:
        if not d:
            continue
        base = Path(d)
        if not base.is_dir():
            continue
        # PT-BR: respeita a ordem de preferência. EN: honour preference order.
        for name in _VOICE_PREFS.get(lang, []):
            m = base / f"{name}.onnx"
            if m.exists() and (base / f"{name}.onnx.json").exists():
                return str(m)
        # PT-BR: senão, qualquer voz do idioma. EN: otherwise, any voice for the language.
        for m in sorted(base.glob(f"{prefix}*.onnx")):
            if (Path(str(m) + ".json")).exists():
                return str(m)
    return None


_VOICE_MODELS = {"en": _find_voice("en"), "pt": _find_voice("pt")}
_VOICE_MODEL = _VOICE_MODELS["en"]  # PT-BR: compat. EN: backward-compat alias.


def available():
    """PT-BR: TTS disponível? EN: is TTS available?"""
    return bool((_PIPER and (_VOICE_MODELS["en"] or _VOICE_MODELS["pt"])) or _ESPEAK)


def engine_name():
    if _PIPER and _VOICE_MODELS["en"]:
        pt = f"+pt:{Path(_VOICE_MODELS['pt']).stem}" if _VOICE_MODELS["pt"] else ""
        return f"piper:{Path(_VOICE_MODELS['en']).stem}{pt}"
    if _ESPEAK:
        return "espeak-ng"
    return "none"


def synth(text: str, lang: str = "en") -> bytes:
    """
    PT-BR: Gera o áudio WAV da fala no idioma pedido ('en' ou 'pt'). Tenta Piper; se faltar a
           voz do idioma, usa a que houver e por fim o espeak-ng.
    EN:    Generate speech WAV bytes in the requested language ('en' or 'pt'). Tries Piper;
           if the language voice is missing, uses whatever exists, then espeak-ng.
    """
    text = (text or "").strip()[:1200]  # PT-BR: limita tamanho. EN: cap length.
    if not text:
        return b""

    lang = "pt" if lang == "pt" else "en"
    model = _VOICE_MODELS.get(lang) or _VOICE_MODELS.get("en") or _VOICE_MODELS.get("pt")

    # --- Piper (voz neural) ---
    if _PIPER and model:
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                out = tmp.name
            subprocess.run(
                [_PIPER, "-m", model, "-f", out],
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
            voice = "pt-br" if lang == "pt" else "en-us"
            subprocess.run(
                [_ESPEAK, "-v", voice, "-s", "150", "-w", out, text],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=30, check=True,
            )
            data = Path(out).read_bytes()
            os.unlink(out)
            return data
        except Exception:
            pass

    return b""
