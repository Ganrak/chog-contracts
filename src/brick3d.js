// Brick Studio workbench: the mosaic stands upright on a base two bricks high and is built bottom-up from
// pieces cut by brick.js cutPieces (Tetris-like fours, threes, twos, a few singles). Each step shows the
// pieces that go next as ghosts in their colour; pick a colour in the tray and click or drag over the wall to
// drop a whole piece in. "Fill step" / "Play" build it for you. Cells are instanced, so 48x48 stays light;
// cells of one piece are drawn without seams between them, so every piece reads as one brick.
import * as THREE from 'three';
import { PALETTE } from './brick.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEPS = 8, BASE = 2, DEPTH = 3, GAP = 0.045; // base: 2 bricks high, 3 studs deep; GAP = seam between pieces

export function startBrickBuilder(canvas, { onChange, onPlace, onStepDone } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-40, 70, 80); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(50, 20, -40); scene.add(fill);

  const board = new THREE.Group(); scene.add(board);
  const bodyGeo = new THREE.BoxGeometry(1, 1, 0.97);
  const studGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.17, 16); studGeo.translate(0, 0.5 + 0.085, 0);
  const ghostGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const brickMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
  const dimMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
  const hotMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b2a33, roughness: 0.35 });

  let m = null, n = 0, half = 0, per = 0, pieces = [], pieceOf = null, placed = null, done = null;
  let bodies, studs, dimGhosts, hotGhosts, baseGroup, hitPlane;
  let selected = null, drops = [], playing = 0, playAcc = 0, spin = false, raf = 0, visible = true, last = performance.now();
  const tmp = new THREE.Object3D(), col = new THREE.Color(), target = new THREE.Vector3();
  const level = (k) => m.size - 1 - Math.floor(k / m.size);
  const stepOfPiece = (p) => Math.floor(p.low / per);
  const same = (k, q) => q >= 0 && pieceOf[q] === pieceOf[k];

  function setMosaic(next, cut, saved) {
    for (const o of [bodies, studs, dimGhosts, hotGhosts, baseGroup, hitPlane]) if (o) board.remove(o);
    m = next; pieces = cut; n = m.size * m.size; half = m.size / 2; per = m.size / STEPS;
    pieceOf = new Int32Array(n); for (const p of pieces) for (const k of p.cells) pieceOf[k] = p.id;
    placed = new Uint8Array(n); if (saved && saved.length === n) for (let k = 0; k < n; k++) placed[k] = saved.charCodeAt(k) === 49 ? 1 : 0;
    done = pieces.map((p) => p.cells.every((k) => placed[k])); // a half-saved piece counts as not placed
    for (const p of pieces) if (!done[p.id]) for (const k of p.cells) placed[k] = 0;

    baseGroup = new THREE.Group(); // two dark brick layers, studs on top in front of and behind the wall
    const w = m.size + 2, slab = new THREE.Mesh(new THREE.BoxGeometry(w, BASE * 0.97, DEPTH), baseMat);
    slab.position.y = BASE * 0.97 / 2; baseGroup.add(slab);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, DEPTH + 0.02), new THREE.MeshBasicMaterial({ color: 0x15141a }));
    seam.position.y = 0.97; baseGroup.add(seam);
    const topStuds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.17, 12), baseMat, w * DEPTH);
    let s = 0;
    for (let x = 0; x < w; x++) for (let z = 0; z < DEPTH; z++) { tmp.position.set(x - w / 2 + 0.5, BASE * 0.97 + 0.085, z - DEPTH / 2 + 0.5); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); topStuds.setMatrixAt(s++, tmp.matrix); }
    baseGroup.add(topStuds); board.add(baseGroup);

    bodies = new THREE.InstancedMesh(bodyGeo, brickMat, n); studs = new THREE.InstancedMesh(studGeo, brickMat, n);
    // each piece gets a faint shade of its own, so neighbouring pieces of one colour still read apart
    for (let k = 0; k < n; k++) { col.set(PALETTE[m.grid[k]].hex).multiplyScalar(1 - ((pieceOf[k] * 2654435761) >>> 0) % 7 / 100); bodies.setColorAt(k, col); studs.setColorAt(k, col); setCell(k, placed[k] ? 0 : null); }
    dimGhosts = new THREE.InstancedMesh(ghostGeo, dimMat, n); hotGhosts = new THREE.InstancedMesh(ghostGeo, hotMat, n);
    dimGhosts.setColorAt(0, col); hotGhosts.setColorAt(0, col);
    hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(m.size, m.size), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hitPlane.position.set(0, BASE + half, 0.5);
    board.add(bodies, studs, dimGhosts, hotGhosts, hitPlane);
    bodies.instanceColor.needsUpdate = studs.instanceColor.needsUpdate = true;
    target.set(0, (BASE + m.size) / 2 + 1, 0);
    view('34', true); refreshGhosts(); emit();
  }
  // one cell of a piece, stretched to meet its piece-mates so the piece has no inner seams; lift: null = hidden
  function setCell(k, lift) {
    const r = Math.floor(k / m.size), c = k % m.size, sz = m.size;
    const L = same(k, c > 0 ? k - 1 : -1) ? 0.5 : 0.5 - GAP, R = same(k, c < sz - 1 ? k + 1 : -1) ? 0.5 : 0.5 - GAP;
    const D = same(k, r < sz - 1 ? k + sz : -1) ? 0.5 : 0.5 - GAP, U = same(k, r > 0 ? k - sz : -1) ? 0.5 : 0.5 - GAP;
    tmp.position.set(c - half + 0.5 + (R - L) / 2, BASE + level(k) + 0.5 + (U - D) / 2 + (lift ?? 0), 0);
    tmp.scale.set(lift === null ? 0.0001 : L + R, lift === null ? 0.0001 : U + D, 1); tmp.updateMatrix();
    bodies.setMatrixAt(k, tmp.matrix);
    // studs only on a piece's top faces (a cell with a piece-mate above hides it anyway)
    tmp.scale.set(lift === null || U === 0.5 ? 0.0001 : 1, lift === null || U === 0.5 ? 0.0001 : 1, 1);
    tmp.position.set(c - half + 0.5, BASE + level(k) + (lift ?? 0) - 0.5 + 1 - (0.5 - U), 0); tmp.updateMatrix();
    studs.setMatrixAt(k, tmp.matrix);
    bodies.instanceMatrix.needsUpdate = studs.instanceMatrix.needsUpdate = true;
  }
  const current = () => { let st = STEPS; for (const p of pieces) if (!done[p.id]) st = Math.min(st, stepOfPiece(p)); return st; };
  function refreshGhosts() {
    const st = current(); let d = 0, h = 0;
    for (const p of pieces) {
      if (done[p.id] || stepOfPiece(p) !== st) continue;
      const hot = selected !== null && p.color === selected; col.set(PALETTE[p.color].hex);
      for (const k of p.cells) {
        tmp.position.set((k % m.size) - half + 0.5, BASE + level(k) + 0.5, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        if (hot) { hotGhosts.setMatrixAt(h, tmp.matrix); hotGhosts.setColorAt(h, col); h++; } else { dimGhosts.setMatrixAt(d, tmp.matrix); dimGhosts.setColorAt(d, col); d++; }
      }
    }
    dimGhosts.count = d; hotGhosts.count = h;
    for (const g of [dimGhosts, hotGhosts]) { g.instanceMatrix.needsUpdate = true; if (g.instanceColor) g.instanceColor.needsUpdate = true; }
  }
  function emit() {
    const st = current(), left = new Map(); let cells = 0, piecesDone = 0;
    for (const p of pieces) { if (done[p.id]) { piecesDone++; cells += p.cells.length; } else if (stepOfPiece(p) === st) left.set(p.color, (left.get(p.color) || 0) + 1); }
    onChange?.({ step: Math.min(st + 1, STEPS), steps: STEPS, placed: piecesDone, total: pieces.length, bricks: cells, colors: [...left].map(([i, c]) => ({ i, left: c })).sort((a, b) => b.left - a.left), selected, finished: piecesDone === pieces.length, saved: Array.from(placed, (v) => (v ? '1' : '0')).join('') });
  }
  function placePiece(p, quiet) {
    if (done[p.id]) return false;
    done[p.id] = true; for (const k of p.cells) { placed[k] = 1; setCell(k, 3); }
    drops.push({ p, t: 0 });
    if (!quiet) onPlace?.();
    return true;
  }
  function afterPlacing(stepBefore) {
    if (selected !== null && !pieces.some((p) => !done[p.id] && stepOfPiece(p) === stepBefore && p.color === selected)) selected = null;
    if (current() !== stepBefore) { selected = null; onStepDone?.(current() >= STEPS); }
    refreshGhosts(); emit();
  }

  // pointer: left click/drag drops pieces, right or shift drag turns the model
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let mode = null, px = 0;
  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(hitPlane)[0]; if (!hit) return -1;
    const p = board.worldToLocal(hit.point.clone()), c = Math.floor(p.x + half), lv = Math.floor(p.y - BASE);
    return c < 0 || lv < 0 || c >= m.size || lv >= m.size ? -1 : (m.size - 1 - lv) * m.size + c;
  }
  function tryPlace(e) {
    const k = cellAt(e); if (k < 0) return;
    const p = pieces[pieceOf[k]], st = current();
    if (done[p.id] || stepOfPiece(p) !== st || (selected !== null && p.color !== selected)) return;
    if (placePiece(p)) afterPlacing(st);
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (!m) return; try { canvas.setPointerCapture(e.pointerId); } catch {} px = e.clientX;
    mode = e.button === 2 || e.shiftKey ? 'turn' : 'place'; spin = false;
    if (mode === 'place') tryPlace(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!mode) return;
    if (mode === 'turn') { board.rotation.y += (e.clientX - px) * 0.008; px = e.clientX; } else tryPlace(e);
  });
  addEventListener('pointerup', () => { mode = null; });
  canvas.addEventListener('wheel', (e) => { if (!m) return; e.preventDefault(); zoom = Math.max(0.45, Math.min(1.8, zoom * (1 + Math.sign(e.deltaY) * 0.08))); camGoal = viewPos(curView); }, { passive: false });

  let zoom = 1, curView = '34', camGoal = new THREE.Vector3();
  const viewPos = (v) => {
    const s = (m.size + BASE) * zoom * (camera.aspect < 1 ? 1.5 : 1);
    const off = v === 'top' ? new THREE.Vector3(0, s * 1.35, s * 1.25) : v === 'front' ? new THREE.Vector3(0, s * 0.06, s * 2.45) : new THREE.Vector3(s * 1.0, s * 0.32, s * 2.15);
    return off.add(target);
  };
  function view(v, instant) { curView = v; camGoal = viewPos(v); if (instant) { camera.position.copy(camGoal); camera.lookAt(target); } }

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (m) camGoal = viewPos(curView);
  }
  const ro = new ResizeObserver(size); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(performance.now()); }, { threshold: 0.05 }); io.observe(canvas);

  function loop(now) {
    cancelAnimationFrame(raf);
    if (!visible || !m) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    camera.position.lerp(camGoal, 1 - Math.exp(-dt * 6)); camera.lookAt(target);
    if (spin) board.rotation.y += dt * 0.4;
    if (playing) { // auto-build: `playing` pieces per second, in build order
      playAcc += dt * playing; const st = current();
      while (playAcc >= 1) { playAcc -= 1; const p = pieces.find((q) => !done[q.id]); if (!p) { playing = 0; break; } placePiece(p, true); }
      if (current() !== st || !playing) afterPlacing(st); else if (Math.random() < 0.2) emit();
    }
    if (drops.length) { // a piece drops onto the stack with a little bounce
      for (const d of drops) {
        d.t += dt / (reduce() ? 0.01 : 0.24); const t = Math.min(1, d.t);
        const lift = (1 - t) * (1 - t) * 3 + (t > 0.75 ? Math.sin((t - 0.75) / 0.25 * Math.PI) * 0.12 : 0);
        for (const k of d.p.cells) setCell(k, lift);
      }
      drops = drops.filter((d) => d.t < 1);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  return {
    setMosaic(next, cut, saved) { size(); setMosaic(next, cut, saved); loop(performance.now()); },
    select(i) { selected = selected === i ? null : i; refreshGhosts(); emit(); },
    fillStep() { const st = current(); for (const p of pieces) if (!done[p.id] && stepOfPiece(p) === st) placePiece(p, true); afterPlacing(st); },
    play(speed) { playing = speed ? 12 * speed : 0; loop(performance.now()); emit(); },
    playing: () => playing > 0,
    reset() { placed.fill(0); done.fill(false); drops = []; for (let k = 0; k < n; k++) setCell(k, null); selected = null; playing = 0; refreshGhosts(); emit(); },
    view(v) { spin = v === 'spin' ? !spin : false; if (v !== 'spin') view(v); },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
  };
}
