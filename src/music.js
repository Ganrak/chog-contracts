// Background music: a small chiptune loop synthesised with Web Audio (no files). Two moods share one scheduler:
// 'lodge' (calm, for the page) and 'hunt' (faster, for the arena). Off by default; the choice is remembered.
const KEY = 'chog-contracts-music';
let ctx = null, out = null, timer = null, step = 0, nextAt = 0, mood = 'lodge';
let on = (() => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } })();

const N = (name) => { // note name like 'A3' → frequency
  const i = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[name[0]] + (name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0);
  return 440 * 2 ** ((i + (Number(name.at(-1)) - 4) * 12) / 12);
};
// each mood: tempo, and per bar a bass root and an arpeggio (4 notes, played as 16ths)
const MOODS = {
  lodge: { bpm: 96, bars: [['A2', ['A4', 'C5', 'E5', 'C5']], ['F2', ['F4', 'A4', 'C5', 'A4']], ['C3', ['G4', 'C5', 'E5', 'C5']], ['G2', ['G4', 'B4', 'D5', 'B4']]], drums: false },
  hunt: { bpm: 132, bars: [['D2', ['D5', 'F5', 'A5', 'F5']], ['Bb1', ['D5', 'F5', 'Bb5', 'F5']], ['C2', ['E5', 'G5', 'C6', 'G5']], ['A1', ['E5', 'A5', 'C#6', 'A5']]], drums: true },
};

function tone(freq, at, dur, type, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.02);
}
function hat(at, vol) {
  const len = Math.ceil(ctx.sampleRate * 0.04), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(out); s.start(at);
}

// schedule a little ahead of the clock so timing stays tight even if the page is busy
function tick() {
  const m = MOODS[mood], s16 = 60 / m.bpm / 4;
  while (nextAt < ctx.currentTime + 0.12) {
    const bar = m.bars[Math.floor(step / 16) % m.bars.length], i = step % 16;
    if (i % 4 === 0) tone(N(bar[0]), nextAt, s16 * 3.6, 'square', 0.09);           // bass on the beat
    tone(N(bar[1][i % 4]), nextAt, s16 * 0.9, 'triangle', i % 4 === 0 ? 0.08 : 0.05); // arpeggio
    if (m.drums && i % 2 === 0) hat(nextAt, i % 8 === 4 ? 0.12 : 0.05);
    if (m.drums && i % 8 === 4) tone(180, nextAt, 0.09, 'triangle', 0.12);           // snare-ish thump
    nextAt += s16; step += 1;
  }
}

function start() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (timer) return;
  step = 0; nextAt = ctx.currentTime + 0.05;
  timer = setInterval(tick, 25);
}
function stop() { clearInterval(timer); timer = null; }

// browsers only allow sound after a click or key press: start then if the player left music on
addEventListener('pointerdown', () => { if (on) start(); }, { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (on && ctx) start(); });

export const musicOn = () => on;
export function setMusic(value) { on = value; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} if (on) start(); else stop(); }
/** 'lodge' for the page, 'hunt' for the arena. Restarts the loop at the top of the new mood. */
export function setMood(m) { if (m === mood || !MOODS[m]) return; mood = m; step = 0; if (ctx) nextAt = ctx.currentTime + 0.05; }
