/*
  PT-BR: Lógica do OpenLingo — navegação entre telas, teste adaptativo e conversação por voz.
  EN:    OpenLingo logic — screen routing, adaptive test, and voice conversation.
*/
"use strict";

const API = ""; // PT-BR: mesma origem do backend. EN: same origin as backend.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------- Navegação entre telas / Screen routing ---------- */
function nav(name) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById("screen-" + name);
  if (el) el.classList.add("active");
  if (name === "talk") talk.enter();
  if (name === "profile") profile.load();
  if (name === "progress") progressPage.load();
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-nav]");
  if (t) nav(t.dataset.nav);
});

/* ---------- Estado do Ollama / Ollama health ---------- */
async function checkHealth() {
  const pill = $("#ollama-status");
  try {
    const r = await fetch(API + "/api/health");
    const d = await r.json();
    if (d.ollama) { pill.textContent = "IA ✓"; pill.className = "status-pill ok"; }
    else { pill.textContent = "IA off"; pill.className = "status-pill off"; }
  } catch {
    pill.textContent = "sem servidor"; pill.className = "status-pill off";
  }
}

/* ---------- Nível salvo / Saved level ---------- */
function showSavedLevel() {
  const lvl = localStorage.getItem("openlingo_level");
  const el = $("#saved-level");
  if (lvl) {
    el.textContent = `Seu último nível: ${lvl}`;
    el.classList.remove("hidden");
    $("#talk-level").value = lvl;
  }
}

/* ---------- Perfil / Profile ---------- */
let PROFILE = null;

async function boot() {
  await checkHealth();
  showSavedLevel();
  try {
    const r = await fetch(API + "/api/profile");
    PROFILE = (await r.json()).profile;
  } catch { PROFILE = null; }
  applyGreeting();
  // PT-BR: onboarding no 1º acesso (sem perfil). EN: onboarding on first visit.
  if (!PROFILE) nav("profile");
}

function applyGreeting() {
  if (PROFILE && PROFILE.name) {
    $("#hero-title").textContent = `Olá, ${PROFILE.name}! 👋`;
  }
}

const profile = {
  load() {
    if (PROFILE) {
      $("#pf-name").value = PROFILE.name || "";
      $("#pf-goal").value = PROFILE.goal || "";
      $("#pf-interests").value = PROFILE.interests || "";
    }
  },
  async save() {
    const name = $("#pf-name").value.trim();
    if (!name) { $("#pf-msg").textContent = "Digite pelo menos seu nome."; return; }
    const body = {
      name,
      goal: $("#pf-goal").value.trim(),
      interests: $("#pf-interests").value.trim(),
    };
    const r = await fetch(API + "/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    PROFILE = (await r.json()).profile;
    applyGreeting();
    $("#pf-msg").textContent = "✓ Salvo!";
    setTimeout(() => { $("#pf-msg").textContent = ""; nav("home"); }, 700);
  },
};

/* =======================================================================
   TESTE DE NIVELAMENTO ADAPTATIVO / ADAPTIVE PLACEMENT TEST
   ======================================================================= */
const test = {
  sessionId: null,
  current: null,
  selected: null,

  async start() {
    const r = await fetch(API + "/api/placement/start", { method: "POST" });
    const d = await r.json();
    this.sessionId = d.session_id;
    nav("test");
    this.render(d.question, d.progress);
  },

  render(q, progress) {
    this.current = q;
    this.selected = null;
    $("#feedback").classList.add("hidden");
    $("#q-skill").textContent = skillLabel(q.skill) + " · " + q.level;
    $("#q-text").innerHTML = escapeHTML(q.question);
    const box = $("#q-options");
    box.innerHTML = "";
    q.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "opt";
      b.textContent = opt;
      b.onclick = () => this.answer(i, b);
      box.appendChild(b);
    });
    this.updateProgress(progress);
  },

  updateProgress(p) {
    const pct = ((p.answered || 0) / (p.total || 20)) * 100;
    $("#progress-fill").style.width = pct + "%";
    $("#level-chip").textContent = p.level && p.level !== "—" ? p.level : "—";
  },

  async answer(choice, btn) {
    if (this.selected !== null) return; // PT-BR: já respondeu. EN: already answered.
    this.selected = choice;
    $$("#q-options .opt").forEach((b) => (b.disabled = true));

    const r = await fetch(API + "/api/placement/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: this.sessionId, item_id: this.current.id, choice }),
    });
    const d = await r.json();

    const opts = $$("#q-options .opt");
    opts[d.correct_index].classList.add("correct");
    if (!d.correct) opts[choice].classList.add("wrong");

    const fb = $("#feedback");
    fb.className = "feedback " + (d.correct ? "ok" : "no");
    $("#feedback-title").textContent = d.correct ? "✓ Correto!" : "✗ Não foi dessa vez";
    $("#feedback-exp").innerHTML =
      `${escapeHTML(d.explanation_pt)}<br><span class="en">${escapeHTML(d.explanation_en)}</span>`;
    this.updateProgress(d.progress);

    $("#btn-continue").onclick = () => {
      if (d.done) this.finish();
      else this.render(d.next_question, d.progress);
    };
  },

  async finish() {
    nav("result");
    $("#report-text").textContent = "Gerando relatório…";
    const r = await fetch(API + "/api/placement/result/" + this.sessionId);
    const d = await r.json();
    localStorage.setItem("openlingo_level", d.level);
    $("#cefr-badge").textContent = d.level;
    $("#result-score").textContent =
      `${d.correct}/${d.total} acertos · confiança ${d.confidence}`;
    renderSkills(d.skills);
    $("#report-text").innerHTML = mdLite(d.report);
  },
};

function renderSkills(skills) {
  const box = $("#skill-bars");
  box.innerHTML = "";
  Object.entries(skills).forEach(([name, s]) => {
    const pct = Math.round((s.correct / s.total) * 100);
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML =
      `<div class="lbl"><span>${skillLabel(name)}</span><span>${s.correct}/${s.total}</span></div>
       <div class="skill-track"><div class="skill-val" style="width:${pct}%"></div></div>`;
    box.appendChild(row);
  });
}

/* =======================================================================
   CONVERSAÇÃO POR VOZ / VOICE CONVERSATION (Web Speech API + Ollama)
   ======================================================================= */
const talk = {
  recog: null,
  listening: false,
  history: [],
  entered: false,

  enter() {
    if (this.entered) return;
    this.entered = true;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      $("#talk-hint").textContent =
        "Seu navegador não suporta reconhecimento de voz (use Chrome).";
      $("#mic-btn").disabled = true;
    } else {
      this.recog = new SR();
      this.recog.lang = "en-US";
      this.recog.interimResults = false;
      this.recog.maxAlternatives = 1;
      this.recog.onresult = (e) => this.onSpeech(e.results[0][0].transcript);
      this.recog.onerror = (e) => { this.setListening(false); $("#talk-hint").textContent = "Erro no microfone: " + e.error; };
      this.recog.onend = () => this.setListening(false);
    }
    $("#mic-btn").onclick = () => this.toggle();
    // PT-BR: mensagem de boas-vindas falada. EN: spoken welcome.
    if (!this.history.length) this.addBot("Hi! I'm your English teacher. What would you like to talk about today?");
  },

  toggle() {
    if (!this.recog) return;
    if (this.listening) { this.recog.stop(); return; }
    try { this.recog.start(); this.setListening(true); }
    catch { /* já iniciado / already started */ }
  },

  setListening(on) {
    this.listening = on;
    const btn = $("#mic-btn");
    btn.classList.toggle("listening", on);
    $("#talk-hint").textContent = on ? "Ouvindo… fale agora" : "Toque no microfone e fale em inglês";
  },

  onSpeech(text) {
    this.setListening(false);
    this.addUser(text);
    this.history.push({ role: "user", content: text });
    this.reply();
  },

  async reply() {
    const btn = $("#mic-btn");
    btn.classList.add("thinking");
    $("#talk-hint").textContent = "O professor está pensando…";
    const bubble = this.addBot("");
    let full = "";
    try {
      const r = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: this.history, level: $("#talk-level").value }),
      });
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        bubble.textContent = full;
        $("#talk-log").scrollTop = $("#talk-log").scrollHeight;
      }
    } catch (e) {
      full = "[erro de conexão]";
      bubble.textContent = full;
    }
    this.history.push({ role: "assistant", content: full });
    btn.classList.remove("thinking");
    $("#talk-hint").textContent = "Toque no microfone e fale em inglês";
    this.speak(full);
  },

  speak(text) {
    // PT-BR: A VOZ DO PROFESSOR — fala a resposta em inglês (não é só transcrição).
    // EN: THE TEACHER'S VOICE — speaks the reply in English (not just transcription).
    if (!window.speechSynthesis || !text) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ""));
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1.0;
    const v = pickEnglishVoice();
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  },

  addUser(text) {
    const b = document.createElement("div");
    b.className = "bubble user";
    b.textContent = text;
    $("#talk-log").appendChild(b);
    $("#talk-log").scrollTop = $("#talk-log").scrollHeight;
  },
  addBot(text) {
    const b = document.createElement("div");
    b.className = "bubble bot";
    b.textContent = text;
    $("#talk-log").appendChild(b);
    $("#talk-log").scrollTop = $("#talk-log").scrollHeight;
    if (text) this.speak(text);
    return b;
  },
};

/* =======================================================================
   PROGRESSO / CURVA DE APRENDIZADO (relatórios gráficos em SVG)
   LEARNING CURVE / PROGRESS (graphical SVG reports)
   ======================================================================= */
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const progressPage = {
  async load() {
    const empty = $("#progress-empty");
    const content = $("#progress-content");
    $("#curve-analysis").textContent = "Analisando sua evolução…";
    let d;
    try {
      d = await (await fetch(API + "/api/progress")).json();
    } catch {
      empty.classList.remove("hidden"); content.classList.add("hidden"); return;
    }
    if (!d.series || d.series.length === 0) {
      empty.classList.remove("hidden"); content.classList.add("hidden"); return;
    }
    empty.classList.add("hidden"); content.classList.remove("hidden");

    $("#st-current").textContent = d.latest_level || "–";
    $("#st-tests").textContent = d.attempts;
    $("#st-practice").textContent = d.practice_sessions;

    // PT-BR: gráficos aparecem imediatamente. EN: charts render instantly.
    $("#chart-evolution").innerHTML = evolutionChart(d.series);
    $("#chart-skills").innerHTML = skillsChart(d.series[d.series.length - 1].skills);

    // PT-BR: análise da IA carrega em separado (é mais lenta). EN: AI analysis loads separately.
    $("#curve-analysis").textContent = "Analisando sua evolução…";
    try {
      const a = await (await fetch(API + "/api/progress/analysis")).json();
      $("#curve-analysis").innerHTML = a.analysis ? mdLite(a.analysis) : "Sem análise disponível.";
    } catch {
      $("#curve-analysis").textContent = "Não foi possível gerar a análise agora.";
    }
  },
};

// PT-BR: converte theta (-3..3) em posição vertical. EN: map theta (-3..3) to y position.
function thetaToY(theta, top, h) {
  const t = Math.max(-3, Math.min(3, theta));
  return top + (1 - (t + 3) / 6) * h;
}

// PT-BR: gráfico de linha da evolução do nível CEFR ao longo dos testes.
// EN: line chart of CEFR level evolution across tests.
function evolutionChart(series) {
  const W = 320, H = 200, padL = 34, padR = 12, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);

  // PT-BR: linhas de grade nos limites CEFR. EN: gridlines at CEFR boundaries.
  let grid = "";
  const bounds = [{ t: -2.5, l: "A1" }, { t: -1.5, l: "A2" }, { t: -0.5, l: "B1" },
                  { t: 0.5, l: "B2" }, { t: 1.5, l: "C1" }, { t: 2.5, l: "C2" }];
  bounds.forEach((b) => {
    const y = thetaToY(b.t, padT, ih);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`;
    grid += `<text x="4" y="${(y + 3).toFixed(1)}" font-size="9" fill="var(--muted)">${b.l}</text>`;
  });

  const pts = series.map((s, i) => `${x(i).toFixed(1)},${thetaToY(s.theta, padT, ih).toFixed(1)}`);
  const line = `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--green)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  const dots = series.map((s, i) => {
    const cx = x(i).toFixed(1), cy = thetaToY(s.theta, padT, ih).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--green-dark)"/>`;
  }).join("");
  const xlabels = series.map((s, i) => {
    const d = s.date.slice(5); // MM-DD
    return `<text x="${x(i).toFixed(1)}" y="${H - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">${d}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do nível">${grid}${line}${dots}${xlabels}</svg>`;
}

// PT-BR: barras horizontais de acerto por habilidade. EN: horizontal per-skill accuracy bars.
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
    rows += `<rect x="${padL}" y="${y}" width="${w.toFixed(1)}" height="18" rx="9" fill="${colors[k] || 'var(--green)'}"/>`;
    rows += `<text x="${W - 4}" y="${y + 14}" font-size="11" font-weight="700" fill="var(--muted)" text-anchor="end">${v}%</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Habilidades">${rows}</svg>`;
}

/* ---------- Voz do professor / Teacher voice (TTS) ---------- */
let VOICES = [];
function loadVoices() { VOICES = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
// PT-BR: escolhe a melhor voz em inglês disponível. EN: pick the best available English voice.
function pickEnglishVoice() {
  if (!VOICES.length) loadVoices();
  const en = VOICES.filter((v) => /en(-|_)/i.test(v.lang) || /english/i.test(v.name));
  if (!en.length) return null;
  const pref = en.find((v) => /US|United States/i.test(v.lang + v.name) && /female|Google|Samantha|Zira|Aria/i.test(v.name));
  return pref || en.find((v) => /US/i.test(v.lang)) || en[0];
}

/* ---------- Utilidades / Utils ---------- */
function skillLabel(s) {
  return { grammar: "Gramática", vocabulary: "Vocabulário", reading: "Leitura" }[s] || s;
}
function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
// PT-BR: markdown mínimo (**negrito**). EN: minimal markdown (**bold**).
function mdLite(str) {
  return escapeHTML(str).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/* ---------- Boot ---------- */
$("#btn-start-test").onclick = () => test.start();
$("#btn-save-profile").onclick = () => profile.save();
boot();

/* PT-BR: Service worker (PWA offline shell). EN: Service worker (PWA offline shell). */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
