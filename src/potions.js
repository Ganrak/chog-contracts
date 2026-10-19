// Potion bottles: three bottles from potions.glb, each with liquid in the potion's colour and a
// Chog NFT label on the front. Used as the hero row and as the reward reveal after a hunt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadBottles } from './bottles.js';

export const POTIONS = [
  // fill: how high the liquid reaches, as a share of the bottle's height (just under where the neck starts)
  { id: 'health', name: 'Health', color: '#E2333D', bottle: 13, fill: 0.64, img: 'assets/chogs/812.webp', chog: 'CHOG #304', effect: 'Heals 40% mid-fight' },
  { id: 'mana', name: 'Mana', color: '#4A72FF', bottle: 7, fill: 0.58, img: 'assets/chogs/61.webp', chog: 'CHOG #1522', effect: 'Fills your ultimate mid-fight' },
  // box: the Power jug has flat sides, so its liquid is a rounded box instead of a round one
  { id: 'power', name: 'Power', color: '#F2B82E', bottle: 2, fill: 0.66, box: true, img: 'assets/chogs/68.webp', chog: 'CHOG #1529', effect: '+50% damage for 3 turns' },
];
const BOTTLE_H = 3.2; // scene units: every bottle is scaled to this height
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// A seal stamped on the label's corner: the official Chog logo in a ring of the potion colour,
// or a drawn spiky Chog head if the logo can't load.
function chogSeal(c, x, y, r, color, logo) {
  c.save(); c.translate(x, y);
  c.fillStyle = '#f6efe0'; c.beginPath(); c.arc(0, 0, r + 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = color; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  if (logo) {
    const ri = r - 9;
    c.beginPath(); c.arc(0, 0, ri, 0, Math.PI * 2); c.clip();
    c.drawImage(logo, -ri, -ri, ri * 2, ri * 2);
    c.restore(); return;
  }
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r - 7, 0, Math.PI * 2); c.stroke();
  // spiky crest
  c.fillStyle = '#fff'; c.beginPath();
  const spikes = 7, R = r * 0.62, rIn = r * 0.36, cy = -r * 0.05;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = Math.PI + (i / (spikes * 2)) * Math.PI, rad = i % 2 ? R : rIn;
    c.lineTo(Math.cos(a) * rad, cy + Math.sin(a) * rad * 1.05);
  }
  c.closePath(); c.fill();
  // face
  c.beginPath(); c.ellipse(0, cy + r * 0.12, r * 0.4, r * 0.32, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = color;
  c.beginPath(); c.arc(-r * 0.14, cy + r * 0.1, r * 0.07, 0, Math.PI * 2); c.arc(r * 0.14, cy + r * 0.1, r * 0.07, 0, Math.PI * 2); c.fill();
  c.strokeStyle = color; c.lineWidth = 3; c.beginPath(); c.arc(0, cy + r * 0.2, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.restore();
}

// The label: the NFT in a rounded frame in the potion colour, the potion's name on a strip below.
function drawLabel(p, img, logo) {
  const W = 512, H = 640, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#efe4c9'; c.beginPath(); c.roundRect(0, 0, W, H, 46); c.fill(); // paper
  c.fillStyle = p.color; c.beginPath(); c.roundRect(14, 14, W - 28, H - 28, 36); c.fill();
  c.save(); c.beginPath(); c.roundRect(30, 30, W - 60, W - 60, 26); c.clip();
  if (img) c.drawImage(img, 30, 30, W - 60, W - 60); else { c.fillStyle = '#2a2240'; c.fillRect(30, 30, W - 60, W - 60); }
  c.restore();
  chogSeal(c, W - 92, 96, 58, p.color, logo);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '76px "Koulen", Impact, sans-serif'; c.letterSpacing = '6px';
  c.fillText(p.name.toUpperCase(), W / 2 + 3, H - 72);
  c.font = '700 20px "JetBrains Mono", monospace'; c.letterSpacing = '4px'; c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillText(p.chog, W / 2 + 2, H - 34);
  return cv;
}

// widest point of a bottle's glass within a height band, so the label sits on the surface
function radiusAt(parts, y0, y1) {
  let r = 0; const v = new THREE.Vector3();
  for (const p of parts) {
    if (p.role !== 'glass') continue;
    const pos = p.geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.y >= y0 && v.y <= y1) r = Math.max(r, Math.hypot(v.x, v.z)); }
  }
  return r;
}

// If the model can't load, draw simple bottles so the potions never go missing.
// Indexed like loadBottles() so POTIONS[].bottle still points at a round flask, a cone and a jug.
function fallbackBottles() {
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  const make = (glass, liquid) => ({
    height: 1, radius: 0.4,
    parts: [
      { role: 'glass', geo: lathe(glass), material: null },
      { role: 'liquid', geo: lathe(liquid), material: null },
      { role: 'cork', geo: new THREE.CylinderGeometry(0.075, 0.065, 0.1, 24).translate(0, 0.97, 0), material: new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.9 }) },
    ],
  });
  const round = make([[0, 0], [0.3, 0.02], [0.42, 0.22], [0.4, 0.5], [0.12, 0.72], [0.09, 0.95], [0.1, 0.97]], [[0, 0.03], [0.28, 0.05], [0.38, 0.22], [0.36, 0.45], [0, 0.45]]);
  const cone = make([[0, 0], [0.4, 0.02], [0.36, 0.2], [0.12, 0.7], [0.09, 0.95], [0.1, 0.97]], [[0, 0.03], [0.37, 0.05], [0.3, 0.3], [0, 0.3]]);
  const jug = make([[0, 0], [0.38, 0.02], [0.4, 0.55], [0.14, 0.7], [0.1, 0.95], [0.11, 0.97]], [[0, 0.03], [0.36, 0.05], [0.37, 0.4], [0, 0.4]]);
  const list = []; list[2] = jug; list[7] = cone; list[13] = round;
  return list;
}

// The model's glass has an inner and an outer wall, which reads as thick glass. Keep only triangles
// that face outwards (or up/down for the base and lip) so the bottle has one thin wall.
function outerShell(parts) {
  const out = [];
  for (const p of parts) {
    if (p.role !== 'glass') continue;
    const g = p.geo.index ? p.geo : p.geo.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index ? g.index.array : null;
    const keep = [], a = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3();
    const count = idx ? idx.length : pos.count;
    for (let i = 0; i < count; i += 3) {
      a.set(0, 0, 0); n.set(0, 0, 0);
      for (let k = 0; k < 3; k++) { const v = idx ? idx[i + k] : i + k; a.add(t.fromBufferAttribute(pos, v)); n.add(t.fromBufferAttribute(nor, v)); }
      const radial = a.x * n.x + a.z * n.z; // > 0: the face looks away from the bottle's axis
      if (radial > 0 || Math.abs(n.y) > 0.8 * n.length()) for (let k = 0; k < 3; k++) keep.push(idx ? idx[i + k] : i + k);
    }
    const s = new THREE.BufferGeometry();
    for (const key in g.attributes) s.setAttribute(key, g.attributes[key]);
    s.setIndex(keep);
    out.push(s);
  }
  return out;
}

// The model's own liquid sits low and narrow, so the glass looks thick. Rebuild the liquid from the glass:
// find the glass's vertex rings (one radius per ring: the narrowest direction, so a square jug doesn't leak),
// interpolate between rings for a smooth outline, and turn that outline into the liquid.
// shells: the outer-wall geometries from outerShell(); inner-wall rings sit at other heights and would zigzag the outline
function liquidFromGlass(shells, height, fill, box = false) {
  const sectors = 16, rings = new Map(), v = new THREE.Vector3(), step = height / 300;
  if (box) { // flat-sided jug: a rounded box just inside the walls
    const top = height * fill, base = height * 0.03; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const g of shells) { const pos = g.attributes.position; for (const i of new Set(g.index.array)) { v.fromBufferAttribute(pos, i); if (v.y > base && v.y < top) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); } } }
    const w = (x1 - x0) * 0.9, d = (z1 - z0) * 0.9, h = top - base;
    return new RoundedBoxGeometry(w, h, d, 4, Math.min(w, d) * 0.18).translate((x0 + x1) / 2, base + h / 2, (z0 + z1) / 2);
  }
  for (const g of shells) {
    const pos = g.attributes.position;
    for (const i of new Set(g.index.array)) {
      v.fromBufferAttribute(pos, i);
      const key = Math.round(v.y / step);
      let ring = rings.get(key); if (!ring) rings.set(key, (ring = { y: v.y, best: new Float32Array(sectors) }));
      const s = Math.floor(((Math.atan2(v.z, v.x) + Math.PI) / (2 * Math.PI)) * sectors) % sectors;
      ring.best[s] = Math.max(ring.best[s], Math.hypot(v.x, v.z));
    }
  }
  const outline = [...rings.values()]
    .map((r) => { const f = [...r.best].filter((x) => x > 0); return f.length >= 12 ? { y: r.y, r: Math.min(...f) } : null; })
    .filter(Boolean).sort((a, b) => a.y - b.y);
  if (outline.length < 3) return null;
  const at = (y) => {
    if (y <= outline[0].y) return outline[0].r;
    for (let i = 1; i < outline.length; i++) if (y <= outline[i].y) { const a = outline[i - 1], b = outline[i], t = (y - a.y) / (b.y - a.y || 1); return a.r + (b.r - a.r) * t; }
    return outline.at(-1).r;
  };
  const top = height * fill, base = height * 0.03, n = 48, pts = [new THREE.Vector2(0, base)];
  for (let k = 0; k <= n; k++) { const y = base + (k / n) * (top - base); pts.push(new THREE.Vector2(at(y) * 0.92, y)); }
  pts.push(new THREE.Vector2(0, top));
  return new THREE.LatheGeometry(pts, 64);
}

let shared;
function assets() {
  shared ||= (async () => {
    await Promise.race([Promise.all([document.fonts.load('76px "Koulen"'), document.fonts.load('700 20px "JetBrains Mono"')]), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
    const [bottles, logo, ...imgs] = await Promise.all([loadBottles('assets/potions-glb.json').catch((err) => { console.error(err); return fallbackBottles(); }), loadImg('assets/brand/logo.png'), ...POTIONS.map((p) => loadImg(p.img))]);
    return { bottles, labels: POTIONS.map((p, i) => drawLabel(p, imgs[i], logo)) };
  })();
  return shared;
}

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const env = new THREE.Scene();
  const box = (w, h, pos, k, color = '#ffffff') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  box(1.1, 16, [-4.5, 0.5, 6], 5, '#fff2e6'); box(0.55, 16, [5.5, 0, 5], 2.6, '#eef0ff');
  box(10, 2, [0, 8, 3], 1.2); box(0.6, 16, [-7, 0, -6], 3.5); box(0.6, 16, [7, 0, -6], 3.5); box(8, 8, [0, 0, -9], 0.6, '#ffb36b');
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
  scene.add(new THREE.HemisphereLight('#ffe9d0', '#2a1f3a', 0.6));
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80); camera.position.set(0, 0, 19);
  return { renderer, scene, camera };
}

/** One potion as a group standing on its base, centred on its own middle. */
function buildPotion(renderer, a, i) {
  const p = POTIONS[i], b = a.bottles[p.bottle], s = BOTTLE_H / b.height;
  const g = new THREE.Group(), inner = new THREE.Group();
  inner.scale.setScalar(s); inner.position.y = -BOTTLE_H / 2;
  b.shell ??= outerShell(b.parts);
  b.liquid ??= liquidFromGlass(b.shell, b.height, p.fill, p.box); // computed once per bottle
  for (const part of b.parts) {
    let m = part.material;
    if (part.role === 'liquid' && b.liquid) continue; // replaced by the rebuilt liquid below
    if (part.role === 'glass' && b.shell.length) continue; // replaced by the one-wall shell below
    if (part.role === 'liquid') {
      m = new THREE.MeshPhysicalMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.35, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92 });
    } else if (part.role === 'cork' && !m?.map) {
      m = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.9 }); // texture blocked or missing: plain cork
    } else if (part.role === 'glass') {
      // see-through glass that only shows reflections (transmission turns milky on a transparent canvas)
      // outer surface only, so the glass reads as one thin wall
      m = new THREE.MeshPhysicalMaterial({ color: '#e6eeff', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.13, envMapIntensity: 1.9, depthWrite: false, side: THREE.FrontSide });
    }
    const mesh = new THREE.Mesh(part.geo, m);
    if (part.role === 'glass') mesh.renderOrder = 2; // drawn after the liquid and the label inside it
    inner.add(mesh);
  }
  if (b.liquid) {
    inner.add(new THREE.Mesh(b.liquid, new THREE.MeshPhysicalMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.45, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.92 })));
  }
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#eef3ff', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.17, envMapIntensity: 1.8, depthWrite: false, side: THREE.FrontSide });
  for (const s of b.shell) { const m = new THREE.Mesh(s, glassMat); m.renderOrder = 2; inner.add(m); }
  // the label: a curved patch on the widest part of the body, facing the viewer
  // flat glass sides have vertices only at their ends, so also clear the liquid's front in this band
  const y0 = b.height * 0.12, y1 = b.height * 0.48;
  let front = 0;
  if (b.liquid) { const lp = b.liquid.attributes.position; for (let k = 0; k < lp.count; k++) { const y = lp.getY(k); if (y >= y0 && y <= y1) front = Math.max(front, lp.getZ(k)); } }
  const r = Math.max(radiusAt(b.parts, y0, y1), front / 0.9) * 1.02;
  const lh = (y1 - y0) * 0.95, arc = clamp((lh * 0.8) / r, 0.6, 1.9);
  const geo = new THREE.CylinderGeometry(r, r, lh, 32, 1, true, -arc / 2, arc);
  const tex = new THREE.CanvasTexture(a.labels[i]); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // opaque (cut-out corners via alphaTest), so it is drawn before the see-through liquid and never ends up behind it
  const label = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, alphaTest: 0.5, side: THREE.FrontSide }));
  label.position.y = (y0 + y1) / 2;
  inner.add(label);
  g.add(inner);
  g.traverse((o) => { o.userData.i = i; });
  return g;
}

/** Hero: the three potions side by side. Hover lifts a bottle, drag spins them. */
export async function heroCans(canvas, stage) {
  const a = await assets();
  const { renderer, scene, camera } = makeRenderer(canvas);
  const items = POTIONS.map((_, i) => ({ g: buildPotion(renderer, a, i), home: 0, sc: 1, lift: 0, phase: i * 2.1 }));
  items.forEach((c) => scene.add(c.g));
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(-9, -9), pointer = { x: 0, y: 0 };
  let spin = 0, drag = null;
  const layout = () => {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const viewW = 2 * 19 * Math.tan(THREE.MathUtils.degToRad(13)) * camera.aspect;
    const gap = clamp(viewW / 3.0, 1.6, 3.6), sc = clamp(gap / 3.2, 0.55, 1.05);
    items.forEach((c, i) => { c.home = (i - 1) * gap; c.sc = sc; });
  };
  new ResizeObserver(layout).observe(stage); layout();
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)]; };
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e); mouse.set(x, y); if (e.pointerType !== 'touch') { pointer.x = x; pointer.y = y; }
    if (drag) spin = drag.spin + (e.clientX - drag.x) * 0.012;
  });
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, spin }; });
  addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { mouse.set(-9, -9); pointer.x = pointer.y = 0; });
  let last = performance.now(), t = 0;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(scene.children, true)[0], hover = hit ? hit.object.userData.i : -1;
    canvas.style.cursor = drag ? 'grabbing' : 'grab';
    if (!drag) spin = damp(spin, 0, 0.8, dt);
    items.forEach((c, i) => {
      c.lift = damp(c.lift, i === hover ? 0.35 : 0, 6, dt);
      c.g.position.set(c.home, -0.1 + c.lift + (reduce ? 0 : Math.sin(t * 1.1 + c.phase) * 0.08), i === 1 ? 0.5 : 0);
      c.g.rotation.set(0.04 + pointer.y * -0.05, (reduce ? 0 : Math.sin(t * 0.5 + c.phase) * 0.22) + spin + pointer.x * 0.15, (i - 1) * -0.05);
      c.g.scale.setScalar(c.sc);
    });
    renderer.render(scene, camera);
  });
}

/** Reward reveal: one bottle drops in and spins. Returns stop(). */
export async function rewardCan(canvas, i) {
  const a = await assets();
  const { renderer, scene, camera } = makeRenderer(canvas);
  const g = buildPotion(renderer, a, i); scene.add(g);
  const fit = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  fit();
  const t0 = performance.now();
  renderer.setAnimationLoop((now) => {
    const t = (now - t0) / 1000, k = reduce ? 1 : Math.min(1, t / 0.9), e = 1 - Math.pow(1 - k, 3);
    g.position.y = (1 - e) * 6;
    g.rotation.set(0.08, (reduce ? 0 : t * 1.2) - (1 - e) * 4, 0);
    g.scale.setScalar(1.25);
    renderer.render(scene, camera);
  });
  return () => { renderer.setAnimationLoop(null); renderer.dispose(); };
}
