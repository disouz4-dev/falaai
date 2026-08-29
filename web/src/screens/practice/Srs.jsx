import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

// PT-BR: Revisão espaçada — cartões de vocabulário (mostra a palavra, você diz se lembrou).
// EN: Spaced review — vocabulary flashcards.
export default function Srs({ back }) {
  const [cards, setCards] = useState(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    api.get("/api/srs").then((d) => setCards(d.cards)).catch(() => setCards([]));
  }, []);

  function grade(correct) {
    const card = cards[i];
    api.post("/api/srs/review", { term: card.term, correct }).catch(() => {});
    setDone(done + 1);
    setRevealed(false);
    setI(i + 1);
  }

  function play(term) {
    new Audio("/api/tts?lang=en&text=" + encodeURIComponent(term)).play().catch(() => {});
  }

  const header = (
    <div className="talk-header">
      <button className="icon-btn" title="Voltar" onClick={back}>✕</button>
      <div className="talk-title">🔁 Revisão</div>
    </div>
  );

  if (cards == null)
    return <section className="screen active">{header}<p className="course-intro">Carregando…</p></section>;

  if (cards.length === 0 || i >= cards.length)
    return (
      <section className="screen active">{header}
        <div className="lesson-done-card">
          <div className="big-emoji">{done ? "🎉" : "✅"}</div>
          <h2>{done ? "Revisão concluída!" : "Nada para revisar agora"}</h2>
          <p className="result-score">
            {done ? `Você revisou ${done} palavra(s). Volte depois para fixar mais.`
                  : "Complete lições para adicionar vocabulário à revisão."}
          </p>
          <button className="btn-primary" onClick={back}>Voltar</button>
        </div>
      </section>
    );

  const card = cards[i];
  return (
    <section className="screen active">{header}
      <div className="progress-wrap" style={{ margin: "0 8px 20px" }}>
        <div className="progress-bar"><div className="progress-fill" style={{ width: (i / cards.length) * 100 + "%" }} /></div>
      </div>
      <div className="flashcard">
        <div className="fc-term">{card.term}
          <button className="replay" title="Ouvir" onClick={() => play(card.term)}>🔊</button>
        </div>
        {revealed ? (
          <div className="fc-translation">{card.translation || "—"}</div>
        ) : (
          <button className="btn-ghost" onClick={() => setRevealed(true)}>Mostrar tradução</button>
        )}
      </div>
      {revealed && (
        <div className="fc-actions">
          <button className="opt wrong" onClick={() => grade(false)}>Não lembrei</button>
          <button className="opt correct" onClick={() => grade(true)}>Acertei ✓</button>
        </div>
      )}
    </section>
  );
}
