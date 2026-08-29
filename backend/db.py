"""
PT-BR: Camada de persistência do OpenLingo (SQLite local, single-user).
       Guarda o perfil do aluno e o histórico de tentativas do teste, que alimentam a
       curva de aprendizado e os relatórios gráficos de evolução.
EN:    OpenLingo persistence layer (local SQLite, single-user).
       Stores the learner profile and the test-attempt history that feed the learning curve
       and the graphical evolution reports.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "openlingo.db"
PROFILE_ID = 1  # PT-BR: app local single-user. EN: single-user local app.


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """PT-BR: Cria as tabelas se não existirem. EN: Create tables if absent."""
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY,
                name TEXT,
                native_lang TEXT,
                goal TEXT,
                interests TEXT,
                created_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER,
                created_at TEXT,
                level TEXT,
                theta REAL,
                se REAL,
                correct INTEGER,
                total INTEGER,
                skills_json TEXT
            )
        """)
        # PT-BR: registra minutos/turnos de conversação para enriquecer a curva.
        # EN: log conversation turns to enrich the learning curve.
        c.execute("""
            CREATE TABLE IF NOT EXISTS practice (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER,
                created_at TEXT,
                kind TEXT,
                detail TEXT
            )
        """)


# --------------------------------------------------------------------------- #
# PT-BR: Perfil. EN: Profile.
# --------------------------------------------------------------------------- #
def get_profile():
    with _conn() as c:
        row = c.execute("SELECT * FROM profile WHERE id=?", (PROFILE_ID,)).fetchone()
    return dict(row) if row else None


def upsert_profile(name, native_lang, goal, interests):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        exists = c.execute("SELECT 1 FROM profile WHERE id=?", (PROFILE_ID,)).fetchone()
        if exists:
            c.execute(
                "UPDATE profile SET name=?, native_lang=?, goal=?, interests=? WHERE id=?",
                (name, native_lang, goal, interests, PROFILE_ID),
            )
        else:
            c.execute(
                "INSERT INTO profile (id, name, native_lang, goal, interests, created_at) "
                "VALUES (?,?,?,?,?,?)",
                (PROFILE_ID, name, native_lang, goal, interests, now),
            )
    return get_profile()


# --------------------------------------------------------------------------- #
# PT-BR: Tentativas de teste (curva de aprendizado). EN: Test attempts (learning curve).
# --------------------------------------------------------------------------- #
def save_attempt(level, theta, se, correct, total, skills):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO attempts (profile_id, created_at, level, theta, se, correct, total, skills_json) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (PROFILE_ID, now, level, theta, se, correct, total, json.dumps(skills)),
        )
        return cur.lastrowid


def list_attempts():
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM attempts WHERE profile_id=? ORDER BY created_at ASC", (PROFILE_ID,)
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["skills"] = json.loads(d.pop("skills_json") or "{}")
        out.append(d)
    return out


def log_practice(kind, detail=""):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT INTO practice (profile_id, created_at, kind, detail) VALUES (?,?,?,?)",
            (PROFILE_ID, now, kind, detail),
        )


def practice_count():
    with _conn() as c:
        row = c.execute(
            "SELECT COUNT(*) n FROM practice WHERE profile_id=?", (PROFILE_ID,)
        ).fetchone()
    return row["n"] if row else 0
