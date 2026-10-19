// Chiptune sound effects, synthesised with Web Audio (no files to load). Sounds only start after the
// player's first click or key press, as browsers require; the SFX toggle is remembered per browser.
const KEY = 'chog-contracts-sfx';
let ctx = null, master = null;
let on = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
addEventListener('pointerdown', () => on && audio(), { once: true });

// one tone with a quick attack and an exponential fade
function tone(freq, { at = 0, dur = 0.12, type = 'square', vol = 0.5, slide = 0 } = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
// a burst of filtered noise: hits, slams, gas
function noise({ at = 0, dur = 0.15, vol = 0.5, freq = 1800, q = 0.8 } = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + at, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
const notes = (list, step, opts) => list.forEach((f, i) => tone(f, { at: i * step, ...opts }));

const SOUNDS = {
  click: () => tone(660, { dur: 0.05, vol: 0.25 }),
  hit: () => { noise({ dur: 0.12, freq: 1400 }); tone(220, { dur: 0.1, slide: 0.5, vol: 0.35 }); },
  weak: () => { noise({ dur: 0.14, freq: 2200 }); notes([880, 1320], 0.05, { dur: 0.08, vol: 0.3 }); },
  crit: () => { noise({ dur: 0.18, freq: 2600, vol: 0.6 }); tone(1046, { dur: 0.2, slide: 0.5, vol: 0.35 }); },
  heal: () => notes([523, 659, 784, 1046], 0.06, { dur: 0.12, type: 'triangle', vol: 0.35 }),
  shield: () => { tone(392, { dur: 0.3, type: 'triangle', slide: 2, vol: 0.3 }); tone(784, { at: 0.05, dur: 0.25, type: 'sine', vol: 0.2 }); },
  energy: () => tone(1318, { dur: 0.07, type: 'triangle', vol: 0.2 }),
  ult: () => { tone(220, { dur: 0.5, type: 'sawtooth', slide: 6, vol: 0.35 }); noise({ at: 0.35, dur: 0.35, freq: 900, vol: 0.6 }); },
  warn: () => notes([392, 392], 0.16, { dur: 0.09, vol: 0.3 }),
  monster: () => { tone(110, { dur: 0.25, type: 'sawtooth', slide: 0.6, vol: 0.4 }); noise({ dur: 0.2, freq: 500, vol: 0.4 }); },
  hurt: () => { noise({ dur: 0.16, freq: 800, vol: 0.55 }); tone(160, { dur: 0.14, slide: 0.6, vol: 0.35 }); },
  miss: () => tone(1200, { dur: 0.12, type: 'sine', slide: 0.4, vol: 0.2 }),
  win: () => notes([523, 659, 784, 1046, 1318], 0.09, { dur: 0.16, vol: 0.32 }),
  lose: () => notes([392, 330, 262, 196], 0.14, { dur: 0.2, type: 'triangle', vol: 0.3 }),
  drink: () => { notes([300, 380, 470, 590], 0.07, { dur: 0.06, type: 'sine', vol: 0.3 }); tone(880, { at: 0.32, dur: 0.25, type: 'triangle', slide: 1.5, vol: 0.25 }); },
  coin: () => notes([988, 1319], 0.07, { dur: 0.12, vol: 0.28 }),
  door: () => { tone(80, { dur: 0.6, type: 'sawtooth', slide: 0.7, vol: 0.25 }); noise({ dur: 0.5, freq: 300, vol: 0.3 }); },
};

export function play(name) { if (on && SOUNDS[name]) { try { SOUNDS[name](); } catch {} } }
export const sfxOn = () => on;
export function setSfx(value) { on = value; try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch {} if (on) audio(); }
