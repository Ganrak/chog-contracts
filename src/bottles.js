// Splits potions.glb (six bottles merged into one mesh per material) back into single bottles.
// Each mesh is cut into its connected pieces; pieces are then grouped by which glass body they
// sit over, so every bottle keeps its own glass, liquid, cork and rope.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const ROLE = { material: 'glass', 'zelie.001': 'liquid', propka: 'cork', verevka: 'rope' };

// connected pieces of an indexed geometry (union-find over shared vertices)
function islands(geo) {
  const idx = geo.index.array, n = geo.attributes.position.count, parent = new Int32Array(n).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]); parent[b] = a; parent[c] = a; }
  const groups = new Map();
  for (let i = 0; i < idx.length; i += 3) { const r = find(idx[i]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(idx[i], idx[i + 1], idx[i + 2]); }
  // each piece gets only its own vertices (sharing the whole mesh's buffers would copy them per piece)
  return [...groups.values()].map((tri) => {
    const remap = new Map(), used = [];
    const index = tri.map((i) => { if (!remap.has(i)) { remap.set(i, used.length); used.push(i); } return remap.get(i); });
    const g = new THREE.BufferGeometry();
    for (const k in geo.attributes) {
      const src = geo.attributes[k], size = src.itemSize, arr = new src.array.constructor(used.length * size);
      used.forEach((i, j) => { for (let c = 0; c < size; c++) arr[j * size + c] = src.array[i * size + c]; });
      g.setAttribute(k, new THREE.BufferAttribute(arr, size, src.normalized));
    }
    g.setIndex(index);
    g.computeBoundingBox();
    return { geo: g, box: g.boundingBox.clone() };
  });
}

/** Returns bottles sorted left to right: [{ parts: [{ geo, material, role }], height, radius }] */
export async function loadBottles(url) {
  // The model ships as {"glb": base64} in a plain .json file: some hosts (the claude.ai preview) block
  // the data: URLs an embedded glTF would fetch, but every host serves a JSON file.
  const { glb } = await (await fetch(url)).json();
  const bytes = Uint8Array.from(atob(glb), (ch) => ch.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const pieces = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.deleteAttribute('tangent');
    g = mergeVertices(g, 1e-4);
    const role = ROLE[o.material.name] || 'other';
    for (const isl of islands(g)) pieces.push({ ...isl, material: o.material, role });
  });
  // every big glass piece is a bottle body; small glass bits (stoppers, drips) join the nearest body
  const glass = pieces.filter((p) => p.role === 'glass').sort((a, b) => b.box.getSize(new THREE.Vector3()).length() - a.box.getSize(new THREE.Vector3()).length());
  const biggest = glass[0].box.getSize(new THREE.Vector3()).length();
  const bodies = glass.filter((p) => p.box.getSize(new THREE.Vector3()).length() > biggest * 0.35);
  const centerXZ = (b) => { const c = b.getCenter(new THREE.Vector3()); return new THREE.Vector2(c.x, c.z); };
  const bottles = bodies.map((b) => ({ anchor: centerXZ(b.box), parts: [], box: new THREE.Box3() }));
  for (const p of pieces) {
    const c = centerXZ(p.box);
    let best = bottles[0], d = Infinity;
    for (const b of bottles) { const dd = b.anchor.distanceTo(c); if (dd < d) { d = dd; best = b; } }
    best.parts.push(p); best.box.union(p.box);
  }
  // centre each bottle on its own base, upright, so they can be placed anywhere
  return bottles.sort((a, b) => a.anchor.x - b.anchor.x).map((b) => {
    const base = b.box.getCenter(new THREE.Vector3()); base.y = b.box.min.y;
    const size = b.box.getSize(new THREE.Vector3());
    const parts = b.parts.map((p) => { const g = p.geo.clone(); g.translate(-base.x, -base.y, -base.z); g.computeBoundingSphere(); return { geo: g, material: p.material, role: p.role }; });
    return { parts, height: size.y, radius: Math.max(size.x, size.z) / 2 };
  });
}
