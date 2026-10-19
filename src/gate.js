// Entry gate: a lodge door in a stone arch with two real Chog cards floating beside it and the maker's own
// hand-drawn Chogs pinned to the door. Cards rise in spinning, a click on a card shows which Chog it is, a click
// on a drawing says who drew it, "Enter" swings the door inward and the camera walks through.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildKit } from './kit.js';
import { play as sfx } from './sfx.js';

export function startGate({ gate, canvas, pctEl, tagEl, hunters, spare = [], welcome = '', whale = 0, drawings = [], boss = null, onDone }) {
  if (welcome) { const hint = gate.querySelector('.g-hint'); if (hint) hint.textContent = welcome; }
  if (whale) { // a gesture for big holders: gold title, and more of their Chogs on the door
    gate.classList.add('is-whale');
    gate.querySelector('#gate-title').innerHTML = 'Welcome back, <b>whale</b>';
    gate.querySelector('.g-bottom > p:not(.g-hint)').textContent = `Your ${whale} Chogs are back. The lodge kept the best seats for you.`;
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeIn = (t) => t * t * t;
  const TAU = Math.PI * 2;
  document.documentElement.style.overflow = 'hidden';

  let renderer, finished = false;
  function finish() {
    if (finished) return; finished = true;
    gate.classList.add('is-gone');
    document.documentElement.style.overflow = '';
    onDone?.();
    setTimeout(() => { renderer?.setAnimationLoop(null); renderer?.dispose(); gate.remove(); }, 850);
  }
  gate.querySelector('[data-skip]').addEventListener('click', finish);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { gate.classList.add('is-ready'); gate.querySelector('[data-enter]').addEventListener('click', finish); return; }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 80);
  const CAM_Z = 19;
  camera.position.set(0, 0, CAM_Z);
  {
    const env = new THREE.Scene();
    const box = (w, h, pos, k, color = '#ffffff') => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    box(1.1, 16, [-4.5, 0.5, 6], 5, '#fff2e6'); box(0.55, 16, [5.5, 0, 5], 2.6, '#eef0ff');
    box(10, 2, [0, 8, 3], 1.2); box(0.6, 16, [-7, 0, -6], 3.5); box(0.6, 16, [7, 0, -6], 3.5);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
  }
  scene.add(new THREE.HemisphereLight('#8a78b0', '#120e18', 0.55));
  const key = new THREE.DirectionalLight('#ffe4c4', 2.2); key.position.set(-4, 6, 8); scene.add(key);
  const torch = new THREE.PointLight('#ff8a1f', 8, 16, 1.4); torch.position.set(0, -1.6, 5); scene.add(torch);
  const inner = new THREE.PointLight('#9b7bff', 0, 22, 1.2); inner.position.set(0, 1.4, -1.2); scene.add(inner);

  /* ---------- textures ---------- */
  const canvasTex = (cv, repeat) => {
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  };
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function woodCanvas() {
    const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), pw = W / 4;
    for (let i = 0; i < 4; i++) {
      const base = ['#55361f', '#4b2f1b', '#5b3a22', '#4f321d'][i], g = c.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
      g.addColorStop(0, base); g.addColorStop(0.5, '#6a4529'); g.addColorStop(1, base);
      c.fillStyle = g; c.fillRect(i * pw, 0, pw, H);
      c.strokeStyle = 'rgba(25,14,6,.35)'; c.lineWidth = 1.2;
      for (let k = 0; k < 18; k++) { const x = i * pw + rnd() * pw; c.beginPath(); c.moveTo(x, 0); for (let y = 0; y <= H; y += 64) c.lineTo(x + Math.sin(y * 0.01 + k) * 6 + (rnd() - 0.5) * 3, y); c.stroke(); }
      for (let k = 0; k < 2; k++) { c.fillStyle = 'rgba(30,16,7,.55)'; c.beginPath(); c.ellipse(i * pw + pw * (0.3 + rnd() * 0.4), rnd() * H, 7, 16, 0, 0, TAU); c.fill(); }
      c.fillStyle = '#1a0f07'; c.fillRect(i * pw, 0, 4, H);
    }
    return cv;
  }
  function stoneCanvas() {
    const W = 512, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), rh = H / 8;
    c.fillStyle = '#211c27'; c.fillRect(0, 0, W, H);
    for (let r = 0; r < 8; r++) {
      let x = -(r % 2) * 60;
      while (x < W) { const w = 90 + rnd() * 70; c.fillStyle = `hsl(266, 10%, ${(52 + rnd() * 18) * 0.36}%)`; c.beginPath(); c.roundRect(x + 3, r * rh + 3, w - 6, rh - 6, 6); c.fill(); x += w; }
    }
    return cv;
  }
  // the notice on the door: this week's boss as a WANTED poster, with how long until it escapes (a new boss every Monday)
  function noticeCanvas(bossImg) {
    const W = 512, H = 660, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ebdfc6'); g.addColorStop(1, '#cdb994'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(43,33,24,.35)'; c.lineWidth = 4; c.strokeRect(18, 18, W - 36, H - 36);
    const t = (s, y, font, col = '#2b2118', sp = 0) => { c.font = font; c.letterSpacing = `${sp}px`; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, W / 2 + sp / 2, y); c.letterSpacing = '0px'; };
    if (boss && bossImg) {
      t('WANTED', 74, '700 54px "JetBrains Mono"', '#7a2a1c', 16);
      // the boss, inked onto the paper
      const bw = 380, bh = 250, k = Math.min(bw / bossImg.width, bh / bossImg.height), iw = bossImg.width * k, ih = bossImg.height * k;
      c.save(); c.filter = 'sepia(.55) contrast(1.1) saturate(.8)'; c.drawImage(bossImg, (W - iw) / 2, 118 + (bh - ih) / 2, iw, ih); c.restore();
      let fs = 64; c.font = `700 ${fs}px "Grenze Gotisch"`; while (c.measureText(boss.name).width > W - 70 && fs > 34) { fs -= 2; c.font = `700 ${fs}px "Grenze Gotisch"`; }
      t(boss.name, 410, `700 ${fs}px "Grenze Gotisch"`);
      c.fillStyle = 'rgba(43,33,24,.25)'; c.fillRect(70, 452, W - 140, 3);
      t('WEEKLY BOSS · BOUNTY IN $CHOG', 488, '700 24px "JetBrains Mono"', '#2b2118', 3);
      const now = new Date(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7 || 7)));
      const left = next - now, d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5);
      t(`ESCAPES IN ${d}D ${h}H`, 548, '700 40px "JetBrains Mono"', '#a3141c', 4);
      t('Chog Contracts', 608, '700 44px "Grenze Gotisch"', '#7a2a1c');
      return cv;
    }
    t('WANTED', 92, '700 40px "JetBrains Mono"', '#7a2a1c', 14);
    t('Hunters', 196, '700 112px "Grenze Gotisch"');
    t('with a Chog', 290, '800 44px "Grenze"');
    c.fillStyle = 'rgba(43,33,24,.25)'; c.fillRect(70, 340, W - 140, 3);
    t('FUD MONSTERS · DAILY', 392, '700 26px "JetBrains Mono"', '#2b2118', 4);
    t('BOUNTY IN $CHOG', 436, '700 26px "JetBrains Mono"', '#2b2118', 4);
    t('Chog Contracts', 560, '700 62px "Grenze Gotisch"', '#7a2a1c');
    return cv;
  }
  // a hand drawing on a sheet of paper, held up by a red pin
  function drawingCanvas(img) {
    const W = 600, pad = 26, H = Math.round((W - pad * 2) * img.height / img.width) + pad * 2, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#f6efe0'; c.fillRect(0, 0, W, H);
    c.drawImage(img, pad, pad, W - pad * 2, H - pad * 2);
    const sh = c.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(60,40,20,.18)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(W / 2 + 5, 30, 15, 0, TAU); c.fill();
    const pin = c.createRadialGradient(W / 2 - 5, 20, 2, W / 2, 26, 15); pin.addColorStop(0, '#ff8a8a'); pin.addColorStop(1, '#a3141c');
    c.fillStyle = pin; c.beginPath(); c.arc(W / 2, 26, 14, 0, TAU); c.fill();
    return cv;
  }
  const CARD = { w: 2.8, h: 3.6, d: 0.09 };
  // where the cards float: [x in card-widths from the door, y offset, size]; the first two always, the rest for a whale
  const SLOTS = [[-1, 0, 1], [1, 0, 1], [-1.72, -1.15, 0.8], [1.72, -1.15, 0.8], [-1.62, 1.15, 0.76], [1.62, 1.15, 0.76]];
  function cardFront(img, h, k) {
    const W = 1024, H = Math.round(W * CARD.h / CARD.w), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), col = k.elementInfo.color;
    c.fillStyle = '#0f0c14'; c.fillRect(0, 0, W, H);
    const tint = c.createLinearGradient(0, H, 0, H * 0.35); tint.addColorStop(0, col + '66'); tint.addColorStop(1, col + '00');
    c.fillStyle = tint; c.fillRect(0, 0, W, H);
    const m = 56, s = W - m * 2;
    c.save(); c.beginPath(); c.roundRect(m, m, s, s, 22); c.clip(); if (img) c.drawImage(img, m, m, s, s); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2; c.beginPath(); c.roundRect(m, m, s, s, 22); c.stroke();
    const y0 = m + s + 74; c.textBaseline = 'middle';
    c.font = '800 70px "Grenze"'; c.fillStyle = '#f2ece0'; c.textAlign = 'left'; c.fillText(h.name, m, y0);
    c.font = '500 24px "JetBrains Mono"'; c.letterSpacing = '3px'; c.fillStyle = 'rgba(242,236,224,.62)'; c.fillText(`TOKEN ${h.token}`, m, y0 + 64);
    c.textAlign = 'right'; c.fillStyle = col; c.font = '700 24px "JetBrains Mono"'; c.letterSpacing = '6px'; c.fillText(k.elementInfo.name.toUpperCase(), W - m, y0 + 64);
    return cv;
  }
  function cardBack(h, k) {
    const W = 1024, H = Math.round(W * CARD.h / CARD.w), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), m = 72, col = k.elementInfo.color;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16121d'); g.addColorStop(1, '#0a080d'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const rg = c.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 0.8); rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    const t = (s, x, y, font, color, align = 'left', sp = 0) => { c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.letterSpacing = `${sp}px`; c.fillText(s, x, y); c.letterSpacing = '0px'; };
    t('HUNTER FILE', m, 90, '500 22px "JetBrains Mono"', 'rgba(242,236,224,.55)', 'left', 6);
    t(h.name, m, 180, '800 84px "Grenze"', '#f2ece0');
    c.fillStyle = col; c.fillRect(m, 236, 90, 6);
    const rows = [['Element', k.elementInfo.name], ['Class', k.classInfo.name], ['Ultimate', k.abilities[3].name], ['Token', String(h.token)]];
    rows.forEach(([a, b], i) => {
      const y = 340 + i * 118;
      t(a.toUpperCase(), m, y, '500 22px "JetBrains Mono"', 'rgba(242,236,224,.55)', 'left', 4);
      t(b, W - m, y, '800 54px "Grenze"', i === 0 ? col : '#f2ece0', 'right');
      c.fillStyle = 'rgba(242,236,224,.12)'; c.fillRect(m, y + 58, W - m * 2, 2);
    });
    t('TRAITS ARE THE BUILD', m, H - 64, '500 20px "JetBrains Mono"', 'rgba(242,236,224,.4)', 'left', 3);
    return cv;
  }

  /* ---------- through the door: a purple Monad portal, turning; the two Chog cards dive into it ahead of you ---------- */
  const BW = 512, BH = 736; // the opening's shape: 3.2 wide, 4.6 tall
  const behindCv = document.createElement('canvas'); behindCv.width = BW; behindCv.height = BH;
  const bc = behindCv.getContext('2d');
  const sparks = Array.from({ length: 70 }, () => ({ a: rnd() * TAU, o: rnd(), s: 0.5 + rnd(), z: 1 + rnd() * 3 }));
  function paintBehind(time) {
    const c = bc, cx = BW / 2, cy = BH * 0.55;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, BH * 0.62);
    g.addColorStop(0, '#fbf8ff'); g.addColorStop(0.12, '#c9bcff'); g.addColorStop(0.32, '#836ef9'); g.addColorStop(0.62, '#2a1650'); g.addColorStop(1, '#08050f');
    c.fillStyle = g; c.fillRect(0, 0, BW, BH);
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let k = 0; k < 6; k++) { // spiral arms turning
      c.strokeStyle = k % 2 ? 'rgba(232,69,164,.55)' : 'rgba(169,155,252,.6)';
      for (let i = 4; i < 70; i++) {
        const a0 = -time * 1.6 + k * TAU / 6 + i * 0.11, a1 = a0 + 0.11, r0 = i * 5.2, r1 = (i + 1) * 5.2;
        c.lineWidth = 1 + (70 - i) * 0.09; c.globalAlpha = 0.25 + 0.75 * (1 - i / 70);
        c.beginPath(); c.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * 1.05); c.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 1.05); c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (const p of sparks) { // motes falling into the centre
      const r = 360 * (1 - ((time * 0.18 * p.s + p.o) % 1)), a = p.a + time * 0.9 + 60 / (r + 30);
      c.fillStyle = `rgba(255,255,255,${0.2 + 0.8 * (1 - r / 360)})`;
      c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, p.z * (0.4 + r / 360), 0, TAU); c.fill();
    }
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, 90); core.addColorStop(0, 'rgba(255,255,255,.95)'); core.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = core; c.fillRect(0, 0, BW, BH);
    c.globalCompositeOperation = 'source-over';
  }
  let behindTex = null;
  /* ---------- door ---------- */
  const doorRoot = new THREE.Group(); scene.add(doorRoot);
  const OPEN_W = 1.6, STRAIGHT = 3.0, DOOR_Y = -1.15;
  const leaves = [];
  let lightPlane, gateReady = false;
  function buildDoor(woodT, stoneT, noticeT, drawingTs) {
    const stone = new THREE.MeshStandardMaterial({ map: stoneT, roughness: 0.95, envMapIntensity: 0.35 });
    const wood = new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.78, envMapIntensity: 0.45 });
    const iron = new THREE.MeshStandardMaterial({ color: '#26242b', metalness: 0.85, roughness: 0.42, envMapIntensity: 0.9 });
    const R = 2.35, outer = new THREE.Shape();
    outer.moveTo(-R, -0.25); outer.lineTo(R, -0.25); outer.lineTo(R, STRAIGHT); outer.absarc(0, STRAIGHT, R, 0, Math.PI, false); outer.lineTo(-R, -0.25);
    const hole = new THREE.Path();
    hole.moveTo(-OPEN_W, 0); hole.lineTo(OPEN_W, 0); hole.lineTo(OPEN_W, STRAIGHT); hole.absarc(0, STRAIGHT, OPEN_W, 0, Math.PI, false); hole.lineTo(-OPEN_W, 0);
    outer.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(outer, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 48 });
    fg.translate(0, 0, -0.35); stoneT.repeat.set(1 / 1.5, 1 / 1.5);
    doorRoot.add(new THREE.Mesh(fg, stone));
    const ks = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.86), stone); ks.position.set(0, STRAIGHT + R - 0.28, 0); doorRoot.add(ks);
    const op = new THREE.Shape(); op.moveTo(-OPEN_W, 0); op.lineTo(OPEN_W, 0); op.lineTo(OPEN_W, STRAIGHT); op.absarc(0, STRAIGHT, OPEN_W, 0, Math.PI, false); op.lineTo(-OPEN_W, 0);
    const lg = new THREE.ShapeGeometry(op, 48);
    { const P = lg.attributes.position, U = lg.attributes.uv; for (let i = 0; i < U.count; i++) U.setXY(i, (P.getX(i) + OPEN_W) / (OPEN_W * 2), P.getY(i) / (STRAIGHT + OPEN_W)); }
    paintBehind(0); behindTex = canvasTex(behindCv);
    lightPlane = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ map: behindTex, toneMapped: false, color: new THREE.Color(0.25, 0.25, 0.25) }));
    lightPlane.position.z = -0.6; doorRoot.add(lightPlane);
    const w = OPEN_W - 0.015;
    for (const side of [-1, 1]) {
      const s = new THREE.Shape();
      if (side < 0) { s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, STRAIGHT + OPEN_W); s.absarc(OPEN_W, STRAIGHT, OPEN_W, Math.PI / 2, Math.PI, false); s.lineTo(0, 0); }
      else { s.moveTo(0, 0); s.lineTo(0, STRAIGHT); s.absarc(-OPEN_W, STRAIGHT, OPEN_W, 0, Math.PI / 2, false); s.lineTo(-w, 0); s.lineTo(0, 0); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 32 });
      const leafTex = woodT.clone(); leafTex.needsUpdate = true; leafTex.repeat.set(side < 0 ? 1 / OPEN_W : -1 / OPEN_W, 1 / (STRAIGHT + OPEN_W));
      const hinge = new THREE.Group(); hinge.position.set(side * OPEN_W, 0, -0.12);
      const leafMat = wood.clone(); leafMat.map = leafTex;
      hinge.add(new THREE.Mesh(geo, leafMat));
      const front = 0.2, sx = side < 0 ? 1 : -1;
      for (const y of [0.75, 2.55]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.13, 0.05), iron); band.position.set(sx * w / 2, y, front); hinge.add(band);
        for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), iron); st.position.set(sx * (0.22 + k * 0.38), y, front + 0.03); hinge.add(st); }
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 12, 32), iron); ring.position.set(sx * (w - 0.28), 1.75, front + 0.05); hinge.add(ring);
      if (side > 0) {
        const note = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.6), new THREE.MeshStandardMaterial({ map: noticeT, roughness: 0.9, envMapIntensity: 0.4 }));
        note.position.set(-0.8, 3.25, front + 0.015); note.rotation.z = 0.045; hinge.add(note);
      }
      // the maker's drawings: the crayon one high on the left leaf, the pencil one low on the right
      const spot = side < 0 ? { i: 0, x: 0.8, y: 3.38, w: 0.98, rz: -0.06 } : { i: 1, x: -0.7, y: 1.62, w: 0.8, rz: 0.07 };
      const dt = drawingTs[spot.i];
      if (dt) {
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(spot.w, spot.w * dt.image.height / dt.image.width), new THREE.MeshStandardMaterial({ map: dt, roughness: 0.92, envMapIntensity: 0.4 }));
        pic.position.set(spot.x, spot.y, front + 0.016); pic.rotation.z = spot.rz; pic.userData.drawing = drawings[spot.i]; hinge.add(pic);
      }
      doorRoot.add(hinge); leaves.push({ hinge, side });
    }
    // warm light leaking out under the door: something is going on in there
    const gc = document.createElement('canvas'); gc.width = 256; gc.height = 64;
    const gx = gc.getContext('2d'), rg = gx.createRadialGradient(128, 64, 4, 128, 64, 128);
    rg.addColorStop(0, 'rgba(255,214,140,1)'); rg.addColorStop(0.25, 'rgba(255,150,40,.75)'); rg.addColorStop(1, 'rgba(255,120,20,0)');
    gx.fillStyle = rg; gx.fillRect(0, 0, 256, 64);
    underGlow = new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W * 2.6, 0.38), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    underGlow.position.set(0, 0.06, 0.32); underGlow.visible = false; doorRoot.add(underGlow); // (the light under the door: switched off, it read as a yellow glow)
    doorRoot.traverse((o) => { if (o.isMesh) o.userData.door = true; });
  }
  let underGlow = null;

  /* ---------- cards ---------- */
  const cards = [];
  function buildCards(imgs) {
    const geo = new RoundedBoxGeometry(CARD.w, CARD.h, CARD.d, 3, 0.04);
    hunters.forEach((h, i) => {
      const k = buildKit(h.traits, { name: h.name });
      const face = (cv) => new THREE.MeshPhysicalMaterial({ map: canvasTex(cv), metalness: 0.05, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08 });
      const edge = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(k.elementInfo.color).lerp(new THREE.Color('#ffffff'), 0.35), metalness: 1, roughness: 0.18 });
      const mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, face(cardFront(imgs[i], h, k)), face(cardBack(h, k))]);
      mesh.userData.card = i;
      const g = new THREE.Group(); g.add(mesh); scene.add(g);
      cards.push({ g, i, h, k, hover: 0, pinned: 0 });
    });
  }

  /* ---------- layout, input, loop ---------- */
  let fit = 1, cardX = 4.3;
  function layout() {
    const w = gate.clientWidth, h = gate.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const viewW = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(13)) * camera.aspect;
    fit = clamp(viewW / 11.5, 0.48, 0.66);
    // beside the door, never cut off by the screen edge (cards sit a little nearer the camera and sway, hence the slack)
    cardX = Math.min(4.3 * fit, (viewW / 2 - CARD.w * 0.6 * fit * 0.6 - 0.3) / 1.08);
  }
  new ResizeObserver(layout).observe(gate);
  const roomNow = () => (camera.aspect > 1.3 ? 6 : camera.aspect > 0.95 ? 4 : 2); // cards that fit beside the door at this shape
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(-9, -9), pointer = { x: 0, y: 0 };
  let hoverDoor = 0, hoverCard = -1, tagTimer;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)]; };
  gate.addEventListener('pointermove', (e) => { const [x, y] = local(e); mouse.set(x, y); if (e.pointerType !== 'touch') { pointer.x = x; pointer.y = y; } });
  gate.addEventListener('pointerleave', () => { mouse.set(-9, -9); pointer.x = pointer.y = 0; });
  function showTag(c, e) {
    tagEl.innerHTML = `<b>${c.h.name}</b><span>Token ${c.h.token} · ${c.k.elementInfo.name} ${c.k.classInfo.name}</span>`;
    tagEl.style.setProperty('--c', c.k.elementInfo.color);
    const r = gate.getBoundingClientRect();
    tagEl.style.left = `${clamp(e.clientX - r.left, 90, r.width - 90)}px`; tagEl.style.top = `${clamp(e.clientY - r.top - 18, 60, r.height)}px`;
    tagEl.hidden = false; cards.forEach((o) => { o.pinned = o === c ? 1 : 0; });
    clearTimeout(tagTimer); tagTimer = setTimeout(() => { tagEl.hidden = true; c.pinned = 0; }, 4000);
  }
  function showNote(d, e) {
    tagEl.innerHTML = `<b>${d.title}</b><span>${d.by}</span>`; tagEl.style.setProperty('--c', '#e845a4');
    const r = gate.getBoundingClientRect();
    tagEl.style.left = `${clamp(e.clientX - r.left, 90, r.width - 90)}px`; tagEl.style.top = `${clamp(e.clientY - r.top - 18, 60, r.height)}px`;
    tagEl.hidden = false; clearTimeout(tagTimer); tagTimer = setTimeout(() => { tagEl.hidden = true; }, 4000);
  }
  canvas.addEventListener('click', (e) => {
    const [x, y] = local(e); mouse.set(x, y); ray.setFromCamera(mouse, camera);
    // skip invisible or decorative meshes (the hidden under-door light, the poster, the frame): take the first thing that means something
    const hits = ray.intersectObjects(scene.children, true).filter((h) => h.object.visible && h.object.material?.opacity !== 0);
    const hit = hits.find((h) => h.object.userData.card !== undefined || h.object.userData.drawing || h.object.userData.door);
    if (hit?.object.userData.card !== undefined) showTag(cards[hit.object.userData.card], e);
    else if (hit?.object.userData.drawing || hit?.object.userData.door) enter(); // anything on the door (the poster too) opens it
  });

  let opening = -1, intro = 0, t = 0, camSway = 0, readyAt = 0, openAt = 0, last = performance.now();
  function enter() {
    if (opening >= 0 || !gateReady) return;
    tagEl.hidden = true;
    if (reduce) { finish(); return; }
    opening = 0; openAt = performance.now(); gate.classList.add('is-entering'); sfx('door');
  }
  gate.querySelector('[data-enter]').addEventListener('click', enter);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (underGlow && !reduce) underGlow.material.opacity = 0.55 + 0.18 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1); // firelight flickers
    if (gateReady) intro = Math.min(1, (now - readyAt) / 2600);
    const iE = reduce ? 1 : expoOut(intro);
    if (opening >= 0) opening = Math.min(1, (now - openAt) / 2400);
    const op = Math.max(0, opening);
    ray.setFromCamera(mouse, camera);
    const hit = opening < 0 ? ray.intersectObjects(scene.children, true)[0] : null;
    hoverCard = hit && hit.object.userData.card !== undefined ? hit.object.userData.card : -1;
    const onDrawing = !!(hit && hit.object.userData.drawing), onDoor = !!(hit && hit.object.userData.door) && !onDrawing;
    hoverDoor = damp(hoverDoor, onDoor ? 1 : 0, 6, dt);
    canvas.style.cursor = onDoor || onDrawing || hoverCard >= 0 ? 'pointer' : 'default';

    const swing = 1 - Math.pow(1 - clamp(op / 0.55, 0, 1), 3);
    doorRoot.scale.setScalar(fit);
    doorRoot.position.set(0, DOOR_Y - (1 - iE) * (1 - iE) * 3, 0);
    doorRoot.rotation.y = damp(doorRoot.rotation.y, pointer.x * 0.1 * (1 - op), 4, dt);
    doorRoot.rotation.x = damp(doorRoot.rotation.x, -pointer.y * 0.04 * (1 - op), 4, dt);
    for (const L of leaves) L.hinge.rotation.y = -L.side * (swing * 1.75 + hoverDoor * 0.06);    lightPlane.material.color.setScalar(0.4 + hoverDoor * 0.35 + swing * 0.75);
    if (hoverDoor > 0.02 || swing > 0) { paintBehind(t); behindTex.needsUpdate = true; } // the portal only turns while you can see it
    inner.intensity = swing * 60;
    torch.intensity = 7 + (reduce ? 0 : Math.sin(t * 9) * 0.9 + Math.sin(t * 23) * 0.5) + hoverDoor * 4;

    for (const c of cards) {
      const focus = Math.max(c.i === hoverCard ? 1 : 0, c.pinned);
      c.hover = damp(c.hover, focus, 6, dt);
      const [sx, dy, sc] = SLOTS[c.i], drop = 1 - iE, side = Math.sign(sx);
      const x = sx * cardX + (reduce ? 0 : Math.sin(t * 0.4 + c.i * 2) * 0.12), z = 1.1 + (reduce ? 0 : Math.cos(t * 0.33 + c.i) * 0.25);
      const y = DOOR_Y + (2.3 + dy) * fit + Math.sin(t * 0.72 + c.i * 2) * 0.12 - drop * drop * 9;
      c.g.position.set(x, y, z);
      // cards always face the viewer while they orbit; only a gentle sway (and the spin of the intro rise)
      const yaw = Math.sin(t * 0.27 + c.i) * 0.12 * (1 - c.hover);
      c.g.rotation.set(Math.sin(t * 0.45 + c.i) * 0.04, yaw - drop * 2.4, Math.cos(t * 0.5 + c.i) * 0.03 - x * 0.015);
      c.g.scale.setScalar(0.6 * sc * fit * (0.7 + 0.3 * iE) * (1 + c.hover * 0.12));
      // once the door is open the cards swoop down, cross over and dive through the doorway into the portal
      const lf = clamp((op - 0.42 - c.i * (cards.length > 2 ? 0.03 : 0.05)) / (cards.length > 2 ? 0.3 : 0.36), 0, 1);
      if (lf > 0) {
        const le = lf * lf * (3 - 2 * lf), u = 1 - le;
        const p0 = [x, y, z], p1 = [side * cardX * 0.35 * Math.abs(sx), DOOR_Y + (0.2 + dy * 0.4) * fit, z + 0.8], p2 = [-side * 0.45 * fit, DOOR_Y + 1.7 * fit, -1.0];
        c.g.position.set(...p0.map((v, k) => u * u * v + 2 * u * le * p1[k] + le * le * p2[k]));
        c.g.rotation.z += -side * le * 0.9; c.g.scale.multiplyScalar(1 - 0.55 * le);
      }
      c.g.visible = lf < 1 && c.i < roomNow(); // a whale's extra cards only while there's room beside the door (follows resizes)
    }
    const walk = easeIn(clamp((op - 0.3) / 0.7, 0, 1));
    camera.position.x = damp(camera.position.x, -pointer.x * 0.3 * (1 - op), 3, dt);
    camSway = damp(camSway, -pointer.y * 0.12 * (1 - op), 3, dt);
    const doorMid = DOOR_Y + 1.5 * fit;
    camera.position.y = camSway + doorMid * walk;
    camera.position.z = lerp(CAM_Z, 0.9, walk);
    camera.lookAt(0, lerp(0, doorMid, walk), lerp(0, -4, walk));
    gate.style.setProperty('--flash', clamp((op - 0.62) / 0.3, 0, 1).toFixed(3));
    if (op >= 1) finish();
    renderer.render(scene, camera);
  }

  (async function boot() {
    layout();
    let p = 0; const bump = (v) => { p = Math.max(p, v); pctEl.textContent = String(Math.round(p)).padStart(2, '0'); };
    const ticker = setInterval(() => bump(Math.min(90, p + 4)), 60);
    try { await Promise.race([Promise.all(['700 112px "Grenze Gotisch"', '800 70px "Grenze"', '700 26px "JetBrains Mono"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3500))]); } catch {}
    // a wallet's own Chog art comes from IPFS: ask for it with CORS so WebGL may use it; if it won't load, a sample Chog takes the spot
    const loadImg = (src) => new Promise((res) => { const i = new Image(); if (/^https?:/.test(src)) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    hunters = hunters.slice(0, SLOTS.length); // all of them are built; roomNow() decides how many show at the current size
    const imgs = await Promise.all(hunters.map((h) => loadImg(h.img)));
    for (let k = 0; k < hunters.length; k++) {
      if (imgs[k]) continue;
      const s = spare.find((x) => !hunters.includes(x)); if (!s) continue;
      hunters[k] = s; imgs[k] = await loadImg(s.img);
    }
    const pics = await Promise.all(drawings.map((d) => new Promise((res) => { const i = new Image(); i.onload = () => res(canvasTex(drawingCanvas(i))); i.onerror = () => res(null); i.src = d.src; })));
    const bossImg = boss ? await loadImg(boss.img) : null;
    const noticeTex = canvasTex(noticeCanvas(bossImg));
    buildDoor(canvasTex(woodCanvas(), [1, 1]), canvasTex(stoneCanvas(), [1, 1]), noticeTex, pics);    buildCards(imgs.slice(0, hunters.length));
    renderer.compile(scene, camera);
    clearInterval(ticker); bump(100);
    renderer.setAnimationLoop(frame);
    await new Promise((r) => setTimeout(r, 450));
    gateReady = true; readyAt = performance.now();
    gate.classList.add('is-ready');
  })().catch((err) => { console.error(err); gate.classList.add('is-ready'); gateReady = true; });
}
