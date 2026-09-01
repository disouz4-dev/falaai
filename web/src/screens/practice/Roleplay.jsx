import React, { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { speak, stopSpeaking, createRecognizer } from "../../speech.js";

// PT-BR: Roleplay — conversa com objetivo (café, hotel, entrevista) + feedback da IA.
// EN: Roleplay — goal-oriented conversation with AI feedback.
export default function Roleplay({ back, level }) {
  const [scenarios, setScenarios] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [ending, setEnding] = useState(false);
  const [muted, setMuted] = useState(false);
  const historyRef = useRef([]);
  const recogRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    api.get("/api/roleplay/scenarios").then((d) => setScenarios(d.scenarios)).catch(() => setScenarios([]));
    return () => stopSpeaking();
  }, []);

  const scroll = () => requestAnimationFrame(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  });

  async function pick(sc) {
    const op = await api.get("/api/roleplay/opening/" + sc.id);
    setScenario({ ...sc, ...op });
    setMsgs([{ role: "bot", text: op.opening }]);
    historyRef.current = [{ role: "assistant", content: op.opening }];
    if (!muted) speak(op.opening);
    recogRef.current = createRecognizer({
      onListening: setListening,
      onResult: (text) => handleSpeech(text),
    });
  }

  function handleSpeech(text) {
    setMsgs((m) => [...m, { role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
    scroll();
    reply();
  }

  async function reply() {
    setThinking(true);
    let bi = -1;
    setMsgs((m) => { bi = m.length; return [...m, { role: "bot", text: "" }]; });
    let full = "";
    try {
      const r = await fetch("/api/roleplay/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenario.id, messages: historyRef.current, level }),
      });
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMsgs((m) => m.map((x, i) => (i === bi ? { ...x, text: full } : x)));
        scroll();
      }
    } catch { full = "[erro]"; }
    historyRef.current.push({ role: "assistant", content: full });
    setThinking(false);
    if (!muted) speak(full);
  }

  async function endRoleplay() {
    setEnding(true);
    stopSpeaking();
    const d = await api.post("/api/roleplay/feedback", {
      scenario_id: scenario.id, messages: historyRef.current, level,
    });
    setFeedback(d.feedback);
  }

  const header = (t) => (
    <div className="talk-header">
      <button className="icon-btn" title="Voltar" onClick={back}>✕</button>
      <div className="talk-title">🎭 {t}</div>
    </div>
  );

  // --- lista de cenários ---
  if (!scenario) {
    return (
      <section className="screen active">{header("Roleplay")}
        <p className="course-intro">Escolha uma situação e converse com o personagem para cumprir o objetivo.</p>
        <div className="cards">
          {scenarios?.map((s) => (
            <button className="big-card" key={s.id} onClick={() => pick(s)}>
              <span className="bc-icon">{s.emoji}</span>
              <span className="bc-title">{s.title}</span>
              <span className="bc-sub">Nível {s.level}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // --- feedback final ---
  if (feedback) {
    return (
      <section className="screen active">{header(scenario.title)}
        <div className="report-card"><h3>🧑‍🏫 Feedback</h3>
          <div className="report-text">{feedback}</div>
        </div>
        <button className="btn-primary" onClick={() => { setScenario(null); setFeedback(null); setMsgs([]); }}>
          Outro cenário
        </button>
        <button className="btn-ghost" onClick={back}>Voltar</button>
      </section>
    );
  }

  // --- conversa ---
  return (
    <section className="screen active" id="screen-talk">
      {header(scenario.title)}
      <div className="task-box" style={{ margin: "0 0 8px" }}>
        <div className="task-label">🎯 Objetivo</div>
        <div>{scenario.goal}</div>
      </div>
      <div className="talk-log" ref={logRef}>
        {msgs.map((m, i) => m.role === "user" ? (
          <div className="bubble user" key={i}>{m.text}</div>
        ) : (
          <div className="bubble bot" key={i}>
            <span className="btxt">{m.text}</span>
            {m.text && <button className="replay" title="Ouvir" onClick={() => speak(m.text)}>🔊</button>}
          </div>
        ))}
      </div>
      <div className="talk-controls">
        <div className="talk-hint">{listening ? "🔴 Ouvindo… solte para enviar" : thinking ? "…" : "Segure o microfone para falar"}</div>
        <button className={"mic-btn" + (listening ? " listening" : thinking ? " thinking" : "")}
          onPointerDown={(e) => { e.preventDefault(); recogRef.current?.start(); }}
          onPointerUp={(e) => { e.preventDefault(); recogRef.current?.stop(); }}
          onPointerLeave={() => recogRef.current?.stop()}
          onContextMenu={(e) => e.preventDefault()}
        >🎤</button>
        <button className={muted ? "btn-ghost mute-on" : "btn-primary mute-off"}
          onClick={() => { setMuted(!muted); stopSpeaking(); }}>
          {muted ? "Desmutar" : "Mutar"}
        </button>
        <button className="btn-ghost" disabled={ending} onClick={endRoleplay}>
          {ending ? "Avaliando…" : "Encerrar e ver feedback"}
        </button>
      </div>
    </section>
  );
}
