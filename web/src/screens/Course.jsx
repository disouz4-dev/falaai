import React, { useEffect, useState } from "react";
import { api, onColor } from "../api.js";

export default function Course({ nav, courseId }) {
  const [course, setCourse] = useState(null);
  const [enrolled, setEnrolled] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    api.get("/api/courses/" + courseId).then((d) => {
      setCourse(d);
      setEnrolled(true);
    }).catch(() => {
      // PT-BR: se ainda não matriculado, mostra estado. EN: if not enrolled, show state.
      setEnrolled(false);
    });
  }, [courseId]);

  if (!course)
    return (
      <section className="screen active">
        <div className="talk-header">
          <button className="icon-btn" title="Voltar" onClick={() => nav("home")}>✕</button>
          <div className="talk-title">📚 {courseId || "Curso"}</div>
        </div>
        <p className="course-intro">Carregando…</p>
      </section>
    );

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={() => nav("home")}>✕</button>
        <div className="talk-title">📚 {course.title}</div>
      </div>
      <p className="course-intro">{course.subtitle}</p>

      <button className="btn-primary outline" style={{ width: "100%", marginBottom: 14 }}
        onClick={() => nav("course")}>
        📚 Outros cursos (matricular-se)
      </button>

      {course.course_certificate ? (
        <button className="btn-primary cert-banner" style={{ width: "100%", marginBottom: 14 }}
          onClick={() => nav("certificate", { courseId: course.id, type: "course" })}>
          🎓 Ver Certificado do Curso
        </button>
      ) : null}

      <div className="modules-list">
        {course.modules.map((m) => {
          const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
          return (
            <div className={"module" + (m.locked ? " locked" : "")} key={m.id}>
              <div className="module-head" style={{ background: m.color, color: onColor(m.color) }}>
                <div className="mh-top"><span>MÓDULO · {m.cefr}</span><span>{m.done}/{m.total}</span></div>
                <h3>{m.title}</h3>
                <div className="mh-sub">
                  {m.passed ? "✅ Aprovado" : m.best_score != null ? `Prova: ${m.best_score}%` : ""}
                </div>
                <div className="module-bar" style={{ background: "rgba(0,0,0,.16)" }}>
                  <div style={{ width: pct + "%", background: onColor(m.color) }} />
                </div>
              </div>

              {m.coming_soon ? (
                <div className="coming-soon">🚧 Em breve</div>
              ) : m.locked ? (
                <div className="module-locked-msg">🔒 {m.locked_hint || "Aprove a prova do módulo anterior"}</div>
              ) : (
                <div className="lesson-list">
                  {m.lessons.map((l) => (
                    <button className="lesson-item" key={l.id} onClick={() => nav("lesson", l.id)}>
                      <span className={"lesson-dot" + (l.done ? " done" : "")}>{l.done ? "✓" : "▶"}</span>
                      <span className="lesson-meta">
                        <span className="lm-title">{l.title}</span>
                        <span className="lm-sub">{l.method} · {l.minutes} min · {l.can_do}</span>
                      </span>
                    </button>
                  ))}

                  {m.exam_unlocked && (
                    <button className="lesson-item exam-entry"
                      onClick={() => nav("exam", { courseId: course.id, moduleId: m.id })}>
                      <span className="lesson-dot exam">{m.passed ? "🏅" : "📝"}</span>
                      <span className="lesson-meta">
                        <span className="lm-title">📝 {m.passed ? "Refazer prova" : "Prova do módulo"}</span>
                        <span className="lm-sub">{m.exam?.num_questions || 8} questões · nota mín. {m.exam?.passing_score || 70}%</span>
                      </span>
                    </button>
                  )}

                  {m.passed && m.certificate && (
                    <button className="lesson-item cert-entry"
                      onClick={() => nav("certificate", { courseId: course.id, moduleId: m.id, type: "module" })}>
                      <span className="lesson-dot cert">🎓</span>
                      <span className="lesson-meta">
                        <span className="lm-title">Certificado do Módulo</span>
                        <span className="lm-sub">Credencial {m.certificate.credential_id}</span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="module">
          <div className="module-head" style={{ background: course.color, color: onColor(course.color) }}>
            <div className="mh-top"><span>🏁</span></div>
            <h3>Prova Final</h3>
            <div className="mh-sub">
              {course.final_passed
                ? "✅ Curso concluído!"
                : "Conclua e aprove todos os módulos para liberar."}
            </div>
          </div>
          {course.final_passed && (
            <div className="lesson-list">
              {course.course_certificate && (
                <button className="lesson-item cert-entry"
                  onClick={() => nav("certificate", { courseId: course.id, type: "course" })}>
                  <span className="lesson-dot cert">🎓</span>
                  <span className="lesson-meta">
                    <span className="lm-title">Certificado do Curso</span>
                    <span className="lm-sub">Credencial {course.course_certificate.credential_id}</span>
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
