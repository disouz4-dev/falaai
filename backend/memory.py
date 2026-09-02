"""
PT-BR: Memória permanente do Guaralingo — um "vault" de arquivos .md (estilo Obsidian) onde o
       professor guarda o que aprende sobre o aluno: detalhes pessoais, brincadeiras, gírias e
       outras coisas. Esse contexto é injetado na conversa para o professor soar humano e lembrar.
EN:    Guaralingo permanent memory — a vault of .md files where the teacher stores what it learns
       about the student (personal details, inside jokes, slang, misc). Injected into the chat so
       the teacher feels human and remembers.
"""

import json
import os
import re
from datetime import date
from pathlib import Path

import ollama_client

# PT-BR: pasta-base do vault (pode apontar para um vault do Obsidian via env). Cada usuário tem
#        sua SUBPASTA aqui (data/memory/<uid>/), mantendo memórias separadas por conta.
#        No app desktop honramos GUARALINGO_DATA_DIR (gravável). EN: base vault dir (env-overridable).
_DEFAULT_MEMORY = Path(os.environ.get(
    "GUARALINGO_MEMORY_DIR",
    str(Path(os.environ.get("GUARALINGO_DATA_DIR", str(Path(__file__).resolve().parent))) / "data" / "memory"),
))
VAULT_BASE = _DEFAULT_MEMORY
_DEFAULT_UID = "local"


def _vault_dir(uid):
    """PT-BR: pasta do vault de um usuário específico. EN: vault dir for a specific user."""
    uid = (uid or _DEFAULT_UID)
    return VAULT_BASE / uid

# PT-BR: categorias -> arquivo .md + título. EN: categories -> .md file + title.
CATEGORIES = {
    "about": ("about.md", "🧑 Sobre o aluno", "Fatos e detalhes pessoais (trabalho, família, cidade, hobbies, metas)."),
    "jokes": ("jokes.md", "😄 Brincadeiras", "Piadas internas, apelidos e coisas engraçadas entre nós."),
    "slang": ("slang.md", "🗣️ Gírias e expressões", "Gírias e expressões que o aluno usa ou curte."),
    "prefs": ("prefs.md", "❤️ Preferências", "Gostos, temas favoritos, o que motiva o aluno."),
    "notes": ("notes.md", "📝 Outras anotações", "Qualquer outra coisa relevante para lembrar."),
}
_MAX_CONTEXT_CHARS = 1800


def ensure_vault(uid=None):
    """PT-BR: cria a pasta e os arquivos do vault se não existirem. EN: create vault dir/files if absent."""
    vdir = _vault_dir(uid)
    vdir.mkdir(parents=True, exist_ok=True)
    for cat, (fname, title, desc) in CATEGORIES.items():
        f = vdir / fname
        if not f.exists():
            f.write_text(f"# {title}\n> {desc}\n\n", encoding="utf-8")


def _existing_lines(uid, fname):
    f = _vault_dir(uid) / fname
    if not f.exists():
        return ""
    return f.read_text(encoding="utf-8").lower()


def add_memory(uid, category, text):
    """
    PT-BR: acrescenta uma memória (bullet datado) no arquivo da categoria, evitando duplicatas.
    EN:    append a dated bullet memory to the category file, avoiding near-duplicates.
    """
    text = (text or "").strip().rstrip(".")
    if not text or len(text) < 3:
        return False
    cat = category if category in CATEGORIES else "notes"
    fname, title, desc = CATEGORIES[cat]
    # PT-BR: dedupe simples por sobreposição de palavras. EN: simple word-overlap dedupe.
    existing = _existing_lines(uid, fname)
    key = re.sub(r"[^a-z0-9á-ú ]", "", text.lower())
    if key and key[:40] in existing:
        return False
    ensure_vault(uid)
    with open(_vault_dir(uid) / fname, "a", encoding="utf-8") as fp:
        fp.write(f"- ({date.today().isoformat()}) {text}.\n")
    return True


def load_context(uid=None):
    """
    PT-BR: junta o vault num texto curto para injetar no prompt do professor.
    EN:    concatenate the vault into a short text to inject into the teacher's prompt.
    """
    vdir = _vault_dir(uid)
    if not vdir.exists():
        return ""
    parts = []
    for cat, (fname, title, desc) in CATEGORIES.items():
        f = vdir / fname
        if not f.exists():
            continue
        lines = [ln.strip() for ln in f.read_text(encoding="utf-8").splitlines()
                 if ln.strip().startswith("- ")]
        if lines:
            parts.append(title + "\n" + "\n".join(lines[-12:]))  # PT-BR: últimas 12. EN: last 12.
    ctx = "\n\n".join(parts).strip()
    return ctx[-_MAX_CONTEXT_CHARS:] if ctx else ""


def read_all(uid=None):
    """PT-BR: retorna o vault inteiro (para exibir/editar). EN: return the whole vault (for viewing)."""
    vdir = _vault_dir(uid)
    ensure_vault(uid)
    out = {}
    for cat, (fname, title, desc) in CATEGORIES.items():
        out[cat] = {"title": title, "file": fname,
                    "content": (vdir / fname).read_text(encoding="utf-8")}
    return out


def _parse_json_array(raw):
    """PT-BR: extrai um array JSON mesmo com lixo/cercas ao redor. EN: extract a JSON array robustly."""
    raw = raw.strip()
    raw = re.sub(r"^```(json)?|```$", "", raw, flags=re.MULTILINE).strip()
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        data = json.loads(raw[start:end + 1])
        return data if isinstance(data, list) else []
    except Exception:
        return []


def extract_and_store(uid, user_text, assistant_text=""):
    """
    PT-BR: a IA lê a última fala do aluno e extrai memórias DURÁVEIS (detalhes, brincadeiras,
           gírias), gravando no vault. Roda em segundo plano para não atrasar a resposta.
    EN:    the AI reads the student's last message and extracts DURABLE memories to store.
    """
    user_text = (user_text or "").strip()
    if len(user_text) < 4:
        return []
    prompt = (
        "You maintain a memory vault about an English student. From the student's message below, "
        "extract only DURABLE, personal facts worth remembering long-term: personal details "
        "(job, family, city, hobbies, pets, goals), inside jokes, slang/expressions they use, and "
        "clear preferences. Ignore small talk and anything temporary.\n"
        "Return ONLY a JSON array of objects like "
        '[{"category":"about|jokes|slang|prefs|notes","text":"..."}]. '
        "Write each 'text' as a short third-person note in Brazilian Portuguese "
        "(ex.: 'Tem um cachorro chamado Rex'). If nothing is worth saving, return [].\n\n"
        f"Student message: \"{user_text}\""
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            return []
        raw = ollama_client.chat_once(
            [{"role": "system", "content": "You extract durable memory notes as strict JSON."},
             {"role": "user", "content": prompt}], temperature=0.2)
        items = _parse_json_array(raw)
        saved = []
        for it in items:
            if isinstance(it, dict) and it.get("text"):
                if add_memory(uid, it.get("category", "notes"), it["text"]):
                    saved.append(it["text"])
        return saved
    except Exception:
        return []
