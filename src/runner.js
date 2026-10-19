// Wannabe Run: an endless runner in the spirit of the offline dino game. The Wannabe sprints through the night;
// jump the FUD monsters on the ground (tap again in the air for a double jump), stay low under the flying ones,
// grab the $CHOG coins. It speeds up as you go. One hit and the run is over.

const W = 960, H = 320, GROUND = 262;
const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/**
 * canvas: a 960×320 canvas. opts: { onState({ score, best, coins, running, over }) }.
 * Returns { start(), stop(), pause(bool), jump() }.
 */
export function startRunner(canvas, { onState } = {}) {
  const c = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = {}; // art
  const ready = Promise.all([
    load('assets/chogs/apprentice.png'), ...['ghoul', 'troll', 'thief', 'golem', 'harpy', 'wraith'].map((k) => load(`assets/monsters/${k}.png`)),
  ]).then(([kid, ghoul, troll, thief, golem, harpy, wraith]) => Object.assign(A, { kid, ghoul, troll, thief, golem, harpy, wraith }));
  const BEST_KEY = 'chog-contracts-run-best';
  let best = (() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } })();

  let raf = 0, last = 0, running = false, over = false, paused = false;
  let me, things, speed, dist, coins, spawnIn, coinIn, t, stars, hills;
  function reset() {
    me = { y: 0, vy: 0, jumps: 0, h: 74 };
    things = []; speed = 360; dist = 0; coins = 0; spawnIn = 1.1; coinIn = 0.8; t = 0;
    stars = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * (GROUND - 80), r: Math.random() * 1.4 + 0.3 }));
    hills = Array.from({ length: 8 }, (_, i) => ({ x: i * 160, h: 40 + Math.random() * 50 }));
  }
  reset();
  const score = () => Math.floor(dist / 12);
  const tell = () => onState?.({ score: score(), best, coins, running, over });

  function jump() {
    if (over || !running) return;
    if (me.jumps < 2) { me.vy = me.jumps ? 640 : 760; me.jumps += 1; }
  }
  function spawn() {
    const level = Math.min(1, score() / 900), r = Math.random();
    if (score() > 120 && r < 0.18 + level * 0.12) { // a flyer: either skimming high (run under) or low (jump it)
      const high = Math.random() < 0.55, k = Math.random() < 0.5 ? 'harpy' : 'wraith';
      things.push({ kind: k, x: W + 40, y: high ? 92 : 30, w: 64, h: 58, fly: true, hit: [0.2, 0.25, 0.6, 0.55] });
    } else {
      const k = ['ghoul', 'troll', 'thief', 'golem'][Math.floor(Math.random() * 4)], s = 52 + Math.random() * 18;
      things.push({ kind: k, x: W + 40, y: 0, w: s, h: s, hit: [0.22, 0.2, 0.56, 0.75] });
      if (score() > 300 && Math.random() < 0.22 + level * 0.15) things.push({ kind: ['ghoul', 'thief'][Math.floor(Math.random() * 2)], x: W + 40 + s * 0.9, y: 0, w: s * 0.85, h: s * 0.85, hit: [0.22, 0.2, 0.56, 0.75] });
    }
    spawnIn = Math.max(0.55, (1.25 - level * 0.5) + Math.random() * 0.7);
  }

  function step(dt) {
    t += dt; speed = Math.min(820, speed + dt * 9); dist += speed * dt;
    // the Wannabe
    me.vy -= 2100 * dt; me.y = Math.max(0, me.y + me.vy * dt);
    if (me.y === 0) { me.vy = 0; me.jumps = 0; }
    // spawns
    spawnIn -= dt; if (spawnIn <= 0) spawn();
    coinIn -= dt; if (coinIn <= 0) { things.push({ kind: 'coin', x: W + 20, y: 40 + Math.random() * 110, w: 26, h: 26, coin: true }); coinIn = 0.9 + Math.random() * 1.6; }
    for (const o of things) o.x -= speed * dt * (o.fly ? 1.12 : 1);
    things = things.filter((o) => o.x > -100 && !o.taken);
    // hits: the Wannabe's box is a little smaller than its picture, to be fair
    const mx = 92, mw = 40, my0 = GROUND - me.y - me.h + 14, my1 = GROUND - me.y - 4;
    for (const o of things) {
      // hit: [left, top, width, height] as shares of the picture (the art has empty margins)
      const [hx, hy, hw, hh] = o.hit || [0, 0, 1, 1];
      const ox0 = o.x + o.w * hx, ox1 = ox0 + o.w * hw, oy0 = GROUND - o.y - o.h + o.h * hy, oy1 = oy0 + o.h * hh;
      if (ox1 < mx || ox0 > mx + mw || oy1 < my0 || oy0 > my1) continue;
      if (o.coin) { o.taken = true; coins += 1; tell(); continue; }
      return end();
    }
  }

  function draw() {
    // night sky, stars, two layers of hills, the ground
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0918'); g.addColorStop(0.75, '#2a1a40'); g.addColorStop(1, '#3a2340');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (const s of stars) { c.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 2 + s.x)})`; c.fillRect((s.x - dist * 0.02 + W * 10) % W, s.y, s.r, s.r); }
    c.fillStyle = '#ffe9c4'; c.beginPath(); c.arc(820, 64, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1f1530';
    for (const hll of hills) { const x = ((hll.x - dist * 0.15) % (W + 160) + W + 160) % (W + 160) - 160; c.beginPath(); c.moveTo(x, GROUND); c.quadraticCurveTo(x + 80, GROUND - hll.h * 2, x + 160, GROUND); c.fill(); }
    c.fillStyle = '#17101f'; c.fillRect(0, GROUND, W, H - GROUND);
    c.strokeStyle = 'rgba(169,155,252,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, GROUND + 1); c.lineTo(W, GROUND + 1); c.stroke();
    c.fillStyle = 'rgba(169,155,252,.25)'; for (let x = -(dist % 40); x < W; x += 40) c.fillRect(x, GROUND + 14 + ((x * 7) % 9), 10, 2);
    // things
    for (const o of things) {
      if (o.coin) {
        const s = 1 + Math.sin(t * 8 + o.x * 0.05) * 0.12;
        c.save(); c.translate(o.x + 13, GROUND - o.y - 13); c.scale(s, 1);
        c.fillStyle = '#ffd66b'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#b8860b'; c.lineWidth = 2.5; c.stroke();
        c.fillStyle = '#8a5a0a'; c.font = '700 12px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 1); c.restore();
        continue;
      }
      const im = A[o.kind], bob = o.fly ? Math.sin(t * 6 + o.x * 0.02) * 5 : 0;
      if (im) c.drawImage(im, o.x, GROUND - o.y - o.h + bob, o.w, o.h);
    }
    // the Wannabe: bobs while running, leans back in the air
    const kid = A.kid, kh = me.h, kw = kid ? kh * kid.width / kid.height : kh * 0.9;
    const run = me.y === 0 && running ? Math.abs(Math.sin(t * 18)) * 4 : 0;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(112, GROUND + 4, 26 * Math.max(0.4, 1 - me.y / 220), 5, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(112, GROUND - me.y - run); c.rotate(me.y > 0 ? -0.12 : Math.sin(t * 18) * 0.04);
    if (kid) c.drawImage(kid, -kw / 2, -kh, kw, kh); else { c.fillStyle = '#c9a36b'; c.fillRect(-20, -kh, 40, kh); }
    c.restore();
    // score
    c.fillStyle = '#f4f1fe'; c.font = '700 18px "JetBrains Mono", monospace'; c.textAlign = 'right'; c.textBaseline = 'top';
    c.fillText(`${String(score()).padStart(5, '0')}`, W - 18, 16);
    c.fillStyle = '#ffd66b'; c.fillText(`$ ${coins}`, W - 18, 40);
    if (best) { c.fillStyle = 'rgba(244,241,254,.45)'; c.fillText(`HI ${String(best).padStart(5, '0')}`, W - 110, 16); }
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    if (running && !paused) step(dt);
    draw();
    if (running && !paused) raf = requestAnimationFrame(loop);
  }
  function end() {
    running = false; over = true;
    const s = score(); if (s > best) { best = s; try { localStorage.setItem(BEST_KEY, String(best)); } catch {} }
    draw(); tell();
  }
  async function start() {
    await ready; reset(); running = true; over = false; paused = false; last = performance.now(); tell();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function pause(p) {
    if (!running) return;
    paused = p; if (!p) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }
  // controls: Space / ↑ / W, a click or a tap on the board
  const key = (e) => { if (!running || canvas.offsetParent === null) return; if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); } };
  addEventListener('keydown', key);
  canvas.addEventListener('pointerdown', (e) => { if (running) { e.preventDefault(); jump(); } });
  ready.then(() => draw());
  return { start, pause, jump, stop: () => { running = false; cancelAnimationFrame(raf); } , reduce };
}
