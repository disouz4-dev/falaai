"""
PT-BR: Síntese de voz (TTS) no servidor para o Fala A.I.. Gera o áudio da fala do professor
       localmente com o Piper (voz neural) e, se faltar, com o espeak-ng. Assim a voz funciona
       em QUALQUER aparelho, sem depender de voz instalada no navegador/celular.
EN:    Server-side TTS for Fala A.I.. Generates the teacher's speech locally with Piper
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
    os.environ.get("FALA_AI_VOICE_DIR", ""),
    str(Path.home() / ".local/share/praxis/voices"),
    str(Path.home() / ".local/share/piper/voices"),
    str(Path(__file__).resolve().parent / "voices"),
]

# PT-BR: Categorias de vozes por gênero e idioma.
# Masculino/Feminino com timbre consistente entre en e pt_BR
_VOICE_GENDERS = {
    "en": {
        "male":  ["en_US-lessac-low", "en_US-kusal-medium", "en_US-arctic-medium",
                  "en_GB-alan-medium", "en_GB-alan-low", "en_US-ryan-medium"],
        "female": ["en_US-amy-medium", "en_US-lessac-medium", "en_US-kathleen-low",
                   "en_US-hfc_female-medium", "en_US-hfc_male-medium"]
    },
    "pt": {
        "male": ["pt_BR-cadu-medium", "pt_BR-jeff-medium", "pt_BR-edresson-low"],
        "female": ["pt_BR-faber-medium", "pt_BR-cadu-medium"]
    }
}


def _find_piper():
    """PT-BR: localiza o piper mesmo se ~/.local/bin não estiver no PATH do servidor.
    EN: locate piper even if ~/.local/bin is not on the server's PATH."""
    candidates = [
        str(Path.home() / ".local/bin/piper"),
        "/usr/local/bin/piper",
        "/usr/bin/piper",
        "/opt/piper/piper",
    ]
    for c in candidates:
        p = Path(c)
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


_PIPER = shutil.which("piper") or _find_piper()
_ESPEAK = shutil.which("espeak-ng") or shutil.which("espeak")


def _find_voice(lang="en", gender="female"):
    """PT-BR: acha o melhor modelo Piper para o idioma e gênero.
       EN: find the best Piper voice for the language and gender."""
    prefix = "pt_" if lang == "pt" else "en_"
    voice_list = _VOICE_GENDERS.get(lang, {}).get(gender, _VOICE_GENDERS.get(lang, {}).get("female", []))
    
    for d in _VOICE_DIRS:
        if not d:
            continue
        base = Path(d)
        if not base.is_dir():
            continue
        # PT-BR: respeita a ordem de preferência para o gênero escolhido. EN: honour preference order for chosen gender.
        for name in voice_list:
            m = base / f"{name}.onnx"
            if m.exists() and (base / f"{name}.onnx.json").exists():
                return str(m)
        # PT-BR: senão, qualquer voz do idioma/gênero. EN: otherwise, any voice for language/gender.
        for m in sorted(base.glob(f"{prefix}*.onnx")):
            if (Path(str(m) + ".json")).exists():
                return str(m)
    return None


def _find_voice_from_prefs(lang="en", voice_prefs=list):
    """PT-BR: acha voz pela lista de preferências antigas. EN: find voice by old preference list."""
    prefix = "pt_" if lang == "pt" else "en_"
    for d in _VOICE_DIRS:
        if not d:
            continue
        base = Path(d)
        if not base.is_dir():
            continue
        for name in voice_prefs:
            m = base / f"{name}.onnx"
            if m.exists() and (base / f"{name}.onnx.json").exists():
                return str(m)
        for m in sorted(base.glob(f"{prefix}*.onnx")):
            if (Path(str(m) + ".json")).exists():
                return str(m)
    return None


# Gênero padrão: "female" = professora, "male" = professor
# Isso pode ser sobrescrito pelas preferências do perfil do aluno
_DEFAULT_GENDER = "female"

_VOICE_MODELS = {"en": _find_voice("en", _DEFAULT_GENDER), "pt": _find_voice("pt", _DEFAULT_GENDER)}
# Force use of selected gender voice if available
# This ensures consistent high-quality voice across languages based on gender choice
if _VOICE_MODELS["en"] is None:
    _VOICE_MODELS["en"] = _find_voice("en", _DEFAULT_GENDER)
if _VOICE_MODELS["pt"] is None:
    _VOICE_MODELS["pt"] = _find_voice("pt", _DEFAULT_GENDER)
_VOICE_MODEL = _VOICE_MODELS["en"]  # PT-BR: compat. EN: backward-compat alias.


def available():
    """PT-BR: TTS disponível? EN: is TTS available?"""
    return bool((_PIPER and (_VOICE_MODELS["en"] or _VOICE_MODELS["pt"])) or _ESPEAK)


def engine_name(gender="female"):
    """Retorna nome do engine considerando o gênero da voz."""
    if _PIPER and _VOICE_MODELS["en"]:
        pt = f"+pt:{Path(_VOICE_MODELS['pt']).stem}" if _VOICE_MODELS["pt"] else ""
        base_name = Path(_VOICE_MODELS["en"]).stem
        return f"piper:{base_name}{pt}"
    if _ESPEAK:
        return "espeak-ng"
    return "none"


def synth(text: str, lang: str = "en", gender: str = "female") -> bytes:
    """
    PT-BR: Gera o áudio WAV da fala no idioma pedido ('en' ou 'pt') com gênero especificado.
       EN:    Generate speech WAV bytes in the requested language ('en' or 'pt') with specified gender.
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
        except Exception as e:
            print(f"Piper error: {e}")
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
