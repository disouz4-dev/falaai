import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Course({ nav }) {
  const [modules, setModules] = useState(null);

  useEffect(() => {
    api.get("/api/course").then((d) => setModules(d.modules)).catch(() => setModules([]));
  }, []);

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={() => nav("home")}>✕</button>
        <div className="talk-title">📚 Curso de Inglês</div>
      </div>
      <p className="course-intro">
        Baseado em métodos reais: CEFR · Comunicativo (CLT) · Task-Based · Abordagem Lexical · Repetição Espaçada.
      </p>

      <div className="modules-list">
        {modules == null && <p className="course-intro">Carregando…</p>}
        {modules?.map((m) => {
          const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
          return (
            <div className={"module" + (m.locked ? " locked" : "")} key={m.id}>
              <div className="module-head" style={{ background: m.color }}>
                <div className="mh-top"><span>MÓDULO · {m.cefr}</span><span>{m.done}/{m.total}</span></div>
                <h3>{m.title}</h3>
                <div className="mh-sub">{m.subtitle}</div>
                <div className="module-bar"><div style={{ width: pct + "%" }} /></div>
              </div>

              {m.coming_soon ? (
                <div className="coming-soon">🚧 Em breve</div>
              ) : m.locked ? (
                <div className="module-locked-msg">🔒 {m.locked_hint || "Bloqueado"}</div>
              ) : (
                <div className="lesson-list">
                  {m.lessons.map((l) => (
                    <button className="lesson-item" key={l.id} onClick={() => nav("lesson", l.id)}>
                      <span className={"lesson-dot" + (l.done ? " done" : "")}>{l.done ? "✓" : "▶"}</span>
                      <span className="lesson-meta">
                        <span className="lm-title">{l.title}</span>
                        <span className="lm-sub">{l.method} · {l.minutes} min · {l.can_do}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
