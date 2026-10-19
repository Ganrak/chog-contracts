// Chog Drop: a Tetris-like puzzle that builds the Chog's picture. The board is a grid of cells (12×12 or
// 16×16); each cell carries a k×k patch of a finer mosaic of the real NFT art, so the pieces are proper
// tetrominoes (cut by brick.js cutPieces) with the picture printed on them. They fall one by one, turned:
// steer (← →), turn (↑), drop (↓ / Space). A piece only clicks in when every cell lands on its own spot, the
// right way up; anything else breaks it, sends it back and costs 5 seconds. "Show target" outlines the spot
// and shows the picture faintly. When the last piece is in, the seams melt away into the clean picture.
import { PALETTE } from './brick.js';

const PENALTY = 5, LOCK = 0.35, SPAWN = 2; // SPAWN: rows above the board where a new piece waits, in view

// the order pieces come in: always one that can fall straight into its spot from above and sits there on solid
// ground (open column above every cell, and under every cell the floor, a placed cell or its own cell), so no
// piece ever roofs over an empty hole. Single cells and the rare piece that cannot go in are set by the game.
function plan(size, pieces, rnd) {
  const filled = new Uint8Array(size * size), done = new Uint8Array(pieces.length), order = [];
  const rows = (p) => p.cells.map((k) => [Math.floor(k / size), k % size]);
  const fits = (p) => {
    const own = new Set(p.cells);
    for (const [r, c] of rows(p)) {
      for (let y = r - 1; y >= 0; y--) if (filled[y * size + c] && !own.has(y * size + c)) return false;
      const below = (r + 1) * size + c;
      if (r < size - 1 && !filled[below] && !own.has(below)) return false; // would hang over a hole
    }
    return true;
  };
  while (order.length < pieces.length) {
    const open = pieces.filter((p) => !done[p.id]);
    const ready = open.filter(fits).sort((a, b) => a.low - b.low || rnd() - 0.5);
    const p = ready[0] || open.sort((a, b) => a.low - b.low)[0];
    done[p.id] = 1; for (const k of p.cells) filled[k] = 1;
    order.push({ p, auto: !ready.length || p.cells.length === 1 });
  }
  return order;
}

/** art: { size (board cells per side), k (picture pixels per cell side), detail (brick.js mosaic of size*k) } */
export function startChogDrop(canvas, art, pieces, { seed = 1, target = true, onState, onLock, onMiss, onEnd } = {}) {
  const g = canvas.getContext('2d'), S = art.size, K = art.k, D = art.detail;
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const order = plan(S, pieces, rnd), owner = new Int32Array(S * S).fill(-1);
  const playable = order.filter((o) => !o.auto).length;
  let idx = 0, cur = null, time = 0, misses = 0, dropped = 0, over = false, paused = false;
  let fallT = 0, lockT = 0, soft = false, raf = 0, last = performance.now(), flash = [], bits = [], shake = 0;
  // the colour of picture pixel (i, j) inside board cell k
  const hexAt = (k, i, j) => PALETTE[D.grid[(Math.floor(k / S) * K + i) * D.size + (k % S) * K + j]].hex;

  // the falling piece: cells { r, c, k } relative to (cur.r, cur.c), r may be above the board; rot = quarter turns
  const norm = (sh) => { const r0 = Math.min(...sh.map((v) => v.r)), c0 = Math.min(...sh.map((v) => v.c)); return sh.map((v) => ({ ...v, r: v.r - r0, c: v.c - c0 })); };
  const shapeOf = (p) => norm(p.cells.map((k) => ({ r: Math.floor(k / S), c: k % S, k })));
  const turn = (sh) => norm(sh.map((v) => ({ r: v.c, c: -v.r, k: v.k })));
  const free = (sh, r, c) => sh.every((v) => { const y = r + v.r, x = c + v.c; return x >= 0 && x < S && y < S && (y < 0 || owner[y * S + x] < 0); });
  function advance() { // set the automatic pieces, then bring in the next one to drop
    while (idx < order.length && order[idx].auto) { const p = order[idx++].p; for (const k of p.cells) owner[k] = p.id; flash.push({ p, t: 0, quiet: true }); }
    if (idx >= order.length) { cur = null; over = true; onEnd?.({ time, misses, score: time, playable }); emit(); return; }
    spawn(order[idx].p);
  }
  function spawn(p) {
    // usually a quarter turn off (one tap either way); now and then upside down or already right
    let sh = shapeOf(p), rot = [1, 3, 1, 3, 2, 0][Math.floor(rnd() * 6)];
    for (let i = 0; i < rot; i++) sh = turn(sh);
    const w = Math.max(...sh.map((v) => v.c)) + 1, h = Math.max(...sh.map((v) => v.r)) + 1;
    // always fully above the board, so it never starts stuck in a nearly full top row
    cur = { p, sh, rot, r: -h, c: Math.max(0, Math.min(S - w, Math.floor((S - w) / 2) + Math.round((rnd() - 0.5) * 4))) };
    cur.mr = cur.r + h / 2; cur.mc = cur.c + w / 2; // exact middle, so turning never drifts the piece
    fallT = -0.7; lockT = 0; emit(); // a moment to look and steer before it starts falling
  }
  function land() {
    // right only if every cell sits on its own spot (so a turned square or bar doesn't count)
    if (cur.sh.every((v) => (cur.r + v.r) * S + cur.c + v.c === v.k)) {
      for (const k of cur.p.cells) owner[k] = cur.p.id;
      flash.push({ p: cur.p, t: 0 }); idx++; dropped++; onLock?.(); cur = null; advance();
    } else { // it breaks: bits fly, the same piece comes back from the top
      misses++; time += PENALTY; shake = 1; onMiss?.();
      for (const v of cur.sh) for (let i = 0; i < 3; i++) bits.push({ x: cur.c + v.c + 0.5, y: cur.r + v.r + 0.5, vx: (rnd() - 0.5) * 9, vy: -rnd() * 8 - 2, t: 0, hex: hexAt(v.k, K >> 1, K >> 1) });
      spawn(cur.p);
    }
  }
  // turn around the piece's middle, then nudge it sideways or up if a wall or a block is in the way,
  // so long bars can turn next to the edges too
  function spin(n) {
    if (!cur) return;
    let sh = cur.sh; for (let i = 0; i < n; i++) sh = turn(sh);
    const size = (s) => [Math.max(...s.map((v) => v.r)) + 1, Math.max(...s.map((v) => v.c)) + 1];
    const [h0, w0] = size(cur.sh), [h1, w1] = size(sh);
    const r = Math.round(cur.mr - h1 / 2), c = Math.round(cur.mc - w1 / 2);
    for (const [dr, dc] of [[0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [0, -3], [0, 3], [-1, -1], [-1, 1], [-2, 0]]) {
      if (free(sh, r + dr, c + dc)) { cur.sh = sh; cur.rot = (cur.rot + n) % 4; cur.r = r + dr; cur.c = c + dc; cur.mr += dr; cur.mc += dc; lockT = 0; return; }
    }
  }
  const step = (dr, dc) => { if (!cur || !free(cur.sh, cur.r + dr, cur.c + dc)) return false; cur.r += dr; cur.c += dc; cur.mr += dr; cur.mc += dc; lockT = 0; return true; };
  const api = {
    left: () => step(0, -1), right: () => step(0, 1),
    rotate: () => spin(1), rotateBack: () => spin(3),
    soft(on) { soft = on; },
    drop() { if (!cur) return; while (step(1, 0)); land(); },
    setTarget(v) { target = v; },
    peek: () => cur && { sh: cur.sh.map((v) => ({ ...v })), r: cur.r, c: cur.c, size: S }, // for tests
    pause(v) { paused = v; last = performance.now(); },
    stop() { cancelAnimationFrame(raf); removeEventListener('keydown', key); removeEventListener('keyup', keyUp); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); },
  };
  function key(e) {
    if (over || paused || !canvas.isConnected || canvas.closest('[hidden]')) return;
    const k = e.key; const map = { ArrowLeft: api.left, ArrowRight: api.right, ArrowUp: api.rotate, ' ': api.drop, x: api.rotate, X: api.rotate, z: api.rotateBack, Z: api.rotateBack };
    if (k === 'ArrowDown') { soft = true; e.preventDefault(); return; }
    if (map[k]) { e.preventDefault(); map[k](); }
  }
  const keyUp = (e) => { if (e.key === 'ArrowDown') soft = false; };
  addEventListener('keydown', key); addEventListener('keyup', keyUp);
  // fingers (and mouse): drag sideways to steer one column per cell width, tap to turn, flick down to drop
  let touch = null;
  const cellPx = () => canvas.getBoundingClientRect().width / S;
  function down(e) { if (over || paused || !cur) return; touch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch {} }
  function move(e) {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.x, w = cellPx();
    while (Math.abs(e.clientX - touch.x) >= w * 0.8) { const dir = Math.sign(e.clientX - touch.x); (dir > 0 ? api.right : api.left)(); touch.x += dir * w * 0.8; touch.moved = true; }
    if (Math.abs(dx) > 6) touch.moved = true;
  }
  function up(e) {
    if (!touch || e.pointerId !== touch.id) return;
    const dy = e.clientY - touch.y, dt = performance.now() - touch.t;
    if (dy > cellPx() * 2 && dy / Math.max(dt, 1) > 0.5) api.drop();   // a quick flick down
    else if (!touch.moved && dt < 300) api.rotate();                   // a tap
    touch = null;
  }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);

  const emit = () => onState?.({ time, misses, left: order.slice(idx).filter((o) => !o.auto).length, playable, over });
  let tick = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused && !over && cur) {
      time += dt; tick += dt; if (tick > 0.25) { tick = 0; emit(); }
      if (soft && fallT < 0) fallT = 0; // ↓ skips the pause
      fallT += dt;
      const every = soft ? 0.035 : Math.max(0.22, 0.6 - dropped * 0.006);
      while (fallT >= every) { fallT -= every; if (!step(1, 0)) { lockT += every; if (lockT >= LOCK) { land(); break; } } }
    }
    draw(dt);
    raf = requestAnimationFrame(loop);
  }

  // drawing ------------------------------------------------------------------------------------------
  // a cell's patch of the picture at (x, y), turned rot quarter turns the same way the piece turns
  function patch(x, y, cell, k, rot = 0) {
    const e = (n) => Math.round((n * cell) / K);
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
      let a = i, b = j; for (let t = 0; t < rot; t++) [a, b] = [b, K - 1 - a];
      g.fillStyle = hexAt(k, i, j); g.fillRect(x + e(b), y + e(a), e(b + 1) - e(b), e(a + 1) - e(a));
    }
  }
  // seams and a soft edge only where a piece meets another piece (L/R/T/B: is that side an outer edge?)
  function edges(x, y, cell, L, R, T, B, a = 1) {
    const gap = Math.max(1, cell * 0.03), b = Math.max(1.5, cell * 0.045);
    g.globalAlpha = a;
    g.fillStyle = 'rgba(255,255,255,.22)'; if (T) g.fillRect(x, y, cell, b); if (L) g.fillRect(x, y, b, cell);
    g.fillStyle = 'rgba(0,0,0,.22)'; if (B) g.fillRect(x, y + cell - b, cell, b); if (R) g.fillRect(x + cell - b, y, b, cell);
    g.fillStyle = '#121118'; if (T) g.fillRect(x, y, cell, gap); if (B) g.fillRect(x, y + cell - gap, cell, gap); if (L) g.fillRect(x, y, gap, cell); if (R) g.fillRect(x + cell - gap, y, gap, cell);
    g.globalAlpha = 1;
  }
  let reveal = 0; // after the last piece, the seams fade out and the pieces melt into one clean picture
  function draw(dt) {
    // the board plus SPAWN rows on top where the next piece appears, so it can be steered before it drops in
    const W = canvas.width, H = canvas.height, cell = Math.floor(Math.min(W / S, H / (S + SPAWN))), ox = Math.floor((W - cell * S) / 2), oy = Math.floor((H - cell * (S + SPAWN)) / 2) + SPAWN * cell;
    shake = Math.max(0, shake - dt * 4);
    if (over) reveal = Math.min(1, reveal + dt / 1.2);
    g.save(); g.clearRect(0, 0, W, H);
    if (shake) g.translate(Math.sin(performance.now() / 18) * shake * 6, 0);
    g.fillStyle = '#16151d'; g.fillRect(ox, oy - SPAWN * cell, cell * S, SPAWN * cell);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(ox, oy + 0.5); g.lineTo(ox + cell * S, oy + 0.5); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#1b1a22'; g.fillRect(ox, oy, cell * S, cell * S);
    for (let k = 0; k < S * S; k++) {
      const r = Math.floor(k / S), c = k % S, x = ox + c * cell, y = oy + r * cell;
      if (owner[k] >= 0) {
        const same = (q) => owner[q] === owner[k];
        patch(x, y, cell, k);
        if (reveal < 1) edges(x, y, cell, !(c > 0 && same(k - 1)), !(c < S - 1 && same(k + 1)), !(r > 0 && same(k - S)), !(r < S - 1 && same(k + S)), 1 - reveal);
      } else if (target) { g.globalAlpha = 0.2; patch(x, y, cell, k); g.globalAlpha = 1; }
      else { g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1); }
    }
    if (cur) {
      if (target) { // the right spot, pulsing
        const a = 0.55 + Math.sin(performance.now() / 160) * 0.3;
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = Math.max(2, cell * 0.08); g.setLineDash([cell * 0.25, cell * 0.18]);
        for (const k of cur.p.cells) g.strokeRect(ox + (k % S) * cell + 2, oy + Math.floor(k / S) * cell + 2, cell - 4, cell - 4);
        g.setLineDash([]);
      }
      let gr = cur.r; while (free(cur.sh, gr + 1, cur.c)) gr++; // where it would land now
      g.fillStyle = 'rgba(255,255,255,.12)';
      for (const v of cur.sh) if (gr + v.r >= 0) g.fillRect(ox + (cur.c + v.c) * cell + 1, oy + (gr + v.r) * cell + 1, cell - 2, cell - 2);
      const own = new Set(cur.sh.map((v) => `${v.r},${v.c}`));
      g.save(); g.beginPath(); g.rect(ox, oy - SPAWN * cell, cell * S, cell * (S + SPAWN)); g.clip();
      for (const v of cur.sh) {
        const x = ox + (cur.c + v.c) * cell, y = oy + (cur.r + v.r) * cell; if (y + cell <= oy) continue;
        patch(x, y, cell, v.k, cur.rot);
        edges(x, y, cell, !own.has(`${v.r},${v.c - 1}`), !own.has(`${v.r},${v.c + 1}`), !own.has(`${v.r - 1},${v.c}`), !own.has(`${v.r + 1},${v.c}`));
      }
      g.restore();
    }
    for (const f of flash) { // a quick glow on a piece that just clicked in
      f.t += dt * (f.quiet ? 4 : 2.5); g.fillStyle = `rgba(255,255,255,${Math.max(0, 0.6 - f.t) * (f.quiet ? 0.4 : 1)})`;
      for (const k of f.p.cells) g.fillRect(ox + (k % S) * cell, oy + Math.floor(k / S) * cell, cell, cell);
    }
    flash = flash.filter((f) => f.t < 0.6);
    for (const b of bits) { // broken bits of a wrong landing
      b.t += dt; b.vy += 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      g.globalAlpha = Math.max(0, 1 - b.t); g.fillStyle = b.hex; g.fillRect(ox + b.x * cell - cell * 0.2, oy + b.y * cell - cell * 0.2, cell * 0.4, cell * 0.4);
    }
    g.globalAlpha = 1; bits = bits.filter((b) => b.t < 1);
    g.restore();
  }
  advance(); loop(performance.now());
  return api;
}
