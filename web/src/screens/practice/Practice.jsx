import React, { useEffect, useState } from "react";
import { api } from "../../api.js";
import Srs from "./Srs.jsx";
import Listen from "./Listen.jsx";
import Roleplay from "./Roleplay.jsx";
import Story from "./Story.jsx";
import Pronounce from "./Pronounce.jsx";
import Mistakes from "./Mistakes.jsx";

// PT-BR: Hub de prática — reúne todos os modos de treino. EN: practice hub.
export default function Practice({ nav, profile }) {
  const [mode, setMode] = useState("menu");
  const [srsStats, setSrsStats] = useState(null);
  const [mistakes, setMistakes] = useState(null);
  const level = localStorage.getItem("falaai_level") || "B1";

  useEffect(() => {
    if (mode !== "menu") return;
    api.get("/api/srs").then((d) => setSrsStats(d.stats)).catch(() => {});
    api.get("/api/mistakes").then((d) => setMistakes(d.count)).catch(() => {});
  }, [mode]);

  if (mode === "srs") return <Srs back={() => setMode("menu")} />;
  if (mode === "listen") return <Listen back={() => setMode("menu")} level={level} />;
  if (mode === "roleplay") return <Roleplay back={() => setMode("menu")} level={level} />;
  if (mode === "story") return <Story back={() => setMode("menu")} level={level} />;
  if (mode === "pronounce") return <Pronounce back={() => setMode("menu")} level={level} />;
  if (mode === "mistakes") return <Mistakes back={() => setMode("menu")} level={level} />;

  const card = (id, emoji, title, sub, badge) => (
    <button className="big-card" onClick={() => setMode(id)}>
      <span className="bc-icon">{emoji}</span>
      <span className="bc-title">{title}{badge ? <span className="prac-badge">{badge}</span> : null}</span>
      <span className="bc-sub">{sub}</span>
    </button>
  );

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={() => nav("home")}>✕</button>
        <div className="talk-title">🏋️ Praticar</div>
      </div>
      <p className="course-intro">Revisão inteligente, escuta, conversa guiada e pronúncia — métodos reais.</p>
      <div className="cards">
        {card("srs", "🔁", "Revisão (SRS)", "Repetição espaçada do vocabulário",
          srsStats?.due ? `${srsStats.due} p/ revisar` : null)}
        {card("listen", "🎧", "Ditado", "Ouça e escreva o que entendeu")}
        {card("pronounce", "🗣️", "Pronúncia", "Leia a frase em voz alta e receba a nota")}
        {card("roleplay", "🎭", "Roleplay", "Conversas com objetivo (café, hotel, entrevista)")}
        {card("story", "📖", "Histórias", "Mini-histórias no seu nível, com áudio")}
        {card("mistakes", "🩹", "Revisar erros", "Refaça o que você errou",
          mistakes ? `${mistakes}` : null)}
      </div>
    </section>
  );
}
