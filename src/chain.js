// Read-only access to Chog Genesis on Monad: owner, metadata and traits of a token, and the
// Chogs a wallet holds. Nothing here signs or sends a transaction.
import { CONTRACT, SUPPLY } from './traits.js';

export const RPC = 'https://rpc.monad.xyz'; // Monad mainnet, chain id 143
const GATEWAY = 'https://ipfs.filebase.io/ipfs/'; // fastest public gateway in tests; Pinata's took ~7 s a file
const SEL = { ownerOf: '0x6352211e', tokenURI: '0xc87b56dd', balanceOf: '0x70a08231' };
// The contract is not ERC721Enumerable, so a wallet's Chogs are found by asking ownerOf for
// every token id, in JSON-RPC batches. Ids run 1..SUPPLY (adjust if a 0 id ever shows up).
const FIRST_ID = 1;

const word = (n) => BigInt(n).toString(16).padStart(64, '0');
export const ipfs = (uri) => (uri || '').replace(/^ipfs:\/\//, GATEWAY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The public RPC allows 50 calls per second, counting every call inside a batch. Over the limit it still
// answers 200 but marks each call with error -32007, so those calls are retried, never read as "not yours".
const PER_SECOND = 45;
let sent = []; // send times of the calls in the last second
async function slot(n) {
  for (;;) {
    const now = Date.now(); sent = sent.filter((t) => now - t < 1000);
    if (sent.length + n <= PER_SECOND) { for (let i = 0; i < n; i++) sent.push(now); return; }
    await sleep(1000 - (now - sent[0]) + 25);
  }
}
const limited = (r) => !r || r.error?.code === -32007 || /limit|too many/i.test(r.error?.message || '');
async function rpc(calls) {
  if (calls.length > PER_SECOND) { // keep every request under the per-second cap
    const out = [];
    for (let i = 0; i < calls.length; i += PER_SECOND) out.push(...(await rpc(calls.slice(i, i + PER_SECOND))));
    return out;
  }
  const out = new Array(calls.length);
  let todo = calls.map((_, i) => i);
  for (let attempt = 0; attempt < 8 && todo.length; attempt++) {
    if (attempt) await sleep(Math.min(5000, 400 * 2 ** attempt) + Math.random() * 300);
    await slot(todo.length);
    const body = todo.map((i) => ({ jsonrpc: '2.0', id: i, method: 'eth_call', params: [{ to: CONTRACT, data: calls[i] }, 'latest'] }));
    const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`Monad RPC answered ${res.status}`);
    const json = await res.json(), list = Array.isArray(json) ? json : [json];
    todo = todo.filter((i) => { const r = list.find((x) => x.id === i); if (limited(r)) return true; out[i] = r; return false; });
  }
  if (todo.length) throw new Error('Monad is busy right now');
  return out;
}

function decodeString(hex) {
  const h = hex.slice(2), len = parseInt(h.slice(64, 128), 16);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = parseInt(h.slice(128 + i * 2, 130 + i * 2), 16);
  return new TextDecoder().decode(bytes);
}
const decodeAddress = (hex) => `0x${hex.slice(-40)}`.toLowerCase();

/* ---------- snapshot: data/chogs.json, built by scripts/snapshot.ps1 ---------- */
let snapshot;
export function loadSnapshot() {
  let url; try { url = new URL('../data/chogs.json', import.meta.url); } catch { return Promise.resolve(null); } // (on the server there is no snapshot file: read the chain)
  snapshot ||= fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return snapshot;
}
const fromSnapshot = (c) => ({ tokenId: c.id, name: c.name || `Chog #${c.id}`, owner: c.owner, image: ipfs(c.image), traits: c.traits || {} });

/** Reads ownerOf for a few ids in one request. */
export async function ownersOf(ids) {
  const replies = await rpc(ids.map((id) => SEL.ownerOf + word(id)));
  return replies.map((r) => (r.result ? decodeAddress(r.result) : null));
}

/** How many Chogs a wallet holds right now (one call). */
export async function chogBalanceOf(wallet) {
  const [r] = await rpc([SEL.balanceOf + word(BigInt(wallet))]);
  if (r.error) throw new Error(r.error.message || 'balanceOf failed');
  return Number(BigInt(r.result));
}

/**
 * A wallet's Chogs. Fast path: candidates from the snapshot, confirmed on-chain in one request.
 * The live balance is checked too, so a Chog bought or moved after the snapshot still shows up:
 * if the snapshot found fewer than the wallet holds, every id is swept on-chain instead.
 */
export async function walletChogs(wallet, { fullScan = false, onProgress } = {}) {
  const me = wallet.toLowerCase(), snap = await loadSnapshot();
  const sweep = async () => Promise.all((await chogsOf(me, { onProgress })).map(readChog));
  if (fullScan || !snap) return sweep();
  const [balance, mine] = await Promise.all([
    chogBalanceOf(me),
    (async () => {
      const candidates = snap.chogs.filter((c) => c.owner === me);
      if (!candidates.length) return [];
      const owners = await ownersOf(candidates.map((c) => c.id));
      return candidates.filter((_, i) => owners[i] === me);
    })(),
  ]);
  if (balance === 0) return [];
  if (mine.length < balance) return sweep(); // bought or moved since the snapshot
  // traits fill into the snapshot over time; read the rest straight from IPFS
  return Promise.all(mine.map((c) => (c.traits ? { ...fromSnapshot(c), owner: me } : readChog(c.id))));
}

/** One Chog: { tokenId, name, owner, image, traits: { Body: 'Tuxedo', ... } } */
export async function readChog(tokenId) {
  const snap = await loadSnapshot();
  const hit = snap?.chogs.find((c) => c.id === Number(tokenId) && c.traits);
  if (hit) { const [owner] = await ownersOf([hit.id]); return { ...fromSnapshot(hit), owner: owner || hit.owner }; }
  const [own, uri] = await rpc([SEL.ownerOf + word(tokenId), SEL.tokenURI + word(tokenId)]);
  if (own.error || uri.error) throw new Error(`Chog #${tokenId} not found on Monad`);
  const meta = await (await fetch(ipfs(decodeString(uri.result)))).json();
  const traits = Object.fromEntries((meta.attributes || []).map((a) => [a.trait_type, String(a.value)]));
  return { tokenId: Number(tokenId), name: meta.name || `Chog #${tokenId}`, owner: decodeAddress(own.result), image: ipfs(meta.image), traits };
}

/** Token ids a wallet holds: every id's ownerOf, in batches of `batch`, `parallel` batches at a time. */
export async function chogsOf(wallet, { batch = 45, parallel = 2, onProgress } = {}) {
  const me = wallet.toLowerCase(), ids = [], ranges = [];
  for (let start = FIRST_ID; start < FIRST_ID + SUPPLY; start += batch) ranges.push(Array.from({ length: Math.min(batch, FIRST_ID + SUPPLY - start) }, (_, i) => start + i));
  let next = 0, done = 0;
  const worker = async () => {
    while (next < ranges.length) {
      const range = ranges[next++];
      const replies = await rpc(range.map((id) => SEL.ownerOf + word(id)));
      replies.forEach((r, i) => { if (r.result && decodeAddress(r.result) === me) ids.push(range[i]); });
      done += range.length; onProgress?.(Math.min(1, done / SUPPLY));
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  return ids.sort((a, b) => a - b);
}
