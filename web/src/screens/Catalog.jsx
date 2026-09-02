import React, { useEffect, useState } from "react";
import { api, onColor } from "../api.js";

export default function Catalog({ nav }) {
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    api.get("/api/courses").then((d) => setCourses(d.courses)).catch(() => setCourses([]));
  }, []);

  async function enroll(courseId) {
    await api.post("/api/courses/" + courseId + "/enroll");
    nav("course", courseId);
  }

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={() => nav("home")}>✕</button>
        <div className="talk-title">📚 Cursos</div>
      </div>
      <p className="course-intro">Escolha um curso para iniciar. Você pode se matricular em quantos quiser.</p>
      <div className="modules-list">
        {courses == null && <p className="course-intro">Carregando…</p>}
        {courses?.map((c) => (
          <div className="module" key={c.id}>
            <div className="module-head" style={{ background: c.color, color: onColor(c.color) }}>
              <div className="mh-top"><span>🎓 CURSO</span><span>{c.done_lessons}/{c.total_lessons} lições</span></div>
              <h3>{c.title}</h3>
              <div className="mh-sub">{c.subtitle}</div>
            </div>
            <div className="lesson-list" style={{ padding: 12 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#566b78" }}>
                {c.total_modules} módulos · nota mínima {c.passing_score}% nas provas
              </p>
              {c.is_enrolled ? (
                <button className="btn-primary" style={{ width: "100%" }}
                  onClick={() => nav("course", c.id)}>Continuar curso</button>
              ) : (
                <button className="btn-primary" style={{ width: "100%" }}
                  onClick={() => enroll(c.id)}>Matricular-se</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
