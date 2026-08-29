"""
PT-BR: OpenLingo — backend FastAPI.
       Serve o PWA e expõe a API do teste de nivelamento adaptativo (CEFR/TRI) e do
       modo de conversação por voz em tempo real (streaming via Ollama).
EN:    OpenLingo — FastAPI backend.
       Serves the PWA and exposes the adaptive placement-test API (CEFR/IRT) and the
       real-time voice conversation mode (streaming via Ollama).
"""

import json
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db
import gpu
import irt
import mdns
import ollama_client
import tts

# PT-BR: detecta a GPU no início e ajusta o Ollama (preferência GPU, fallback CPU).
# EN: detect the GPU at startup and tune Ollama (prefer GPU, fall back to CPU).
GPU_INFO = gpu.apply_env()
print(f"[OpenLingo] Aceleração: {GPU_INFO['device'].upper()} — {GPU_INFO['reason']}")

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
ITEMS_PATH = BASE_DIR / "data" / "items.json"

TEST_LENGTH = 20  # PT-BR: nº de questões do teste. EN: number of questions in the test.
START_THETA = -1.0  # PT-BR: começa fácil e sobe progressivamente. EN: start easy, ramp up.

# PT-BR: Carrega o banco de itens uma vez. EN: Load the item bank once.
with open(ITEMS_PATH, encoding="utf-8") as f:
    ITEM_BANK = json.load(f)["items"]

# PT-BR: Carrega o currículo do curso. EN: Load the course curriculum.
COURSE_PATH = BASE_DIR / "data" / "course.json"
with open(COURSE_PATH, encoding="utf-8") as f:
    COURSE = json.load(f)["modules"]

# PT-BR: Estado das sessões em memória. EN: In-memory session state.
SESSIONS = {}

# PT-BR: Inicializa o banco local (perfil + histórico). EN: init local DB (profile + history).
db.init_db()

app = FastAPI(title="OpenLingo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# PT-BR: nome amigável na rede (openlingo.local). EN: friendly network name (openlingo.local).
FRIENDLY_URL = None


@app.on_event("startup")
def _start_mdns():
    """PT-BR: anuncia 'openlingo.local' na rede via mDNS. EN: advertise 'openlingo.local' via mDNS."""
    global FRIENDLY_URL
    if os.environ.get("OPENLINGO_MDNS", "1") == "0":
        return  # PT-BR: mDNS desativado (ex.: ambientes restritos). EN: mDNS disabled.
    port = int(os.environ.get("OPENLINGO_PORT", "8000"))
    https = os.environ.get("OPENLINGO_HTTPS", "0") == "1"
    FRIENDLY_URL = mdns.start(port=port, https=https)
    if FRIENDLY_URL:
        print(f"[OpenLingo] Acesse pela rede em: {FRIENDLY_URL}")


@app.on_event("shutdown")
def _stop_mdns():
    mdns.stop()


# --------------------------------------------------------------------------- #
# PT-BR: Modelos de request. EN: Request models.
# --------------------------------------------------------------------------- #
class AnswerIn(BaseModel):
    session_id: str
    item_id: str
    choice: int


class ChatIn(BaseModel):
    messages: list  # [{role, content}]
    level: str = "B1"


class ProfileIn(BaseModel):
    name: str
    native_lang: str = "Português (Brasil)"
    goal: str = ""
    interests: str = ""


class CompleteIn(BaseModel):
    score: int = 100


class TaskFeedbackIn(BaseModel):
    lesson_id: str
    transcript: str


def _public_item(item):
    """PT-BR: Remove gabarito antes de enviar ao cliente. EN: Strip answer before sending."""
    return {
        "id": item["id"],
        "level": item["level"],
        "skill": item["skill"],
        "question": item["question"],
        "options": item["options"],
    }


def _progress(session):
    """PT-BR: Estado da barra de progresso + nível parcial. EN: Progress-bar state + partial level."""
    theta, se = irt.estimate_ability(session["responses"])
    level, frac = irt.cefr_progress(theta)
    return {
        "answered": len(session["responses"]),
        "total": TEST_LENGTH,
        "theta": round(theta, 2),
        "se": round(se, 2),
        "level": level,
        "level_progress": frac,
    }


# --------------------------------------------------------------------------- #
# PT-BR: Endpoints da API. EN: API endpoints.
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    ok, names = ollama_client.is_available()
    return {"ollama": ok, "model": ollama_client.MODEL, "models": names,
            "items": len(ITEM_BANK), "tts": tts.available(), "tts_engine": tts.engine_name(),
            "gpu": GPU_INFO}


@app.get("/api/tts")
def text_to_speech(text: str = Query(..., min_length=1), lang: str = Query("en")):
    """PT-BR: Gera o áudio (WAV) da fala do professor no servidor, no idioma pedido (en/pt).
    Tocado pelo app em qualquer aparelho. EN: Server-side speech audio (WAV) in the given language."""
    audio = tts.synth(text, lang=lang)
    if not audio:
        raise HTTPException(503, "TTS indisponível / TTS unavailable")
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# --------------------------------------------------------------------------- #
# PT-BR: Perfil do aluno. EN: Learner profile.
# --------------------------------------------------------------------------- #
@app.get("/api/profile")
def get_profile():
    return {"profile": db.get_profile()}


@app.post("/api/profile")
def save_profile(p: ProfileIn):
    prof = db.upsert_profile(p.name.strip(), p.native_lang, p.goal.strip(), p.interests.strip())
    return {"profile": prof}


@app.post("/api/placement/start")
def placement_start():
    """PT-BR: Inicia um teste e devolve a 1ª questão. EN: Start a test, return first question."""
    sid = uuid.uuid4().hex
    session = {"responses": [], "used_ids": [], "history": []}
    first = irt.select_next_item(ITEM_BANK, [], START_THETA)
    session["current"] = first["id"]
    SESSIONS[sid] = session
    return {
        "session_id": sid,
        "question": _public_item(first),
        "progress": {"answered": 0, "total": TEST_LENGTH, "level": "—", "level_progress": 0},
    }


@app.post("/api/placement/answer")
def placement_answer(ans: AnswerIn):
    """PT-BR: Registra a resposta, reestima o nível e devolve a próxima questão (adaptativo).
    EN: Record the answer, re-estimate ability, and return the next question (adaptive)."""
    session = SESSIONS.get(ans.session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada / Session not found")
    if session["current"] != ans.item_id:
        raise HTTPException(400, "Item fora de ordem / Out-of-order item")

    item = next((it for it in ITEM_BANK if it["id"] == ans.item_id), None)
    if not item:
        raise HTTPException(404, "Item inexistente / Unknown item")

    correct = ans.choice == item["answer"]
    session["responses"].append({"b": item["b"], "correct": correct})
    session["used_ids"].append(item["id"])
    session["history"].append({
        "id": item["id"], "level": item["level"], "skill": item["skill"],
        "correct": correct, "b": item["b"],
    })

    theta, _ = irt.estimate_ability(session["responses"])
    done = len(session["responses"]) >= TEST_LENGTH
    next_q = None
    if not done:
        # PT-BR: teto de rampa — sobe no máx. ~1 nível (1.0 logit) acima do item mais difícil
        #        já apresentado, para o teste aumentar progressivamente. EN: ramp cap ~1 level.
        hardest_b = max(h["b"] for h in session["history"])
        max_b = hardest_b + 1.0
        nxt = irt.select_next_item(ITEM_BANK, session["used_ids"], theta, max_b=max_b)
        if nxt is None:
            done = True
        else:
            session["current"] = nxt["id"]
            next_q = _public_item(nxt)

    return {
        "correct": correct,
        "correct_index": item["answer"],
        "explanation_pt": item["explanation_pt"],
        "explanation_en": item["explanation_en"],
        "target": item["target"],
        "done": done,
        "next_question": next_q,
        "progress": _progress(session),
    }


@app.get("/api/placement/result/{session_id}")
def placement_result(session_id: str):
    """PT-BR: Resultado final: nível CEFR, quebra por habilidade e relatório da IA.
    EN: Final result: CEFR level, per-skill breakdown, and an AI-generated report."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Sessão não encontrada / Session not found")

    theta, se = irt.estimate_ability(session["responses"])
    level = irt.theta_to_cefr(theta)

    # PT-BR: Quebra por habilidade (gramática/vocabulário/leitura). EN: per-skill breakdown.
    skills = {}
    for h in session["history"]:
        s = skills.setdefault(h["skill"], {"correct": 0, "total": 0})
        s["total"] += 1
        s["correct"] += 1 if h["correct"] else 0

    total_correct = sum(1 for h in session["history"] if h["correct"])

    # PT-BR: Salva a tentativa no histórico (só uma vez por sessão) para a curva de aprendizado.
    # EN: Save the attempt to history (once per session) to build the learning curve.
    if not session.get("saved"):
        db.save_attempt(level, round(theta, 3), round(se, 3), total_correct,
                        len(session["history"]), skills)
        session["saved"] = True

    report = _ai_report(level, se, skills, total_correct, len(session["history"]))

    return {
        "level": level,
        "theta": round(theta, 2),
        "se": round(se, 2),
        "confidence": "alta" if se < 0.5 else ("média" if se < 0.8 else "baixa"),
        "correct": total_correct,
        "total": len(session["history"]),
        "skills": skills,
        "report": report,
    }


@app.get("/api/progress")
def progress():
    """PT-BR: Curva de aprendizado — histórico de tentativas + análise da evolução pela IA.
    EN: Learning curve — attempt history + AI analysis of the learner's evolution."""
    attempts = db.list_attempts()
    profile = db.get_profile()
    practice = db.practice_count()

    # PT-BR: série da evolução (nível/theta ao longo do tempo). EN: evolution series.
    series = [
        {
            "date": a["created_at"][:10],
            "level": a["level"],
            "theta": a["theta"],
            "accuracy": round(100 * a["correct"] / a["total"]) if a["total"] else 0,
            "skills": {k: round(100 * v["correct"] / v["total"]) if v["total"] else 0
                       for k, v in a["skills"].items()},
        }
        for a in attempts
    ]

    # PT-BR: resposta rápida (gráficos). A análise da IA vem no endpoint dedicado abaixo.
    # EN: fast response (charts). The AI analysis is served by the dedicated endpoint below.
    return {
        "attempts": len(series),
        "practice_sessions": practice,
        "series": series,
        "first_level": series[0]["level"] if series else None,
        "latest_level": series[-1]["level"] if series else None,
    }


@app.get("/api/progress/analysis")
def progress_analysis():
    """PT-BR: Análise da curva de aprendizado pela IA (endpoint lento, carregado à parte).
    EN: AI learning-curve analysis (slow endpoint, loaded separately so charts show instantly)."""
    attempts = db.list_attempts()
    profile = db.get_profile()
    practice = db.practice_count()
    series = [
        {
            "date": a["created_at"][:10], "level": a["level"], "accuracy":
            round(100 * a["correct"] / a["total"]) if a["total"] else 0,
            "skills": {k: round(100 * v["correct"] / v["total"]) if v["total"] else 0
                       for k, v in a["skills"].items()},
        }
        for a in attempts
    ]
    if not series:
        return {"analysis": None}
    return {"analysis": _ai_curve_analysis(profile, series, practice)}


def _ai_curve_analysis(profile, series, practice):
    """PT-BR: A IA lê a curva de aprendizado e escreve uma análise da evolução.
    EN: The AI reads the learning curve and writes an evolution analysis."""
    name = (profile or {}).get("name") or "o aluno"
    pts = "; ".join(f"{s['date']} nível {s['level']} ({s['accuracy']}%)" for s in series)
    skill_now = series[-1]["skills"]
    skill_txt = ", ".join(f"{k}: {v}%" for k, v in skill_now.items())
    prompt = (
        f"You are analysing the learning curve of a Brazilian English learner named {name}. "
        f"Placement-test history (oldest to newest): {pts}. "
        f"Latest per-skill accuracy: {skill_txt}. Voice-practice sessions so far: {practice}. "
        f"Write a SHORT analysis in Brazilian Portuguese (max 100 words) addressed to {name} as 'você': "
        f"is progress improving, stable, or dropping? which skill is evolving best and which lags? "
        f"one clear recommendation. Write ONLY the analysis body, no preamble, no headings."
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            raise RuntimeError("offline")
        return ollama_client.chat_once(
            [{"role": "system", "content": "You are a supportive English-learning coach."},
             {"role": "user", "content": prompt}],
            temperature=0.6,
        ).strip()
    except Exception:
        if len(series) < 2:
            return ("Faça o teste algumas vezes ao longo dos dias para eu montar sua curva de "
                    "evolução. (Análise da IA indisponível — verifique o Ollama.)")
        delta = series[-1]["accuracy"] - series[0]["accuracy"]
        tend = "subindo" if delta > 0 else ("estável" if delta == 0 else "caindo")
        return f"Sua tendência de acertos está {tend} ({delta:+d} pontos). Continue praticando!"


def _ai_report(level, se, skills, correct, total):
    """PT-BR: Gera relatório personalizado com a IA (fallback se offline).
    EN: Generate a personalized report with the AI (fallback if offline)."""
    skill_txt = ", ".join(f"{k}: {v['correct']}/{v['total']}" for k, v in skills.items())
    prompt = (
        f"A student just finished an adaptive English placement test. "
        f"Result: CEFR level {level}, score {correct}/{total}, per-skill: {skill_txt}. "
        f"Write a short, encouraging report FOR THE STUDENT in Brazilian Portuguese (max 120 words): "
        f"1) what {level} means in practice, 2) their strongest and weakest skill, "
        f"3) three concrete next steps to reach the next level. Be warm and specific. "
        f"IMPORTANT: write ONLY the report body in Portuguese. No English preamble, no greeting, "
        f"no name placeholder like [Nome], no markdown headings. Start directly with the message. "
        f"Address the student as 'você'."
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            raise RuntimeError("offline")
        return ollama_client.chat_once(
            [
                {"role": "system", "content": "You are a supportive English teacher writing to a Brazilian learner."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        ).strip()
    except Exception:
        return (
            f"Seu nível estimado é **{level}**. Você acertou {correct} de {total} questões. "
            f"Continue praticando com o modo de conversação e revise seus pontos fracos. "
            f"(Relatório da IA indisponível — verifique se o Ollama está rodando.)"
        )


@app.post("/api/chat")
def chat(body: ChatIn):
    """PT-BR: Conversação por voz em tempo real (streaming). O nível CEFR ajusta a fala do professor.
    EN: Real-time voice conversation (streaming). The CEFR level tunes the teacher's speech."""
    # PT-BR: O professor conhece o aluno (nome, objetivo, interesses e nível medido).
    # EN: The teacher knows the student (name, goal, interests, and measured level).
    profile = db.get_profile()
    who = ""
    if profile:
        parts = []
        if profile.get("name"):
            parts.append(f"The learner's name is {profile['name']}")
        if profile.get("goal"):
            parts.append(f"their goal is: {profile['goal']}")
        if profile.get("interests"):
            parts.append(f"their interests: {profile['interests']}")
        if parts:
            who = ". ".join(parts) + ". Use their name naturally and bring up their interests. "

    system = (
        "You are a REAL bilingual English teacher (Portuguese–English) having a spoken conversation. "
        f"{who}"
        f"The learner's CEFR level is {body.level}. Adapt your English vocabulary and grammar to that level.\n"
        "Alternate between the two languages exactly like a real teacher:\n"
        "- TEACH and CONVERSE in ENGLISH: keep the practice immersive, natural, short (1-2 sentences), "
        "and always end with a question in English to keep the learner talking.\n"
        "- CORRECT in PORTUGUESE (português do Brasil): when the learner makes an important mistake, "
        "switch briefly to Portuguese to explain the correction clearly — what was wrong and the correct "
        "form — then switch back to English to continue.\n"
        "Use Portuguese ONLY for corrections/explanations; use English for everything else. "
        "Don't over-correct minor slips. Be warm and encouraging.\n"
        "Format each correction on its own line starting with '📝 (correção): '. The text AFTER "
        "'📝 (correção):' MUST be written in Brazilian Portuguese (never English).\n"
        "Example of a good reply:\n"
        "That sounds fun! What did you eat there?\n"
        "📝 (correção): Em vez de \"I go\", diga \"I went\" — a festa foi no passado."
    )
    messages = [{"role": "system", "content": system}] + body.messages

    # PT-BR: registra a sessão de prática para a curva de aprendizado. EN: log practice.
    try:
        db.log_practice("conversation")
    except Exception:
        pass

    def gen():
        try:
            for chunk in ollama_client.chat_stream(messages, temperature=0.6):
                yield chunk
        except Exception as e:  # PT-BR: nunca falha em silêncio. EN: never fail silently.
            yield f"\n[erro: {e}]"

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


# --------------------------------------------------------------------------- #
# PT-BR: CURSO — módulos, lições, material didático e tarefas. EN: COURSE.
# --------------------------------------------------------------------------- #
def _find_lesson(lesson_id):
    for m in COURSE:
        for les in m["lessons"]:
            if les["id"] == lesson_id:
                return m, les
    return None, None


@app.get("/api/course")
def course():
    """PT-BR: Estrutura do curso + progresso + travas de módulo. EN: Course structure + progress + locks."""
    done = db.get_lesson_progress()
    modules_out = []
    prev_all_done = True  # PT-BR: 1º módulo sempre liberado. EN: first module always unlocked.
    for m in COURSE:
        lesson_ids = [l["id"] for l in m["lessons"]]
        completed = [lid for lid in lesson_ids if lid in done]
        has_content = len(lesson_ids) > 0
        locked = not prev_all_done or not has_content
        modules_out.append({
            "id": m["id"], "title": m["title"], "cefr": m["cefr"],
            "subtitle": m["subtitle"], "color": m.get("color", "#58cc02"),
            "locked": locked, "coming_soon": not has_content,
            "locked_hint": m.get("locked_hint", ""),
            "total": len(lesson_ids), "done": len(completed),
            "lessons": [
                {"id": l["id"], "title": l["title"], "method": l["method"],
                 "minutes": l["minutes"], "can_do": l["can_do"],
                 "done": l["id"] in done, "score": done.get(l["id"], {}).get("score")}
                for l in m["lessons"]
            ],
        })
        # PT-BR: próximo módulo libera quando este é 100% concluído.
        # EN: next module unlocks when this one is fully complete.
        prev_all_done = has_content and len(completed) == len(lesson_ids)
    return {"modules": modules_out}


@app.get("/api/course/lesson/{lesson_id}")
def course_lesson(lesson_id: str):
    """PT-BR: Conteúdo completo da lição (material, vocabulário, exercícios, tarefa). EN: full lesson."""
    _, les = _find_lesson(lesson_id)
    if not les:
        raise HTTPException(404, "Lição não encontrada / Lesson not found")
    return les


@app.post("/api/course/lesson/{lesson_id}/complete")
def course_complete(lesson_id: str, body: CompleteIn):
    """PT-BR: Marca a lição como concluída. EN: Mark the lesson as completed."""
    _, les = _find_lesson(lesson_id)
    if not les:
        raise HTTPException(404, "Lição não encontrada / Lesson not found")
    db.complete_lesson(lesson_id, body.score)
    return {"ok": True}


@app.post("/api/course/task-feedback")
def course_task_feedback(body: TaskFeedbackIn):
    """PT-BR: A IA avalia a TAREFA comunicativa do aluno (Task-Based Learning) e dá feedback.
    EN: The AI evaluates the learner's communicative TASK (TBLT) and gives feedback."""
    _, les = _find_lesson(body.lesson_id)
    if not les:
        raise HTTPException(404, "Lição não encontrada / Lesson not found")
    task = les.get("task", {})
    prompt = (
        f"You are an English teacher grading a spoken/written TASK from a Brazilian learner.\n"
        f"Task (level {les.get('method','')}): {task.get('prompt_en','')}\n"
        f"Success criteria: {task.get('criteria','')}\n"
        f"Learner's answer: \"{body.transcript}\"\n\n"
        f"Reply in Brazilian Portuguese, max 80 words, in this structure:\n"
        f"1) One encouraging sentence. 2) Corrija 1-2 erros mostrando a forma certa em inglês. "
        f"3) Diga se a tarefa foi cumprida (sim/parcialmente). Write ONLY the feedback, no preamble."
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            raise RuntimeError("offline")
        fb = ollama_client.chat_once(
            [{"role": "system", "content": "You are a warm, precise English teacher."},
             {"role": "user", "content": prompt}], temperature=0.5).strip()
    except Exception:
        fb = "Bom trabalho! (Feedback detalhado da IA indisponível — verifique o Ollama.)"
    return {"feedback": fb}


# --------------------------------------------------------------------------- #
# PT-BR: Serve o PWA (deve ficar por último). EN: Serve the PWA (must be last).
# --------------------------------------------------------------------------- #
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
