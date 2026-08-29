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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import irt
import ollama_client

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
ITEMS_PATH = BASE_DIR / "data" / "items.json"

TEST_LENGTH = 20  # PT-BR: nº de questões do teste. EN: number of questions in the test.
START_THETA = -1.0  # PT-BR: começa fácil e sobe progressivamente. EN: start easy, ramp up.

# PT-BR: Carrega o banco de itens uma vez. EN: Load the item bank once.
with open(ITEMS_PATH, encoding="utf-8") as f:
    ITEM_BANK = json.load(f)["items"]

# PT-BR: Estado das sessões em memória. EN: In-memory session state.
SESSIONS = {}

app = FastAPI(title="OpenLingo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"ollama": ok, "model": ollama_client.MODEL, "models": names, "items": len(ITEM_BANK)}


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
    system = (
        "You are the OpenLingo English teacher having a spoken conversation. "
        f"The learner's CEFR level is {body.level}. Adapt your vocabulary and grammar to that level. "
        "Keep replies short (1-3 sentences), natural, and end with a question to keep them talking. "
        "Gently correct only important mistakes."
    )
    messages = [{"role": "system", "content": system}] + body.messages

    def gen():
        try:
            for chunk in ollama_client.chat_stream(messages, temperature=0.6):
                yield chunk
        except Exception as e:  # PT-BR: nunca falha em silêncio. EN: never fail silently.
            yield f"\n[erro: {e}]"

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


# --------------------------------------------------------------------------- #
# PT-BR: Serve o PWA (deve ficar por último). EN: Serve the PWA (must be last).
# --------------------------------------------------------------------------- #
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
