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
        # PT-BR: conclusão de lições do curso. EN: course lesson completion.
        c.execute("""
            CREATE TABLE IF NOT EXISTS lesson_progress (
                lesson_id TEXT,
                profile_id INTEGER,
                status TEXT,
                score INTEGER,
                completed_at TEXT,
                PRIMARY KEY (lesson_id, profile_id)
            )
        """)
        # PT-BR: SRS de vocabulário (half-life regression). Guarda a meia-vida de memória.
        # EN: vocabulary SRS (half-life regression). Stores the memory half-life per word.
        c.execute("""
            CREATE TABLE IF NOT EXISTS srs (
                profile_id INTEGER,
                term TEXT,
                translation TEXT,
                reps INTEGER DEFAULT 0,
                correct INTEGER DEFAULT 0,
                half_life REAL DEFAULT 0.5,
                last_review TEXT,
                next_due TEXT,
                PRIMARY KEY (profile_id, term)
            )
        """)
        # PT-BR: erros do aluno (teste + lições) para o hub de revisão. EN: mistakes for the review hub.
        c.execute("""
            CREATE TABLE IF NOT EXISTS mistakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER,
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


# --------------------------------------------------------------------------- #
# PT-BR: Progresso no curso (lições concluídas). EN: Course progress (lessons done).
# --------------------------------------------------------------------------- #
def get_lesson_progress():
    with _conn() as c:
        rows = c.execute(
            "SELECT lesson_id, status, score FROM lesson_progress WHERE profile_id=?",
            (PROFILE_ID,),
        ).fetchall()
    return {r["lesson_id"]: {"status": r["status"], "score": r["score"]} for r in rows}


def complete_lesson(lesson_id, score):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT INTO lesson_progress (lesson_id, profile_id, status, score, completed_at) "
            "VALUES (?,?,?,?,?) "
            "ON CONFLICT(lesson_id, profile_id) DO UPDATE SET status=excluded.status, "
            "score=MAX(lesson_progress.score, excluded.score), completed_at=excluded.completed_at",
            (lesson_id, PROFILE_ID, "done", int(score), now),
        )


# --------------------------------------------------------------------------- #
# PT-BR: SRS de vocabulário (repetição espaçada). EN: vocabulary SRS.
# --------------------------------------------------------------------------- #
def srs_upsert(term, translation):
    """PT-BR: cadastra uma palavra no SRS (se ainda não existe). EN: register a word in SRS if new."""
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO srs (profile_id, term, translation, next_due, last_review) "
            "VALUES (?,?,?,?,?)",
            (PROFILE_ID, term, translation, now, now),
        )


def srs_due(limit=20):
    """PT-BR: palavras a revisar agora (vencidas). EN: words due for review now."""
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        rows = c.execute(
            "SELECT term, translation, reps, correct, half_life FROM srs "
            "WHERE profile_id=? AND next_due<=? ORDER BY next_due ASC LIMIT ?",
            (PROFILE_ID, now, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def srs_update(term, half_life, correct, next_due):
    """PT-BR: atualiza a meia-vida e o próximo vencimento após revisar. EN: update half-life/next due."""
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "UPDATE srs SET reps=reps+1, correct=correct+?, half_life=?, last_review=?, next_due=? "
            "WHERE profile_id=? AND term=?",
            (1 if correct else 0, half_life, now, next_due, PROFILE_ID, term),
        )


def srs_stats():
    """PT-BR: contagem total e vencidas. EN: total and due counts."""
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) n FROM srs WHERE profile_id=?", (PROFILE_ID,)).fetchone()["n"]
        due = c.execute("SELECT COUNT(*) n FROM srs WHERE profile_id=? AND next_due<=?",
                        (PROFILE_ID, now)).fetchone()["n"]
    return {"total": total, "due": due}


# --------------------------------------------------------------------------- #
# PT-BR: Erros do aluno (hub de revisão). EN: student mistakes (review hub).
# --------------------------------------------------------------------------- #
def log_mistake(source, skill, question, correct_answer, given_answer, explanation=""):
    now = datetime.utcnow().isoformat()
    with _conn() as c:
        c.execute(
            "INSERT INTO mistakes (profile_id, created_at, source, skill, question, "
            "correct_answer, given_answer, explanation) VALUES (?,?,?,?,?,?,?,?)",
            (PROFILE_ID, now, source, skill, question, correct_answer, given_answer, explanation),
        )


def list_mistakes(limit=30):
    with _conn() as c:
        rows = c.execute(
            "SELECT id, source, skill, question, correct_answer, given_answer, explanation "
            "FROM mistakes WHERE profile_id=? AND resolved=0 ORDER BY created_at DESC LIMIT ?",
            (PROFILE_ID, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def resolve_mistake(mistake_id):
    with _conn() as c:
        c.execute("UPDATE mistakes SET resolved=1 WHERE profile_id=? AND id=?",
                  (PROFILE_ID, mistake_id))


def mistakes_count():
    with _conn() as c:
        return c.execute("SELECT COUNT(*) n FROM mistakes WHERE profile_id=? AND resolved=0",
                         (PROFILE_ID,)).fetchone()["n"]
