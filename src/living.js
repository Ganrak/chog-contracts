// "Living card": the real NFT art stays untouched; its traits drive effects around it, so every one of the
// 1,969 Chogs comes alive the same way. Aura trait → particles around the card, Tier → holo sheen, element →
// strike glow, and the card itself breathes, winds up, gets cracked, celebrates or falls.
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Aura trait (as written in Chog Genesis metadata) → particle style
function auraStyle(aura, fallback) {
  const a = String(aura || '').toLowerCase();
  if (/burning|fiery|^fire/.test(a)) return { type: 'ember', color: '#ff8a1f', n: 60 };
  if (/aqua|cool/.test(a)) return { type: 'bubble', color: '#6fd6ff', n: 34 };
  if (/wind|clean|white/.test(a)) return { type: 'wind', color: '#eef4ff', n: 22 };
  if (/yellow|electric/.test(a)) return { type: 'spark', color: '#ffe14a', n: 26 };
  if (/royal blue/.test(a)) return { type: 'glint', color: '#7fa2ff', n: 30 };
  if (/royal/.test(a)) return { type: 'glint', color: '#ffd66b', n: 30 };
  if (/rose|pink/.test(a)) return { type: 'petal', color: '#ff86bd', n: 30 };
  if (/mint|green/.test(a)) return { type: 'leaf', color: '#6ce5b1', n: 30 };
  if (/smoke/.test(a)) return { type: 'smoke', color: '#9a93a8', n: 24 };
  if (/purple|violet/.test(a)) return { type: 'motes', color: '#b59bff', n: 38 };
  return { type: 'motes', color: fallback, n: 22 }; // no aura: a few motes in the element's colour
}

/**
 * card: the framed NFT element (#me-art). host: its positioned parent. traits: the token's traits.
 * color: element colour. Returns controls for the arena to call.
 */
export function startLiving({ card, host, traits = {}, color = '#a99bfc' }) {
  const style = auraStyle(traits.Aura, color);
  const tier = String(traits.Tier || '');
  card.classList.add('living');
  card.classList.toggle('holo', /rare|epic|legendary/i.test(tier));
  card.style.setProperty('--aura', style.color);

  // particles live on a canvas around the card, behind it
  const cv = document.createElement('canvas'); cv.className = 'aura-fx'; cv.setAttribute('aria-hidden', 'true');
  host.prepend(cv);
  const g = cv.getContext('2d');
  let W = 0, H = 0, box = null, raf = 0, last = performance.now(), dead = false, burst = 0;
  const ps = [];
  function size() {
    const r = cv.getBoundingClientRect(), c = card.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    box = { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height };
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // spawn on a band around the card's edges (sides and bottom for rising types, anywhere around for the rest)
  function spawn() {
    if (!box) return;
    const t = style.type, side = Math.random();
    let x, y;
    if (t === 'wind') { x = box.x - 30; y = rnd(box.y, box.y + box.h); }
    else if (t === 'petal' || t === 'leaf') { x = rnd(box.x - 20, box.x + box.w + 20); y = box.y - 10; }
    else if (side < 0.35) { x = box.x - rnd(4, 26); y = rnd(box.y + box.h * 0.2, box.y + box.h); }
    else if (side < 0.7) { x = box.x + box.w + rnd(4, 26); y = rnd(box.y + box.h * 0.2, box.y + box.h); }
    else { x = rnd(box.x, box.x + box.w); y = box.y + box.h + rnd(0, 14); }
    const p = { x, y, t: 0, life: rnd(1.2, 2.6), s: rnd(1, 2.2), vx: rnd(-8, 8), vy: rnd(-38, -18), r: rnd(0, 6.28) };
    if (t === 'wind') { p.vx = rnd(120, 200); p.vy = rnd(-6, 6); p.life = rnd(0.8, 1.3); }
    if (t === 'petal' || t === 'leaf') { p.vx = rnd(-14, 14); p.vy = rnd(16, 30); p.life = rnd(2.4, 3.6); }
    if (t === 'smoke') { p.vy = rnd(-20, -10); p.life = rnd(2, 3.2); }
    if (t === 'spark' || t === 'glint') { p.vx = 0; p.vy = 0; p.life = rnd(0.25, 0.6); x = rnd(box.x - 22, box.x + box.w + 22); p.x = x; p.y = rnd(box.y - 18, box.y + box.h + 10); }
    ps.push(p);
  }
  function drawP(p) {
    const k = p.t / p.life, a = Math.sin(Math.PI * Math.min(1, k)), c = style.color;
    g.globalAlpha = a; g.fillStyle = c; g.strokeStyle = c;
    switch (style.type) {
      case 'ember': g.globalAlpha = a * (0.6 + 0.4 * Math.random()); g.fillRect(p.x, p.y, 3 * p.s, 3 * p.s); break;
      case 'bubble': g.lineWidth = 1.5; g.beginPath(); g.arc(p.x + Math.sin(p.t * 5 + p.r) * 5, p.y, 4 * p.s, 0, 6.28); g.stroke(); break;
      case 'wind': g.lineWidth = 2; g.globalAlpha = a * 0.7; g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + 24, p.y - 6, p.x + 48, p.y); g.stroke(); break;
      case 'spark': { g.lineWidth = 2; g.beginPath(); let x = p.x, y = p.y; g.moveTo(x, y); for (let i = 0; i < 3; i++) { x += rnd(-7, 7); y += rnd(4, 9); g.lineTo(x, y); } g.stroke(); break; }
      case 'glint': { const s = 7 * p.s * a; g.beginPath(); g.moveTo(p.x, p.y - s); g.lineTo(p.x + s * 0.25, p.y - s * 0.25); g.lineTo(p.x + s, p.y); g.lineTo(p.x + s * 0.25, p.y + s * 0.25); g.lineTo(p.x, p.y + s); g.lineTo(p.x - s * 0.25, p.y + s * 0.25); g.lineTo(p.x - s, p.y); g.lineTo(p.x - s * 0.25, p.y - s * 0.25); g.fill(); break; }
      case 'petal': case 'leaf': g.save(); g.translate(p.x + Math.sin(p.t * 2 + p.r) * 8, p.y); g.rotate(p.r + p.t * 2); g.beginPath(); g.ellipse(0, 0, 5 * p.s, 2.6 * p.s, 0, 0, 6.28); g.fill(); g.restore(); break;
      case 'smoke': g.globalAlpha = a * 0.28; g.beginPath(); g.arc(p.x, p.y, (6 + p.t * 10) * p.s, 0, 6.28); g.fill(); break;
      default: g.globalAlpha = a * 0.8; g.beginPath(); g.arc(p.x, p.y, 2.2 * p.s, 0, 6.28); g.fill();
    }
  }
  function loop(now) {
    if (dead) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!box) size();
    const want = style.n + burst;
    for (let k = 0; k < 2 && ps.length < want; k++) if (Math.random() < 0.8 + burst / 20) spawn();
    burst = Math.max(0, burst - dt * 30);
    g.clearRect(0, 0, W, H);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { ps.splice(i, 1); continue; }
      drawP(p);
    }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(loop);
  }
  if (!reduce()) { size(); raf = requestAnimationFrame(loop); }
  const onResize = () => size();
  addEventListener('resize', onResize);

  const anim = (frames, opts) => (reduce() ? null : card.animate(frames, opts));
  return {
    /** wind up, thrust forward with an element-coloured flash, and puff the aura */
    strike(c = color) {
      burst = 70;
      anim([
        { transform: 'translate(0,0) rotate(0) scale(1)', filter: 'none' },
        { transform: 'translate(-20px,6px) rotate(-8deg) scale(.92,1.07)', offset: 0.35 },
        { transform: 'translate(38px,-8px) rotate(6deg) scale(1.12,.93)', filter: `drop-shadow(0 0 30px ${c}) drop-shadow(0 0 12px ${c}) brightness(1.5)`, offset: 0.62 },
        { transform: 'translate(0,0) rotate(0) scale(1)', filter: 'none' },
      ], { duration: 480, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    },
    /** red flash; below half health the card shows cracks, below a quarter more of them */
    hurt(hpShare) {
      card.classList.remove('hurt'); void card.offsetWidth; card.classList.add('hurt');
      setTimeout(() => card.classList.remove('hurt'), 380);
      card.classList.toggle('cracked', hpShare < 0.5); card.classList.toggle('cracked2', hpShare < 0.25);
    },
    heal(hpShare) { burst = 40; card.classList.toggle('cracked', hpShare < 0.5); card.classList.toggle('cracked2', hpShare < 0.25); },
    /** where the eyes are, for laser ultimates (the art faces left or right by its Side trait) */
    eyes() {
      const r = card.getBoundingClientRect(), left = /left/i.test(traits.Side || '');
      const y = r.top + r.height * 0.47, x1 = r.left + r.width * (left ? 0.36 : 0.44), x2 = r.left + r.width * (left ? 0.56 : 0.64);
      return [{ x: x1, y }, { x: x2, y: y - r.height * 0.01 }];
    },
    win() {
      burst = 140; card.classList.add('victor');
      anim([{ transform: 'translateY(0) rotateY(0)' }, { transform: 'translateY(-60px) rotateY(180deg) scale(1.12)', offset: 0.5 }, { transform: 'translateY(0) rotateY(360deg)' }], { duration: 900, easing: 'ease-in-out' });
    },
    lose() { burst = 0; card.classList.add('fallen'); },
    stop() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); cv.remove(); card.classList.remove('living', 'holo', 'hurt', 'cracked', 'cracked2', 'victor', 'fallen'); },
  };
}
