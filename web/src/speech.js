// PT-BR: Voz do professor (TTS via servidor, bilíngue) + reconhecimento push-to-talk.
// EN: Teacher voice (server TTS, bilingual) + push-to-talk speech recognition.

let _audio = null;
let _queueToken = 0;

// PT-BR: destrava o áudio no primeiro toque (exigência dos navegadores mobile). EN: unlock audio.
let ttsUnlocked = false;
export function unlockTTS() {
  if (ttsUnlocked || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.resume();
    ttsUnlocked = true;
  } catch { /* ignore */ }
}
if (typeof document !== "undefined") document.addEventListener("pointerdown", unlockTTS);

export function stopSpeaking() {
  if (_audio) { try { _audio.pause(); } catch {} _audio = null; }
  _queueToken++;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// PT-BR: fala o texto — INGLÊS no ensino e PORTUGUÊS nas correções (linhas com 📝).
// EN: speaks the text — ENGLISH for teaching, PORTUGUESE for corrections (📝 lines).
export function speak(text) {
  if (!text) return;
  stopSpeaking();
  const segments = [];
  for (const rawLine of String(text).split(/\n+/)) {
    const isPt = /^\s*📝/.test(rawLine);
    const clean = rawLine
      .replace(/📝\s*\(corre[çc][ãa]o\):?/i, "")
      .replace(/[*_`#>~]/g, "")
      .trim();
    if (clean) segments.push({ text: clean, lang: isPt ? "pt" : "en" });
  }
  if (segments.length) playQueue(segments, 0);
}

function playQueue(segments, i) {
  const token = _queueToken;
  if (i >= segments.length) return;
  const seg = segments[i];
  const audio = new Audio("/api/tts?lang=" + seg.lang + "&text=" + encodeURIComponent(seg.text));
  _audio = audio;
  audio.onended = () => { if (_queueToken === token) playQueue(segments, i + 1); };
  audio.play().catch(() => speakBrowser(segments.map((s) => s.text).join(". ")));
}

function pickEnglishVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const en = voices.filter((v) => /en(-|_)/i.test(v.lang) || /english/i.test(v.name));
  if (!en.length) return null;
  return en.find((v) => /US/i.test(v.lang)) || en[0];
}

// PT-BR: fallback — voz do navegador. EN: fallback — browser voice.
function speakBrowser(clean) {
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
}

// PT-BR: cria um reconhecedor push-to-talk. Enquanto o botão é SEGURADO, continua gravando sem cortar.
// EN: creates a push-to-talk recognizer. While the button is HELD, keeps recording without cutting off.
export function createRecognizer({ onListening, onResult, onError, onInterim }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return { supported: false, start() {}, stop() {} };

  const recog = new SR();
  recog.lang = "en-US";
  recog.continuous = true;      // PT-BR: captura contínua enquanto segura. EN: continuous while held.
  recog.interimResults = true;  // PT-BR: captura fala longa sem perder. EN: capture long speech.
  recog.maxAlternatives = 1;
  let transcript = "";          // PT-BR: acumulador da fala final. EN: final transcript accumulator.
  let holding = false;          // PT-BR: usuário segura o botão? EN: is the button held?
  let restarting = false;       // PT-BR: guarda contra reinícios simultâneos. EN: guards double restarts.
  let resumeAfterRestart = false; // PT-BR: reprograma reinício se o start falhar. EN: plans restart if start fails.

  // PT-BR: reinicia o reconhecedor sem perder o que já foi capturado. EN: restart without losing audio.
  //        Isso é o que impede o CORTE: quando o Chrome para sozinho, a gente religa na hora.
  function startRecognizer() {
    try { recog.start(); } catch { /* pode lançar se já estiver iniciado */ }
  }

  function safeRestart() {
    if (!holding || restarting) return;
    restarting = true;
    resumeAfterRestart = false;
    try { recog.stop(); } catch {}
    // PT-BR: religa logo em seguida. EN: turn it back on right after.
    setTimeout(() => {
      if (!holding) return;
      startRecognizer();
      setTimeout(() => { restarting = false; }, 100);
    }, 60);
  }

  recog.onresult = (e) => {
    let finalText = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        const t = e.results[i][0].transcript;
        if (t) { transcript += t + " "; finalText += t + " "; }
      }
    }
    // PT-BR: feedback visual ao vivo (opcional) sem disparar envio. EN: optional live visual feedback.
    if (finalText) onInterim?.(transcript.trim());
  };

  recog.onerror = (e) => {
    if (e.error === "not-allowed") { onError?.(e.error); return; }
    // 'no-speech'/'aborted' são normais em pausas — não trata como falha nem corta.
    if (e.error !== "no-speech" && e.error !== "aborted" && e.error !== "network" &&
        e.error !== "service-not-allowed" && e.error !== "audio-capture") {
      onError?.(e.error);
    }
  };

  recog.onend = () => {
    // PT-BR: o reconhecedor PAROU sozinho, mas o usuário AINDA SEGURA → religa para não cortar.
    // EN: recognizer STOPPED but the user is STILL HOLDING → turn it back on so speech isn't cut.
    if (holding) {
      safeRestart();
      return;
    }
    // PT-BR: usuário SOLTOU o botão → envia a fala acumulada. EN: user RELEASED → send the speech.
    onListening?.(false);
    const text = transcript.trim();
    transcript = "";
    if (text) onResult?.(text);
  };

  return {
    supported: true,
    start() {
      if (holding) return;
      transcript = "";
      holding = true;
      unlockTTS();
      onListening?.(true);
      startRecognizer();
    },
    stop() {
      if (!holding) return;
      holding = false;
      try { recog.stop(); } catch {}
      // PT-BR: se o reinício estava programado, não dispara. EN: cancel a pending restart.
      setTimeout(() => { if (!holding) resumeAfterRestart = false; }, 0);
    },
  };
}
