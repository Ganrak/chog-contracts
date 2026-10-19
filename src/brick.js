// Brick Studio: a Chog's real NFT art as a stud mosaic (1x1 round plates), with a parts list and a step-by-step
// instruction booklet drawn on canvas. Colours are matched to a standard brick palette (names as brick sellers
// list them), so the parts list can be ordered for real. No AI, no redrawing: every one of the 1,969 Chogs works.

// [name, hex] — common solid brick colours, approximate RGB
export const PALETTE = [
  ['White', '#F4F4F4'], ['Light Bluish Gray', '#A0A5A9'], ['Dark Bluish Gray', '#6C6E68'], ['Black', '#1B1B1D'],
  ['Red', '#C91A09'], ['Dark Red', '#720E0F'], ['Orange', '#FE8A18'], ['Yellow', '#F2CD37'], ['Bright Light Yellow', '#FFF03A'],
  ['Tan', '#E4CD9E'], ['Dark Tan', '#958A73'], ['Reddish Brown', '#582A12'], ['Medium Nougat', '#AA7D55'], ['Light Nougat', '#F6D7B3'],
  ['Lime', '#BBE90B'], ['Green', '#237841'], ['Dark Green', '#184632'], ['Medium Azure', '#36AEBF'], ['Dark Azure', '#078BC9'],
  ['Blue', '#0055BF'], ['Dark Blue', '#0A3463'], ['Sand Blue', '#6074A1'], ['Light Aqua', '#ADC3C0'], ['Lavender', '#E1D5ED'],
  ['Medium Lavender', '#AC78BA'], ['Dark Purple', '#3F3691'], ['Magenta', '#923978'], ['Dark Pink', '#C870A0'], ['Bright Pink', '#E4ADC8'], ['Coral', '#FF698F'],
].map(([name, hex]) => ({ name, hex, rgb: [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) }));
export const PART = { name: 'Plate, Round 1 x 1', id: '4073' };

// perceptual-ish colour distance ("redmean"), good enough to pick the nearest brick colour
function dist([r1, g1, b1], [r2, g2, b2]) {
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

/**
 * img → { size, grid (palette index per stud, row by row), counts [{ i, n }] sorted by count }.
 * Uses at most maxColors colours: the most-used ones are kept and rare ones remapped to them,
 * which cleans up speckle and keeps the parts list short, like real mosaic kits.
 */
export function mosaic(img, size = 48, maxColors = 16) {
  // downscale in two passes so each stud averages its whole area instead of sampling one pixel
  const mid = document.createElement('canvas'); mid.width = mid.height = size * 4;
  const m = mid.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(img, 0, 0, mid.width, mid.height);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(mid, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size).data, grid = new Uint8Array(size * size);
  const nearest = (c, allowed) => { let best = allowed[0], bd = Infinity; for (const i of allowed) { const d = dist(c, PALETTE[i].rgb); if (d < bd) { bd = d; best = i; } } return best; };
  const all = PALETTE.map((_, i) => i), colour = (k) => [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]];
  // pass 1: nearest of all colours, to learn which ones the picture really uses
  const tally = new Array(PALETTE.length).fill(0);
  for (let k = 0; k < size * size; k++) tally[nearest(colour(k), all)]++;
  const keep = tally.map((n, i) => [n, i]).filter(([n]) => n).sort((a, b) => b[0] - a[0]).slice(0, maxColors).map(([, i]) => i);
  // pass 2: nearest of the kept colours only
  const final = new Array(PALETTE.length).fill(0);
  for (let k = 0; k < size * size; k++) { const i = nearest(colour(k), keep); grid[k] = i; final[i]++; }
  const counts = final.map((n, i) => ({ i, n })).filter((c) => c.n).sort((a, b) => b.n - a.n);
  return { size, grid, counts };
}

/**
 * Cuts the mosaic into pieces of one colour, mostly Tetris-like groups of four, some threes, twos and a few
 * singles, so a build isn't 1,024 identical clicks. Grown bottom-up from each free cell, the same way every
 * time for the same seed. Returns [{ id, color, cells: [k], low }] in build order (low = lowest row, 0 = bottom).
 */
export function cutPieces(m, seed = 1) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const size = m.size, owner = new Int32Array(size * size).fill(-1), list = [];
  const level = (k) => size - 1 - Math.floor(k / size);
  const nbrs = (k) => { const r = Math.floor(k / size), c = k % size, o = []; if (c > 0) o.push(k - 1); if (c < size - 1) o.push(k + 1); if (r > 0) o.push(k - size); if (r < size - 1) o.push(k + size); return o; };
  for (let row = size - 1; row >= 0; row--) {
    for (let c = 0; c < size; c++) {
      const k = row * size + c; if (owner[k] >= 0) continue;
      const want = (() => { const x = rnd(); return x < 0.58 ? 4 : x < 0.8 ? 3 : x < 0.95 ? 2 : 1; })();
      const id = list.length, cells = [k]; owner[k] = id;
      while (cells.length < want) {
        const cand = [...new Set(cells.flatMap(nbrs))].filter((q) => owner[q] < 0 && m.grid[q] === m.grid[k]);
        if (!cand.length) break;
        // prefer cells low down, so pieces sit on what's already built
        cand.sort((a, b) => level(a) - level(b) + (rnd() - 0.5) * 1.5);
        const q = cand[0]; owner[q] = id; cells.push(q);
      }
      list.push({ id, color: m.grid[k], cells, low: Math.min(...cells.map(level)) });
    }
  }
  return list;
}

const shade = (hex, f) => { const v = [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))); return `rgb(${v.join(',')})`; };

/**
 * Draws studs into a w×w square at (x, y). show(row) → 'done' | 'new' | 'empty' decides how each row looks:
 * built rows normal, this step's rows highlighted, rows still to come as an empty baseplate.
 */
export function drawMosaic(g, m, x, y, w, show = () => 'done') {
  const s = w / m.size, r = s * 0.42;
  g.fillStyle = '#d9d3c4'; g.fillRect(x, y, w, w); // baseplate
  let first = -1, last = -1; // this step's rows, outlined once after drawing
  for (let row = 0; row < m.size; row++) {
    const mode = show(row);
    if (mode === 'new') { if (first < 0) first = row; last = row; }
    for (let col = 0; col < m.size; col++) {
      const cx = x + col * s + s / 2, cy = y + row * s + s / 2;
      if (mode === 'empty') { g.fillStyle = '#cfc8b7'; g.beginPath(); g.arc(cx, cy, r * 0.55, 0, 6.283); g.fill(); continue; }
      const hex = PALETTE[m.grid[row * m.size + col]].hex;
      g.globalAlpha = mode === 'done-dim' ? 0.45 : 1;
      g.fillStyle = shade(hex, 0.72); g.beginPath(); g.arc(cx, cy + s * 0.05, r, 0, 6.283); g.fill(); // side of the stud
      g.fillStyle = hex; g.beginPath(); g.arc(cx, cy, r * 0.92, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cx - r * 0.28, cy - r * 0.3, r * 0.3, 0, 6.283); g.fill(); // highlight
      g.globalAlpha = 1;
    }
  }
  if (first >= 0) { g.strokeStyle = '#e845a4'; g.lineWidth = 4; g.strokeRect(x - 3, y + first * s - 3, w + 6, (last - first + 1) * s + 6); }
}

function swatch(g, x, y, r, hex) {
  g.fillStyle = shade(hex, 0.72); g.beginPath(); g.arc(x, y + 2, r, 0, 6.283); g.fill();
  g.fillStyle = hex; g.beginPath(); g.arc(x, y, r * 0.92, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.3, r * 0.3, 0, 6.283); g.fill();
}
const DISPLAY = '"Koulen", Impact, sans-serif', BODY = '"Inter", system-ui, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = '#1d1830', PAPER = '#f6f1e7';

/**
 * The booklet: cover, parts, one page per step, finished page. Returns page painters: (ctx, W, H) => void.
 * info: { name, token, level, trophies: [{ kind, n }], monsterImgs: { kind: img } }
 */
export function booklet(m, info) {
  const steps = 8, per = m.size / steps, total = m.size * m.size;
  const stepCounts = (st) => {
    const t = new Map();
    for (let row = st * per; row < (st + 1) * per; row++) for (let col = 0; col < m.size; col++) { const i = m.grid[row * m.size + col]; t.set(i, (t.get(i) || 0) + 1); }
    return [...t].map(([i, n]) => ({ i, n })).sort((a, b) => b.n - a.n);
  };
  const frame = (g, W, H, page) => {
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    g.fillStyle = INK; g.font = `600 18px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(`${info.name.toUpperCase()} · BRICK EDITION`, 40, H - 32);
    g.textAlign = 'right'; g.fillText(String(page), W - 40, H - 32); g.textAlign = 'left';
  };
  const list = (g, items, x, y, colW, perCol) => {
    items.forEach((c, k) => {
      const cx = x + Math.floor(k / perCol) * colW, cy = y + (k % perCol) * 46;
      swatch(g, cx + 16, cy, 15, PALETTE[c.i].hex);
      g.fillStyle = INK; g.font = `700 20px ${MONO}`; g.fillText(`${c.n}×`, cx + 42, cy + 7);
      g.font = `500 15px ${BODY}`; g.fillStyle = '#4a4458'; g.fillText(PALETTE[c.i].name, cx + 92, cy + 6, colW - 100);
    });
  };
  const pages = [];
  pages.push((g, W, H) => { // cover
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f4f1fe'; g.font = `96px ${DISPLAY}`; g.textAlign = 'center'; g.fillText(info.name.toUpperCase(), W / 2, 150);
    g.fillStyle = '#e845a4'; g.font = `700 22px ${MONO}`; g.fillText(`BRICK EDITION · ${total.toLocaleString('en-US')} PIECES · ${m.size}×${m.size}`, W / 2, 196);
    drawMosaic(g, m, (W - 760) / 2, 240, 760);
    g.fillStyle = '#a99bfc'; g.font = `600 20px ${MONO}`; g.fillText(`TOKEN ${info.token} · HUNTER LEVEL ${info.level} · CHOG CONTRACTS`, W / 2, H - 70);
    g.textAlign = 'left';
  });
  pages.push((g, W, H) => { // parts
    frame(g, W, H, 2);
    g.fillStyle = INK; g.font = `64px ${DISPLAY}`; g.fillText('PARTS', 40, 110);
    g.font = `500 20px ${BODY}`; g.fillStyle = '#4a4458'; g.fillText(`${total.toLocaleString('en-US')} × ${PART.name} (part ${PART.id}), in ${m.counts.length} colours`, 40, 150);
    list(g, m.counts, 40, 210, 420, Math.ceil(m.counts.length / 2));
  });
  for (let st = 0; st < steps; st++) {
    pages.push((g, W, H) => {
      frame(g, W, H, st + 3);
      g.fillStyle = INK; g.beginPath(); g.arc(80, 90, 46, 0, 6.283); g.fill();
      g.fillStyle = '#fff'; g.font = `56px ${DISPLAY}`; g.textAlign = 'center'; g.fillText(String(st + 1), 80, 110); g.textAlign = 'left';
      g.fillStyle = INK; g.font = `600 20px ${MONO}`; g.fillText(`ROWS ${st * per + 1}–${(st + 1) * per} OF ${m.size}`, 150, 98);
      drawMosaic(g, m, 70, 160, 760, (row) => (row < st * per ? 'done-dim' : row < (st + 1) * per ? 'new' : 'empty'));
      g.fillStyle = INK; g.font = `700 18px ${MONO}`; g.fillText('ADD THESE', 40, 970);
      list(g, stepCounts(st).slice(0, 12), 40, 1010, 212, 3);
    });
  }
  pages.push((g, W, H) => { // finished, with the Chog's hunting record
    frame(g, W, H, steps + 3);
    g.fillStyle = INK; g.font = `64px ${DISPLAY}`; g.fillText('DONE!', 40, 110);
    g.font = `500 20px ${BODY}`; g.fillStyle = '#4a4458'; g.fillText('Frame it, then go hunt more FUD: the record below grows with every contract.', 40, 148);
    drawMosaic(g, m, 170, 180, 560);
    g.fillStyle = INK; g.font = `700 20px ${MONO}`; g.fillText(`HUNTER LEVEL ${info.level} · ${info.trophies.reduce((a, t) => a + t.n, 0)} TROPHIES`, 40, 800);
    if (!info.trophies.length) { g.font = `500 19px ${BODY}`; g.fillStyle = '#4a4458'; g.fillText('No trophies yet. Each monster this Chog hunts lands here.', 40, 840); }
    info.trophies.forEach((t, k) => {
      const x = 40 + (k % 5) * 168, y = 830 + Math.floor(k / 5) * 170, im = info.monsterImgs[t.kind];
      g.fillStyle = '#ebe4d4'; g.beginPath(); g.roundRect(x, y, 150, 150, 18); g.fill();
      if (im) { const s = Math.min(120 / im.naturalWidth, 110 / im.naturalHeight); g.drawImage(im, x + 75 - im.naturalWidth * s / 2, y + 120 - im.naturalHeight * s, im.naturalWidth * s, im.naturalHeight * s); }
      g.fillStyle = INK; g.font = `700 18px ${MONO}`; g.fillText(`×${t.n}`, x + 10, y + 142);
    });
  });
  return pages;
}
