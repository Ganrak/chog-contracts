// Turn-based hunt. Every turn you pick one of your Chog's four moves; the monster shows its next
// move in advance, so the choice is always readable. Moves come from the Chog's traits (kit.js).
// act() resolves your move, the monster's answer and end-of-turn effects, and returns the events
// in order so the arena can play them back.
import { ELEMENTS } from './kit.js';

/* ---------- monster move sets: hit = light, heavy = telegraphed big hit ---------- */
export const MOVESETS = {
  ghoul:  [{ name: 'Claw', kind: 'hit', mult: 0.18 }, { name: 'Grave Slam', kind: 'heavy', mult: 0.4 }, { name: 'Rot Breath', kind: 'poison', mult: 0.08, stacks: 2 }],
  troll:  [{ name: 'Belly Bump', kind: 'hit', mult: 0.2 }, { name: 'Gas Cloud', kind: 'poison', mult: 0.07, stacks: 3 }, { name: 'Fee Crush', kind: 'heavy', mult: 0.42 }],
  thief:  [{ name: 'Backstab', kind: 'hit', mult: 0.2 }, { name: 'Rug Pull', kind: 'drain', mult: 0.14 }, { name: 'Shadow Cut', kind: 'heavy', mult: 0.4 }],
  golem:  [{ name: 'Pound', kind: 'hit', mult: 0.2 }, { name: 'Harden', kind: 'armor' }, { name: 'Quake', kind: 'heavy', mult: 0.42 }],
  harpy:  [{ name: 'Talon', kind: 'hit', mult: 0.18 }, { name: 'Panic Shriek', kind: 'weaken', mult: 0.1 }, { name: 'Dive', kind: 'heavy', mult: 0.4 }],
  wyrm:   [{ name: 'Bite', kind: 'hit', mult: 0.2 }, { name: 'FUD Breath', kind: 'poison', mult: 0.1, stacks: 3 }, { name: 'Tail Sweep', kind: 'heavy', mult: 0.38 }, { name: 'Doom Roar', kind: 'weaken', mult: 0.08 }],
  wraith: [{ name: 'Chill Touch', kind: 'hit', mult: 0.18 }, { name: 'Wail', kind: 'weaken', mult: 0.1 }, { name: 'Soul Grab', kind: 'heavy', mult: 0.38 }],
};
// tuning: monster health and hit strength relative to its power
// tuned by simulation: first monster easy, element choice matters, boss needs levels
export const TUNE = { hp: 2.6, dmg: 1.3, boss: 1.25, bossWeak: 1.35, rageTurn: 10, rageStep: 0.2 };
const KIND_TEXT = { hit: 'attack', heavy: 'heavy attack', poison: 'poison', drain: 'steals energy', armor: 'raises armor', weaken: 'weakens you' };

/* ---------- what each move does, by the names kit.js gives them ---------- */
const W_MOVES = {
  Bribe: { text: 'The monster skips its next move.', cd: 3, run: (f, ev) => { f.foe.stun = Math.max(f.foe.stun, 1); ev.push({ t: 'status', to: 'foe', s: 'stun', text: 'Bribed' }); } },
  Grit: { text: 'Take 60% less from the next hit, then hit back.', cd: 2, run: (f, ev) => { f.me.guard = 0.6; f.me.counter = true; ev.push({ t: 'status', to: 'me', s: 'guard', text: 'Grit' }); } },
  Ward: { text: 'A shield worth 30% of your health.', cd: 2, run: (f, ev) => { f.me.shield += Math.round(f.me.maxHp * 0.3); ev.push({ t: 'shield', to: 'me', n: f.me.shield }); } },
  Fortify: { text: 'Block the next hit completely.', cd: 2, run: (f, ev) => { f.me.guard = 1; ev.push({ t: 'status', to: 'me', s: 'guard', text: 'Fortified' }); } },
  Decoy: { text: 'The next hit lands on a decoy.', cd: 2, run: (f, ev) => { f.me.evade = 1; ev.push({ t: 'status', to: 'me', s: 'evade', text: 'Decoy' }); } },
  'Dodge Roll': { text: 'Roll away: 80% chance the next hit misses.', cd: 2, run: (f, ev, rnd) => { if (rnd() < 0.8) f.me.evade = 1; ev.push({ t: 'status', to: 'me', s: 'evade', text: 'Rolling' }); } },
};
const E_MOVES = {
  'Royal Decree': { text: '+40% damage for 2 turns.', run: (f, ev) => buff(f, ev, 0.4, 2) },
  'Cap Tip': { text: '+25% damage for 2 turns.', run: (f, ev) => buff(f, ev, 0.25, 2) },
  Rally: { text: '+30% damage for 2 turns and +1 energy.', run: (f, ev) => { buff(f, ev, 0.3, 2); gainEnergy(f, ev, 1); } },
  'Chog Pride': { text: 'Heal 12% and +25% damage for 2 turns.', run: (f, ev) => { heal(f, ev, 0.12); buff(f, ev, 0.25, 2); } },
  Blink: { text: 'Teleport: the next hit misses.', run: (f, ev) => { f.me.evade = 1; ev.push({ t: 'status', to: 'me', s: 'evade', text: 'Blink' }); } },
  Jeet: { text: 'Dash away: the next hit misses, +1 energy.', run: (f, ev) => { f.me.evade = 1; gainEnergy(f, ev, 1); ev.push({ t: 'status', to: 'me', s: 'evade', text: 'Jeeted' }); } },
  Phalanx: { text: 'A shield worth 25% of your health.', run: (f, ev) => { f.me.shield += Math.round(f.me.maxHp * 0.25); ev.push({ t: 'shield', to: 'me', n: f.me.shield }); } },
  'Cold Front': { text: 'Slow the monster: its hits are 35% weaker for 2 turns.', run: (f, ev) => { f.foe.slow = 2; ev.push({ t: 'status', to: 'foe', s: 'slow', text: 'Slowed' }); } },
  'Second Wind': { text: 'Heal 28%.', run: (f, ev) => heal(f, ev, 0.28) },
  Blessing: { text: 'Heal 25% and clear poison.', run: (f, ev) => { heal(f, ev, 0.25); f.me.poison = 0; } },
  Honk: { text: 'Confuse the monster: its next move misses.', run: (f, ev) => { f.foe.stun = Math.max(f.foe.stun, 1); ev.push({ t: 'status', to: 'foe', s: 'stun', text: 'Honked' }); } },
  Distraction: { text: 'The monster loses its next move.', run: (f, ev) => { f.foe.stun = Math.max(f.foe.stun, 1); ev.push({ t: 'status', to: 'foe', s: 'stun', text: 'Distracted' }); } },
  Pickpocket: { text: 'A quick hit, and +1 trophy fragment if you win.', run: (f, ev, rnd) => { f.loot += 1; strike(f, ev, rnd, 1.2, f.element); } },
  Pump: { text: 'Hit for double damage, then -30% next turn.', run: (f, ev, rnd) => { strike(f, ev, rnd, 4.4, f.element); f.me.dmg = -0.3; f.me.dmgTurns = 1; } },
  Overclock: { text: 'Reset W and gain +2 energy.', run: (f, ev) => { f.me.cd.W = 0; gainEnergy(f, ev, 2); } },
  Gore: { text: 'Heavy hit that ignores armor.', run: (f, ev, rnd) => strike(f, ev, rnd, 3.2, f.element, { pierce: true }) },
  Headbutt: { text: 'A hit with a 40% chance to stun.', run: (f, ev, rnd) => { strike(f, ev, rnd, 2, f.element); if (rnd() < 0.4) stun(f, ev, 1); } },
  Spores: { text: 'Poison the monster (3 stacks).', run: (f, ev) => { f.foe.poison += 3; ev.push({ t: 'status', to: 'foe', s: 'poison', text: 'Poisoned ×3' }); } },
  Foresight: { text: 'Read the monster: its next hit is halved, +1 energy.', run: (f, ev) => { f.me.guard = Math.max(f.me.guard, 0.5); gainEnergy(f, ev, 1); ev.push({ t: 'status', to: 'me', s: 'guard', text: 'Foresight' }); } },
  'Bucket Toss': { text: 'A hit that slows the monster for a turn.', run: (f, ev, rnd) => { strike(f, ev, rnd, 2, f.element); slow(f, ev, 1); } },
  'Peace Out': { text: 'Heal 15%; the monster hits 40% weaker for 2 turns.', run: (f, ev) => { heal(f, ev, 0.15); f.foe.mog = Math.max(f.foe.mog, 2); ev.push({ t: 'status', to: 'foe', s: 'mog', text: 'Calmed' }); } },
  'Rain Cloud': { text: 'An Aqua hit that slows it for 2 turns.', run: (f, ev, rnd) => { strike(f, ev, rnd, 1.8, 'aqua'); slow(f, ev, 2); } },
  'Star Power': { text: '+50% damage next turn and +1 energy.', run: (f, ev) => { buff(f, ev, 0.5, 1); gainEnergy(f, ev, 1); } },
  Curveball: { text: 'A hit with a 40% chance to crit.', run: (f, ev, rnd) => strike(f, ev, rnd, 2.4, f.element, { crit: 0.4 }) },
  Hyperfocus: { text: '+60% damage for one turn.', run: (f, ev) => buff(f, ev, 0.6, 1) },
  'Hair Flip': { text: 'Dodge the next hit and slap back.', run: (f, ev, rnd) => { f.me.evade = 1; ev.push({ t: 'status', to: 'me', s: 'evade', text: 'Hair flip' }); strike(f, ev, rnd, 1, f.element); } },
  'Free Trade': { text: '+1 energy and +20% damage for 2 turns.', run: (f, ev) => { gainEnergy(f, ev, 1); buff(f, ev, 0.2, 2); } },
  'Stay Inside': { text: 'A shield worth 20% of your health, and heal 8%.', run: (f, ev) => { f.me.shield += Math.round(f.me.maxHp * 0.2); ev.push({ t: 'shield', to: 'me', n: f.me.shield }); heal(f, ev, 0.08); } },
};
const R_MOVES = {
  Laser: { text: 'A beam in your eyes\' element for 6× damage.', run: (f, ev, rnd) => strike(f, ev, rnd, 6, f.laserEl, { beam: true }) },
  Scanner: { text: 'Expose the monster: +50% damage taken for 3 turns, then hit.', run: (f, ev, rnd) => { f.foe.exposed = 3; ev.push({ t: 'status', to: 'foe', s: 'exposed', text: 'Exposed' }); strike(f, ev, rnd, 2.5, f.element); } },
  Rewind: { text: 'Heal 40% and clear every effect on you.', run: (f, ev) => { heal(f, ev, 0.4); f.me.poison = 0; f.me.weak = 0; } },
  'Deal With It': { text: 'Five fast hits, each can crit.', run: (f, ev, rnd) => { for (let i = 0; i < 5; i++) strike(f, ev, rnd, 1.3, f.element, { crit: 0.35 }); } },
  'Flood of Tears': { text: 'Heal 38%, clear poison, slow the monster.', run: (f, ev) => { heal(f, ev, 0.38); f.me.poison = 0; f.foe.slow = 2; } },
  Heartbreaker: { text: 'Stun for 2 turns and hit.', run: (f, ev, rnd) => { strike(f, ev, rnd, 2.5, 'charm'); stun(f, ev, 2); } },
  'Death Stare': { text: 'Finish a monster under 35%; otherwise a heavy hit.', run: (f, ev, rnd) => { if (f.foe.hp / f.foe.maxHp < 0.35) { ev.push({ t: 'dmg', to: 'foe', n: f.foe.hp, tag: 'EXECUTE', el: 'shadow' }); f.foe.hp = 0; } else strike(f, ev, rnd, 3.5, 'shadow'); } },
  Mog: { text: 'The monster hits 40% weaker for 3 turns, then hit.', run: (f, ev, rnd) => { f.foe.mog = 3; ev.push({ t: 'status', to: 'foe', s: 'mog', text: 'Mogged' }); strike(f, ev, rnd, 2.5, f.element); } },
  'Good Vibes': { text: 'Reset W and E, heal 20%, then hit.', run: (f, ev, rnd) => { f.me.cd.W = 0; f.me.cd.E = 0; heal(f, ev, 0.2); strike(f, ev, rnd, 2.2, f.element); } },
  Ribbit: { text: 'A frog joins and hits every turn for 3 turns.', run: (f, ev, rnd) => { f.me.frog = 3; ev.push({ t: 'status', to: 'me', s: 'frog', text: 'Frog joined' }); strike(f, ev, rnd, 2, 'wild'); } },
  'Clown Fiesta': { text: 'Confuse it for 2 turns (it may hit itself), then hit.', run: (f, ev, rnd) => { f.foe.confused = 2; ev.push({ t: 'status', to: 'foe', s: 'confused', text: 'Confused' }); strike(f, ev, rnd, 2.5, f.element); } },
  Signature: { text: 'A one-of-one ultimate: 7× damage.', run: (f, ev, rnd) => strike(f, ev, rnd, 7, f.element, { beam: true }) },
  'Puppy Eyes': { text: 'Stun it for a turn, heal 15%, then hit.', run: (f, ev, rnd) => { stun(f, ev, 1); heal(f, ev, 0.15); strike(f, ev, rnd, 2, f.element); } },
  'Focus Shot': { text: 'One clean shot for 4.5× damage, 30% crit.', run: (f, ev, rnd) => strike(f, ev, rnd, 4.5, f.element, { crit: 0.3, beam: true }) },
  'Power Nap': { text: 'Heal 30%, shake off weakness, +1 energy.', run: (f, ev) => { heal(f, ev, 0.3); f.me.weak = 0; gainEnergy(f, ev, 1); } },
  Deadpan: { text: 'Three hits that ignore armor.', run: (f, ev, rnd) => { for (let i = 0; i < 3; i++) strike(f, ev, rnd, 1.6, f.element, { pierce: true }); } },
  'Panic Mode': { text: 'A 4× hit, 40% stronger when you are below half health.', run: (f, ev, rnd) => strike(f, ev, rnd, f.me.hp / f.me.maxHp < 0.5 ? 5.6 : 4, f.element) },
  // really random now (it used to fall back to a laser): one of the attacking ultimates, picked with the fight's own dice
  Wildcard: { text: 'A random ultimate: you never know which.', run: (f, ev, rnd) => {
    const k = WILD[Math.floor(rnd() * WILD.length)];
    ev.push({ t: 'status', to: 'me', s: 'buff', text: `Wildcard: ${k}` });
    R_MOVES[k].run(f, ev, rnd);
  } },
};
const WILD = ['Laser', 'Scanner', 'Deal With It', 'Heartbreaker', 'Mog', 'Clown Fiesta', 'Ribbit', 'Focus Shot', 'Deadpan'];
export const HEAL_ULT = /^(Rewind|Flood of Tears|Power Nap)$/;
const R_KEY = (name) => (/laser$/i.test(name) ? 'Laser' : /signature/i.test(name) ? 'Signature' : name);

/* ---------- helpers that change the fight and record events ---------- */
function gainEnergy(f, ev, n) { const before = f.me.energy; f.me.energy = Math.min(3, f.me.energy + n); if (f.me.energy > before) ev.push({ t: 'energy', n: f.me.energy }); }
function heal(f, ev, share, quiet) { const n = Math.min(f.me.maxHp - f.me.hp, Math.round(f.me.maxHp * share)); if (!n && quiet) return; f.me.hp += n; ev.push({ t: 'heal', to: 'me', n }); }
// a weaker buff never replaces a stronger one that is still running (a Power potion then Cap Tip keeps +50%)
function buff(f, ev, amount, turns) { if (!(f.me.dmg > amount && f.me.dmgTurns > 0)) f.me.dmg = amount; f.me.dmgTurns = Math.max(f.me.dmgTurns, turns); ev.push({ t: 'status', to: 'me', s: 'buff', text: `+${Math.round(f.me.dmg * 100)}% damage` }); }
function slow(f, ev, turns) { f.foe.slow = Math.max(f.foe.slow, turns); ev.push({ t: 'status', to: 'foe', s: 'slow', text: 'Slowed' }); }
function stun(f, ev, turns) { f.foe.stun = Math.max(f.foe.stun, turns); ev.push({ t: 'status', to: 'foe', s: 'stun', text: turns > 1 ? `Stunned ${turns} turns` : 'Stunned' }); }
// the right element should decide a normal fight; against the boss it helps but levels and potions still matter
const elMult = (f, el) => (el === f.foe.weak ? (f.foe.boss ? TUNE.bossWeak : 1.7) : el === f.foe.immune ? 0.6 : 1);

function strike(f, ev, rnd, scale, el, { pierce = false, crit = 0, beam = false, counter = false } = {}) {
  const m = elMult(f, el);
  let n = f.me.atk * scale * m;
  n *= 1 + f.me.dmg;
  if (f.me.weak > 0) n *= 0.75;
  if (f.foe.exposed > 0) n *= 1.5;
  if (f.revenge && f.me.hp / f.me.maxHp < 0.3) n *= 1.3;
  if (f.candle) { n *= 1 + 0.03 * f.hits; f.hits += 1; }
  const isCrit = rnd() < crit + f.critBonus;
  if (isCrit) n *= 1.6;
  if (f.foe.armor > 0 && !pierce) n *= 0.7;
  n *= rage(f);
  n = Math.max(1, Math.round(n * (0.85 + rnd() * 0.3))); // ±15% so fights don't play out the same way twice
  f.foe.hp = Math.max(0, f.foe.hp - n);
  ev.push({ t: 'dmg', to: 'foe', n, el, beam, counter, tag: isCrit ? 'CRIT' : m > 1 ? 'WEAK SPOT' : m < 1 ? 'RESISTED' : null });
  return n;
}

// Adrenaline: from TUNE.rageTurn your hits grow stronger every turn, so slow healer fights end in a sensible
// time. Only the hunter gets it on normal contracts (scaling both sides would punish heals and flip the odds);
// the boss gets it too, so a healer can't just outlast it.
export const rage = (f) => (f.turn >= TUNE.rageTurn ? 1 + TUNE.rageStep * (f.turn - TUNE.rageTurn + 1) : 1);

/* ---------- setup ---------- */
/** stats: from game.js hunterStats(); m: a monster; level and ghost scale the hunter. */
export function createFight(stats, m, { level = 1, ghost = false, rand = Math.random } = {}) {
  const k = stats.kit, lv = 1 + 0.08 * (level - 1), g = ghost ? 0.88 : 1; // the apprentice must still win its first (training) fight
  const passive = k.passive.name, item = k.item?.name;
  const maxHp = Math.round(stats.hp * lv * g * (passive === 'Steady' ? 1.05 : 1));
  const set = MOVESETS[m.kind] || MOVESETS.wraith;
  const laserEyes = (k.abilities[3].name.match(/^(\w+) Laser$/) || [])[1];
  const laserEl = Object.keys(ELEMENTS).find((key) => ELEMENTS[key].name === laserEyes) || k.element;
  const f = {
    turn: 1, over: false, win: false, loot: 0, hits: 0,
    kit: k, element: k.element, laserEl,
    critBonus: (passive === 'Lip Bite' ? 0.08 : 0) + (item === 'Lucky Coin' ? 0.1 : 0),
    revenge: passive === 'Revenge', candle: item === 'Green Candle',
    me: { maxHp, hp: maxHp, atk: stats.atk * lv * g, def: (k.stats.def + (passive === 'Gritted Teeth' ? 2 : 0)) / 100,
      energy: item === 'Skateboard' ? 1 : 0, shield: 0, guard: 0, evade: 0, counter: false, dmg: 0, dmgTurns: 0,
      weak: 0, poison: 0, frog: item === 'Pet Frog' ? 99 : 0, revive: k.perks.some((p) => p.name === 'Undead') || item === 'Spare Heart',
      cd: { W: 0, E: 0 } },
    foe: { name: m.name, kind: m.kind, power: m.power, weak: m.weak, immune: m.immune, boss: !!m.boss,
      maxHp: Math.round(m.power * TUNE.hp * (m.boss ? TUNE.boss : 1)), hp: 0, set, step: Math.floor(rand() * set.length),
      stun: 0, slow: 0, mog: 0, exposed: 0, confused: 0, armor: 0, poison: 0, burn: 0,
      hitMult: TUNE.dmg * (item === 'Red Candle' ? 0.9 : 1), missChance: (passive === 'Drool' ? 0.1 : 0) + (item === 'Smoke Screen' ? 0.15 : 0) },
  };
  f.foe.hp = f.foe.maxHp;
  f.foe.intent = f.foe.set[f.foe.step];
  return f;
}

/** The four buttons: what they do, whether they can be used right now. */
export function moves(f) {
  const [Q, W, E, R] = f.kit.abilities, el = ELEMENTS[f.element];
  const qExtra = { fire: 'Burns for 2 turns.', aqua: 'Slows its next hit.', volt: 'Chains for a second hit.', wild: 'Poisons (stacks).', shadow: 'Heals you for 30% of it.', holy: 'Heals you 6%.', charm: '25% chance to stun.', plain: '' }[f.element];
  const w = W_MOVES[W.name] || W_MOVES['Dodge Roll'], e = E_MOVES[E.name] || E_MOVES['Cap Tip'], rk = R_KEY(R.name), r = R_MOVES[rk] || R_MOVES.Laser;
  const hit = (scale) => Math.round(f.me.atk * scale * rage(f));
  const qShort = { fire: ' + burn', aqua: ' + slow', volt: ' + chain', wild: ' + poison', shadow: ' + drain', holy: ' + heal', charm: ' + stun?', plain: '' }[f.element];
  return [
    { key: 'Q', name: Q.name, text: `Hit for ${hit(2.2)}. ${qExtra}`.trim(), short: `Hit ${hit(2.2)}${qShort}`, ready: true, el: el.color },
    { key: 'W', name: W.name, text: w.text, short: SHORT[W.name] || 'Dodge 80%', ready: f.me.cd.W === 0, cd: f.me.cd.W },
    { key: 'E', name: E.name, text: e.text, short: SHORT_HIT[E.name] ? `Hit ${hit(SHORT_HIT[E.name])}${SHORT[E.name] || ''}` : SHORT[E.name] || '+25% dmg', ready: f.me.cd.E === 0, cd: f.me.cd.E },
    { key: 'R', name: R.name, text: r.text, short: SHORT_HIT[rk] ? `Hit ${hit(SHORT_HIT[rk])}${SHORT[rk] || ''}` : SHORT[rk] || 'Ultimate', ready: f.me.energy >= 3, need: 3 - f.me.energy, ult: true },
  ];
}
// the big one-line label on each move button (the full text stays as its tooltip)
const SHORT = {
  Bribe: 'Skip its turn', Grit: 'Block 60% + hit back', Ward: 'Shield 30%', Fortify: 'Block next hit', Decoy: 'Dodge next hit', 'Dodge Roll': 'Dodge 80%',
  'Royal Decree': '+40% dmg', 'Cap Tip': '+25% dmg', Rally: '+30% dmg, +1 energy', 'Chog Pride': 'Heal 12%, +25% dmg', Blink: 'Dodge next hit', Jeet: 'Dodge, +1 energy',
  Phalanx: 'Shield 25%', 'Cold Front': 'Slow it 2 turns', 'Second Wind': 'Heal 28%', Blessing: 'Heal 25%, cure', Honk: 'It skips a turn', Distraction: 'It skips a turn',
  Pickpocket: ' + loot', Pump: ', then tired', Overclock: '+2 energy', Gore: ', pierce', Headbutt: ' + stun?', Spores: 'Poison ×3', Foresight: 'Halve next hit',
  Laser: '', Scanner: ' + expose', Rewind: 'Heal 40%, cure', 'Deal With It': ' ×5', 'Flood of Tears': 'Heal 38% + slow', Heartbreaker: ' + stun 2',
  'Death Stare': 'Finish under 35%', Mog: ' + weaken it', 'Good Vibes': 'Heal 20%, reset, hit', Ribbit: ' + frog ally', 'Clown Fiesta': ' + confuse', Signature: '',
  'Bucket Toss': ' + slow', 'Peace Out': 'Heal 15%, calm it', 'Rain Cloud': ' + slow 2', 'Star Power': '+50% dmg, +1 energy', Curveball: ', crit 40%',
  Hyperfocus: '+60% dmg', 'Hair Flip': ' + dodge', 'Free Trade': '+1 energy, +20% dmg', 'Stay Inside': 'Shield 20%, heal 8%',
  'Puppy Eyes': ' + stun, heal 15%', 'Focus Shot': ', crit 30%', 'Power Nap': 'Heal 30%, +1 energy', Deadpan: ' ×3, pierce', 'Panic Mode': ', more if hurt', Wildcard: 'Random ultimate',
};
const SHORT_HIT = { Pickpocket: 1.2, Pump: 4.4, Gore: 3.2, Headbutt: 2, Laser: 6, Scanner: 2.5, 'Deal With It': 1.3, Heartbreaker: 2.5, Mog: 2.5, Ribbit: 2, 'Clown Fiesta': 2.5, Signature: 7,
  'Bucket Toss': 2, 'Rain Cloud': 1.8, Curveball: 2.4, 'Hair Flip': 1, 'Puppy Eyes': 2, 'Focus Shot': 4.5, Deadpan: 1.6, 'Panic Mode': 4 };
export const intentText = (f) => {
  const i = f.foe.intent, n = i.mult ? Math.round(i.mult * f.foe.power * f.foe.hitMult * (f.foe.mog ? 0.6 : 1) * (f.foe.slow ? 0.65 : 1) * (f.foe.boss ? rage(f) : 1)) : 0;
  return { name: i.name, kind: i.kind, n, text: n ? `${i.name} · ${n}${i.kind === 'poison' ? ' + poison' : ''}` : `${i.name} · ${KIND_TEXT[i.kind]}`, stunned: f.foe.stun > 0 };
};

/** Drinking a potion mid-fight: free (it doesn't use your turn), one per fight. 0 health, 1 mana, 2 power. */
export function quaff(f, i) {
  if (f.over || f.quaffed) return [];
  f.quaffed = true; const ev = [];
  if (i === 0) heal(f, ev, 0.4);
  if (i === 1) { f.me.energy = 3; ev.push({ t: 'energy', n: 3, text: 'Ult ready' }); }
  if (i === 2) buff(f, ev, 0.5, 3);
  return ev;
}

/* ---------- one turn ---------- */
export function act(f, key, rand = Math.random) {
  if (f.over) return [];
  const ev = [], [Q, W, E, R] = f.kit.abilities;
  // your move
  if (key === 'Q') {
    ev.push({ t: 'use', key, name: Q.name, el: f.element });
    const n = strike(f, ev, rand, 2.2, f.element);
    if (f.element === 'fire') { f.foe.burn = 2; ev.push({ t: 'status', to: 'foe', s: 'burn', text: 'Burning' }); }
    if (f.element === 'aqua') f.foe.slow = Math.max(f.foe.slow, 1);
    if (f.element === 'volt' && f.foe.hp > 0) strike(f, ev, rand, 0.8, 'volt');
    if (f.element === 'wild' || f.kit.passive.name === 'Rainbow Puke' || f.kit.item?.name === 'Knife') { f.foe.poison += 1; ev.push({ t: 'status', to: 'foe', s: 'poison', text: `Poison ×${f.foe.poison}` }); }
    if (f.element === 'shadow') { const h = Math.min(f.me.maxHp - f.me.hp, Math.round(n * 0.3)); f.me.hp += h; if (h) ev.push({ t: 'heal', to: 'me', n: h }); }
    if (f.element === 'holy') heal(f, ev, 0.06, true);
    if (f.element === 'charm' && rand() < 0.25) stun(f, ev, 1);
    if (f.kit.passive.name === 'Sticky') f.foe.slow = Math.max(f.foe.slow, 1);
    gainEnergy(f, ev, 1);
  } else if (key === 'W' && f.me.cd.W === 0) {
    ev.push({ t: 'use', key, name: W.name, el: 'guard' });
    (W_MOVES[W.name] || W_MOVES['Dodge Roll']).run(f, ev, rand);
    f.me.cd.W = (W_MOVES[W.name] || W_MOVES['Dodge Roll']).cd + 1;
    gainEnergy(f, ev, 1);
  } else if (key === 'E' && f.me.cd.E === 0) {
    ev.push({ t: 'use', key, name: E.name, el: f.element });
    (E_MOVES[E.name] || E_MOVES['Cap Tip']).run(f, ev, rand);
    f.me.cd.E = 4;
    gainEnergy(f, ev, 1);
  } else if (key === 'R' && f.me.energy >= 3) {
    ev.push({ t: 'use', key, name: R.name, el: f.laserEl, ult: true });
    f.me.energy = 0; ev.push({ t: 'energy', n: 0 });
    (R_MOVES[R_KEY(R.name)] || R_MOVES.Laser).run(f, ev, rand);
  } else return [];
  if (f.me.dmgTurns > 0 && key !== 'E') { f.me.dmgTurns -= 1; if (!f.me.dmgTurns) f.me.dmg = 0; }

  if (finished(f, ev)) return ev;
  phaseCheck(f, ev, false);
  monsterTurn(f, ev, rand);
  if (finished(f, ev)) return ev;
  endOfTurn(f, ev);
  if (!finished(f, ev)) phaseCheck(f, ev, true);
  return ev;
}

// the boss, once below half health: enraged for the rest of the fight. It hits harder and gains a new heavy move,
// which it shows as its next move straight away (so it is always telegraphed, never a surprise)
// (tuned by simulation to keep the boss's win odds about where they were: it feels harder, guarding answers it)
export const PHASE2 = { hit: 1.1, move: { name: 'Cataclysm', kind: 'heavy', mult: 0.45 } };
function phaseCheck(f, ev, afterMonster) {
  const foe = f.foe;
  if (!foe.boss || foe.phase2 || foe.hp <= 0 || foe.hp > foe.maxHp / 2) return;
  foe.phase2 = true; foe.hitMult *= PHASE2.hit;
  foe.set = [...foe.set, PHASE2.move];
  if (afterMonster) { foe.step = foe.set.length - 1; foe.intent = PHASE2.move; } else foe.forceNext = true;
  ev.push({ t: 'phase', text: `${foe.name} is enraged!` });
}

function monsterTurn(f, ev, rand) {
  const foe = f.foe, i = foe.intent;
  if (foe.stun > 0) { foe.stun -= 1; ev.push({ t: 'foeSkip', text: 'Stunned' }); advance(f); return; }
  ev.push({ t: 'foeUse', name: i.name, kind: i.kind });
  // reading a heavy attack and answering it with a guard, a dodge or a shield is a perfect defence: +1 energy
  const perfect = i.kind === 'heavy' && (f.me.guard > 0 || f.me.evade > 0 || f.me.shield > 0);
  if (foe.confused > 0 && rand() < 0.5) {
    const n = Math.round(foe.power * 0.25); foe.hp = Math.max(0, foe.hp - n);
    ev.push({ t: 'dmg', to: 'foe', n, tag: 'HIT ITSELF', el: 'charm' }); advance(f); return;
  }
  if (i.kind === 'armor') { foe.armor = 2; ev.push({ t: 'status', to: 'foe', s: 'armor', text: 'Armor up' }); advance(f); return; }
  let n = Math.round((i.mult || 0) * foe.power * foe.hitMult * (foe.mog ? 0.6 : 1) * (foe.slow ? 0.65 : 1) * (foe.boss ? rage(f) : 1) * (1 - f.me.def) * (0.85 + rand() * 0.3));
  const missed = f.me.evade > 0 || rand() < foe.missChance;
  if (missed) { f.me.evade = 0; ev.push({ t: 'miss', to: 'me' }); if (perfect) { ev.push({ t: 'perfect' }); gainEnergy(f, ev, 1); } advance(f); return; }
  if (f.me.guard > 0) { const blocked = Math.round(n * f.me.guard); n -= blocked; ev.push({ t: 'block', to: 'me', n: blocked }); f.me.guard = 0; }
  if (f.me.shield > 0 && n > 0) { const s = Math.min(f.me.shield, n); f.me.shield -= s; n -= s; ev.push({ t: 'shield', to: 'me', n: f.me.shield, absorbed: s }); }
  if (perfect) { ev.push({ t: 'perfect' }); gainEnergy(f, ev, 1); }
  if (n > 0) { f.me.hp = Math.max(0, f.me.hp - n); ev.push({ t: 'dmg', to: 'me', n, heavy: i.kind === 'heavy' && !perfect }); }
  if (i.kind === 'poison') { f.me.poison += i.stacks; ev.push({ t: 'status', to: 'me', s: 'poison', text: `Poison ×${f.me.poison}` }); }
  if (i.kind === 'drain' && f.me.energy > 0) { f.me.energy -= 1; ev.push({ t: 'energy', n: f.me.energy, text: 'Energy stolen' }); }
  if (i.kind === 'weaken') { f.me.weak = 2; ev.push({ t: 'status', to: 'me', s: 'weak', text: 'Weakened' }); }
  if (f.me.counter) { f.me.counter = false; strike(f, ev, rand, 1.1, f.element, { counter: true }); }
  if (n > 0 && !perfect) gainEnergy(f, ev, 1); // taking a hit charges the ultimate too
  advance(f);
}
function advance(f) {
  const foe = f.foe;
  foe.step = foe.forceNext ? foe.set.length - 1 : (foe.step + 1) % foe.set.length; foe.forceNext = false;
  foe.intent = foe.set[foe.step];
}

function endOfTurn(f, ev) {
  const foe = f.foe, me = f.me;
  if (foe.burn > 0) { const n = Math.round(me.atk * 0.7); foe.hp = Math.max(0, foe.hp - n); foe.burn -= 1; ev.push({ t: 'dmg', to: 'foe', n, tag: 'BURN', el: 'fire', tick: true }); }
  if (foe.poison > 0) { const n = Math.round(me.atk * 0.3 * foe.poison); foe.hp = Math.max(0, foe.hp - n); ev.push({ t: 'dmg', to: 'foe', n, tag: 'POISON', el: 'wild', tick: true }); foe.poison = Math.max(0, foe.poison - 1); }
  if (me.frog > 0 && foe.hp > 0) { const n = Math.round(me.atk * 0.6); foe.hp = Math.max(0, foe.hp - n); me.frog -= 1; ev.push({ t: 'dmg', to: 'foe', n, tag: 'FROG', el: 'wild', tick: true }); }
  if (me.poison > 0) { const n = Math.round(foe.power * 0.035 * me.poison); me.hp = Math.max(0, me.hp - n); ev.push({ t: 'dmg', to: 'me', n, tag: 'POISON', tick: true }); me.poison = Math.max(0, me.poison - 1); }
  if (f.kit.passive.name === 'Bright Side' && me.hp > 0) { const n = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * 0.03)); if (n) { me.hp += n; ev.push({ t: 'heal', to: 'me', n, tick: true }); } }
  for (const k of ['slow', 'mog', 'exposed', 'confused', 'armor']) if (foe[k] > 0) foe[k] -= 1;
  if (me.weak > 0) me.weak -= 1;
  if (me.cd.W > 0) me.cd.W -= 1;
  if (me.cd.E > 0) me.cd.E -= 1;
  f.turn += 1;
  if (f.turn === TUNE.rageTurn) ev.push({ t: 'rage', text: 'Adrenaline! Your hits grow stronger every turn.' });
}

function finished(f, ev) {
  if (f.foe.hp <= 0) { f.over = true; f.win = true; ev.push({ t: 'end', win: true }); return true; }
  if (f.me.hp <= 0) {
    if (f.me.revive) { f.me.revive = false; f.me.hp = Math.round(f.me.maxHp * 0.25); ev.push({ t: 'revive', n: f.me.hp }); return false; }
    f.over = true; f.win = false; ev.push({ t: 'end', win: false }); return true;
  }
  return false;
}

/** A repeatable random stream (mulberry32): the same seed gives the same fight, so a server can replay a boss
 *  hunt from its seed and the keys that were pressed, and trust the damage it gets, not the one it was told. */
export function seededRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- a sensible autopilot: used by the Auto button and to estimate the odds ---------- */
export function autoMove(f) {
  const ms = moves(f), ready = (k) => ms.find((m) => m.key === k).ready;
  const intent = f.foe.intent, hpShare = f.me.hp / f.me.maxHp;
  const eName = f.kit.abilities[2].name, eHeals = /Wind|Blessing|Pride/.test(eName);
  // a healing ultimate is wasted at full health: save it until you're hurt
  if (ready('R') && (!HEAL_ULT.test(f.kit.abilities[3].name) || hpShare < 0.55)) return 'R';
  if (intent.kind === 'heavy' && f.foe.stun === 0 && ready('W')) return 'W';
  if (hpShare < 0.45 && eHeals && ready('E')) return 'E';
  if (ready('E') && !eHeals) return 'E';
  return 'Q';
}
export function simulate(stats, m, opts, runs = 160) {
  let wins = 0, seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < runs; i++) {
    const f = createFight(stats, m, { ...opts, rand });
    while (!f.over && f.turn < 40) act(f, autoMove(f), rand);
    if (f.win) wins++;
  }
  return wins / runs;
}
