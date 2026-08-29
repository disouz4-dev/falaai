import React, { useEffect, useState } from "react";
import { api, skillLabel, mdLite } from "../api.js";

// PT-BR: converte theta (-3..3) em posição vertical. EN: map theta (-3..3) to y.
function thetaToY(theta, top, h) {
  const t = Math.max(-3, Math.min(3, theta));
  return top + (1 - (t + 3) / 6) * h;
}

// PT-BR: gráfico de linha da evolução do nível CEFR. EN: CEFR level evolution line chart.
function evolutionChart(series) {
  const W = 320, H = 200, padL = 34, padR = 12, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const bounds = [
    { t: -2.5, l: "A1" }, { t: -1.5, l: "A2" }, { t: -0.5, l: "B1" },
    { t: 0.5, l: "B2" }, { t: 1.5, l: "C1" }, { t: 2.5, l: "C2" },
  ];
  let grid = "";
  bounds.forEach((b) => {
    const y = thetaToY(b.t, padT, ih);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`;
    grid += `<text x="4" y="${(y + 3).toFixed(1)}" font-size="9" fill="var(--muted)">${b.l}</text>`;
  });
  const pts = series.map((s, i) => `${x(i).toFixed(1)},${thetaToY(s.theta, padT, ih).toFixed(1)}`);
  const line = `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--green)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  const dots = series.map((s, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${thetaToY(s.theta, padT, ih).toFixed(1)}" r="4.5" fill="var(--green-dark)"/>`).join("");
  const xlabels = series.map((s, i) =>
    `<text x="${x(i).toFixed(1)}" y="${H - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">${s.date.slice(5)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do nível">${grid}${line}${dots}${xlabels}</svg>`;
}

// PT-BR: barras horizontais de acerto por habilidade. EN: per-skill accuracy bars.
function skillsChart(skills) {
  const entries = Object.entries(skills);
  if (!entries.length) return '<p style="color:var(--muted);font-size:13px">Sem dados.</p>';
  const W = 320, rowH = 34, padL = 84, padR = 40;
  const H = entries.length * rowH + 8;
  const bw = W - padL - padR;
  const colors = { grammar: "var(--blue)", vocabulary: "var(--yellow)", reading: "var(--green)" };
  let rows = "";
  entries.forEach(([k, v], i) => {
    const y = 8 + i * rowH;
    const w = (v / 100) * bw;
    rows += `<text x="0" y="${y + 14}" font-size="11" font-weight="700" fill="var(--ink)">${skillLabel(k)}</text>`;
    rows += `<rect x="${padL}" y="${y}" width="${bw}" height="18" rx="9" fill="var(--line)"/>`;
    rows += `<rect x="${padL}" y="${y}" width="${w.toFixed(1)}" height="18" rx="9" fill="${colors[k] || "var(--green)"}"/>`;
    rows += `<text x="${W - 4}" y="${y + 14}" font-size="11" font-weight="700" fill="var(--muted)" text-anchor="end">${v}%</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Habilidades">${rows}</svg>`;
}

export default function Progress({ nav }) {
  const [data, setData] = useState(undefined); // undefined=carregando, null=vazio
  const [analysis, setAnalysis] = useState("Analisando sua evolução…");

  useEffect(() => {
    api.get("/api/progress").then((d) => {
      if (!d.series || d.series.length === 0) { setData(null); return; }
      setData(d);
      api.get("/api/progress/analysis")
        .then((a) => setAnalysis(a.analysis || "Sem análise disponível."))
        .catch(() => setAnalysis("Não foi possível gerar a análise agora."));
    }).catch(() => setData(null));
  }, []);

  const last = data?.series?.[data.series.length - 1];

  return (
    <section className="screen active">
      <div className="progress-page">
        <div className="talk-header">
          <button className="icon-btn" title="Voltar" onClick={() => nav("home")}>✕</button>
          <div className="talk-title">📈 Meu progresso</div>
        </div>

        {data === null && (
          <div className="empty-state">
            <div className="empty-emoji">🌱</div>
            <p>Você ainda não fez nenhum teste.<br />Faça o teste de nivelamento para começar sua curva de aprendizado.</p>
            <button className="btn-primary" onClick={() => nav("test-intro")}>Fazer teste de nível</button>
          </div>
        )}

        {data && (
          <div>
            <div className="stat-row">
              <div className="stat"><div className="stat-num">{data.latest_level || "–"}</div><div className="stat-lbl">Nível atual</div></div>
              <div className="stat"><div className="stat-num">{data.attempts}</div><div className="stat-lbl">Testes</div></div>
              <div className="stat"><div className="stat-num">{data.practice_sessions}</div><div className="stat-lbl">Conversas</div></div>
            </div>

            <h3 className="chart-title">Evolução do nível</h3>
            <div className="chart-box" dangerouslySetInnerHTML={{ __html: evolutionChart(data.series) }} />

            <h3 className="chart-title">Habilidades (último teste)</h3>
            <div className="chart-box" dangerouslySetInnerHTML={{ __html: skillsChart(last.skills) }} />

            <div className="report-card">
              <h3>🧠 Análise da IA</h3>
              <div className="report-text" dangerouslySetInnerHTML={{ __html: mdLite(analysis) }} />
            </div>
            <button className="btn-primary" onClick={() => nav("test-intro")}>Fazer novo teste</button>
          </div>
        )}
      </div>
    </section>
  );
}
