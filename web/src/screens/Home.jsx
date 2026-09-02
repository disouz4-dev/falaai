import React from "react";

export default function Home({
  nav, profile, deferredInstall, onInstall,
  update, checking, recheck, isLocalhost, updating, onUpdate,
}) {
  return (
    <section className="screen active">
      <div className="hero">
        <img src="/falaai.png" alt="Fala A.I." className="hero-logo" />
        <h1>{profile?.name ? `Olá, ${profile.name}! 👋` : "Aprenda inglês do seu jeito"}</h1>
        <p className="subtitle">IA local · seu nível medido com métodos reais (CEFR)</p>
      </div>

      <div className="cards">
        <button className="big-card primary" onClick={() => nav("test-intro")}>
          <span className="bc-icon">🎯</span>
          <span className="bc-title">Descobrir meu nível</span>
          <span className="bc-sub">Teste adaptativo de 20 questões</span>
        </button>
        <button className="big-card" onClick={() => nav("course")}>
          <span className="bc-icon">📚</span>
          <span className="bc-title">Curso</span>
          <span className="bc-sub">Módulos, lições e tarefas com métodos reais</span>
        </button>
        <button className="big-card" onClick={() => nav("talk")}>
          <span className="bc-icon">🎙️</span>
          <span className="bc-title">Conversar (voz)</span>
          <span className="bc-sub">Fale com o professor de IA em tempo real</span>
        </button>
        <button className="big-card" onClick={() => nav("practice")}>
          <span className="bc-icon">🏋️</span>
          <span className="bc-title">Praticar</span>
          <span className="bc-sub">Revisão (SRS), ditado, pronúncia, roleplay e histórias</span>
        </button>
        <button className="big-card" onClick={() => nav("progress")}>
          <span className="bc-icon">📈</span>
          <span className="bc-title">Meu progresso</span>
          <span className="bc-sub">Curva de aprendizado e relatórios gráficos</span>
        </button>
      </div>

      {deferredInstall && (
        <button className="install-btn" onClick={onInstall}>⬇️ Instalar o Fala A.I.</button>
      )}

      {/* PT-BR: status de versão sempre visível. EN: always-visible version status. */}
      <div className="version-box">
        {!update ? (
          <span className="ver-line">Verificando versão…</span>
        ) : update.update_available ? (
          <div className="ver-line ver-update">
            <span>🎉 Nova versão <strong>{update.latest}</strong> disponível (você tem a {update.current})</span>
            {isLocalhost ? (
              <button className="update-btn" disabled={updating} onClick={onUpdate}>
                {updating ? "Atualizando…" : "Atualizar"}
              </button>
            ) : (
              <span className="update-hint">Atualize pelo computador que roda o servidor.</span>
            )}
          </div>
        ) : (
          <span className="ver-line ver-ok">
            ✓ Fala A.I. <strong>v{update.current}</strong> — você está na versão mais atual
          </span>
        )}
      </div>
    </section>
  );
}
