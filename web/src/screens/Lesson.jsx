import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, mdBlock, mdLite } from "../api.js";
import { speak, stopSpeaking } from "../speech.js";
import { playCorrect, playWrong } from "../sounds.js";

export default function Lesson({ nav, lessonId }) {
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(null); // índice escolhido no exercício
  const [taskAnswer, setTaskAnswer] = useState("");
  const [taskFb, setTaskFb] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const [finished, setFinished] = useState(null); // score final
  const [listening, setListening] = useState(false);
  const [explain, setExplain] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playedQuestion, setPlayedQuestion] = useState(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    scoreRef.current = 0;
    setIdx(0); setAnswered(null); setTaskAnswer(""); setTaskFb(""); setTaskDone(false); setFinished(null);
    setPlayedQuestion(null);
    api.get("/api/course/lesson/" + lessonId).then(setData).catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    if (!muted && stage?.startsWith("ex") && data) {
      const i = parseInt(stage.slice(2), 10);
      if (i !== playedQuestion && data.exercises[i]) {
        setPlayedQuestion(i);
        speak(data.exercises[i].question);
      }
    }
  }, [stage, data, muted, playedQuestion]);

  useEffect(() => {
    if (explain && !muted) {
      speak(explain);
    }
  }, [explain, muted]);

  const stages = useMemo(
    () => (data ? ["material", ...data.exercises.map((_, i) => "ex" + i), "task"] : []),
    [data]
  );

  if (!data) return <section className="screen active"><p className="course-intro">Carregando…</p></section>;

  const total = stages.length;
  const stage = stages[idx];
  const pct = (idx / total) * 100;

  function next() {
    setAnswered(null);
    setExplain(null);
    if (idx + 1 >= total) return finish();
    setIdx(idx + 1);
  }

  async function askExplain(ex, given) {
    setExplaining(true);
    try {
      const d = await api.post("/api/explain", {
        question: ex.question, correct: ex.options[ex.answer], given: ex.options[given], level: data.method,
      });
      setExplain(d.explanation);
    } catch { setExplain("Não foi possível explicar agora."); }
    setExplaining(false);
  }

  async function finish() {
    const score = Math.round((scoreRef.current / (data.exercises.length || 1)) * 100);
    try {
      await api.post("/api/course/lesson/" + data.id + "/complete", { score });
    } catch {}
    setFinished(score);
  }

  function answerExercise(i, oi) {
    if (answered !== null) return;
    setAnswered(oi);
    const ex = data.exercises[i];
    if (oi === ex.answer) { scoreRef.current += 1; playCorrect(); }
    else {
      playWrong();
      // PT-BR: registra o erro no hub de revisão. EN: log the mistake for the review hub.
      api.post("/api/mistakes/log", {
        source: "lição", skill: "grammar", question: ex.question,
        correct: ex.options[ex.answer], given: ex.options[oi], explanation: ex.explanation || "",
      }).catch(() => {});
    }
  }

  // PT-BR: ditar a resposta da tarefa por voz. EN: dictate the task answer by voice.
  function dictate() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false;
    rec.onresult = (e) =>
      setTaskAnswer((t) => (t + " " + e.results[0][0].transcript).trim());
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); } catch {}
  }

  async function submitTask() {
    if (!taskAnswer.trim()) { setTaskFb("Escreva ou fale sua resposta primeiro."); return; }
    setSubmitting(true);
    setTaskFb("O professor está avaliando…");
    let fb = "";
    try {
      const d = await api.post("/api/course/task-feedback", {
        lesson_id: data.id, transcript: taskAnswer.trim(),
      });
      fb = d.feedback;
    } catch { fb = "Não foi possível avaliar agora."; }
    setTaskFb(fb);
    setTaskDone(true);
    setSubmitting(false);
    if (!muted && window.speechSynthesis) speak(fb.replace(/[^A-Za-z0-9 .,!?']/g, " "));
  }

  if (finished !== null) {
    return (
      <section className="screen active">
        <div className="lesson-done-card">
          <div className="big-emoji">🎉</div>
          <h2>Lição concluída!</h2>
          <p className="result-score">Você acertou {finished}% dos exercícios.</p>
          <button className="btn-primary" onClick={() => nav("course")}>Voltar ao curso</button>
          <button className="btn-ghost" onClick={() => nav("talk")}>Praticar conversando</button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active">
      <div className="test-header">
        <button className="icon-btn" title="Sair" onClick={() => nav("course")}>✕</button>
        <div className="progress-wrap">
          <div className="progress-bar"><div className="progress-fill" style={{ width: pct + "%" }} /></div>
        </div>
        <div className="level-chip">{idx + 1}/{total}</div>
      </div>

      <div className="lesson-body">
        {stage === "material" && (
          <div className="lesson-stage">
            <div className="stage-tag">📖 Material · {data.method}</div>
            <h2>{data.title}</h2>
            <div className="material" dangerouslySetInnerHTML={{ __html: mdBlock(data.material_pt) }} />
            <h3 style={{ marginTop: 18 }}>🗂️ Vocabulário</h3>
            <div className="vocab-grid">
              {data.vocab.map((v, i) => (
                <div className="vocab-card" key={i}>
                  <div className="v-en">{v.en}</div>
                  <div className="v-pt">{v.pt}</div>
                </div>
              ))}
            </div>
            <div className="lesson-controls">
              <button className={muted ? "btn-ghost mute-on" : "btn-primary mute-off"}
                onClick={() => { setMuted(!muted); stopSpeaking(); }}>
                {muted ? "Desmutar" : "Mutar professor"}
              </button>
            </div>
            <button className="btn-primary" onClick={next}>Praticar</button>
          </div>
        )}

        {stage?.startsWith("ex") && (() => {
          const i = parseInt(stage.slice(2), 10);
          const ex = data.exercises[i];
          const correct = answered !== null && answered === ex.answer;
          return (
            <div className="lesson-stage">
              <div className="stage-tag">✏️ Prática {i + 1}</div>
              <h2 className="q-text">{ex.question}</h2>
              <div className="options">
                {ex.options.map((opt, oi) => {
                  let cls = "opt";
                  if (answered !== null) {
                    if (oi === ex.answer) cls += " correct";
                    else if (oi === answered) cls += " wrong";
                  }
                  return (
                    <button key={oi} className={cls} disabled={answered !== null}
                      onClick={() => answerExercise(i, oi)}>{opt}</button>
                  );
                })}
              </div>
              {answered !== null && (
                <div className={"feedback " + (correct ? "ok" : "no")}>
                  <div className="feedback-title">{correct ? "✓ Correto!" : "✗ Quase!"}</div>
                  <div className="feedback-exp">{ex.explanation}</div>
                  {explain && (
                    <div className="task-feedback" dangerouslySetInnerHTML={{ __html: "🧑‍🏫 " + mdLite(explain) }} />
                  )}
                  {!correct && !explain && (
                    <button className="btn-ghost" disabled={explaining} onClick={() => askExplain(ex, answered)}>
                      {explaining ? "Explicando…" : "💡 Explique meu erro"}
                    </button>
                  )}
                  <button className="btn-primary" onClick={next}>Continuar</button>
                </div>
              )}
              <button className={muted ? "btn-ghost mute-on" : "btn-primary mute-off"}
                onClick={() => { setMuted(!muted); stopSpeaking(); }}>
                {muted ? "Desmutar" : "Mutar professor"}
              </button>
            </div>
          );
        })()}

        {stage === "task" && (
          <div className="lesson-stage">
            <div className="stage-tag">🎯 Tarefa (produção)</div>
            <h2>Sua vez de usar!</h2>
            <div className="task-box">
              <div className="task-label">Tarefa</div>
              <div>{data.task.prompt_pt}</div>
              <div className="task-en">{data.task.prompt_en}</div>
            </div>
            <div className="task-controls">
              <button className={"mic-inline" + (listening ? " listening" : "")} onClick={dictate}>
                {listening ? "🔴 Ouvindo…" : "🎤 Falar resposta"}
              </button>
              <button className={muted ? "btn-ghost mute-on" : "btn-primary mute-off"}
                onClick={() => { setMuted(!muted); stopSpeaking(); }}>
                {muted ? "Desmutar" : "Mutar professor"}
              </button>
            </div>
            <textarea className="task-answer" placeholder="…ou escreva sua resposta em inglês aqui"
              value={taskAnswer} onChange={(e) => setTaskAnswer(e.target.value)} />
            {taskFb && <div className="task-feedback" dangerouslySetInnerHTML={{ __html: "🧑‍🏫 " + mdLite(taskFb) }} />}
            {taskDone ? (
              <button className="btn-primary" onClick={next}>Concluir lição</button>
            ) : (
              <button className="btn-primary" disabled={submitting} onClick={submitTask}>
                Enviar para o professor
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
