import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { playCorrect, playWrong } from "../sounds.js";

export default function Exam({ nav, courseId, moduleId }) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [passing, setPassing] = useState(70);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null); // {score, passed, certificate}

  useEffect(() => {
    if (!courseId) return;
    const url = moduleId
      ? "/api/courses/" + courseId + "/module/" + moduleId + "/exam/start"
      : "/api/courses/" + courseId + "/exam/start";
    api.post(url, {}).then((d) => {
      setQuestions(d.questions || []);
      setName(d.name || "Prova");
      setPassing(d.passing_score ?? 70);
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line
  }, [courseId, moduleId]);

  function choose(qi, oi) {
    playCorrect(); // PT-BR: feedback auditivo ao marcar. EN: audio feedback when selecting.
    setAnswers({ ...answers, [qi]: oi });
  }

  const answeredCount = Object.keys(answers).length;
  const canSubmit = questions.length > 0 && answeredCount === questions.length;

  async function submit() {
    let correct = 0;
    questions.forEach((q, qi) => {
      if (answers[qi] === q.answer) correct += 1;
    });
    const score = Math.round((correct / questions.length) * 100);
    const url = moduleId
      ? "/api/courses/" + courseId + "/module/" + moduleId + "/exam/result"
      : "/api/courses/" + courseId + "/exam/result";
    const d = await api.post(url, { score });
    setResult(d);
    if (d.passed) playCorrect(); else playWrong();
  }

  const header = (
    <div className="talk-header">
      <button className="icon-btn" title="Voltar" onClick={() => nav("course", courseId)}>✕</button>
      <div className="talk-title">📝 {name}</div>
    </div>
  );

  if (loading)
    return <section className="screen active">{header}<p className="course-intro">Preparando prova…</p></section>;

  if (result)
    return (
      <section className="screen active">{header}
        <div className="lesson-done-card">
          <div className="big-emoji">{result.passed ? "🎉" : "😅"}</div>
          <h2>{result.passed ? "Aprovado!" : "Não desta vez"}</h2>
          <p className="result-score">
            Você fez <strong>{result.score}%</strong> — a nota mínima é {result.passing}%.
            {result.passed ? (result.certificate ? " Seu certificado foi emitido. 🎓" : "") : " Revise o conteúdo e tente novamente."}
          </p>
          {result.passed && result.certificate && (
            <button className="btn-primary" style={{ width: "100%", marginBottom: 8 }}
              onClick={() => nav("certificate", { courseId, moduleId, type: moduleId ? "module" : "course" })}>
              Ver Certificado
            </button>
          )}
          <button className="btn-primary outline" style={{ width: "100%" }}
            onClick={() => nav("course", courseId)}>Voltar ao curso</button>
        </div>
      </section>
    );

  return (
    <section className="screen active">{header}
      <p className="course-intro" style={{ marginBottom: 14 }}>
        Responda <strong>todas</strong> as {questions.length} questões. Nota mínima: <strong>{passing}%</strong>.
      </p>
      <div className="progress-wrap" style={{ margin: "0 8px 18px" }}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: (answeredCount / (questions.length || 1)) * 100 + "%" }} />
        </div>
        <div style={{ fontSize: 12, color: "#566b78", marginTop: 4 }}>{answeredCount}/{questions.length} respondidas</div>
      </div>
      {questions.map((q, qi) => (
        <div className="module" key={qi} style={{ margin: "0 8px 12px" }}>
          <div className="module-head" style={{ background: "#002776" }}>
            <div className="mh-top"><span>{qi + 1}. {q.skill}</span></div>
          </div>
          <div className="lesson-list" style={{ padding: 12 }}>
            <div className="q-text" style={{ fontSize: 15, marginBottom: 8 }}>{q.question}</div>
            <div className="options">
              {q.options.map((opt, oi) => (
                <button key={oi}
                  className={"opt" + (answers[qi] === oi ? " selected" : "")}
                  onClick={() => choose(qi, oi)}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button className="btn-primary" style={{ width: "100%", margin: "10px 0 24px" }}
        disabled={!canSubmit} onClick={submit}>
        {canSubmit ? "Finalizar e ver nota" : `Responda todas (${answeredCount}/${questions.length})`}
      </button>
    </section>
  );
}
