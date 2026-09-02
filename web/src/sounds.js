// PT-BR: Sons de feedback (acerto/erro) via Web Audio — sem arquivos externos.
// EN:    Feedback sounds (correct/wrong) via Web Audio — no external files.
let ctx = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(c, freq, start, dur, type = "sine", gain = 0.12) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// PT-BR: acorde ascendente curto e alegre. EN: short rising happy chord.
export function playCorrect() {
  const c = audio();
  if (!c) return;
  tone(c, 523.25, 0, 0.16, "sine");
  tone(c, 659.25, 0.09, 0.18, "sine");
  tone(c, 783.99, 0.18, 0.26, "sine");
}

// PT-BR: acorde descendente curto e suave. EN: short soft falling chord.
export function playWrong() {
  const c = audio();
  if (!c) return;
  tone(c, 440, 0, 0.18, "sine", 0.10);
  tone(c, 349.23, 0.12, 0.28, "sine", 0.10);
}

// PT-BR: clique de botão — toca o áudio externo /click.mp3 (fornecido pelo usuário).
// EN:    button click — plays the external /click.mp3 provided by the user.
let _click = null;
export function playClick() {
  const c = audio(); // PT-BR: garante AudioContext destravado/ativo. EN: ensure AudioContext unlocked.
  if (!c) return;
  if (!_click) {
    _click = new Audio("/click.mp3");
    _click.preload = "auto";
  }
  _click.currentTime = 0;
  const p = _click.play();
  if (p && p.catch) p.catch(() => {});
}
