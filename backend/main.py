"""
PT-BR: Fala A.I. — backend FastAPI.
       Serve o PWA e expõe a API do teste de nivelamento adaptativo (CEFR/TRI) e do
       modo de conversação por voz em tempo real (streaming via Ollama).
EN:    Fala A.I. — FastAPI backend.
       Serves the PWA and exposes the adaptive placement-test API (CEFR/IRT) and the
       real-time voice conversation mode (streaming via Ollama).
"""

import json
import os
import uuid
import hashlib
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import threading

import auth
import db
import gpu
import irt
import mdns
import memory
import ollama_client
import srs
import tts
import version

# PT-BR: detecta a GPU no início e ajusta o Ollama (preferência GPU, fallback CPU).
# EN: detect the GPU at startup and tune Ollama (prefer GPU, fall back to CPU).
GPU_INFO = gpu.apply_env()
print(f"[Fala A.I.] Aceleração: {GPU_INFO['device'].upper()} — {GPU_INFO['reason']}")

BASE_DIR = Path(__file__).resolve().parent
# PT-BR: frontend React compilado (web/dist). EN: compiled React frontend (web/dist).
FRONTEND_DIR = BASE_DIR.parent / "web" / "dist"
ITEMS_PATH = BASE_DIR / "data" / "items.json"
# PT-BR: arquivo que guarda a identidade local do app desktop (persistente entre execuções).
#        Usa o diretório de dados (gravável), que respeita FALA_AI_DATA_DIR no app desktop.
# EN: file that persists the local desktop identity across runs. Uses the data dir (writable),
#     which honors FALA_AI_DATA_DIR in the desktop app.
LOCAL_USER_PATH = Path(db.data_dir()) / "local_user.json"

TEST_LENGTH = 20  # PT-BR: nº de questões do teste. EN: number of questions in the test.
START_THETA = -1.0  # PT-BR: começa fácil e sobe progressivamente. EN: start easy, ramp up.

# PT-BR: Carrega o banco de itens uma vez. EN: Load the item bank once.
with open(ITEMS_PATH, encoding="utf-8") as f:
    ITEM_BANK = json.load(f)["items"]

# PT-BR: Carrega o currículo do curso. EN: Load the course curriculum.
COURSE_PATH = BASE_DIR / "data" / "course.json"
with open(COURSE_PATH, encoding="utf-8") as f:
    COURSES = json.load(f)["courses"]

def _get_course(course_id):
    for c in COURSES:
        if c["id"] == course_id:
            return c
    return None

def _get_module(course, module_id):
    for m in course.get("modules", []):
        if m["id"] == module_id:
            return m
    return None

# PT-BR: Auxiliar de prova adaptativa por módulo (reusa o banco IRT).
# EN:    Adaptive exam helper per module (reuses the IRT item bank).
def _exam_items(course, module, count):
    """PT-BR: sorteia itens do banco calibrados ao nível CEFR do módulo.
    EN: pick items from the IRT bank tuned to the module's CEFR level."""
    items = [it for it in ITEM_BANK if it.get("level") == module.get("cefr")]
    if len(items) < count:
        items = [it for it in ITEM_BANK if it.get("b", 0) >= -3.0]
    import random
    chosen = random.sample(items, min(count, len(items)))
    # PT-BR: embaralha as opções, recordando a posição da correta.
    # EN: shuffle options, keep the position of the correct answer.
    out = []
    for it in chosen:
        opts = list(it["options"])
        ans = it["answer"]  # PT-BR: índice da correta (int). EN: index of the correct one (int).
        idxs = list(range(len(opts)))
        random.shuffle(idxs)
        new_opts = [opts[i] for i in idxs]
        new_ans = idxs.index(ans)
        out.append({
            "id": it["id"], "skill": it.get("skill", "grammar"),
            "question": it["question"], "options": new_opts,
            "answer": new_ans, "target": it.get("target", ""),
        })
    return out

# PT-BR: Estado das sessões em memória. EN: In-memory session state.
SESSIONS = {}

# PT-BR: Inicializa o banco local (perfil + histórico). EN: init local DB (profile + history).
db.init_db()
# PT-BR: Garante o vault de memória do professor. EN: ensure the teacher's memory vault.
memory.ensure_vault()

app = FastAPI(title="Fala A.I. API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# PT-BR: nome amigável na rede (falaai.local). EN: friendly network name (falaai.local).
FRIENDLY_URL = None


@app.on_event("startup")
def _start_mdns():
    """PT-BR: anuncia 'falaai.local' na rede via mDNS. EN: advertise 'falaai.local' via mDNS."""
    global FRIENDLY_URL
    if os.environ.get("FALA_AI_MDNS", "1") == "0":
        return  # PT-BR: mDNS desativado (ex.: ambientes restritos). EN: mDNS disabled.
    port = int(os.environ.get("FALA_AI_PORT", "8000"))
    https = os.environ.get("FALA_AI_HTTPS", "0") == "1"
    FRIENDLY_URL = mdns.start(port=port, https=https)
    if FRIENDLY_URL:
        print(f"[Fala A.I.] Acesse pela rede em: {FRIENDLY_URL}")


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
    gender_preference: str = "female"  # "female" = professora, "male" = professor


class LoginLocalIn(BaseModel):
    name: str = ""
    password: str = ""


class CompleteIn(BaseModel):
    score: int = 100


class ExamSubmitIn(BaseModel):
    score: int


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
# PT-BR: Dependência que valida o token local e devolve o usuário logado.
# EN:    Dependency that validates the local token and returns the logged-in user.
def get_current_user(authorization: str = Header(None)):  # noqa: E501
    try:
        return auth.get_uid_from_header(authorization)
    except ValueError as e:
        raise HTTPException(401, f"Autenticação requerida / Authentication required: {e}")


@app.get("/api/health")
def health():
    ok, names = ollama_client.is_available()
    return {"ollama": ok, "model": ollama_client.MODEL, "models": names,
            "items": len(ITEM_BANK), "tts": tts.available(), "tts_engine": tts.engine_name(),
            "gpu": GPU_INFO, "version": version.current()}


@app.get("/api/version")
def get_version(force: bool = False):
    """PT-BR: versão atual + checagem de atualização no GitHub. EN: current version + GitHub update check."""
    return version.check(force=force)


@app.post("/api/update")
def do_update(request: Request):
    """PT-BR: atualiza o app — no modo NAVEGADOR faz git pull + rebuild + reinício;
    no modo DESKTOP baixa o novo .deb da release e instala por cima (dpkg -i).
    SÓ pelo próprio computador (localhost), nunca pela rede.
    EN: app update — in BROWSER mode does git pull + rebuild + restart; in DESKTOP mode
    downloads the new .deb from the release and installs it over the current one (dpkg -i).
    Only allowed from the host machine (localhost), never remotely."""
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(403, "Atualização só é permitida no próprio computador (localhost).")
    if os.environ.get("FALA_AI_DESKTOP", "0") == "1":
        return version.perform_update_desktop()
    return version.perform_update()


@app.get("/api/tts")
def text_to_speech(text: str = Query(..., min_length=1), lang: str = Query("en"), gender: str = Query("female")):
    """PT-BR: Gera o áudio (WAV) da fala do professor no servidor, no idioma e gênero pedido (en/pt + gênero).
    Tocado pelo app em qualquer aparelho. EN: Server-side speech audio in given language and gender."""
    audio = tts.synth(text, lang=lang, gender=gender)
    if not audio:
        raise HTTPException(503, "TTS indisponível / TTS unavailable")
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# --------------------------------------------------------------------------- #
# PT-BR: Login LOCAL (modo app desktop, offline). EN: LOCAL login (desktop app).
# --------------------------------------------------------------------------- #
def _get_or_create_local_user():
    """PT-BR: devolve o uid local persistente, criando na 1ª vez. EN: return the persistent
    local uid, creating it on first use."""
    try:
        if LOCAL_USER_PATH.exists():
            data = json.loads(LOCAL_USER_PATH.read_text(encoding="utf-8"))
            if data.get("uid"):
                return data["uid"]
    except Exception:
        pass
    uid = "local-" + uuid.uuid4().hex[:16]
    try:
        LOCAL_USER_PATH.parent.mkdir(parents=True, exist_ok=True)
        LOCAL_USER_PATH.write_text(json.dumps({"uid": uid}), encoding="utf-8")
    except Exception:
        pass
    return uid


@app.get("/api/users")
def list_users():
    """PT-BR: usuários locais cadastrados (para o pick list da tela de login).
    EN: registered local users (for the login screen pick list)."""
    return {"users": db.list_profiles()}


@app.post("/api/login")
def login_local(body: LoginLocalIn):
    """PT-BR: login local do app desktop. Cada NOME é uma conta própria (com sua senha).
    Cria a conta na 1ª vez, verifica a senha nas seguintes, e devolve o token.
    EN: local login for the desktop app. Each NAME is its own account (with own password).
    Creates the account on first use, verifies the password afterwards, returns a token."""
    name = (body.name or "").strip()
    uid = _get_or_create_local_user()

    # PT-BR: se veio um nome, resolvemos a conta POR NOME (pick list / múltiplos usuários).
    #        O uid da 1ª conta legada (local_user.json) é reaproveitado quando o nome bate,
    #        para não perder progresso de quem já usava o app. EN: if a name was provided,
    #        resolve the account BY NAME. Legacy single-user uid is reused when name matches.
    if name:
        prof = db.get_profile_by_name(name)
        if prof:
            uid = prof["uid"]
        else:
            # PT-BR: nova conta → uid estável derivado do nome. EN: new account → stable uid.
            uid = "local-" + hashlib.sha256(name.lower().encode()).hexdigest()[:16]
    else:
        prof = db.get_profile(uid)

    created = False
    if prof:
        if prof.get("password_hash"):
            if not body.password:
                raise HTTPException(status_code=401, detail="Senha necessária")
            if not db.verify_password(uid, body.password):
                raise HTTPException(status_code=401, detail="Senha incorreta")
    else:
        # PT-BR: primeira vez — cria a conta com o nome escolhido. EN: first time — create account.
        created = True
        name = name or "Aluno(a)"
        prof = db.upsert_profile(uid, name, "Português (Brasil)", "", "", "female",
                                 email="", picture="",
                                 password=body.password if body.password else None)
        if not prof.get("password_hash") and body.password:
            prof = db.upsert_profile(uid, name, "Português (Brasil)", "", "", "female",
                                     email="", picture="", password=body.password)

    token = auth.create_local_token(uid, name=prof.get("name", name), email=prof.get("email"),
                                    picture=prof.get("picture"))
    return {
        "token": token,
        "user": {"uid": uid, "name": prof.get("name"), "email": prof.get("email"),
                 "picture": prof.get("picture"), "local": True},
        "profile": prof,
        "created": created,
    }


# --------------------------------------------------------------------------- #
# PT-BR: Perfil do aluno. EN: Learner profile.
# --------------------------------------------------------------------------- #
@app.get("/api/profile")
def get_profile(user: dict = Depends(get_current_user)):
    return {"profile": db.get_profile(user["uid"])}


@app.post("/api/profile")
def save_profile(p: ProfileIn, user: dict = Depends(get_current_user)):
    prof = db.upsert_profile(user["uid"], p.name.strip(), p.native_lang, p.goal.strip(),
                             p.interests.strip(), p.gender_preference,
                             email=user.get("email"), picture=user.get("picture"))
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
def placement_answer(ans: AnswerIn, user: dict = Depends(get_current_user)):
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
    # PT-BR: registra o erro para o hub de revisão. EN: log the mistake for the review hub.
    if not correct:
        try:
            db.log_mistake(user["uid"], "teste", item["skill"], item["question"],
                           item["options"][item["answer"]],
                           item["options"][ans.choice] if 0 <= ans.choice < len(item["options"]) else "",
                           item.get("explanation_pt", ""))
        except Exception:
            pass
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
def placement_result(session_id: str, user: dict = Depends(get_current_user)):
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
        db.save_attempt(user["uid"], level, round(theta, 3), round(se, 3), total_correct,
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
def progress(user: dict = Depends(get_current_user)):
    """PT-BR: Curva de aprendizado — histórico de tentativas + análise da evolução pela IA.
    EN: Learning curve — attempt history + AI analysis of the learner's evolution."""
    attempts = db.list_attempts(user["uid"])
    profile = db.get_profile(user["uid"])
    practice = db.practice_count(user["uid"])

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
def progress_analysis(user: dict = Depends(get_current_user)):
    """PT-BR: Análise da curva de aprendizado pela IA (endpoint lento, carregado à parte).
    EN: AI learning-curve analysis (slow endpoint, loaded separately so charts show instantly)."""
    attempts = db.list_attempts(user["uid"])
    profile = db.get_profile(user["uid"])
    practice = db.practice_count(user["uid"])
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


# PT-BR: A memória do professor é INTERNA — não há endpoint para o aluno acessá-la.
#        Ela é lida no prompt e escrita pela extração, só no backend. O vault fica em disco
#        (backend/data/memory/) para o dono do sistema inspecionar, nunca exposto pela API.
# EN: The teacher's memory is INTERNAL — no endpoint exposes it to the student. It is read into
#     the prompt and written by the extractor, backend-only. The vault stays on disk.
@app.post("/api/chat")
def chat(body: ChatIn, user: dict = Depends(get_current_user)):
    """PT-BR: Conversação por voz em tempo real (streaming). O nível CEFR ajusta a fala do professor.
    EN: Real-time voice conversation (streaming). The CEFR level tunes the teacher's speech."""
    # PT-BR: O professor conhece o aluno (nome, objetivo, interesses, nível e gênero medido).
    # EN: The teacher knows the student (name, goal, interests, level, and gender).
    profile = db.get_profile(user["uid"])
    who = ""
    if profile:
        parts = []
        if profile.get("name"):
            parts.append(f"The learner's name is {profile['name']}")
        if profile.get("goal"):
            parts.append(f"their goal is: {profile['goal']}")
        if profile.get("interests"):
            parts.append(f"their interests: {profile['interests']}")
        if profile.get("gender_preference"):
            gp = profile["gender_preference"]
            who = f"The teacher is a {'professor' if gp == 'male' else 'professora'}. Adapt your tone accordingly. "
            who += ". ".join(parts) + ". Use their name naturally and bring up their interests. "
        else:
            who = ". ".join(parts) + ". Use their name naturally and bring up their interests. "

        # PT-BR: memória permanente do professor (vault .md) — detalhes, brincadeiras, gírias.
        # EN: teacher's permanent memory (md vault) — details, inside jokes, slang.
        mem = memory.load_context(user["uid"])
        mem_block = ""
        if mem:
            mem_block = (
                "\nWHAT YOU REMEMBER ABOUT THIS STUDENT (use it naturally, like an old friend — "
                "bring up their life, reuse your inside jokes, and mirror their slang; never read it "
                "back as a list):\n" + mem + "\n"
            )

        system = (
            "You are a REAL bilingual English teacher (Portuguese–English) having a spoken conversation. "
            "Be warm, funny and human — like a friend who happens to teach English. Joke around, react, "
            "show you remember past conversations. "
            f"{who}{mem_block}"
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
            db.log_practice(user["uid"], "conversation")
        except Exception:
            pass

        # PT-BR: extrai memórias da última fala do aluno em segundo plano (não atrasa a resposta).
        # EN: extract memories from the student's last message in the background (non-blocking).
        last_user = next((m.get("content", "") for m in reversed(body.messages)
                          if m.get("role") == "user"), "")
        if last_user:
            threading.Thread(target=memory.extract_and_store,
                             args=(user["uid"], last_user), daemon=True).start()

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
    for c in COURSES:
        for m in c.get("modules", []):
            for les in m["lessons"]:
                if les["id"] == lesson_id:
                    return c, m, les
    return None, None, None


# --------------------------------------------------------------------------- #
# PT-BR: Catálogo de cursos + matrícula + progresso por curso (com provas).
# EN:    Course catalog + enrollment + per-course progress (with exams).
# --------------------------------------------------------------------------- #
@app.get("/api/courses")
def courses_list(user: dict = Depends(get_current_user)):
    """PT-BR: catálogo de cursos com estado de matrícula/progresso do usuário.
    EN: course catalog with the user's enrollment/progress state."""
    enrolled = {e["course_id"] for e in db.get_enrolled_courses(user["uid"])}
    done = db.get_lesson_progress(user["uid"])
    out = []
    for c in COURSES:
        modules = c.get("modules", [])
        total_lessons = sum(len(m.get("lessons", [])) for m in modules)
        done_lessons = sum(1 for m in modules
                           for l in m.get("lessons", []) if l["id"] in done)
        out.append({
            "id": c["id"], "title": c["title"], "subtitle": c.get("subtitle", ""),
            "color": c.get("color", "#FFDF00"),
            "passing_score": c.get("passing_score", 70),
            "total_modules": len(modules), "total_lessons": total_lessons,
            "done_lessons": done_lessons,
            "is_enrolled": c["id"] in enrolled,
            "certificate": db.has_certificate(user["uid"], c["id"], "", "course"),
        })
    return {"courses": out}


@app.post("/api/courses/{course_id}/enroll")
def course_enroll(course_id: str, user: dict = Depends(get_current_user)):
    """PT-BR: matricula o usuário no curso. EN: enroll the user in a course."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    db.enroll(user["uid"], course_id)
    return {"ok": True}


@app.get("/api/courses/{course_id}")
def course_detail(course_id: str, user: dict = Depends(get_current_user)):
    """PT-BR: estrutura + progresso + travas por prova e certificados do curso.
    EN: structure + progress + exam locks and certificates for the course."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    done = db.get_lesson_progress(user["uid"])
    prev_passed = True  # PT-BR: 1º módulo liberado. EN: first module unlocked.
    modules_out = []
    for m in c.get("modules", []):
        lesson_ids = [l["id"] for l in m.get("lessons", [])]
        completed = [lid for lid in lesson_ids if lid in done]
        has_content = len(lesson_ids) > 0
        all_lessons_done = has_content and len(completed) == len(lesson_ids)
        exam = db.latest_exam_result(user["uid"], course_id, m["id"])
        passed = bool(exam and exam["passed"])
        locked = not prev_passed or not has_content
        # PT-BR: a prova libera quando todas as lições do módulo estão concluídas.
        # EN: exam unlocks when all lessons in the module are done.
        exam_unlocked = not locked and all_lessons_done
        cert = db.has_certificate(user["uid"], course_id, m["id"], "module")
        modules_out.append({
            "id": m["id"], "title": m["title"], "cefr": m["cefr"],
            "subtitle": m["subtitle"], "color": m.get("color", "#58cc02"),
            "exam": m.get("exam", {}),
            "locked": locked, "coming_soon": not has_content,
            "locked_hint": m.get("locked_hint", ""),
            "exam_unlocked": exam_unlocked,
            "passed": passed, "best_score": (exam or {}).get("score"),
            "certificate": cert,
            "total": len(lesson_ids), "done": len(completed),
            "lessons": [
                {"id": l["id"], "title": l["title"], "method": l["method"],
                 "minutes": l["minutes"], "can_do": l["can_do"],
                 "done": l["id"] in done, "score": done.get(l["id"], {}).get("score")}
                for l in m.get("lessons", [])
            ],
        })
        # PT-BR: próximo módulo libera apenas se o atual teve prova APROVADA.
        # EN: next module unlocks only if the current one PASSED its exam.
        prev_passed = has_content and passed

    final_passed = all(mod["passed"] for mod in modules_out if not mod["coming_soon"]) \
        if modules_out else False
    return {
        "id": c["id"], "title": c["title"], "subtitle": c.get("subtitle", ""),
        "color": c.get("color", "#FFDF00"),
        "passing_score": c.get("passing_score", 70),
        "final_exam": c.get("final_exam", {}),
        "final_passed": final_passed,
        "course_certificate": db.has_certificate(user["uid"], course_id, "", "course"),
        "modules": modules_out,
    }


@app.get("/api/course/lesson/{lesson_id}")
def course_lesson(lesson_id: str):
    """PT-BR: Conteúdo completo da lição (material, vocabulário, exercícios, tarefa). EN: full lesson."""
    _, _, les = _find_lesson(lesson_id)
    if not les:
        raise HTTPException(404, "Lição não encontrada / Lesson not found")
    return les


@app.post("/api/course/lesson/{lesson_id}/complete")
def course_complete(lesson_id: str, body: CompleteIn, user: dict = Depends(get_current_user)):
    """PT-BR: Marca a lição como concluída. EN: Mark the lesson as completed."""
    _, _, les = _find_lesson(lesson_id)
    if not les:
        raise HTTPException(404, "Lição não encontrada / Lesson not found")
    db.complete_lesson(user["uid"], lesson_id, body.score)
    # PT-BR: adiciona o vocabulário da lição ao SRS (repetição espaçada). EN: add vocab to SRS.
    try:
        srs.seed_lesson_vocab(user["uid"], les)
    except Exception:
        pass
    return {"ok": True}


# --------------------------------------------------------------------------- #
# PT-BR: Provas de módulo e prova final (com aprovação) + certificados.
# EN:    Module exams and final exam (pass/fail) + certificates.
# --------------------------------------------------------------------------- #
@app.post("/api/courses/{course_id}/module/{module_id}/exam/start")
def exam_start(course_id: str, module_id: str, user: dict = Depends(get_current_user)):
    """PT-BR: inicia a prova de um módulo (gera questões adaptativas). EN: start a module exam."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    m = _get_module(c, module_id)
    if not m:
        raise HTTPException(404, "Módulo não encontrado / Module not found")
    count = m.get("exam", {}).get("num_questions", 8)
    return {"module_id": module_id, "name": m.get("exam", {}).get("name", "Prova de módulo"),
            "cefr": m.get("cefr", ""), "passing_score": m.get("exam", {}).get("passing_score", 70),
            "questions": _exam_items(c, m, count)}


@app.post("/api/courses/{course_id}/module/{module_id}/exam/result")
def exam_result(course_id: str, module_id: str, body: ExamSubmitIn, user: dict = Depends(get_current_user)):
    """PT-BR: registra nota final da prova do módulo e emite certificado se aprovado.
    EN: record the module exam final score and issue certificate if passed."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    m = _get_module(c, module_id)
    if not m:
        raise HTTPException(404, "Módulo não encontrado / Module not found")
    passing = m.get("exam", {}).get("passing_score", c.get("passing_score", 70))
    score = body.score
    passed = score >= passing
    attempt = db.exam_attempts(user["uid"], course_id, module_id) + 1
    db.save_exam_result(user["uid"], course_id, module_id, score, passed, attempt)
    cert = None
    if passed:
        cert = db.issue_certificate(user["uid"], course_id, module_id, "module")
    return {"score": score, "passing": passing, "passed": passed, "attempt": attempt, "certificate": cert}


@app.post("/api/courses/{course_id}/exam/start")
def course_exam_start(course_id: str, user: dict = Depends(get_current_user)):
    """PT-BR: inicia a PROVA FINAL do curso (itens de todos os módulos/CEFR).
    EN: starts the FINAL course exam (items across all modules/CEFR)."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    modules = c.get("modules", [])
    for m in modules:
        if m.get("lessons"):
            ex = db.latest_exam_result(user["uid"], course_id, m["id"])
            if not ex or not ex["passed"]:
                raise HTTPException(400, "Conclua e aprove todas as provas dos módulos primeiro.")
    count = c.get("final_exam", {}).get("num_questions", 12)
    pool = [it for it in ITEM_BANK]
    import random
    chosen = random.sample(pool, min(count, len(pool)))
    questions = []
    for it in chosen:
        opts = list(it["options"])
        ans = it["answer"]  # PT-BR: índice da correta (int). EN: index of the correct one (int).
        idxs = list(range(len(opts)))
        random.shuffle(idxs)
        new_opts = [opts[i] for i in idxs]
        new_ans = idxs.index(ans)
        questions.append({
            "id": it["id"], "skill": it.get("skill", "grammar"),
            "question": it["question"], "options": new_opts,
            "answer": new_ans, "target": it.get("target", ""),
        })
    return {"course_id": course_id, "name": c.get("final_exam", {}).get("name", "Prova Final"),
            "passing_score": c.get("final_exam", {}).get("passing_score", c.get("passing_score", 70)),
            "questions": questions}


@app.post("/api/courses/{course_id}/exam/result")
def course_exam_result(course_id: str, body: ExamSubmitIn, user: dict = Depends(get_current_user)):
    """PT-BR: registra a PROVA FINAL do curso, exige todos os módulos aprovados.
    EN: record the FINAL course exam; requires all modules passed."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    modules = c.get("modules", [])
    for m in modules:
        if m.get("lessons"):
            ex = db.latest_exam_result(user["uid"], course_id, m["id"])
            if not ex or not ex["passed"]:
                raise HTTPException(400, "Conclua e aprove todas as provas dos módulos primeiro.")
    passing = c.get("final_exam", {}).get("passing_score", c.get("passing_score", 70))
    score = body.score
    passed = score >= passing
    db.save_exam_result(user["uid"], course_id, "final", score, passed, db.exam_attempts(user["uid"], course_id, "final") + 1)
    cert = None
    if passed:
        cert = db.issue_certificate(user["uid"], course_id, "", "course")
    return {"score": score, "passing": passing, "passed": passed, "certificate": cert}


@app.get("/api/courses/{course_id}/certificate")
def course_certificate(course_id: str, user: dict = Depends(get_current_user)):
    """PT-BR: dados do certificado do curso (questionamento; só se emitido).
    EN: course certificate payload (only if issued)."""
    c = _get_course(course_id)
    if not c:
        raise HTTPException(404, "Curso não encontrado / Course not found")
    cert = db.has_certificate(user["uid"], course_id, "", "course")
    if not cert:
        raise HTTPException(404, "Certificado ainda não emitido / Certificate not issued yet")
    prof = db.get_profile(user["uid"]) or {}
    return {"type": "course", "course": c["title"], "student": prof.get("name", "Aluno"),
            "credential_id": cert["credential_id"], "issued_at": cert["issued_at"]}


@app.get("/api/courses/{course_id}/module/{module_id}/certificate")
def module_certificate(course_id: str, module_id: str, user: dict = Depends(get_current_user)):
    """PT-BR: dados do certificado do módulo. EN: module certificate payload."""
    c = _get_course(course_id)
    m = _get_module(c, module_id) if c else None
    if not m:
        raise HTTPException(404, "Módulo não encontrado / Module not found")
    cert = db.has_certificate(user["uid"], course_id, module_id, "module")
    if not cert:
        raise HTTPException(404, "Certificado ainda não emitido / Certificate not issued yet")
    prof = db.get_profile(user["uid"]) or {}
    return {"type": "module", "course": c["title"], "module": m["title"], "cefr": m.get("cefr", ""),
            "student": prof.get("name", "Aluno"),
            "credential_id": cert["credential_id"], "issued_at": cert["issued_at"]}


@app.post("/api/course/task-feedback")
def course_task_feedback(body: TaskFeedbackIn):
    """PT-BR: A IA avalia a TAREFA comunicativa do aluno (Task-Based Learning) e dá feedback.
    EN: The AI evaluates the learner's communicative TASK (TBLT) and gives feedback."""
    _, _, les = _find_lesson(body.lesson_id)
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


# =========================================================================== #
# PT-BR: FEATURES DE PRÁTICA — SRS, explicar erro, ditado, roleplay,
#        histórias, hub de erros e pronúncia. EN: Practice features.
# =========================================================================== #
import re as _re
import difflib


def _norm(s):
    """PT-BR: normaliza texto p/ comparar (minúsculas, sem pontuação). EN: normalize text for compare."""
    return _re.sub(r"[^a-z0-9' ]", "", (s or "").lower()).strip()


def _similarity(a, b):
    """PT-BR: similaridade 0-100 entre duas frases (por palavra). EN: 0-100 word similarity."""
    wa, wb = _norm(a).split(), _norm(b).split()
    if not wa and not wb:
        return 100
    ratio = difflib.SequenceMatcher(None, wa, wb).ratio()
    return round(ratio * 100)


# ---------- SRS de vocabulário ----------
class SrsReviewIn(BaseModel):
    term: str
    correct: bool


@app.get("/api/srs")
def srs_due(user: dict = Depends(get_current_user)):
    """PT-BR: cartões de vocabulário a revisar agora + estatísticas. EN: due SRS cards + stats."""
    return {"cards": srs.due_cards(user["uid"], limit=20), "stats": db.srs_stats(user["uid"])}


@app.post("/api/srs/review")
def srs_review(r: SrsReviewIn, user: dict = Depends(get_current_user)):
    """PT-BR: registra a revisão de um cartão (acertou/errou). EN: record a card review."""
    return srs.review(user["uid"], r.term, r.correct)


# ---------- Explique meu erro ----------
class ExplainIn(BaseModel):
    question: str
    correct: str
    given: str = ""
    level: str = "B1"


@app.post("/api/explain")
def explain_answer(x: ExplainIn):
    """PT-BR: a IA explica em profundidade por que a resposta certa é aquela. EN: AI 'explain my answer'."""
    prompt = (
        f"An English learner (CEFR {x.level}) answered a question.\n"
        f"Question: {x.question}\nCorrect answer: {x.correct}\n"
        + (f"Their answer: {x.given}\n" if x.given else "")
        + "Explain in Brazilian Portuguese (max 90 words), warmly and clearly: WHY the correct "
        "answer is right (the grammar/vocabulary rule), and if their answer is given, why it's "
        "wrong. End with a tiny example in English. Write only the explanation."
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            raise RuntimeError("offline")
        txt = ollama_client.chat_once(
            [{"role": "system", "content": "You are a clear, kind English teacher."},
             {"role": "user", "content": prompt}], temperature=0.5).strip()
    except Exception:
        txt = "Explicação da IA indisponível — verifique se o Ollama está rodando."
    return {"explanation": txt}


# ---------- Ditado / escuta (Listen & Type) ----------
_LISTEN_BANK = {
    "A1": ["My name is Anna.", "I have two cats.", "She is from Brazil.", "We go to school.",
           "The book is on the table.", "I like coffee in the morning."],
    "A2": ["Yesterday I went to the park.", "She is taller than her brother.",
           "We are going to travel next week.", "I have never eaten sushi."],
    "B1": ["If it rains, we will stay at home.", "I have been working here for five years.",
           "She said she would call me later.", "You should try to speak every day."],
    "B2": ["The bridge was built more than a century ago.", "Had I known, I would have helped you.",
           "Despite the rain, they finished the hike.", "The report will be sent tomorrow."],
    "C1": ["Never have I seen such a beautiful sunset.", "What we need is a little more time.",
           "The evidence lends weight to his theory.", "Were I you, I would apologise."],
    "C2": ["The negotiations reached an impasse neither side could break.",
           "For all his talent, he never fulfilled his promise."],
}


@app.get("/api/listen/new")
def listen_new(level: str = "B1"):
    """PT-BR: sorteia uma frase para ditado (o áudio vem de /api/tts). EN: pick a dictation sentence."""
    import random
    bank = _LISTEN_BANK.get(level) or _LISTEN_BANK["B1"]
    return {"text": random.choice(bank), "level": level}


class ListenCheckIn(BaseModel):
    target: str
    typed: str


@app.post("/api/listen/check")
def listen_check(c: ListenCheckIn, user: dict = Depends(get_current_user)):
    """PT-BR: compara o que o aluno digitou com a frase falada. EN: compare typed vs spoken sentence."""
    sim = _similarity(c.target, c.typed)
    correct = sim >= 90
    if not correct:
        db.log_mistake(user["uid"], "ditado", "listening", c.target, c.target, c.typed, "")
    return {"similarity": sim, "correct": correct, "target": c.target}


# ---------- Roleplay (cenários) ----------
_SCENARIOS = [
    {"id": "cafe", "emoji": "☕", "title": "Pedir num café", "level": "A2",
     "setting": "You are a friendly barista at a coffee shop in London. The learner is a customer.",
     "goal": "order a drink and something to eat, and ask the price",
     "opening": "Hi there! Welcome to the café. What can I get for you today?"},
    {"id": "hotel", "emoji": "🏨", "title": "Check-in no hotel", "level": "B1",
     "setting": "You are a hotel receptionist. The learner is a guest checking in.",
     "goal": "check in, give their name, and ask about breakfast and wifi",
     "opening": "Good evening, welcome to the Grand Hotel! Do you have a reservation with us?"},
    {"id": "interview", "emoji": "💼", "title": "Entrevista de emprego", "level": "B2",
     "setting": "You are a hiring manager interviewing the learner for a job.",
     "goal": "introduce themselves, talk about their experience and answer questions",
     "opening": "Thanks for coming in today. So, tell me a little about yourself and your background."},
    {"id": "directions", "emoji": "🗺️", "title": "Pedir informação na rua", "level": "A2",
     "setting": "You are a local on the street. The learner is a tourist who is lost.",
     "goal": "ask for directions to a place and understand the answer",
     "opening": "Hello! You look a bit lost — do you need any help finding something?"},
]


@app.get("/api/roleplay/scenarios")
def roleplay_scenarios():
    return {"scenarios": [{k: s[k] for k in ("id", "emoji", "title", "level")} for s in _SCENARIOS]}


class RoleplayIn(BaseModel):
    scenario_id: str
    messages: list = []
    level: str = "B1"


def _scenario(sid):
    return next((s for s in _SCENARIOS if s["id"] == sid), None)


@app.post("/api/roleplay/chat")
def roleplay_chat(body: RoleplayIn):
    """PT-BR: conversa de roleplay em streaming, no papel do cenário. EN: streaming roleplay chat."""
    sc = _scenario(body.scenario_id)
    if not sc:
        raise HTTPException(404, "Cenário não encontrado / Scenario not found")
    system = (
        f"You are roleplaying. {sc['setting']} Stay fully in character and speak only English at "
        f"the learner's CEFR level ({body.level}). Keep replies short (1-2 sentences) and natural, "
        f"and guide the learner toward the goal: they should {sc['goal']}. Do not break character."
    )
    messages = [{"role": "system", "content": system}] + body.messages

    def gen():
        try:
            for chunk in ollama_client.chat_stream(messages, temperature=0.6):
                yield chunk
        except Exception as e:
            yield f"\n[erro: {e}]"
    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


@app.post("/api/roleplay/feedback")
def roleplay_feedback(body: RoleplayIn):
    """PT-BR: feedback da IA ao fim do roleplay (precisão, vocabulário, dica). EN: end-of-roleplay feedback."""
    sc = _scenario(body.scenario_id)
    convo = "\n".join(f"{m.get('role')}: {m.get('content')}" for m in body.messages
                      if m.get("role") in ("user", "assistant"))
    prompt = (
        f"A learner just finished a roleplay ({sc['title'] if sc else ''}). Conversation:\n{convo}\n\n"
        "Give short feedback in Brazilian Portuguese (max 90 words): 1) one thing they did well, "
        "2) correct 1-2 important mistakes (show the right English), 3) whether they achieved the goal. "
        "Write only the feedback."
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            raise RuntimeError("offline")
        fb = ollama_client.chat_once(
            [{"role": "system", "content": "You are a warm English teacher."},
             {"role": "user", "content": prompt}], temperature=0.5).strip()
    except Exception:
        fb = "Bom trabalho! (Feedback da IA indisponível.)"
    return {"feedback": fb}


@app.get("/api/roleplay/opening/{sid}")
def roleplay_opening(sid: str):
    sc = _scenario(sid)
    if not sc:
        raise HTTPException(404, "Cenário não encontrado")
    return {"opening": sc["opening"], "title": sc["title"], "goal": sc["goal"]}


# ---------- Histórias com áudio (Stories / DuoRadio) ----------
@app.get("/api/story")
def story(level: str = "B1", topic: str = "", user: dict = Depends(get_current_user)):
    """PT-BR: a IA cria uma mini-história no nível + perguntas de compreensão. EN: AI mini-story + questions."""
    prof = db.get_profile(user["uid"])
    interests = (prof or {}).get("interests", "")
    theme = topic or interests or "everyday life"
    prompt = (
        f"Write a SHORT, simple English story (CEFR {level}, 5-7 sentences) about {theme}. "
        "Then write 3 comprehension questions about it. Return ONLY strict JSON: "
        '{"title": "...", "text": "...", "questions": [{"q":"...","options":["..","..","..",".."],"answer":0}]}. '
        "Options in English; 'answer' is the index of the correct option."
    )
    try:
        ok, _ = ollama_client.is_available()
        if not ok:
            raise RuntimeError("offline")
        raw = ollama_client.chat_once(
            [{"role": "system", "content": "You write graded readers and output strict JSON."},
             {"role": "user", "content": prompt}], temperature=0.7)
        raw = _re.sub(r"^```(json)?|```$", "", raw.strip(), flags=_re.MULTILINE).strip()
        s, e = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[s:e + 1])
        data.setdefault("questions", [])
        return data
    except Exception:
        return {"title": "História indisponível",
                "text": "Não foi possível gerar a história agora (verifique o Ollama).",
                "questions": []}


# ---------- Hub de revisão de erros ----------
class MistakeIn(BaseModel):
    source: str = "lição"
    skill: str = "grammar"
    question: str
    correct: str
    given: str = ""
    explanation: str = ""


@app.post("/api/mistakes/log")
def mistakes_log(m: MistakeIn, user: dict = Depends(get_current_user)):
    """PT-BR: registra um erro (chamado pelas lições no cliente). EN: log a mistake (called by lessons)."""
    db.log_mistake(user["uid"], m.source, m.skill, m.question, m.correct, m.given, m.explanation)
    return {"ok": True}


@app.get("/api/mistakes")
def mistakes_list(user: dict = Depends(get_current_user)):
    return {"mistakes": db.list_mistakes(user["uid"], limit=30), "count": db.mistakes_count(user["uid"])}


@app.post("/api/mistakes/{mid}/resolve")
def mistakes_resolve(mid: int, user: dict = Depends(get_current_user)):
    db.resolve_mistake(user["uid"], mid)
    return {"ok": True}


# ---------- Nota de pronúncia ----------
class PronounceIn(BaseModel):
    target: str
    heard: str


@app.post("/api/pronounce/check")
def pronounce_check(p: PronounceIn):
    """PT-BR: pontua a pronúncia comparando a frase-alvo com o que foi reconhecido. EN: pronunciation score."""
    score = _similarity(p.target, p.heard)
    tw, hw = _norm(p.target).split(), _norm(p.heard).split()
    hset = set(hw)
    missed = [w for w in tw if w not in hset]  # PT-BR: palavras não reconhecidas. EN: words not recognized.
    return {"score": score, "missed": missed, "target": p.target, "heard": p.heard}


# --------------------------------------------------------------------------- #
# PT-BR: Serve o frontend React compilado (deve ficar por último). EN: Serve the built React app.
# --------------------------------------------------------------------------- #
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
else:
    @app.get("/")
    def _needs_build():
        # PT-BR: frontend ainda não compilado. EN: frontend not built yet.
        return {
            "message": "Frontend React não compilado.",
            "fix": "Rode ./run.sh (compila automaticamente) ou: cd web && npm install && npm run build",
        }
