import React, { useEffect, useRef, useState } from "react";
import { speak, stopSpeaking, createRecognizer } from "../speech.js";

const WELCOME = "Hi! I'm your English teacher. What would you like to talk about today?";

export default function Talk({ nav }) {
  const [msgs, setMsgs] = useState([]);
  const [level, setLevel] = useState(localStorage.getItem("guaralingo_level") || "B1");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState("Segure o microfone para falar");
  const [supported, setSupported] = useState(true);
  const [muted, setMuted] = useState(false);

  const historyRef = useRef([]);
  const recogRef = useRef(null);
  const logRef = useRef(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  const scroll = () => requestAnimationFrame(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  });

  useEffect(() => {
    const rec = createRecognizer({
      onListening: (on) => {
        setListening(on);
        setHint(on ? "🔴 Ouvindo… solte para enviar" : "Segure o microfone para falar");
      },
      onResult: (text) => handleSpeech(text),
      onError: (err) => setHint("Erro no microfone: " + err),
    });
    recogRef.current = rec;
    setSupported(rec.supported);
    if (!rec.supported) setHint("Seu navegador não suporta reconhecimento de voz (use Chrome).");
    // PT-BR: boas-vindas faladas. EN: spoken welcome.
    setMsgs([{ role: "bot", text: WELCOME }]);
    if (!muted) speak(WELCOME);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSpeech(text) {
    setMsgs((m) => [...m, { role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
    scroll();
    reply();
  }

  async function reply() {
    setThinking(true);
    setHint("O professor está pensando…");
    let botIndex = -1;
    setMsgs((m) => { botIndex = m.length; return [...m, { role: "bot", text: "" }]; });

    let full = "";
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyRef.current, level: levelRef.current }),
      });
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMsgs((m) => m.map((msg, i) => (i === botIndex ? { ...msg, text: full } : msg)));
        scroll();
      }
    } catch {
      full = "[erro de conexão]";
      setMsgs((m) => m.map((msg, i) => (i === botIndex ? { ...msg, text: full } : msg)));
    }
    historyRef.current.push({ role: "assistant", content: full });
    setThinking(false);
    setHint("Segure o microfone para falar");
    if (!muted) speak(full);
  }

  const micClass = "mic-btn" + (listening ? " listening" : thinking ? " thinking" : "");

  return (
    <section className="screen active" id="screen-talk">
      <div className="talk-header">
        <select className="level-select" title="Seu nível" value={level}
          onChange={(e) => setLevel(e.target.value)}>
          {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}
        </select>
        <div className="talk-title">🎙️ Conversação</div>
        <button className="icon-btn" title="Sair" onClick={() => nav("home")}>✕</button>
      </div>

      <div className="talk-log" ref={logRef}>
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div className="bubble user" key={i}>{m.text}</div>
          ) : (
            <div className="bubble bot" key={i}>
              <span className="btxt">{m.text}</span>
              {m.text && (
                <button className="replay" title="Ouvir" onClick={() => speak(m.text)}>🔊</button>
              )}
            </div>
          )
        )}
      </div>

      <div className="talk-controls">
        <div className="talk-hint">{hint}</div>
        <button
          className={micClass}
          title="Segure para falar, solte para enviar"
          disabled={!supported}
          onPointerDown={(e) => { e.preventDefault(); recogRef.current?.start(); }}
          onPointerUp={(e) => { e.preventDefault(); recogRef.current?.stop(); }}
          onPointerLeave={() => recogRef.current?.stop()}
          onContextMenu={(e) => e.preventDefault()}
        >🎤</button>
        <button className={muted ? "btn-ghost mute-on" : "btn-primary mute-off"}
          onClick={() => { setMuted(!muted); stopSpeaking(); }}>
          {muted ? "Desmutar" : "Mutar"}
        </button>
      </div>
    </section>
  );
}
