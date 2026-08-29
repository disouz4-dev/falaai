import React from "react";

export default function Home({ nav, profile, deferredInstall, onInstall }) {
  return (
    <section className="screen active">
      <div className="hero">
        <div className="hero-mascot">🦜</div>
        <h1>{profile?.name ? `Olá, ${profile.name}! 👋` : "Aprenda inglês do seu jeito"}</h1>
        <p className="subtitle">IA local · seu nível medido com métodos reais (CEFR)</p>
      </div>

      <div className="cards">
        <button className="big-card primary" onClick={() => nav("course")}>
          <span className="bc-icon">📚</span>
          <span className="bc-title">Curso</span>
          <span className="bc-sub">Módulos, lições e tarefas com métodos reais</span>
        </button>
        <button className="big-card" onClick={() => nav("test-intro")}>
          <span className="bc-icon">🎯</span>
          <span className="bc-title">Descobrir meu nível</span>
          <span className="bc-sub">Teste adaptativo de 20 questões</span>
        </button>
        <button className="big-card" onClick={() => nav("talk")}>
          <span className="bc-icon">🎙️</span>
          <span className="bc-title">Conversar (voz)</span>
          <span className="bc-sub">Fale com o professor de IA em tempo real</span>
        </button>
        <button className="big-card" onClick={() => nav("progress")}>
          <span className="bc-icon">📈</span>
          <span className="bc-title">Meu progresso</span>
          <span className="bc-sub">Curva de aprendizado e relatórios gráficos</span>
        </button>
      </div>

      {deferredInstall && (
        <button className="install-btn" onClick={onInstall}>⬇️ Instalar o OpenLingo</button>
      )}
    </section>
  );
}
