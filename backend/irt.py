"""
PT-BR: Motor de nivelamento adaptativo baseado em Teoria de Resposta ao Item (TRI).
       Usa o modelo de Rasch (1PL) e estimativa EAP (Expected A Posteriori) da habilidade.
       É o mesmo princípio matemático de testes reais (EF SET, Cambridge Linguaskill,
       Duolingo English Test): a dificuldade das questões acompanha a habilidade estimada,
       maximizando a informação a cada item.
EN:    Adaptive placement engine based on Item Response Theory (IRT). Uses the Rasch (1PL)
       model with EAP (Expected A Posteriori) ability estimation — the same math real
       adaptive tests use: item difficulty tracks the estimated ability, maximizing
       Fisher information per item.
"""

import math
import random

# PT-BR: Mapa CEFR -> logit (dificuldade média de cada nível). EN: CEFR -> logit map.
CEFR_LOGITS = {"A1": -2.5, "A2": -1.5, "B1": -0.5, "B2": 0.5, "C1": 1.5, "C2": 2.5}
CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

# PT-BR: Fronteiras de theta para converter habilidade em nível CEFR.
# EN: Theta boundaries to convert ability into a CEFR level.
CEFR_BOUNDS = [
    (-2.0, "A1"),
    (-1.0, "A2"),
    (0.0, "B1"),
    (1.0, "B2"),
    (2.0, "C1"),
    (float("inf"), "C2"),
]

# PT-BR: Grade de theta para a estimativa EAP (integração numérica). EN: theta grid for EAP.
_THETA_GRID = [(-4.0 + i * 0.1) for i in range(81)]  # -4.0 .. 4.0 passo 0.1
_PRIOR_MEAN = 0.0
_PRIOR_SD = 1.5


def prob_correct(theta: float, b: float) -> float:
    """PT-BR: P(acerto) no modelo de Rasch. EN: P(correct) under the Rasch model."""
    return 1.0 / (1.0 + math.exp(-(theta - b)))


def _prior(theta: float) -> float:
    """PT-BR: Densidade normal a priori. EN: Normal prior density."""
    z = (theta - _PRIOR_MEAN) / _PRIOR_SD
    return math.exp(-0.5 * z * z)


def estimate_ability(responses):
    """
    PT-BR: Estima habilidade (theta) e erro-padrão via EAP dado o histórico de respostas.
           'responses' = lista de dicts {'b': float, 'correct': bool}.
    EN:    Estimate ability (theta) and standard error via EAP from the response history.
           'responses' = list of dicts {'b': float, 'correct': bool}.
    """
    if not responses:
        return 0.0, _PRIOR_SD

    num = 0.0   # PT-BR: numerador E[theta]. EN: numerator for E[theta].
    den = 0.0   # PT-BR: normalização (soma das posteriores). EN: normalizer.
    for theta in _THETA_GRID:
        # PT-BR: verossimilhança do padrão de respostas nesse theta.
        # EN: likelihood of the response pattern at this theta.
        like = _prior(theta)
        for r in responses:
            p = prob_correct(theta, r["b"])
            like *= p if r["correct"] else (1.0 - p)
        num += theta * like
        den += like

    if den == 0.0:
        return 0.0, _PRIOR_SD

    mean = num / den
    # PT-BR: variância a posteriori -> erro-padrão. EN: posterior variance -> SE.
    var = 0.0
    for theta in _THETA_GRID:
        like = _prior(theta)
        for r in responses:
            p = prob_correct(theta, r["b"])
            like *= p if r["correct"] else (1.0 - p)
        var += ((theta - mean) ** 2) * like
    var /= den
    return mean, math.sqrt(max(var, 1e-6))


def theta_to_cefr(theta: float) -> str:
    """PT-BR: Converte habilidade em nível CEFR. EN: Convert ability to CEFR level."""
    for bound, level in CEFR_BOUNDS:
        if theta < bound:
            return level
    return "C2"


def cefr_progress(theta: float):
    """
    PT-BR: Retorna nível atual + progresso (0-1) dentro do nível, para a barra de progresso.
    EN:    Returns current level + progress (0-1) within the level, for the progress bar.
    """
    level = theta_to_cefr(theta)
    idx = CEFR_ORDER.index(level)
    lo = -2.5 + idx  # PT-BR: início aproximado do nível. EN: approx. level start.
    frac = max(0.0, min(1.0, (theta - lo) / 1.0))
    return level, round(frac, 2)


def select_next_item(items, used_ids, theta, max_b=None):
    """
    PT-BR: Seleção adaptativa — escolhe o item ainda não usado com dificuldade 'b' mais
           próxima da habilidade atual (máxima informação de Fisher no Rasch).
           'max_b' (opcional) limita a subida: a dificuldade cresce no máximo ~1 nível por
           vez, para o teste aumentar PROGRESSIVAMENTE (sem pular de A2 direto para B2).
           A descida é livre (se a pessoa erra, o teste facilita na hora).
    EN:    Adaptive selection — pick the unused item whose difficulty 'b' is closest to the
           current ability (maximum Fisher information under Rasch). Optional 'max_b' caps how
           fast difficulty may rise (~1 level at a time) so the test ramps up PROGRESSIVELY.
    """
    candidates = [it for it in items if it["id"] not in used_ids]
    if not candidates:
        return None
    if max_b is not None:
        capped = [it for it in candidates if it["b"] <= max_b]
        if capped:  # PT-BR: só aplica o teto se sobrar item. EN: only cap if any remain.
            candidates = capped
    candidates.sort(key=lambda it: abs(it["b"] - theta))
    return candidates[0]
