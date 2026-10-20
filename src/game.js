// Demo rules, kept simple on purpose: power decides the odds, the odds are shown before a hunt,
// levels make a Chog stronger for good, and potions are one-use boosts drunk mid-fight.
import { buildKit } from './kit.js';

/* the weekly boss changes its weak spot every Monday, round all seven elements, so every kind of Chog gets its week */
const BOSS_ROTATION = ['volt', 'shadow', 'aqua', 'fire', 'wild', 'holy', 'charm'];
export function bossWeek(now = new Date()) {
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = Math.floor((monday.getTime() + 4 * 86400000) / (7 * 86400000)); // weeks since the epoch, counted from Mondays
  const i = ((week % 7) + 7) % 7;
  return { weak: BOSS_ROTATION[i], immune: BOSS_ROTATION[(i + 3) % 7], nextWeak: BOSS_ROTATION[(i + 1) % 7] };
}

export const MONSTERS = [
  { id: 'ghoul', kind: 'ghoul', name: 'Deadchain Ghoul', quote: 'this chain is dead, nobody uses it anymore', weak: 'fire', immune: 'shadow', power: 70, reward: 0 },
  { id: 'troll', kind: 'troll', name: 'Gas-Bloat Troll', quote: 'fees are going to kill this whole ecosystem', weak: 'aqua', immune: 'fire', power: 88, reward: 2 },
  { id: 'thief', kind: 'thief', name: 'Rugshade Thief', quote: 'every project here is a rug waiting to happen', weak: 'charm', immune: 'wild', power: 104, reward: 1 },
  { id: 'wyrm', kind: 'wyrm', name: 'The Great FUD Wyrm', quote: 'monad is a ghost chain and $CHOG goes to zero', ...bossWeek(), power: 115, reward: 1, boss: true, unlock: 3 },
];

/* ---------- FUD Forge: a FUD post becomes a monster ----------
   The kind of FUD picks the monster (and so its weak spot), how loud the post is sets its strength,
   and the post's own words name it. Same post, same monster, so people can compare. */
// word lists use the way FUD is really written about NFTs and chains (no AI: simple, free and instant)
const KINDS = [
  { kind: 'ghoul', re: /\b(dead|died|dying|rip|ghost(ed|town)?|ghost ?chain|nobody|empty|abandon\w*|no ?one|users?|tvl|inactive|quiet|graveyard|forgotten|irrelevant|no (volume|activity|holders|community)|zero volume|devs? (left|gone|vanished|quit)|team (left|gone|quit|vanished)|nobody cares)\b/gi, epithet: 'Rot', noun: 'Ghoul', weak: 'fire', immune: 'shadow', why: 'Dead-chain FUD. Burn it with Fire.' },
  { kind: 'troll', re: /\b(gas|fees?|expensive|costs?|pay\w*|tax\w*|overpriced|overvalued|mint price|royalt\w*|rip-?off|waste of money|not worth( it)?|too pricey)\b/gi, epithet: 'Gorged', noun: 'Troll', weak: 'aqua', immune: 'fire', why: 'Fee FUD. Wash it out with Aqua.' },
  { kind: 'thief', re: /\b(rug\w*|scam\w*|exit|fraud\w*|ponzi|stole|steal\w*|hack\w*|drain\w*|honeypot|wash ?trad\w*|insiders?|cash ?grab|grift\w*|fake|botted|bots?|sybil|jeets?|cabal|unlocks?)\b/gi, epithet: 'Shade', noun: 'Thief', weak: 'charm', immune: 'wild', why: 'Rug FUD. Charm wins the crowd back.' },
  { kind: 'golem', re: /\b(slow\w*|down|bugs?|buggy|outage|lag\w*|broken|halt\w*|stuck|crash(es|ed)?|fail(ed|ing|s)?|not working|errors?|unusable|congest\w*|centrali[sz]ed|testnet forever)\b/gi, epithet: 'Stone', noun: 'Golem', weak: 'volt', immune: 'aqua', why: 'Outage FUD. Jolt it awake with Volt.' },
  { kind: 'harpy', re: /\b(dump\w*|price|sell\w*|sold|panic\w*|zero|rekt|bear\w*|bags?|bag ?holders?|red|bleed\w*|floor|worthless|down bad|exit liquidity|no bids?|illiquid)\b|-\d{2}%/gi, epithet: 'Shriek', noun: 'Harpy', weak: 'wild', immune: 'volt', why: 'Price FUD. Wild holds through the storm.' },
];
// vague hate (art, hype, "no utility"): the Wraith. Also what a post becomes when no other kind matches.
const WRAITH = { kind: 'wraith', re: /\b(mid|ugly|cringe|overhyped|hype|meh|lame|boring|trash|garbage|no utility|useless|pointless|jpe?gs?|copy ?cat|derivative|ai slop|fading|dead cat)\b/gi, epithet: 'Murmur', noun: 'Wraith', weak: 'holy', immune: 'charm', why: 'Vague FUD. Holy light clears the murmur.' };
// what makes a post louder (and the monster stronger)
const LOUD = /\b(never|always|everyone|nobody|all|literally|totally|100%|guaranteed|cope|ngmi|lmao|lol|imagine|clearly|obviously)\b/gi;
// who it's aimed at: Chog is what we defend, so FUD aimed at Chog makes the strongest monsters; Monad counts too
const CHOG = /(\$chog\b|@chognft\b|\bchog ?genesis\b|\bchog ?#\d+|\bchog(s|nft)?\b)/gi;
const MONAD = /(@monad\w*|\bmonad\b|\bmon\b|\bnads?\b)/gi;
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** Cleans a pasted post so a monster never carries anyone's handle or links (the project's own handles stay). */
export const cleanPost = (text) => text.replace(/https?:\/\/\S+/g, '[link]').replace(/@\w{1,15}/g, (h) => (/^@(chognft|monad\w*)$/i.test(h) ? h : '@anon')).replace(/\s+/g, ' ').trim().slice(0, 140);

/** Reads a post without making a monster: used for the live preview while typing. */
export function readFud(raw) {
  const text = cleanPost(raw);
  const hits = [...KINDS, WRAITH].map((k) => ({ k, words: text.match(k.re) || [] }));
  // the kind with the most FUD words wins; a tie goes to the specific kinds before the vague Wraith
  const best = hits.reduce((a, b) => (b.words.length > a.words.length ? b : a), { k: WRAITH, words: [] });
  const loud = text.match(LOUD) || [], chog = text.match(CHOG) || [], monad = text.match(MONAD) || [];
  const letters = text.replace(/[^a-z]/gi, '');
  const shouting = letters.length > 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6;
  const bangs = (text.match(/!/g) || []).length;
  const points = hits.reduce((n, x) => n + x.words.length, 0) + loud.length + (chog.length ? 2 : monad.length ? 1 : 0) + (shouting ? 1 : 0) + (bangs >= 2 ? 1 : 0);
  const level = Math.max(1, Math.min(5, points));
  const words = [...new Set([...hits.flatMap((x) => x.words), ...loud, ...chog, ...monad].map((w) => w.toLowerCase()))];
  return { text, k: best.k, key: best.words[0] || '', level, words, shouting, atChog: chog.length > 0 };
}

export function monsterFromPost(raw) {
  const r = readFud(raw), k = r.k;
  let h = 7; for (const ch of r.text.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // name it after its own words: "gas fees are a joke" → Gas-Gorged Troll
  const longest = r.text.split(/[^a-z]+/i).filter((w) => w.length > 3).sort((a, b) => b.length - a.length)[0];
  // a phrase ("testnet forever", "no utility") is named after its longest word
  const keyWord = (r.key || '').split(/[^a-z]+/i).sort((a, b) => b.length - a.length)[0] || '';
  const word = (keyWord || (longest || 'Nameless').replace(/[^a-z]/gi, '')).slice(0, 9);
  return {
    id: `post-${h}`, kind: k.kind, name: `${cap(word)}-${k.epithet} ${k.noun}`, quote: r.text,
    weak: k.weak, immune: k.immune, power: 56 + r.level * 10 + (h % 5), reward: h % 3, custom: true,
    forge: { level: r.level, words: r.words, why: r.atChog ? `${k.why} Aimed at Chog, so it hits harder.` : k.why },
  };
}

/* ---------- daily contracts: two new FUD monsters every day, the same for everyone ----------
   Picked from this pool by the date, so every player sees the same pair (in the game they would come from
   real posts on X). One is easy, one is hard and of a different kind. Clearing one a day keeps a streak. */
const FUD_POOL = [
  'gas fees ate half my mint, never again', 'paying fees to lose money, great ecosystem',
  'this is too expensive for normal people', 'every tx costs more than the nft', 'devs will rug the second it pumps',
  'another ponzi with cute pfps', 'this whole thing is an exit scam waiting to happen', 'they drained the treasury, watch',
  'scam team, scam art, scam chain', 'the chain is down AGAIN', 'transactions stuck for an hour, broken tech',
  'so slow i fell asleep waiting for a mint', 'bugs everywhere, halt the chain already', '$CHOG to zero, sell while you can',
  'floor is bleeding, everyone is dumping', 'PANIC SELL NOW, IT IS OVER!!', 'bags heavy, price only goes down',
  'rekt again, red candles all week', 'idk something feels off about this', 'vibes are weird lately ngl',
  'this smells like trouble, mark my words', 'people are saying things, just saying',
  // loud ones, so every kind can be the hard contract
  'GAS FEES ARE A TOTAL JOKE, who can pay this!!', 'fees fees fees, literally paying to exist here',
  '100% a rug, devs will exit scam and drain everything', 'guaranteed scam, they will steal the mint money',
  'chain is DOWN again, broken, stuck, literally unusable', 'always lagging, always halted, never fixed',
  'everyone knows, it is literally over, cope', 'never trust this, everyone is lying, ngmi',
];
export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // local YYYY-MM-DD
export function dailyContracts(key = dayKey()) {
  let seed = 7; for (const ch of key) seed = Math.imul(seed ^ ch.charCodeAt(0), 2654435761) >>> 0;
  const rand = () => { // mulberry32: neighbouring dates give unrelated picks
    seed = (seed + 0x6D2B79F5) >>> 0; let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // the training contract is already a Ghoul, so the daily pair skips that kind
  const order = FUD_POOL.map((t) => [rand(), t]).sort((a, b) => a[0] - b[0]).map(([, t]) => monsterFromPost(t)).filter((m) => m.kind !== 'ghoul');
  const easy = order.find((m) => m.forge.level <= 2) || order[0];
  const hard = order.find((m) => m.forge.level >= 3 && m.kind !== easy.kind) || order.find((m) => m.kind !== easy.kind);
  return [easy, hard].map((m, i) => ({ ...m, id: `daily-${key}-${i}`, custom: false, daily: true }));
}

const DAILY_KEY = 'chog-contracts-daily';
export function loadDaily() { try { return JSON.parse(localStorage.getItem(DAILY_KEY)) || {}; } catch { return {}; } }
export function saveDaily(d) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch {} }
/** Today's state: which dailies are done, and the streak (a day missed resets it). */
export function dailyState(d = loadDaily(), today = dayKey()) {
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const streak = d.last === today || d.last === yesterday ? d.streak || 0 : 0;
  return { done: d.day === today ? d.done || [] : [], streak, today, clearedToday: d.last === today };
}
/** Marks a daily as won. Returns the streak after it and the XP bonus share it earns (10% per day, up to 50%). */
export function winDaily(id, today = dayKey()) {
  const d = loadDaily(), s = dailyState(d, today);
  const done = s.done.includes(id) ? s.done : [...s.done, id];
  const streak = s.clearedToday ? s.streak : s.streak + 1;
  saveDaily({ day: today, done, last: today, streak });
  return { streak, bonus: Math.min(0.5, 0.1 * streak), first: !s.clearedToday };
}

/* ---------- hunter progress (saved in this browser only) ---------- */
const KEY = 'chog-contracts-demo-v1';
export function loadProgress() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function saveProgress(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} }
export const fresh = () => ({ level: 1, xp: 0, boost: { hp: 0, atk: 0, mana: 0 }, trophies: {} });
export const xpToNext = (level) => 100 * level;

export function hunterStats(h, p) {
  const k = buildKit(h.traits, { name: h.name });
  // levels are the only lasting growth (+8% health and damage each); potions are used up in fights
  const hp = k.stats.hp, atk = k.stats.atk;
  let power = hp * 0.3 + atk * 3 + k.stats.def * 2 + (k.perks.some((x) => x.name === 'Undead') ? 6 : 0);
  // the shown number (fights are simulated from the real stats): every Chog NFT sits between 60 and 100 at level 1,
  // spread out from the raw 68-100 so rarer Chogs stand out; the Wannabe is a 50. Each level adds 8%.
  power = h.ghost ? 50 : Math.min(100, Math.max(60, 60 + (power - 68) * 1.25));
  power *= 1 + 0.08 * (p.level - 1);
  return { kit: k, hp, atk, power: Math.round(power) };
}

export function matchup(stats, m) {
  const el = stats.kit.element;
  const mult = el === m.weak ? 1.3 : el === m.immune ? 0.8 : 1;
  const eff = stats.power * mult;
  const chance = Math.min(0.97, Math.max(0.05, 1 / (1 + Math.exp(-(eff - m.power) / (0.2 * m.power)))));
  return { mult, eff: Math.round(eff), chance };
}

/** Applies a finished hunt to a hunter's progress. Returns what changed, for the result screen. */
export function settle(p, m, win, mult) {
  const before = p.level;
  const xp = win ? 60 + (mult > 1 ? 20 : 0) + (m.boss ? 60 : 0) : 25;
  p.xp += xp;
  while (p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level += 1; }
  if (win) p.trophies[m.kind] = (p.trophies[m.kind] || 0) + 1;
  return { xp, levelUp: p.level > before, level: p.level };
}
/* ---------- $CHOG bounties: a reward only, never needed to play ----------
   Each contract pays a bounty on a win; with a hired Chog the owner gets OWNER_SHARE of it.
   Demo amounts are test numbers kept in this browser; in the game they'd come from a bounty pool. */
export const OWNER_SHARE = 0.3;
// test $CHOG: training 500, a contract 3,000-6,500 by power (rounded to 500), the weekly boss 25,000. Real $CHOG only comes from the weekly pool.
export const bounty = (m) => (m.training ? 500 : m.boss ? 25000 : Math.round(m.power * 50 / 500) * 500);
export const fmtChog = (n) => Math.round(n).toLocaleString('en-US');
const WALLET_KEY = 'chog-contracts-chog';
export function chogBalance() { try { return Number(localStorage.getItem(WALLET_KEY)) || 0; } catch { return 0; } }
/** Demo only: tops up test $CHOG so anyone can try the shop and the healer. */
export function grantChog(n) { try { localStorage.setItem(WALLET_KEY, String(chogBalance() + n)); } catch {} }
/** Spends test $CHOG (the healer, room items). Returns false when there isn't enough. */
export function spendChog(n) {
  const b = chogBalance(); if (b < n) return false;
  try { localStorage.setItem(WALLET_KEY, String(b - n)); return true; } catch { return false; }
}
/** Pays a won bounty. Returns { mine, owner } (owner is 0 unless the hunter was hired). */
export function payBounty(m, hired) {
  const total = bounty(m), owner = hired ? Math.round(total * OWNER_SHARE) : 0, mine = total - owner;
  try { localStorage.setItem(WALLET_KEY, String(chogBalance() + mine)); } catch {}
  return { mine, owner };
}

/* ---------- losing hurts: the hunter is injured (no hunting) for 3 h, or 1.5 h for a Chog you own; a healer
   patches it up now for test $CHOG. Never touches the NFT or the wallet; only this game's progress. ---------- */
export const INJURY_H = { owner: 1.5, other: 3 }, HEAL_COST = 1000;
export const injuredLeft = (p) => Math.max(0, (p.hurtUntil || 0) - Date.now());
export function injure(p, hours) { p.hurtUntil = Date.now() + hours * 3600000; }
export function healNow(p) {
  const b = chogBalance(); if (b < HEAL_COST) return false;
  try { localStorage.setItem(WALLET_KEY, String(b - HEAL_COST)); } catch { return false; }
  p.hurtUntil = 0; return true;
}

// in Wannabe's room a visit to an injured hunter in bed takes 15 min off, once every 10 min per hunter
export const TUCK_MIN = 15, TUCK_EVERY_MIN = 10;
export const tuckWait = (p) => Math.max(0, (p.tuckAt || 0) + TUCK_EVERY_MIN * 60000 - Date.now());
export function tuckIn(p) {
  if (!injuredLeft(p) || tuckWait(p)) return false;
  p.tuckAt = Date.now(); p.hurtUntil -= TUCK_MIN * 60000; return true;
}

/* ---------- the Chog's journal: every hunt is written to the Chog, not to the player ----------
   In the demo it lives in this browser; in the game it is keyed by token id, so it travels with the NFT. */
const LOG_MAX = 40;
export function remember(p, m, res, { hired = false, chog = 0 } = {}) {
  p.since ||= Date.now();
  p.log ||= [];
  p.earned = (p.earned || 0) + chog;
  // a loss stays in the log as a scar; beating that kind of monster later marks the oldest open scar avenged
  if (res.win) { const scar = [...p.log].reverse().find((e) => !e.win && !e.trip && e.kind === m.kind && !e.avenged); if (scar) scar.avenged = Date.now(); }
  p.log.unshift({ at: Date.now(), kind: m.kind, name: m.name, quote: m.quote, win: !!res.win, turns: res.turns, potion: res.win ? m.reward : null, forged: !!m.custom, boss: !!m.boss, hired, chog });
  p.log.length = Math.min(p.log.length, LOG_MAX);
}

/** A potion drunk in a fight goes into that Chog's journal (no lasting boost). */
export function drink(p, potion) {
  p.drunk ||= [0, 0, 0];
  p.drunk[potion] += 1;
}

/* ---------- the potion bag: yours, not the Chog's. Potions drop from contracts and are used up in fights ---------- */
const BAG_KEY = 'chog-contracts-bag';
export function loadBag() { try { const b = JSON.parse(localStorage.getItem(BAG_KEY)); return Array.isArray(b) ? [0, 1, 2].map((i) => b[i] | 0) : [1, 1, 1]; } catch { return [1, 1, 1]; } } // new players start with one of each
const saveBag = (b) => { try { localStorage.setItem(BAG_KEY, JSON.stringify(b)); } catch {} };
export function addPotion(i) { const b = loadBag(); b[i] += 1; saveBag(b); }
export function usePotion(i) { const b = loadBag(); if (b[i] < 1) return false; b[i] -= 1; saveBag(b); return true; }

/** A Chog changed hands: its level, XP and potions start over; its story (trophies, journal) stays, marked as the old owner's. */
export function newOwner(p) {
  p.level = 1; p.xp = 0; p.boost = { hp: 0, atk: 0, mana: 0 }; p.drunk = [0, 0, 0];
  for (const e of p.log || []) e.prev = true;
}
