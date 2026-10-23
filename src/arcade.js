import { CAPSULE_ON } from './capsule.js';
// The Chog Arcade: a painted room (assets/arcade/arcade.webp) with five cabinets. Their screens are live canvases
// laid over the painting: the Brick Studio one shows your Chog in pixels, Chog Drop rains blocks, Wannabe Run has a
// tiny runner, and the two empty cabinets show static. Click a cabinet to open its game under the room.

const IW = 1672, IH = 941; // the painting's own pixels
// [game, cabinet box, screen box, marquee centre] in painting pixels
const MACHINES = [
  CAPSULE_ON ? { game: 'capsule', name: 'Chog Capsule', cab: [175, 250, 237, 410], screen: [220, 325, 150, 116], label: [300, 282] } : { game: 'soon', name: 'Coming soon', cab: [175, 250, 237, 410], screen: [220, 325, 150, 116], label: [300, 282] },
  { game: 'drop', name: 'Chog Drop', cab: [445, 250, 227, 410], screen: [487, 325, 151, 116], label: [560, 282] },
  { game: 'studio', name: 'Brick Studio', cab: [705, 222, 262, 445], screen: [750, 310, 176, 133], label: [836, 262] },
  { game: 'run', name: 'Wannabe Run', cab: [1005, 250, 222, 410], screen: [1042, 325, 151, 116], label: [1120, 282] },
  { game: 'soon', name: 'Coming soon', cab: [1262, 250, 238, 410], screen: [1302, 325, 151, 116], label: [1380, 282] },
];
const pct = (v, of) => `${(v / of * 100).toFixed(3)}%`;
const box = ([x, y, w, h]) => `left:${pct(x, IW)};top:${pct(y, IH)};width:${pct(w, IW)};height:${pct(h, IH)}`;
const DROP_COLS = ['#836ef9', '#e845a4', '#ffd66b', '#5bc8ff', '#6cc48a', '#ff8a1f'];

/** stage: an empty element. onPick(game). Returns { dive(game, out), reset(), setActive(game), setChog(url), pause(bool) }. */
export function startArcade(stage, { onPick } = {}) {
  stage.innerHTML = `<div class="ar-inner"><img class="ar-room" src="assets/arcade/arcade.webp" alt="The Chog Arcade: five arcade cabinets in a dark purple room">
    ${MACHINES.map((m, i) => `<span class="ar-glow g-${m.game}" style="${box([m.screen[0] - 40, m.screen[1] + m.screen[3] * 0.6, m.screen[2] + 80, 420])}" aria-hidden="true"></span>
      <canvas class="ar-screen s-${m.game}" width="160" height="120" style="${box(m.screen)}" aria-hidden="true"></canvas>
      <span class="ar-label" style="left:${pct(m.label[0], IW)};top:${pct(m.label[1], IH)}" aria-hidden="true">${m.name}</span>
      <button type="button" class="ar-cab" data-i="${i}" data-game="${m.game}" style="${box(m.cab)}" ${m.game === 'soon' ? 'aria-disabled="true"' : ''} aria-label="${m.game === 'soon' ? 'Coming soon' : `Play ${m.name}`}"></button>`).join('')}</div><i class="ar-flash" aria-hidden="true"></i>`;
  const inner = stage.querySelector('.ar-inner'), flash = stage.querySelector('.ar-flash');
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the camera dives into a cabinet's screen (or backs out of it): scale the room around that screen until it fills the view
  function dive(game, out = false) {
    const m = MACHINES.find((x) => x.game === game); if (!m || reduce()) return Promise.resolve();
    const [x, y, w, h] = m.screen, ox = (x + w / 2) / IW * 100, oy = (y + h / 2) / IH * 100, k = Math.min(IW / w, IH / h) * 1.05;
    inner.style.transformOrigin = `${ox}% ${oy}%`;
    const frames = [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: `scale(${k})`, filter: 'brightness(1.7)' }];
    const glow = { studio: '#a99bfc', drop: '#5bc8ff', run: '#ffd66b' }[game] || '#fff';
    flash.style.background = `radial-gradient(circle at ${ox}% ${oy}%, #fff 0%, ${glow} 35%, rgba(10,6,18,.9) 80%)`;
    const a = inner.animate(out ? frames.reverse() : frames, { duration: out ? 520 : 720, easing: out ? 'cubic-bezier(.1,.6,.3,1)' : 'cubic-bezier(.65,0,.85,.35)', fill: 'forwards' });
    flash.animate(out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: out ? 420 : 720, easing: 'ease-in', fill: 'forwards' });
    // never wait on an animation forever (a background tab can freeze it): move on after its length plus a little
    return Promise.race([a.finished.catch(() => {}), new Promise((r) => setTimeout(r, (out ? 520 : 720) + 250))])
      .then(() => { if (out) { inner.getAnimations().forEach((x) => x.cancel()); flash.getAnimations().forEach((x) => x.cancel()); } });
  }
  const screens = [...stage.querySelectorAll('.ar-screen')].map((cv, i) => ({ cv, c: cv.getContext('2d'), m: MACHINES[i] }));
  stage.addEventListener('click', (e) => {
    const b = e.target.closest('.ar-cab'); if (!b) return;
    if (b.dataset.game === 'soon') { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    onPick?.(b.dataset.game);
  });

  // what's on the screens
  let chog = null, pix = null, t = 0;
  const off = document.createElement('canvas'); off.width = off.height = 22;
  const kid = new Image(); kid.src = 'assets/chogs/apprentice.webp';
  const blocks = [], stack = Array(8).fill(0);
  function drawStudio({ c }) {
    c.fillStyle = '#120c1e'; c.fillRect(0, 0, 160, 120);
    if (pix) { c.imageSmoothingEnabled = false; const s = 104; c.globalAlpha = 0.85 + Math.sin(t * 2) * 0.1; c.drawImage(pix, 28, 8, s, s); c.globalAlpha = 1; }
    else { c.fillStyle = '#836ef9'; c.font = '700 14px monospace'; c.textAlign = 'center'; c.fillText('BRICK', 80, 62); }
  }
  function drawDrop({ c }) {
    c.fillStyle = '#0f0b1a'; c.fillRect(0, 0, 160, 120);
    if (Math.random() < 0.07 && blocks.length < 3) blocks.push({ col: Math.floor(Math.random() * 8), y: -12, color: DROP_COLS[Math.floor(Math.random() * DROP_COLS.length)] });
    for (const b of blocks) {
      b.y += 2.2; const floor = 120 - (stack[b.col] + 1) * 12;
      if (b.y >= floor) { b.y = floor; stack[b.col] += 1; b.done = true; }
      c.fillStyle = b.color; c.fillRect(b.col * 20 + 1, b.y, 18, 11);
    }
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].done) { (drawDrop.settled ||= []).push(blocks[i]); blocks.splice(i, 1); }
    for (const b of drawDrop.settled || []) { c.fillStyle = b.color; c.fillRect(b.col * 20 + 1, b.y, 18, 11); }
    if (Math.max(...stack) >= 8) { stack.fill(0); drawDrop.settled = []; }
  }
  const runObs = [{ x: 170 }, { x: 260 }];
  function drawRun({ c }) {
    c.fillStyle = '#100b1c'; c.fillRect(0, 0, 160, 120);
    c.fillStyle = '#ffe9c4'; c.beginPath(); c.arc(132, 22, 8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a99bfc'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 96); c.lineTo(160, 96); c.stroke();
    for (const o of runObs) { o.x -= 2.6; if (o.x < -12) o.x = 160 + Math.random() * 90; c.fillStyle = '#e2333d'; c.fillRect(o.x, 82, 10, 14); }
    const near = runObs.some((o) => o.x > 26 && o.x < 62), y = near ? 22 : Math.abs(Math.sin(t * 14)) * 2;
    if (kid.complete && kid.naturalWidth) c.drawImage(kid, 30, 96 - 36 - y, 32, 36);
    c.fillStyle = '#ffd66b'; c.beginPath(); c.arc(((t * 60) % 200) * -1 + 180, 52, 4, 0, Math.PI * 2); c.fill();
  }
  function drawSoon({ c }) {
    const img = c.createImageData(80, 60);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 70; img.data[i] = v; img.data[i + 1] = v * 0.9; img.data[i + 2] = v * 1.3; img.data[i + 3] = 255; }
    off.width = 80; off.height = 60; off.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false; c.drawImage(off, 0, 0, 160, 120); off.width = off.height = 22;
    if (Math.floor(t * 1.5) % 2 === 0) { c.fillStyle = 'rgba(232,69,164,.9)'; c.font = '700 16px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SOON', 80, 60); }
  }
  // Chog Capsule: coloured capsules bobbing in a glass dome
  const CAPS = DROP_COLS.map((col, i) => ({ col, x: 30 + (i % 3) * 45, y: 40 + Math.floor(i / 3) * 34, p: i }));
  function drawCapsule({ c }) {
    c.fillStyle = '#160b1c'; c.fillRect(0, 0, 160, 120);
    c.fillStyle = 'rgba(169,155,252,.15)'; c.beginPath(); c.arc(80, 60, 52, 0, Math.PI * 2); c.fill();
    for (const k of CAPS) {
      const y = k.y + Math.sin(t * 3 + k.p) * 4;
      c.fillStyle = k.col; c.beginPath(); c.arc(k.x + 8, y, 12, Math.PI, 0); c.fill();
      c.fillStyle = '#f4f1fe'; c.beginPath(); c.arc(k.x + 8, y, 12, 0, Math.PI); c.fill();
    }
  }
  const DRAW = { studio: drawStudio, drop: drawDrop, run: drawRun, soon: drawSoon, capsule: drawCapsule };
  function frame() {
    t += 1 / 24;
    for (const s of screens) {
      DRAW[s.m.game](s);
      s.c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 120; y += 3) s.c.fillRect(0, y, 160, 1); // scanlines
    }
  }
  let timer = 0, visible = false, paused = false;
  const run = () => { clearInterval(timer); if (visible && !paused && !document.hidden) timer = setInterval(frame, 1000 / 24); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(stage);
  document.addEventListener('visibilitychange', run);
  frame();

  return {
    dive,
    reset() { inner.getAnimations().forEach((x) => x.cancel()); flash.getAnimations().forEach((x) => x.cancel()); },
    setActive(game) { stage.querySelectorAll('.ar-cab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.game === game))); },
    setChog(url) {
      if (!url || url === chog) return; chog = url;
      const i = new Image(); if (/^https?:/.test(url)) i.crossOrigin = 'anonymous';
      i.onload = () => { const g = off.getContext('2d'); g.imageSmoothingEnabled = true; g.clearRect(0, 0, 22, 22); g.drawImage(i, 0, 0, 22, 22); const p = document.createElement('canvas'); p.width = p.height = 22; p.getContext('2d').drawImage(off, 0, 0); pix = p; };
      i.src = url;
    },
    pause(p) { paused = p; run(); },
  };
}
