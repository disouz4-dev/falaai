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
  if (name === "course") courseView.load();
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
      this.recog.continuous = true;      // PT-BR: captura enquanto o botão está pressionado. EN: capture while held.
      this.recog.interimResults = false;
      this.recog.maxAlternatives = 1;
      this._transcript = "";
      // PT-BR: acumula os trechos finais enquanto o usuário segura o botão.
      // EN: accumulate final chunks while the user holds the button.
      this.recog.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) this._transcript += e.results[i][0].transcript + " ";
        }
      };
      this.recog.onerror = (e) => {
        this.setListening(false);
        if (e.error !== "no-speech" && e.error !== "aborted")
          $("#talk-hint").textContent = "Erro no microfone: " + e.error;
      };
      // PT-BR: ao SOLTAR (recognition termina), envia o áudio transcrito ao professor.
      // EN: on RELEASE (recognition ends), send the transcribed audio to the teacher.
      this.recog.onend = () => {
        this.setListening(false);
        const text = (this._transcript || "").trim();
        this._transcript = "";
        if (text) this.onSpeech(text);
      };
    }
    // PT-BR: PUSH-TO-TALK — segura para falar, solta para enviar.
    // EN: PUSH-TO-TALK — hold to talk, release to send.
    const btn = $("#mic-btn");
    const press = (e) => { e.preventDefault(); this.startListening(); };
    const release = (e) => { e.preventDefault(); this.stopListening(); };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault()); // PT-BR: sem menu no toque longo. EN: no long-press menu.

    // PT-BR: mensagem de boas-vindas falada. EN: spoken welcome.
    if (!this.history.length) this.addBot("Hi! I'm your English teacher. What would you like to talk about today?");
  },

  startListening() {
    if (!this.recog || this.listening) return;
    this._transcript = "";
    unlockTTS(); // PT-BR: destrava o áudio no gesto. EN: unlock audio on the gesture.
    try { this.recog.start(); this.setListening(true); }
    catch { /* já iniciado / already started */ }
  },

  stopListening() {
    if (!this.recog || !this.listening) return;
    try { this.recog.stop(); } catch { /* ignore */ }
    // PT-BR: o onend cuida de enviar. EN: onend handles sending.
  },

  setListening(on) {
    this.listening = on;
    const btn = $("#mic-btn");
    btn.classList.toggle("listening", on);
    $("#talk-hint").textContent = on
      ? "🔴 Ouvindo… solte para enviar"
      : "Segure o microfone para falar";
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
        bubble._txt.textContent = full; // PT-BR: atualiza só o texto. EN: update text only.
        $("#talk-log").scrollTop = $("#talk-log").scrollHeight;
      }
    } catch (e) {
      full = "[erro de conexão]";
      bubble._txt.textContent = full;
    }
    this.history.push({ role: "assistant", content: full });
    btn.classList.remove("thinking");
    $("#talk-hint").textContent = "Toque no microfone e fale em inglês";
    // PT-BR: TEXTO + ÁUDIO juntos — fala a resposta e deixa o botão 🔊 para reouvir.
    // EN: TEXT + AUDIO together — speak the reply and add the 🔊 replay button.
    this.addPlayButton(bubble, full);
    this.speak(full);
  },

  speak(text) {
    // PT-BR: A VOZ DO PROFESSOR — toca o áudio gerado no SERVIDOR (Piper), trecho a trecho,
    //        no idioma certo: INGLÊS no ensino e PORTUGUÊS nas correções (linhas com 📝).
    // EN: THE TEACHER'S VOICE — plays SERVER audio (Piper) segment by segment in the right
    //     language: ENGLISH for teaching, PORTUGUESE for corrections (lines with 📝).
    if (!text) return;
    // PT-BR: interrompe qualquer áudio anterior. EN: stop any previous audio.
    this._stopAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    // PT-BR: quebra a resposta em segmentos por idioma. EN: split the reply into language segments.
    const segments = [];
    for (const rawLine of text.split(/\n+/)) {
      const isPt = /^\s*📝/.test(rawLine);
      const clean = rawLine.replace(/📝\s*\(corre[çc][ãa]o\):?/i, "").replace(/[*_`#>~]/g, "").trim();
      if (clean) segments.push({ text: clean, lang: isPt ? "pt" : "en" });
    }
    if (!segments.length) return;
    this._playQueue(segments, 0);
  },

  _stopAudio() {
    if (this._audio) { try { this._audio.pause(); } catch {} this._audio = null; }
    this._queueToken = (this._queueToken || 0) + 1; // PT-BR: invalida fila anterior. EN: cancel old queue.
  },

  _playQueue(segments, i) {
    const token = this._queueToken || 0;
    if (i >= segments.length) return;
    const seg = segments[i];
    const audio = new Audio(API + "/api/tts?lang=" + seg.lang + "&text=" + encodeURIComponent(seg.text));
    this._audio = audio;
    audio.onended = () => { if ((this._queueToken || 0) === token) this._playQueue(segments, i + 1); };
    audio.play().catch(() => {
      // PT-BR: fallback pro TTS do navegador (só o texto todo). EN: browser TTS fallback.
      this.speakBrowser(segments.map((s) => s.text).join(". "));
    });
  },

  // PT-BR: fallback — voz do próprio navegador. EN: fallback — the browser's own voice.
  speakBrowser(clean) {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const doSpeak = () => {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "en-US"; u.rate = 0.95;
      const v = pickEnglishVoice();
      if (v) u.voice = v;
      synth.speak(u); synth.resume();
    };
    synth.cancel();
    setTimeout(doSpeak, 70);
  },

  addUser(text) {
    const b = document.createElement("div");
    b.className = "bubble user";
    b.textContent = text;
    $("#talk-log").appendChild(b);
    $("#talk-log").scrollTop = $("#talk-log").scrollHeight;
  },
  // PT-BR: bolha do professor = TEXTO + botão de áudio 🔊 (fala automática + reouvir).
  // EN: teacher bubble = TEXT + audio button 🔊 (auto speech + replay).
  addBot(text) {
    const b = document.createElement("div");
    b.className = "bubble bot";
    const span = document.createElement("span");
    span.className = "btxt";
    span.textContent = text || "";
    b.appendChild(span);
    b._txt = span;
    $("#talk-log").appendChild(b);
    $("#talk-log").scrollTop = $("#talk-log").scrollHeight;
    if (text) { this.addPlayButton(b, text); this.speak(text); }
    return b;
  },
  // PT-BR: adiciona/atualiza o botão 🔊 que reproduz o texto da bolha. EN: add/refresh the 🔊 replay button.
  addPlayButton(bubble, text) {
    let btn = bubble.querySelector(".replay");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "replay";
      btn.textContent = "🔊";
      btn.title = "Ouvir";
      bubble.appendChild(btn);
    }
    btn.onclick = () => this.speak(text);
  },
};

/* =======================================================================
   CURSO / COURSE (módulos, lições PPP, tarefas TBLT)
   ======================================================================= */
const courseView = {
  async load() {
    const box = $("#modules-list");
    box.innerHTML = '<p class="course-intro">Carregando…</p>';
    let d;
    try { d = await (await fetch(API + "/api/course")).json(); }
    catch { box.innerHTML = '<p class="course-intro">Erro ao carregar o curso.</p>'; return; }
    box.innerHTML = "";
    d.modules.forEach((m) => box.appendChild(this.moduleEl(m)));
  },

  moduleEl(m) {
    const el = document.createElement("div");
    el.className = "module" + (m.locked ? " locked" : "");
    const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
    let lessons = "";
    if (m.coming_soon) {
      lessons = `<div class="coming-soon">🚧 Em breve</div>`;
    } else if (m.locked) {
      lessons = `<div class="module-locked-msg">🔒 ${escapeHTML(m.locked_hint || "Bloqueado")}</div>`;
    } else {
      lessons = `<div class="lesson-list">` + m.lessons.map((l) =>
        `<button class="lesson-item" data-lesson="${l.id}">
           <span class="lesson-dot ${l.done ? "done" : ""}">${l.done ? "✓" : "▶"}</span>
           <span class="lesson-meta">
             <span class="lm-title">${escapeHTML(l.title)}</span>
             <span class="lm-sub">${escapeHTML(l.method)} · ${l.minutes} min · ${escapeHTML(l.can_do)}</span>
           </span>
         </button>`).join("") + `</div>`;
    }
    el.innerHTML =
      `<div class="module-head" style="background:${m.color}">
         <div class="mh-top"><span>MÓDULO · ${m.cefr}</span><span>${m.done}/${m.total}</span></div>
         <h3>${escapeHTML(m.title)}</h3>
         <div class="mh-sub">${escapeHTML(m.subtitle)}</div>
         <div class="module-bar"><div style="width:${pct}%"></div></div>
       </div>${lessons}`;
    el.querySelectorAll("[data-lesson]").forEach((b) =>
      b.addEventListener("click", () => lesson.open(b.dataset.lesson)));
    return el;
  },
};

const lesson = {
  data: null,
  stages: [],
  idx: 0,

  async open(id) {
    try { this.data = await (await fetch(API + "/api/course/lesson/" + id)).json(); }
    catch { return; }
    this.score = 0; // PT-BR: zera o placar de exercícios. EN: reset exercise score.
    // PT-BR: monta as etapas (PPP): material -> prática -> produção (tarefa).
    // EN: build stages (PPP): presentation -> practice -> production (task).
    this.stages = ["material", ...this.data.exercises.map((_, i) => "ex" + i), "task"];
    this.idx = 0;
    nav("lesson");
    this.render();
  },

  render() {
    const total = this.stages.length;
    $("#lesson-progress-fill").style.width = ((this.idx) / total) * 100 + "%";
    $("#lesson-step-chip").textContent = `${this.idx + 1}/${total}`;
    const stage = this.stages[this.idx];
    if (stage === "material") this.renderMaterial();
    else if (stage === "task") this.renderTask();
    else this.renderExercise(parseInt(stage.slice(2), 10));
  },

  next() {
    this.idx++;
    if (this.idx >= this.stages.length) return this.finish();
    this.render();
  },

  renderMaterial() {
    const d = this.data;
    const vocab = d.vocab.map((v) =>
      `<div class="vocab-card"><div class="v-en">${escapeHTML(v.en)}</div><div class="v-pt">${escapeHTML(v.pt)}</div></div>`).join("");
    $("#lesson-body").innerHTML =
      `<div class="lesson-stage">
         <div class="stage-tag">📖 Material · ${escapeHTML(d.method)}</div>
         <h2>${escapeHTML(d.title)}</h2>
         <div class="material">${mdBlock(d.material_pt)}</div>
         <h3 style="margin-top:18px">🗂️ Vocabulário</h3>
         <div class="vocab-grid">${vocab}</div>
         <button class="btn-primary" id="lesson-next">Praticar</button>
       </div>`;
    $("#lesson-next").onclick = () => this.next();
  },

  renderExercise(i) {
    const ex = this.data.exercises[i];
    let answered = false;
    $("#lesson-body").innerHTML =
      `<div class="lesson-stage">
         <div class="stage-tag">✏️ Prática ${i + 1}</div>
         <h2 class="q-text">${escapeHTML(ex.question)}</h2>
         <div class="options" id="lesson-opts"></div>
         <div id="lesson-fb" class="feedback hidden"></div>
       </div>`;
    const box = $("#lesson-opts");
    ex.options.forEach((opt, oi) => {
      const b = document.createElement("button");
      b.className = "opt"; b.textContent = opt;
      b.onclick = () => {
        if (answered) return;
        answered = true;
        $$("#lesson-opts .opt").forEach((x) => (x.disabled = true));
        const opts = $$("#lesson-opts .opt");
        opts[ex.answer].classList.add("correct");
        if (oi !== ex.answer) opts[oi].classList.add("wrong");
        const correct = oi === ex.answer;
        if (correct) this.score = (this.score || 0) + 1;
        const fb = $("#lesson-fb");
        fb.className = "feedback " + (correct ? "ok" : "no");
        fb.innerHTML =
          `<div class="feedback-title">${correct ? "✓ Correto!" : "✗ Quase!"}</div>
           <div class="feedback-exp">${escapeHTML(ex.explanation)}</div>
           <button class="btn-primary" id="lesson-next">Continuar</button>`;
        $("#lesson-next").onclick = () => this.next();
      };
      box.appendChild(b);
    });
  },

  renderTask() {
    const t = this.data.task;
    $("#lesson-body").innerHTML =
      `<div class="lesson-stage">
         <div class="stage-tag">🎯 Tarefa (produção)</div>
         <h2>Sua vez de usar!</h2>
         <div class="task-box">
           <div class="task-label">Tarefa</div>
           <div>${escapeHTML(t.prompt_pt)}</div>
           <div class="task-en">${escapeHTML(t.prompt_en)}</div>
         </div>
         <button class="mic-inline" id="task-mic">🎤 Falar resposta</button>
         <textarea class="task-answer" id="task-answer" placeholder="…ou escreva sua resposta em inglês aqui"></textarea>
         <div id="task-fb"></div>
         <button class="btn-primary" id="task-submit">Enviar para o professor</button>
       </div>`;
    // PT-BR: ditar a resposta pela voz (opcional). EN: dictate answer by voice (optional).
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = $("#task-mic");
    if (SR) {
      const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
      rec.onresult = (e) => {
        $("#task-answer").value = ($("#task-answer").value + " " + e.results[0][0].transcript).trim();
        micBtn.classList.remove("listening"); micBtn.textContent = "🎤 Falar resposta";
      };
      rec.onend = () => { micBtn.classList.remove("listening"); micBtn.textContent = "🎤 Falar resposta"; };
      micBtn.onclick = () => { try { rec.start(); micBtn.classList.add("listening"); micBtn.textContent = "🔴 Ouvindo…"; } catch {} };
    } else {
      micBtn.style.display = "none";
    }
    $("#task-submit").onclick = () => this.submitTask();
  },

  async submitTask() {
    const answer = $("#task-answer").value.trim();
    if (!answer) { $("#task-fb").innerHTML = '<div class="task-feedback">Escreva ou fale sua resposta primeiro.</div>'; return; }
    $("#task-fb").innerHTML = '<div class="task-feedback">O professor está avaliando…</div>';
    $("#task-submit").disabled = true;
    let fb = "";
    try {
      const r = await fetch(API + "/api/course/task-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: this.data.id, transcript: answer }),
      });
      fb = (await r.json()).feedback;
    } catch { fb = "Não foi possível avaliar agora."; }
    $("#task-fb").innerHTML = `<div class="task-feedback">🧑‍🏫 ${mdLite(fb)}</div>`;
    if (window.speechSynthesis) talk.speak(fb.replace(/[^A-Za-z0-9 .,!?']/g, " "));
    $("#task-submit").textContent = "Concluir lição";
    $("#task-submit").disabled = false;
    $("#task-submit").onclick = () => this.next();
  },

  async finish() {
    const total = this.data.exercises.length;
    const score = Math.round(((this.score || 0) / (total || 1)) * 100);
    try {
      await fetch(API + "/api/course/lesson/" + this.data.id + "/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
    } catch {}
    this.score = 0;
    $("#lesson-progress-fill").style.width = "100%";
    $("#lesson-body").innerHTML =
      `<div class="lesson-done-card">
         <div class="big-emoji">🎉</div>
         <h2>Lição concluída!</h2>
         <p class="result-score">Você acertou ${score}% dos exercícios.</p>
         <button class="btn-primary" data-nav="course">Voltar ao curso</button>
         <button class="btn-ghost" data-nav="talk">Praticar conversando</button>
       </div>`;
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

// PT-BR: destrava o áudio (navegadores mobile só falam depois de um toque do usuário).
// EN: unlock audio (mobile browsers only speak after a user gesture).
let ttsUnlocked = false;
function unlockTTS() {
  if (ttsUnlocked || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.resume();
    ttsUnlocked = true;
  } catch { /* ignore */ }
}
document.addEventListener("pointerdown", unlockTTS);

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

// PT-BR: renderiza um bloco de material (títulos, negrito, itálico, listas, parágrafos).
// EN: render a material block (headings, bold, italic, lists, paragraphs).
function mdBlock(str) {
  const lines = str.split("\n");
  let html = "", inList = false;
  const inline = (s) => escapeHTML(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\*])\*([^\*]+?)\*/g, "$1<em>$2</em>");
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) { if (inList) { html += "</ul>"; inList = false; } continue; }
    if (/^-\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + inline(line.replace(/^-\s+/, "")) + "</li>";
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (/^###\s/.test(line)) html += "<h3>" + inline(line.slice(4)) + "</h3>";
      else if (/^##\s/.test(line)) html += "<h3>" + inline(line.slice(3)) + "</h3>";
      else html += "<p>" + inline(line) + "</p>";
    }
  }
  if (inList) html += "</ul>";
  return html;
}

/* ---------- Instalação do app (PWA) / App install (PWA) ---------- */
// PT-BR: captura o evento de instalação e mostra o botão (Mac/Windows/Linux via navegador).
// EN: capture the install event and show the button (Mac/Windows/Linux via the browser).
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  $("#install-btn").classList.remove("hidden");
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  $("#install-btn").classList.add("hidden");
});
$("#install-btn").onclick = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("#install-btn").classList.add("hidden");
};

/* ---------- Boot ---------- */
$("#btn-start-test").onclick = () => test.start();
$("#btn-save-profile").onclick = () => profile.save();
boot();

/* PT-BR: Service worker (PWA offline shell). EN: Service worker (PWA offline shell). */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
