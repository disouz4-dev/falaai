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

// PT-BR: cria um reconhecedor push-to-talk. Retorna { start, stop, supported }.
// EN: creates a push-to-talk recognizer. Returns { start, stop, supported }.
export function createRecognizer({ onListening, onResult, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return { supported: false, start() {}, stop() {} };

  const recog = new SR();
  recog.lang = "en-US";
  recog.continuous = true;      // PT-BR: captura enquanto segura. EN: capture while held.
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  let transcript = "";
  let holding = false;          // PT-BR: usuário está com o botão pressionado? EN: is the button held?

  recog.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " ";
    }
  };
  recog.onerror = (e) => {
    // PT-BR: 'no-speech'/'aborted' são normais durante pausas; não trata como falha.
    // EN: 'no-speech'/'aborted' are normal during pauses; not a real error.
    if (e.error !== "no-speech" && e.error !== "aborted") onError?.(e.error);
  };
  recog.onend = () => {
    // PT-BR: parou sozinho MAS o usuário ainda segura → REINICIA para não cortar a fala.
    // EN: auto-stopped but the button is still held → RESTART so speech isn't cut off.
    if (holding) {
      try {
        recog.start();
      } catch {
        setTimeout(() => { if (holding) { try { recog.start(); } catch {} } }, 120);
      }
      return;
    }
    // PT-BR: usuário SOLTOU → envia a fala acumulada. EN: user RELEASED → send accumulated speech.
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
      try { recog.start(); } catch {}
    },
    stop() {
      if (!holding) return;
      holding = false;
      try { recog.stop(); } catch {}
    },
  };
}
