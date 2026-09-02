import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function Certificate({ nav, courseId, moduleId, type }) {
  const [cert, setCert] = useState(null);
  const [err, setErr] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!courseId) return;
    const url = (type === "course")
      ? "/api/courses/" + courseId + "/certificate"
      : "/api/courses/" + courseId + "/module/" + moduleId + "/certificate";
    api.get(url).then(setCert).catch((e) => setErr("Certificado não disponível."));
    // eslint-disable-next-line
  }, [courseId, moduleId, type]);

  async function download() {
    const el = wrapRef.current;
    if (!el) return;
    // PT-BR: importa html-to-image dinamicamente; se falhar, tenta Canvas.
    // EN: import html-to-image dynamically; fall back to Canvas.
    try {
      const mod = await import("html-to-image");
      const dataUrl = await mod.toPng(el, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = (cert?.credential_id || "certificado") + ".png";
      a.click();
    } catch {
      // PT-BR: sem lib, renderiza um canvas simples. EN: without lib, draw a simple canvas.
      const canvas = document.createElement("canvas");
      canvas.width = 1000; canvas.height = 700;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1000, 700);
      ctx.strokeStyle = "#002776"; ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 960, 660);
      ctx.fillStyle = "#002776"; ctx.font = "bold 34px serif";
      ctx.textAlign = "center";
      ctx.fillText("CERTIFICADO DE " + (type === "course" ? "CONCLUSÃO" : "MÓDULO"), 500, 130);
      ctx.fillStyle = "#222"; ctx.font = "22px serif";
      ctx.fillText("Certificamos que", 500, 220);
      ctx.fillStyle = "#002776"; ctx.font = "bold 36px serif";
      ctx.fillText(cert?.student || "", 500, 280);
      ctx.fillStyle = "#222"; ctx.font = "22px serif";
      ctx.fillText("concluiu com aproveitamento", 500, 330);
      ctx.font = "bold 24px serif";
      ctx.fillText(type === "course" ? (cert?.course || "") : (cert?.module || ""), 500, 380);
      ctx.fillStyle = "#666"; ctx.font = "18px serif";
      ctx.fillText("Credencial: " + (cert?.credential_id || ""), 500, 460);
      ctx.fillText("Emitido em: " + ((cert?.issued_at || "").slice(0, 10)), 500, 490);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = (cert?.credential_id || "certificado") + ".png";
      a.click();
    }
  }

  return (
    <section className="screen active">
      <div className="talk-header">
        <button className="icon-btn" title="Voltar" onClick={() => nav("course", courseId)}>✕</button>
        <div className="talk-title">🎓 Certificado</div>
      </div>

      <div style={{ padding: "0 8px" }}>
        <div ref={wrapRef} style={{
          background: "#fff", border: "6px solid #FFDF00", borderRadius: 8,
          padding: 30, textAlign: "center", marginBottom: 16,
        }}>
          <div style={{ fontSize: 60, marginTop: 10 }}>🐺</div>
          <h1 style={{ color: "#002776", margin: "8px 0 4px" }}>CERTIFICADO</h1>
          <p style={{ color: "#009C3B", fontWeight: 700, margin: 0 }}>
            {type === "course" ? "DE CONCLUSÃO DE CURSO" : "DE CONCLUSÃO DE MÓDULO"}
          </p>
          {err ? (
            <p style={{ color: "#b00", marginTop: 30 }}>{err}</p>
          ) : !cert ? (
            <p style={{ marginTop: 30 }}>Carregando…</p>
          ) : (
            <>
              <p style={{ color: "#566b78", marginTop: 26 }}>Certificamos que</p>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#002776", margin: "6px 0" }}>
                {cert.student}
              </div>
              <p style={{ color: "#566b78", margin: "4px 0 10px" }}>
                concluiu com aproveitamento o {type === "course" ? "curso" : "módulo"}
              </p>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>
                {type === "course" ? cert.course : `${cert.module} (${cert.cefr})`}
              </div>
              <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "0 20px" }} />
              <div style={{ fontSize: 13, color: "#888", marginTop: 16, lineHeight: 1.6 }}>
                <div>Credencial: <strong>{cert.credential_id}</strong></div>
                <div>Emitido em: {String(cert.issued_at).slice(0, 10)}</div>
                <div>Fala A.I. · A.I. · Plataforma de ensino de idiomas</div>
              </div>
            </>
          )}
        </div>
        {cert && !err && (
          <button className="btn-primary" style={{ width: "100%", marginBottom: 12 }} onClick={download}>
            ⬇️ Baixar como imagem
          </button>
        )}
        <button className="btn-ghost" style={{ width: "100%" }} onClick={() => nav("course", courseId)}>
          Voltar ao curso
        </button>
      </div>
    </section>
  );
}
