"""
PT-BR: Camada de persistência do Fala A.I. (SQLite local, MULTI-USUÁRIO).
       Todas as funções recebem um `uid` (identidade local do usuário) e chaveiam perfil,
       tentativas do teste, prática, progresso do curso, vocabulário SRS e erros por usuário.
EN:    Fala A.I. persistence layer (local SQLite, MULTI-USER).
       All functions take a `uid` (local user identity) and key profile, test attempts,
       practice, course progress, SRS vocabulary and mistakes per user.
"""

import hmac
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
import hashlib
import secrets

# PT-BR: se FALA_AI_DATA_DIR estiver definido (app desktop), guarda o banco em local
#        gravável do usuário. Senão, usa backend/data (modo servidor web).
# EN:    if FALA_AI_DATA_DIR is set (desktop app), keep the DB in a user-writable path.
#        Otherwise use backend/data (web server mode).
_DATA_DIR = os.environ.get("FALA_AI_DATA_DIR")
if _DATA_DIR:
    DATA_DIR = Path(_DATA_DIR)
else:
    DATA_DIR = Path(__file__).resolve().parent / "data"
    _DATA_DIR = str(DATA_DIR)

DB_PATH = DATA_DIR / "falaai.db"


def data_dir() -> str:
    """PT-BR: expõe o diretório de dados atual (p/ o main.py usar). EN: expose current data dir."""
    return _DATA_DIR


def _hash_password(password: str) -> str:
    """PT-BR: gera hash seguro da senha (PBKDF2-SHA256). EN: hash password securely."""
    salt = secrets.token_bytes(16)
    hash_val = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + ":" + hash_val.hex()


def _verify_password(password: str, stored_hash: str) -> bool:
    """PT-BR: verifica senha contra hash armazenado. EN: verify password against stored hash."""
    try:
        salt_hex, hash_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        hash_val = bytes.fromhex(hash_hex)
        test_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
        return hmac.compare_digest(test_hash, hash_val)
    except Exception:
        return False


def _conn():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """PT-BR: Cria as tabelas se não existirem. EN: Create tables if absent."""
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS profile (
                uid TEXT PRIMARY KEY,
                name TEXT,
                native_lang TEXT,
                goal TEXT,
                interests TEXT,
                gender_preference TEXT DEFAULT 'female',
                email TEXT,
                picture TEXT,
                password_hash TEXT,
                created_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid TEXT,
                created_at TEXT,
                level TEXT,
                theta REAL,
                se REAL,
                correct INTEGER,
                total INTEGER,
                skills_json TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS practice (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid TEXT,
                created_at TEXT,
                kind TEXT,
                detail TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS lesson_progress (
                lesson_id TEXT,
                uid TEXT,
                status TEXT,
                score INTEGER,
                completed_at TEXT,
                PRIMARY KEY (lesson_id, uid)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS srs (
                uid TEXT,
                term TEXT,
                translation TEXT,
                reps INTEGER DEFAULT 0,
                correct INTEGER DEFAULT 0,
                half_life REAL DEFAULT 0.5,
                last_review TEXT,
                next_due TEXT,
                PRIMARY KEY (uid, term)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS mistakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid TEXT,
                created_at TEXT,
                source TEXT,
                skill TEXT,
                question TEXT,
                correct_answer TEXT,
                given_answer TEXT,
                explanation TEXT,
                resolved INTEGER DEFAULT 0
            )
        """)
        # PT-BR: índice de performance por usuário (a maioria das buscas é por uid).
        # EN: performance index by user (most lookups are by uid).
        for tbl in ("attempts", "practice", "lesson_progress", "srs", "mistakes"):
            c.execute(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_uid ON {tbl}(uid)")

        # PT-BR: MIGRAÇÃO de schema — bancos antigos criados sem password_hash (ou sem outras
        #        colunas recentes) não são atualizados pelo "CREATE TABLE IF NOT EXISTS".
        #        Adicionamos as colunas faltantes dinamicamente. EN: schema migration — older
        #        DBs created without password_hash (or other new columns) are not touched by
        #        "CREATE TABLE IF NOT EXISTS"; add any missing columns here.
        def _add_column(table, col, ddl):
            cols = {r["name"] for r in c.execute(f"PRAGMA table_info({table})").fetchall()}
            if col not in cols:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")

        _add_column("profile", "password_hash", "TEXT")
        _add_column("profile", "native_lang", "TEXT")
        _add_column("profile", "goal", "TEXT")
        _add_column("profile", "interests", "TEXT")
        _add_column("profile", "gender_preference", "TEXT DEFAULT 'female'")
        _add_column("profile", "email", "TEXT")
        _add_column("profile", "picture", "TEXT")
        _add_column("profile", "created_at", "TEXT")


# --------------------------------------------------------------------------- #
# PT-BR: Perfil. EN: Profile.
# --------------------------------------------------------------------------- #
def get_profile(uid):
    with _conn() as c:
        row = c.execute("SELECT * FROM profile WHERE uid=?", (uid,)).fetchone()
    return dict(row) if row else None


def list_profiles():
    """PT-BR: lista os perfis locais cadastrados (para o pick list do login).
    EN: list the registered local profiles (for the login pick list)."""
    with _conn() as c:
        rows = c.execute(
            "SELECT uid, name FROM profile ORDER BY name COLLATE NOCASE"
        ).fetchall()
    return [dict(r) for r in rows]


def get_profile_by_name(name):
    """PT-BR: acha um perfil pelo nome (sem diferenciar maiúsculas). EN: find profile by name."""
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM profile WHERE lower(name)=lower(?) LIMIT 1", (name,)
        ).fetchone()
    return dict(row) if row else None


def upsert_profile(uid, name, native_lang, goal, interests, gender_preference="female",
                   email=None, picture=None, password=None):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        exists = c.execute("SELECT 1 FROM profile WHERE uid=?", (uid,)).fetchone()
        if exists:
            if password:
                pw_hash = _hash_password(password)
                c.execute(
                    "UPDATE profile SET name=?, native_lang=?, goal=?, interests=?, "
                    "gender_preference=?, email=?, picture=?, password_hash=? WHERE uid=?",
                    (name, native_lang, goal, interests, gender_preference, email, picture, pw_hash, uid),
                )
            else:
                c.execute(
                    "UPDATE profile SET name=?, native_lang=?, goal=?, interests=?, "
                    "gender_preference=?, email=?, picture=? WHERE uid=?",
                    (name, native_lang, goal, interests, gender_preference, email, picture, uid),
                )
        else:
            pw_hash = _hash_password(password) if password else None
            c.execute(
                "INSERT INTO profile (uid, name, native_lang, goal, interests, "
                "gender_preference, email, picture, password_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (uid, name, native_lang, goal, interests, gender_preference, email, picture, pw_hash, now),
            )
    return get_profile(uid)


def verify_password(uid, password: str) -> bool:
    """PT-BR: verifica se a senha confere com o hash armazenado. EN: verify password against stored hash."""
    prof = get_profile(uid)
    if not prof or not prof.get("password_hash"):
        return False
    return _verify_password(password, prof["password_hash"])


def create_profile_from_auth(uid, name, email, picture):
    """PT-BR: cria um perfil inicial a partir dos dados do login local, se ainda não existir.
    EN: create an initial profile from the local sign-in data, if it doesn't exist yet."""
    if get_profile(uid):
        return get_profile(uid)
    return upsert_profile(uid, name or "Aluno(a)", "Português (Brasil)", "", "",
                          "female", email=email, picture=picture)


# --------------------------------------------------------------------------- #
# PT-BR: Tentativas de teste (curva de aprendizado). EN: Test attempts (learning curve).
# --------------------------------------------------------------------------- #
def save_attempt(uid, level, theta, se, correct, total, skills):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO attempts (uid, created_at, level, theta, se, correct, total, skills_json) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (uid, now, level, theta, se, correct, total, json.dumps(skills)),
        )
        return cur.lastrowid


def list_attempts(uid):
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM attempts WHERE uid=? ORDER BY created_at ASC", (uid,)
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["skills"] = json.loads(d.pop("skills_json") or "{}")
        out.append(d)
    return out


def log_practice(uid, kind, detail=""):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT INTO practice (uid, created_at, kind, detail) VALUES (?,?,?,?)",
            (uid, now, kind, detail),
        )


def practice_count(uid):
    with _conn() as c:
        row = c.execute(
            "SELECT COUNT(*) n FROM practice WHERE uid=?", (uid,)
        ).fetchone()
    return row["n"] if row else 0


# --------------------------------------------------------------------------- #
# PT-BR: Progresso no curso (lições concluídas). EN: Course progress (lessons done).
# --------------------------------------------------------------------------- #
def get_lesson_progress(uid):
    with _conn() as c:
        rows = c.execute(
            "SELECT lesson_id, status, score FROM lesson_progress WHERE uid=?",
            (uid,),
        ).fetchall()
    return {r["lesson_id"]: {"status": r["status"], "score": r["score"]} for r in rows}


def complete_lesson(uid, lesson_id, score):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT INTO lesson_progress (lesson_id, uid, status, score, completed_at) "
            "VALUES (?,?,?,?,?) "
            "ON CONFLICT(lesson_id, uid) DO UPDATE SET status=excluded.status, "
            "score=MAX(lesson_progress.score, excluded.score), completed_at=excluded.completed_at",
            (lesson_id, uid, "done", int(score), now),
        )


# --------------------------------------------------------------------------- #
# PT-BR: SRS de vocabulário (repetição espaçada). EN: vocabulary SRS.
# --------------------------------------------------------------------------- #
def srs_upsert(uid, term, translation):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO srs (uid, term, translation, next_due, last_review) "
            "VALUES (?,?,?,?,?)",
            (uid, term, translation, now, now),
        )


def srs_due(uid, limit=20):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        rows = c.execute(
            "SELECT term, translation, reps, correct, half_life FROM srs "
            "WHERE uid=? AND next_due<=? ORDER BY next_due ASC LIMIT ?",
            (uid, now, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def srs_update(uid, term, half_life, correct, next_due):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "UPDATE srs SET reps=reps+1, correct=correct+?, half_life=?, last_review=?, next_due=? "
            "WHERE uid=? AND term=?",
            (1 if correct else 0, half_life, now, next_due, uid, term),
        )


def srs_stats(uid):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) n FROM srs WHERE uid=?", (uid,)).fetchone()["n"]
        due = c.execute("SELECT COUNT(*) n FROM srs WHERE uid=? AND next_due<=?",
                        (uid, now)).fetchone()["n"]
    return {"total": total, "due": due}


# --------------------------------------------------------------------------- #
# PT-BR: Erros do aluno (hub de revisão). EN: student mistakes (review hub).
# --------------------------------------------------------------------------- #
def log_mistake(uid, source, skill, question, correct_answer, given_answer, explanation=""):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT INTO mistakes (uid, created_at, source, skill, question, "
            "correct_answer, given_answer, explanation) VALUES (?,?,?,?,?,?,?,?)",
            (uid, now, source, skill, question, correct_answer, given_answer, explanation),
        )


def list_mistakes(uid, limit=30):
    with _conn() as c:
        rows = c.execute(
            "SELECT id, source, skill, question, correct_answer, given_answer, explanation "
            "FROM mistakes WHERE uid=? AND resolved=0 ORDER BY created_at DESC LIMIT ?",
            (uid, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def resolve_mistake(uid, mistake_id):
    with _conn() as c:
        c.execute("UPDATE mistakes SET resolved=1 WHERE uid=? AND id=?",
                  (uid, mistake_id))


def mistakes_count(uid):
    with _conn() as c:
        return c.execute("SELECT COUNT(*) n FROM mistakes WHERE uid=? AND resolved=0",
                         (uid,)).fetchone()["n"]
