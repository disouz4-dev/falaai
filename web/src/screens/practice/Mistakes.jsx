import React, { useEffect, useState } from "react";
import { api, mdLite } from "../../api.js";

// PT-BR: Hub de revisão — seus erros do teste e das lições, com "Explique meu erro". EN: mistakes hub.
export default function Mistakes({ back, level }) {
  const [items, setItems] = useState(null);
  const [explain, setExplain] = useState({}); // id -> texto
  const [loading, setLoading] = useState({}); // id -> bool

  useEffect(() => {
    api.get("/api/mistakes").then((d) => setItems(d.mistakes)).catch(() => setItems([]));
  }, []);

  async function askExplain(m) {
    setLoading((s) => ({ ...s, [m.id]: true }));
    try {
      const d = await api.post("/api/explain", {
        question: m.question, correct: m.correct_answer, given: m.given_answer, level,
      });
      setExplain((s) => ({ ...s, [m.id]: d.explanation }));
    } catch { setExplain((s) => ({ ...s, [m.id]: "Não foi possível explicar agora." })); }
    setLoading((s) => ({ ...s, [m.id]: false }));
  }

  async function resolve(id) {
    await api.post("/api/mistakes/" + id + "/resolve").catch(() => {});
    setItems((it) => it.filter((m) => m.id !== id));
  }

  const header = (
    <div className="talk-header">
      <button className="icon-btn" title="Voltar" onClick={back}>✕</button>
      <div className="talk-title">🩹 Revisar erros</div>
    </div>
  );

  if (items == null)
    return <section className="screen active">{header}<p className="course-intro">Carregando…</p></section>;

  if (items.length === 0)
    return (
      <section className="screen active">{header}
        <div className="lesson-done-card">
          <div className="big-emoji">✨</div>
          <h2>Nenhum erro pendente!</h2>
          <p className="result-score">Faça o teste ou lições — o que você errar aparece aqui para revisar.</p>
          <button className="btn-primary" onClick={back}>Voltar</button>
        </div>
      </section>
    );

  return (
    <section className="screen active">{header}
      <p className="course-intro">Reveja o que você errou. Toque em "Explique meu erro" para a IA detalhar.</p>
      {items.map((m) => (
        <div className="mistake-card" key={m.id}>
          <div className="mk-src">{m.source} · {m.skill}</div>
          <div className="mk-q">{m.question}</div>
          <div className="mk-line"><span className="mk-ok">✓ {m.correct_answer}</span></div>
          {m.given_answer && <div className="mk-line"><span className="mk-bad">✗ {m.given_answer}</span></div>}
          {explain[m.id] && (
            <div className="task-feedback" dangerouslySetInnerHTML={{ __html: "🧑‍🏫 " + mdLite(explain[m.id]) }} />
          )}
          <div className="mk-actions">
            {!explain[m.id] && (
              <button className="btn-ghost" disabled={loading[m.id]} onClick={() => askExplain(m)}>
                {loading[m.id] ? "Explicando…" : "💡 Explique meu erro"}
              </button>
            )}
            <button className="btn-ghost" onClick={() => resolve(m.id)}>✓ Revisado</button>
          </div>
        </div>
      ))}
      <button className="btn-primary" onClick={back}>Voltar</button>
    </section>
  );
}
