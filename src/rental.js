// Renting out: a holder lists a Chog, other players hire it, and the owner gets 30% of every bounty it wins.
// There is no server in this demo, so the renters are simulated: once a Chog is listed, a demo renter takes it on
// a hunt every few hours (minutes in fast mode), seeded so the same listing always tells the same story.
// The page labels all of it "simulated in the demo"; in the full game these would be real hires.

export const OWNER_SHARE = 0.3;
const EVERY_H = 4; // a simulated rental every 4 hours
const HUNTS = [
  { name: 'Gas-Bloat Troll', bounty: 440 }, { name: 'Rugshade Thief', bounty: 520 }, { name: 'Lagstone Golem', bounty: 540 },
  { name: 'Deadchain Ghoul', bounty: 330 }, { name: 'Panic Harpy', bounty: 410 }, { name: 'Murmur Wraith', bounty: 380 },
];
function rnd(seed) { let t = (seed + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const cut = (b) => Math.round(b * OWNER_SHARE);

/** Everything that happened to a listing so far: finished rentals and the one in progress. */
export function rentalLog(token, since, now = Date.now(), fast = false) {
  const period = fast ? 60000 : EVERY_H * 3600000, n = Math.min(300, Math.floor((now - since) / period));
  const done = [];
  for (let i = 0; i < n; i++) {
    const r = rnd(token * 7919 + i * 104729), h = HUNTS[Math.floor(r * HUNTS.length)], win = rnd(token * 31 + i * 17) < 0.75;
    done.push({ at: since + (i + 1) * period, monster: h.name, win, earned: win ? cut(h.bounty) : 0 });
  }
  const nowHunt = HUNTS[Math.floor(rnd(token * 7919 + n * 104729) * HUNTS.length)].name;
  return { done, nowHunt, earned: done.reduce((s, e) => s + e.earned, 0), next: since + (n + 1) * period };
}

/** A rough daily estimate for listing a Chog of this power (shown before listing). */
export function dailyEstimate(power) {
  const avg = HUNTS.reduce((s, h) => s + h.bounty, 0) / HUNTS.length, scale = Math.max(0.7, Math.min(1.3, power / 80));
  return Math.round(avg * scale * OWNER_SHARE * 0.75 * (24 / EVERY_H));
}

/** The demo market's Chogs have a made-up but steady history, so their cards can show what owners earned. */
export function demoOwnerStats(token) {
  const rentals = 6 + (token * 13) % 11, avg = cut(440) * 0.75;
  return { rentals, earned: Math.round(rentals * avg) };
}

/* which simulated rentals have already been paid into the test balance, per token */
const PAID_KEY = 'chog-contracts-rent-paid';
export const loadPaid = () => { try { return JSON.parse(localStorage.getItem(PAID_KEY)) || {}; } catch { return {}; } };
export const savePaid = (p) => { try { localStorage.setItem(PAID_KEY, JSON.stringify(p)); } catch {} };
