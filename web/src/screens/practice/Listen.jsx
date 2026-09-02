import React, { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { playCorrect, playWrong } from "../../sounds.js";

// PT-BR: Ditado — o app fala uma frase (Piper) e você escreve o que ouviu. EN: dictation.
export default function Listen({ back, level }) {
  const [target, setTarget] = useState(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const audioRef = useRef(null);

  async function load() {
    setResult(null); setTyped("");
    const d = await api.get("/api/listen/new?level=" + level);
    setTarget(d.text);
    setTimeout(() => play(d.text), 300);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function play(text) {
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    const a = new Audio("/api/tts?lang=en&text=" + encodeURIComponent(text || target));
    audioRef.current = a;
    a.play().catch(() => {});
  }

  async function check() {
    if (!typed.trim()) return;
    const d = await api.post("/api/listen/check", { target, typed });
    setResult(d);
    if (d.correct) playCorrect(); else playWrong();
  }

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={back}>✕</button>
        <div className="talk-title">🎧 Ditado</div>
      </div>
      <div className="panel">
        <p>Toque no botão, ouça a frase em inglês e escreva exatamente o que você entendeu.</p>
        <button className="btn-primary" onClick={() => play()}>🔊 Ouvir de novo</button>
        <textarea className="task-answer" placeholder="Escreva aqui o que você ouviu…"
          value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!result} />
        {!result ? (
          <button className="btn-primary" onClick={check}>Verificar</button>
        ) : (
          <>
            <div className={"feedback " + (result.correct ? "ok" : "no")} style={{ position: "static" }}>
              <div className="feedback-title">
                {result.correct ? "✓ Perfeito!" : `Quase — ${result.similarity}% de acerto`}
              </div>
              <div className="feedback-exp">Frase correta: <strong>{result.target}</strong></div>
            </div>
            <button className="btn-primary" onClick={load}>Próxima frase</button>
          </>
        )}
        <button className="btn-ghost" onClick={back}>Voltar</button>
      </div>
    </section>
  );
}
