// Trip map: where a Chog on an expedition is right now, drawn over the painted map (assets/map/map-night.webp, and
// map-day.webp in daylight: the same painting at sunrise, so every place sits in the same spot).
// Roads follow the paths in the painting (north of the river they cross the bridge). The first 30% of the trip
// the Chog walks there, the middle 40% it roams around the place (that's where the diary happens), the last 30%
// it walks home. Diary pages and the halfway choice sit along the way as pins.

const W = 1619, H = 971; // the painting's own pixels
const LODGE = [880, 838], BRIDGE = [[838, 640], [796, 482], [790, 378]];
// each place: where its label goes, and the road from the lodge (the last point is the place itself)
const SPOTS = {
  backyard: { label: [705, 900], road: [LODGE, [792, 842], [705, 818]] },
  swamp: { label: [230, 760], road: [LODGE, [700, 712], [452, 684], [262, 662]] },
  alley: { label: [1392, 790], road: [LODGE, [1050, 770], [1252, 690], [1385, 642]] },
  woods: { label: [300, 290], road: [LODGE, ...BRIDGE, [600, 330], [338, 222]] },
  peaks: { label: [960, 345], road: [LODGE, ...BRIDGE, [860, 318], [935, 258]] },
  crypt: { label: [1410, 285], road: [LODGE, ...BRIDGE, [1050, 332], [1300, 252], [1400, 196]] },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A point u (0..1) of the way along a road of straight legs. */
function along(pts, u) {
  const legs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = legs.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < legs.length; i++) {
    if (d <= legs[i] || i === legs.length - 1) { const k = legs[i] ? Math.min(1, d / legs[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
    d -= legs[i];
  }
  return pts.at(-1);
}

/** Where the Chog is at trip progress f (0..1): [x, y, phase]. */
function whereAt(road, f, seed) {
  if (f < 0.3) return [...along(road, f / 0.3), 'out'];
  if (f < 0.7) { const [x, y] = road.at(-1), a = (f - 0.3) / 0.4 * Math.PI * 2 + seed; return [x + Math.cos(a) * 46, y + Math.sin(a) * 22, 'there']; }
  return [...along(road, 1 - (f - 0.7) / 0.3), 'home'];
}

/** The map as SVG. t: the trip; place: from PLACES; h: { name, img|null }; places: all PLACES; now: ms. */
export function tripMapSvg({ t, place, h, places, now = Date.now(), night = true }) {
  const spot = SPOTS[t.place], road = spot.road, seed = t.seed % 7;
  const f = Math.max(0, Math.min(1, (now - t.start) / (t.end - t.start))), [cx, cy, phase] = whereAt(road, f, seed);
  const frac = (at) => (at - t.start) / (t.end - t.start);
  const walked = phase === 'out' ? f / 0.3 : 1; // how much of the road it has covered (all of it once it's there)
  // the road as a trail of dots: white ahead, pink once the Chog has passed them
  const total = road.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - road[i][0], p[1] - road[i][1]), 0), n = Math.max(2, Math.round(total / 30));
  const dots = Array.from({ length: n + 1 }, (_, i) => [...along(road, i / n), i / n <= walked + 1e-6]);
  const pins = t.diary.map((d) => { const [x, y] = whereAt(road, frac(d.at), seed); return { x, y, seen: d.at <= now, text: d.text }; });
  const ch = t.choice, [qx, qy] = whereAt(road, frac(ch.at), seed), asking = now >= ch.at && !ch.pick && now < t.end;
  const [px, py] = road.at(-1);
  const label = (x, y, text, here) => `<text x="${x}" y="${y}" text-anchor="middle" class="tm-name${here ? ' here' : ''}">${esc(text)}</text>`;
  const me = h.img
    ? `<clipPath id="tm-me"><circle cx="${cx}" cy="${cy - 58}" r="36"/></clipPath><circle cx="${cx}" cy="${cy - 58}" r="41" fill="#ffd66b"/><image href="${esc(h.img)}" x="${cx - 36}" y="${cy - 94}" width="72" height="72" clip-path="url(#tm-me)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy - 58}" r="36" fill="#ffd66b"/>`;
  return `<svg class="tm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(h.name)} ${phase === 'home' ? 'on the way home from' : phase === 'there' ? 'exploring' : 'on the way to'} ${esc(place.name)}">
    <image href="assets/map/map-${night ? 'night' : 'day'}.webp" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>
    ${dots.map(([x, y, on]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on ? 7 : 5.5}" fill="${on ? '#e845a4' : 'rgba(255,255,255,.75)'}" stroke="rgba(20,12,30,.6)" stroke-width="2"${on ? ' filter="drop-shadow(0 0 5px rgba(232,69,164,.9))"' : ''}/>`).join('')}
    <circle cx="${px}" cy="${py}" r="70" fill="none" stroke="#e845a4" stroke-width="4" opacity=".7"><animate attributeName="r" values="60;78;60" dur="2.4s" repeatCount="indefinite"/></circle>
    ${place.kind ? `<image href="assets/monsters/${place.kind}.png" x="${px - 150}" y="${py - 120}" width="100" height="100"/>` : ''}
    ${Object.entries(SPOTS).map(([id, s]) => label(s.label[0], s.label[1], places.find((x) => x.id === id)?.name || id, id === t.place)).join('')}
    ${label(LODGE[0], 935, 'The Lodge', false)}
    ${pins.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${p.seen ? 12 : 8}" fill="${p.seen ? '#ffd66b' : 'rgba(255,255,255,.35)'}" stroke="#1a1226" stroke-width="3"><title>${p.seen ? esc(p.text) : 'A diary page, coming up'}</title></circle>`).join('')}
    <g><circle cx="${qx}" cy="${qy}" r="20" fill="${asking ? '#e845a4' : ch.pick ? '#836ef9' : 'rgba(255,255,255,.3)'}" stroke="#1a1226" stroke-width="3">${asking ? '<animate attributeName="r" values="17;26;17" dur="1.2s" repeatCount="indefinite"/>' : ''}</circle><text x="${qx}" y="${qy + 9}" text-anchor="middle" class="tm-q">?</text></g>
    <ellipse cx="${cx}" cy="${cy}" rx="30" ry="9" fill="rgba(0,0,0,.55)"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 18}" stroke="#ffd66b" stroke-width="5"/>
    ${me}
  </svg>`;
}
