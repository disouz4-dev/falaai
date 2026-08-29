import React, { useState } from "react";
import { api, skillLabel, mdLite } from "../api.js";

export default function Placement({ nav }) {
  const [phase, setPhase] = useState("intro"); // intro | test | result
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState({ answered: 0, total: 20, level: "—" });
  const [feedback, setFeedback] = useState(null); // {correct, correct_index, explanation_pt/en, done, next_question}
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [explain, setExplain] = useState(null);
  const [explaining, setExplaining] = useState(false);

  async function askExplain() {
    setExplaining(true);
    try {
      const d = await api.post("/api/explain", {
        question: question.question,
        correct: question.options[feedback.correct_index],
        given: question.options[selected],
        level: progress.level && progress.level !== "—" ? progress.level : "B1",
      });
      setExplain(d.explanation);
    } catch { setExplain("Não foi possível explicar agora."); }
    setExplaining(false);
  }

  async function start() {
    const d = await api.post("/api/placement/start");
    setSession(d.session_id);
    setQuestion(d.question);
    setProgress(d.progress);
    setFeedback(null);
    setSelected(null);
    setResult(null);
    setPhase("test");
  }

  async function answer(choice) {
    if (feedback) return;
    setSelected(choice);
    const d = await api.post("/api/placement/answer", {
      session_id: session, item_id: question.id, choice,
    });
    setFeedback(d);
    setProgress(d.progress);
  }

  async function next() {
    if (feedback.done) return finish();
    setQuestion(feedback.next_question);
    setFeedback(null);
    setSelected(null);
    setExplain(null);
  }

  async function finish() {
    setPhase("result");
    setResult(null);
    const d = await api.get("/api/placement/result/" + session);
    localStorage.setItem("openlingo_level", d.level);
    setResult(d);
  }

  if (phase === "intro") {
    return (
      <section className="screen active">
        <div className="panel">
          <h2>🎯 Teste de nivelamento</h2>
          <p>
            São <strong>20 questões</strong> que se ajustam ao seu desempenho: acertou, fica mais
            difícil; errou, fica mais fácil. Ao final você recebe seu nível <strong>CEFR (A1 a C2)</strong> e
            um plano de estudo da IA.
          </p>
          <ul className="method-list">
            <li>📐 Baseado em <strong>Teoria de Resposta ao Item (Rasch)</strong></li>
            <li>🌍 Escala oficial <strong>CEFR</strong> (Quadro Europeu Comum)</li>
            <li>🧠 Mede gramática, vocabulário e leitura</li>
          </ul>
          <button className="btn-primary" onClick={start}>Começar</button>
          <button className="btn-ghost" onClick={() => nav("home")}>Voltar</button>
        </div>
      </section>
    );
  }

  if (phase === "test" && question) {
    const pct = ((progress.answered || 0) / (progress.total || 20)) * 100;
    return (
      <section className="screen active">
        <div className="test-header">
          <button className="icon-btn" title="Sair" onClick={() => nav("home")}>✕</button>
          <div className="progress-wrap">
            <div className="progress-bar"><div className="progress-fill" style={{ width: pct + "%" }} /></div>
          </div>
          <div className="level-chip">{progress.level && progress.level !== "—" ? progress.level : "—"}</div>
        </div>

        <div className="test-body">
          <div className="q-skill">{skillLabel(question.skill) + " · " + question.level}</div>
          <h2 className="q-text">{question.question}</h2>
          <div className="options">
            {question.options.map((opt, i) => {
              let cls = "opt";
              if (feedback) {
                if (i === feedback.correct_index) cls += " correct";
                else if (i === selected) cls += " wrong";
              }
              return (
                <button key={i} className={cls} disabled={!!feedback} onClick={() => answer(i)}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {feedback && (
          <div className={"feedback " + (feedback.correct ? "ok" : "no")}>
            <div className="feedback-title">{feedback.correct ? "✓ Correto!" : "✗ Não foi dessa vez"}</div>
            <div className="feedback-exp">
              {feedback.explanation_pt}
              <br />
              <span className="en">{feedback.explanation_en}</span>
            </div>
            {explain && (
              <div className="task-feedback" dangerouslySetInnerHTML={{ __html: "🧑‍🏫 " + mdLite(explain) }} />
            )}
            {!feedback.correct && !explain && (
              <button className="btn-ghost" disabled={explaining} onClick={askExplain}>
                {explaining ? "Explicando…" : "💡 Explique meu erro"}
              </button>
            )}
            <button className="btn-primary" onClick={next}>Continuar</button>
          </div>
        )}
      </section>
    );
  }

  // phase === "result"
  return (
    <section className="screen active">
      <div className="result-body">
        <div className="cefr-badge">{result?.level || "--"}</div>
        <h2>Seu nível</h2>
        <p className="result-score">
          {result ? `${result.correct}/${result.total} acertos · confiança ${result.confidence}` : ""}
        </p>
        <div className="skill-bars">
          {result &&
            Object.entries(result.skills).map(([name, s]) => {
              const p = Math.round((s.correct / s.total) * 100);
              return (
                <div className="skill-row" key={name}>
                  <div className="lbl"><span>{skillLabel(name)}</span><span>{s.correct}/{s.total}</span></div>
                  <div className="skill-track"><div className="skill-val" style={{ width: p + "%" }} /></div>
                </div>
              );
            })}
        </div>
        <div className="report-card">
          <h3>📋 Plano da IA</h3>
          <div className="report-text"
            dangerouslySetInnerHTML={{ __html: result ? mdLite(result.report) : "Gerando relatório…" }} />
        </div>
        <button className="btn-primary" onClick={() => nav("talk")}>🎙️ Praticar conversando</button>
        <button className="btn-ghost" onClick={start}>Refazer teste</button>
      </div>
    </section>
  );
}
