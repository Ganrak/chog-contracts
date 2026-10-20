// Chog Capsule: a toy capsule machine in the arcade. It runs on capsule tokens that can't be bought, only earned:
// one free every day, one for each daily contract won, one for each weekly-boss hunt. No $CHOG goes in, so it is a
// prize toy, not a bet. What comes out: XP for your Chog, test $CHOG, potions, and now and then a room item.

const KEY = 'chog-contracts-capsule';
export const MAX_TOKENS = 5;
export const CAPSULE_ON = false; // hidden until its machine art is ready: the cabinet shows 'Coming soon', no tokens are handed out

// [weight, prize]; the odds are shown on the machine
export const PRIZES = [
  [35, { kind: 'xp', n: 40, label: '+40 XP', tier: 'common', img: 'xp-small' }],
  [25, { kind: 'chog', n: 300, label: '+300 test $CHOG', tier: 'common', img: 'coins' }],
  [20, { kind: 'potion', label: 'A potion', tier: 'uncommon', img: 'potion' }],
  [12, { kind: 'xp', n: 120, label: '+120 XP', tier: 'uncommon', img: 'xp-big' }],
  [6, { kind: 'item', label: 'A room item', tier: 'rare', img: 'gift' }],
  [2, { kind: 'chog', n: 5000, label: 'Golden capsule: +5,000 test $CHOG', tier: 'legend', img: 'golden' }],
];
const TOTAL = PRIZES.reduce((s, [w]) => s + w, 0);
export const odds = () => PRIZES.map(([w, p]) => ({ ...p, pct: Math.round(w / TOTAL * 100) }));

const today = () => new Date().toLocaleDateString('en-CA');
export function loadCapsule() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
  return { tokens: 0, lastFree: '', spins: 0, ...(s || {}) };
}
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

/** The free token of the day, once per calendar day. Returns true if one was just given. */
export function claimDaily() {
  const s = loadCapsule(); if (s.lastFree === today()) return false;
  s.lastFree = today(); s.tokens = Math.min(MAX_TOKENS, s.tokens + 1); save(s); return true;
}
/** One token for playing (a daily contract won, a boss hunt). Returns true if it fit under the cap. */
export function earnToken() {
  const s = loadCapsule(); if (s.tokens >= MAX_TOKENS) return false;
  s.tokens += 1; save(s); return true;
}
/** Spends a token and draws a prize, or returns null with no token left. */
export function spin(rand = Math.random) {
  const s = loadCapsule(); if (s.tokens < 1) return null;
  s.tokens -= 1; s.spins += 1; save(s);
  let r = rand() * TOTAL;
  for (const [w, p] of PRIZES) { r -= w; if (r < 0) return { ...p }; }
  return { ...PRIZES[0][1] };
}
/** Time until tomorrow's free token, as "5h 12m". */
export function nextFreeIn() {
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), m = Math.max(0, Math.round((next - now) / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
