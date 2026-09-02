import React, { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { playCorrect, playWrong } from "../../sounds.js";

// PT-BR: Histórias — a IA cria uma mini-história no seu nível, com áudio e perguntas. EN: stories.
export default function Story({ back, level }) {
  const [story, setStory] = useState(null);
  const [answers, setAnswers] = useState({});
  const audioRef = useRef(null);

  async function load() {
    setStory(null); setAnswers({});
    const d = await api.get("/api/story?level=" + level);
    setStory(d);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function play() {
    if (!story) return;
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    const a = new Audio("/api/tts?lang=en&text=" + encodeURIComponent(story.text));
    audioRef.current = a;
    a.play().catch(() => {});
  }

  const header = (
    <div className="talk-header">
      <button className="icon-btn" title="Voltar" onClick={back}>✕</button>
      <div className="talk-title">📖 Histórias</div>
    </div>
  );

  if (!story)
    return <section className="screen active">{header}<p className="course-intro">Gerando história…</p></section>;

  return (
    <section className="screen active">{header}
      <div className="panel">
        <h2>{story.title}</h2>
        <button className="btn-primary" onClick={play}>🔊 Ouvir a história</button>
        <p className="material" style={{ marginTop: 12 }}>{story.text}</p>

        {story.questions?.length > 0 && <h3 style={{ marginTop: 18 }}>Perguntas</h3>}
        {story.questions?.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <div key={qi} style={{ marginBottom: 16 }}>
              <div className="q-text" style={{ fontSize: 16 }}>{q.q}</div>
              <div className="options">
                {q.options.map((opt, oi) => {
                  let cls = "opt";
                  if (chosen !== undefined) {
                    if (oi === q.answer) cls += " correct";
                    else if (oi === chosen) cls += " wrong";
                  }
                  return (
                    <button key={oi} className={cls} disabled={chosen !== undefined}
                      onClick={() => { setAnswers({ ...answers, [qi]: oi }); (oi === q.answer ? playCorrect() : playWrong()); }}>{opt}</button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button className="btn-primary" onClick={load}>Nova história</button>
        <button className="btn-ghost" onClick={back}>Voltar</button>
      </div>
    </section>
  );
}
