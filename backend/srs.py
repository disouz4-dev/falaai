"""
PT-BR: Repetição espaçada do Fala A.I., baseada no modelo Half-Life Regression
       (Settles & Meeder, 2016). Cada palavra tem uma "meia-vida" de memória (em dias); a
       probabilidade de lembrar cai como 2^(-Δ/meia-vida). Acertou → a meia-vida cresce
       (revê mais tarde); errou → volta ao início (revê logo).
EN:    Fala A.I. spaced repetition, based on the Half-Life Regression model (Settles &
       Meeder, 2016). Each word has a memory half-life (days); recall probability decays as
       2^(-Δ/half-life). Correct → half-life grows; wrong → resets.
"""

import math
from datetime import datetime, timedelta

import db

MIN_HL = 0.25          # PT-BR: meia-vida mínima ~6h. EN: min half-life ~6h.
MAX_HL = 365.0         # PT-BR: máxima ~1 ano. EN: max ~1 year.
GROWTH = 2.0           # PT-BR: fator de crescimento ao acertar. EN: growth on correct.


def recall_probability(half_life, days_since):
    """PT-BR: p = 2^(-Δ/h). EN: recall probability."""
    if half_life <= 0:
        return 0.0
    return 2 ** (-max(0.0, days_since) / half_life)


def update_half_life(half_life, correct):
    """
    PT-BR: nova meia-vida após a revisão. Acertou multiplica; errou reinicia.
    EN:    new half-life after review. Correct multiplies; wrong resets.
    """
    hl = half_life or MIN_HL
    if correct:
        hl = min(hl * GROWTH, MAX_HL)
    else:
        hl = MIN_HL
    return round(hl, 3)


def next_due(half_life):
    """PT-BR: próximo vencimento = agora + meia-vida (dias). EN: next due = now + half-life days."""
    return (datetime.utcnow() + timedelta(days=half_life)).isoformat()


def seed_lesson_vocab(uid, lesson):
    """PT-BR: cadastra o vocabulário de uma lição no SRS do usuário. EN: register a lesson's vocab in SRS."""
    for v in lesson.get("vocab", []):
        en = (v.get("en") or "").strip()
        pt = (v.get("pt") or "").strip()
        if en:
            db.srs_upsert(uid, en, pt)


def review(uid, term, correct):
    """
    PT-BR: registra uma revisão: recalcula a meia-vida e o próximo vencimento.
    EN:    record a review: recompute half-life and next due.
    """
    due = db.srs_due(uid, limit=1000)
    item = next((d for d in due if d["term"] == term), None)
    hl_old = item["half_life"] if item else MIN_HL
    hl = update_half_life(hl_old, correct)
    db.srs_update(uid, term, hl, correct, next_due(hl))
    return {"term": term, "half_life": hl, "correct": correct}


def due_cards(uid, limit=20):
    """PT-BR: cartões a revisar agora, com prob. de lembrança. EN: cards due now, with recall prob."""
    rows = db.srs_due(uid, limit=limit)
    now = datetime.utcnow()
    cards = []
    for r in rows:
        cards.append({
            "term": r["term"],
            "translation": r["translation"],
            "reps": r["reps"],
            "recall": round(recall_probability(r["half_life"], 0), 2),
        })
    return cards
