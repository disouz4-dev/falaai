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
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
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
checkHealth();
showSavedLevel();

/* PT-BR: Service worker (PWA offline shell). EN: Service worker (PWA offline shell). */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
