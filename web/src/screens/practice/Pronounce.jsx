import React, { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { createRecognizer } from "../../speech.js";

// PT-BR: Pronúncia — leia a frase em voz alta; a nota vem da comparação com o reconhecido.
// EN: Pronunciation — read the phrase aloud; score by comparing with what was recognized.
export default function Pronounce({ back, level }) {
  const [target, setTarget] = useState(null);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);
  const recogRef = useRef(null);
  const targetRef = useRef(null);
  targetRef.current = target;

  async function load() {
    setResult(null);
    const d = await api.get("/api/listen/new?level=" + level);
    setTarget(d.text);
  }

  useEffect(() => {
    load();
    // PT-BR: um único reconhecedor; usa targetRef p/ sempre pegar a frase atual. EN: single recognizer.
    recogRef.current = createRecognizer({
      onListening: setListening,
      onResult: async (heard) => {
        const d = await api.post("/api/pronounce/check", { target: targetRef.current, heard });
        setResult(d);
      },
    });
    // eslint-disable-next-line
  }, []);

  const scoreColor = result
    ? result.score >= 85 ? "var(--green-dark)" : result.score >= 60 ? "var(--yellow)" : "var(--red)"
    : "";

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={back}>✕</button>
        <div className="talk-title">🗣️ Pronúncia</div>
      </div>
      <div className="panel" style={{ textAlign: "center" }}>
        <p className="subtitle">Segure o microfone e leia a frase em inglês:</p>
        <h2 className="q-text" style={{ textAlign: "center" }}>{target || "…"}</h2>

        {result && (
          <div style={{ margin: "12px 0" }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: scoreColor }}>{result.score}%</div>
            {result.missed?.length > 0 && (
              <div className="feedback-exp">Revise: <strong>{result.missed.join(", ")}</strong></div>
            )}
            <div className="feedback-exp en">Reconhecido: "{result.heard}"</div>
          </div>
        )}

        <button
          className={"mic-btn" + (listening ? " listening" : "")}
          onPointerDown={(e) => { e.preventDefault(); recogRef.current?.start(); }}
          onPointerUp={(e) => { e.preventDefault(); recogRef.current?.stop(); }}
          onPointerLeave={() => recogRef.current?.stop()}
          onContextMenu={(e) => e.preventDefault()}
        >🎤</button>
        <div className="talk-hint">{listening ? "🔴 Ouvindo… solte ao terminar" : "Segure para ler em voz alta"}</div>

        <button className="btn-primary" onClick={load}>Próxima frase</button>
        <button className="btn-ghost" onClick={back}>Voltar</button>
      </div>
    </section>
  );
}
