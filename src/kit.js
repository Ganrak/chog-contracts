// Turns a Chog's traits into its hunting kit. Same traits in, same kit out: the NFT is the build.
//   element  <- Aura first, then laser/visor eyes, then outfit, headwear, base
//   class    <- Body (outfit) — sets the role and W
//   Q        <- class basic attack, flavoured by element
//   E        <- Head (headwear) — utility
//   R        <- Eyes — ultimate (a 1:1 base gets a signature ultimate instead)
//   passive  <- Mouth, item <- Accessory, power <- Tier (kept small so rarity never decides a hunt)
import { TRAITS, SUPPLY } from './traits.js';

export const ELEMENTS = {
  fire:   { name: 'Fire',   color: '#FF8A1F', effect: 'burns for 3 s' },
  aqua:   { name: 'Aqua',   color: '#5BC8FF', effect: 'slows the monster' },
  volt:   { name: 'Volt',   color: '#F2E14A', effect: 'chains to a second target' },
  wild:   { name: 'Wild',   color: '#6CC48A', effect: 'poisons, stacking' },
  shadow: { name: 'Shadow', color: '#9C8FC4', effect: 'steals a little health' },
  holy:   { name: 'Holy',   color: '#FFE3A1', effect: 'heals the lowest ally on hit' },
  charm:  { name: 'Charm',  color: '#FF6FA8', effect: 'may stun for 1 s' },
  plain:  { name: 'Plain',  color: '#B8B0C4', effect: 'no extra effect' },
};

// [pattern, value]: first match wins. Patterns are tested against the lower-cased trait value.
const AURA_EL = [
  [/burning|fiery|^fire$/, 'fire'], [/aqua|cool|royal blue/, 'aqua'], [/yellow|electric/, 'volt'],
  [/mint|green|wind/, 'wild'], [/smoke|purple|violet/, 'shadow'], [/clean|royal aura|white/, 'holy'],
  [/rose|pink/, 'charm'],
];
const EYES_EL = [[/fire laser/, 'fire'], [/cyan laser/, 'aqua'], [/green laser/, 'wild'], [/purple laser/, 'shadow'], [/plasma/, 'volt'], [/heart/, 'charm']];
const BODY_EL = [[/fire shirt|dragon/, 'fire'], [/shark|duck float/, 'aqua'], [/electro|glitch/, 'volt'], [/toad green|farmer/, 'wild'], [/mummy/, 'shadow'], [/jesus|kings robe/, 'holy'], [/milf|pink tux/, 'charm']];
const HEAD_EL = [[/thunder|10k tps/, 'volt'], [/shroom/, 'wild'], [/horn/, 'shadow'], [/holy|wreath|thorn|crown/, 'holy']];
const BASE_EL = [[/skull/, 'shadow'], [/radioactive/, 'wild']];
// last resort: every Chog has a background, so nobody ends up Plain
const BG_EL = [
  [/lemon|sunlight|yellow|^mon$/, 'volt'], [/aqua|sky|deep blue|royal|noble/, 'aqua'], [/mint|green|radioactive/, 'wild'],
  [/deep purple|supreme/, 'shadow'], [/rose|rosie|coral|peach|magenta/, 'charm'], [/orange|red sky|blood/, 'fire'],
  [/gold|lavender|light purple/, 'holy'],
];

export const CLASSES = {
  dealer:    { name: 'Dealer',    role: 'Control', hp: 100, atk: 11, def: 6, q: 'Cufflink Toss', w: ['Bribe', 'The monster skips its next attack.'] },
  brawler:   { name: 'Brawler',   role: 'Damage',  hp: 105, atk: 12, def: 5, q: 'Haymaker',      w: ['Grit', 'Takes 40% less damage for 4 s.'] },
  mystic:    { name: 'Mystic',    role: 'Support', hp: 95,  atk: 10.5, def: 4, q: 'Hex Bolt',      w: ['Ward', 'Shields the whole team for 3 s.'] },
  tank:      { name: 'Tank',      role: 'Defense', hp: 140, atk: 10, def: 9, q: 'Shield Bash',   w: ['Fortify', 'Pulls the monster\'s attacks onto itself for 5 s.'] },
  trickster: { name: 'Trickster', role: 'Chaos',   hp: 90,  atk: 11, def: 4, q: 'Pratfall',      w: ['Decoy', 'Drops a fake Chog the monster attacks instead.'] },
  street:    { name: 'Street',    role: 'Balanced', hp: 100, atk: 11, def: 5, q: 'Swipe',        w: ['Dodge Roll', 'Rolls out of a red zone instantly.'] },
};
const BODY_CLASS = [
  [/tuxedo|gangster|ceo|mafia|vest/, 'dealer'],
  [/inmate|prisoner|squid|stripe|army|tank|sleeveless|chug life|six seven|jersey|trackset/, 'brawler'],
  [/wizard|robe|jesus|yukata|chinese|gojo|guko/, 'mystic'],
  [/armor|astro|sci fi|shark|dragon|mummy/, 'tank'],
  [/banana|duck|toad|boner|milf|virgin|thots|bbc|cwo|hawaiian/, 'trickster'],
];

const HEAD_E = [
  [/crown/, 'Royal Decree', 'Team deals 20% more damage for 5 s.'],
  [/wizard/, 'Blink', 'Teleports out of any attack.'],
  [/spartan/, 'Phalanx', 'Blocks the next hit for the whole team.'],
  [/russian/, 'Cold Front', 'Slows the monster for 4 s.'],
  [/durag|headband|bandana|wrap/, 'Second Wind', 'Heals itself for 30%.'],
  [/clown|rainbow/, 'Honk', 'Confuses the monster: its next attack misses.'],
  [/robber|plumber/, 'Pickpocket', '+1 trophy fragment if the hunt is won.'],
  [/btc|eth|buttcoin|dollar|diamond/, 'Pump', 'Doubles its own damage for 3 s, then halves it for 3 s.'],
  [/jeet/, 'Jeet', 'Dashes away and becomes untargetable for 2 s.'],
  [/10k tps|thunder/, 'Overclock', 'Cuts all its cooldowns by 2 s.'],
  [/horn/, 'Gore', 'Heavy hit that ignores armor.'],
  [/holy|wreath|thorn/, 'Blessing', 'Heals the team for 20%.'],
  [/3rd eye/, 'Foresight', 'Shows the next red zone 1 s earlier.'],
  [/shroom/, 'Spores', 'Poisons everything in a wide circle.'],
  [/mon cap|mon beanie|choggie|chog cap|mega chog/, 'Chog Pride', 'Team heals 10% and deals 10% more for 4 s.'],
  [/boob/, 'Distraction', 'The monster loses its next turn.'],
  [/wagmi|mcga|mmga|mega/, 'Rally', 'Team moves and attacks 15% faster for 5 s.'],
  // the most common caps each get their own move, so a cap is not just a cap
  [/bucket/, 'Bucket Toss', 'Throws its bucket hat: a hit that slows the monster.'],
  [/peace/, 'Peace Out', 'Heals a little and calms the monster down.'],
  [/cloud/, 'Rain Cloud', 'A cold rain: an Aqua hit that slows.'],
  [/star cap/, 'Star Power', 'A big damage boost and +1 energy.'],
  [/balls cap/, 'Curveball', 'A tricky throw that often crits.'],
  [/tism|retard cap/, 'Hyperfocus', 'Locks in: +60% damage for one turn.'],
  [/bob hair/, 'Hair Flip', 'Flips its hair: dodges the next hit and slaps back.'],
  [/rh beanie/, 'Free Trade', '+1 energy and a damage boost.'],
  [/neet/, 'Stay Inside', 'Hides indoors: a shield and a little rest.'],
  [/bucket|beanie|cap|hat|hair|neet|nose|banana|8 ball|laser/, 'Cap Tip', 'Small team buff: +10% damage for 4 s.'],
];
const EYES_R = [
  [/laser/, 'Laser Beam', 'A long beam in its element, 3x damage.'],
  [/visor/, 'Scanner', 'Exposes the monster: everyone deals 50% more for 6 s.'],
  [/vr/, 'Rewind', 'Team health snaps back to where it was 3 s ago.'],
  [/glass|viper|thug/, 'Deal With It', 'Five fast critical hits.'],
  [/crying|tear|teary/, 'Flood of Tears', 'Heals the whole team for 40%.'],
  [/heart/, 'Heartbreaker', 'Stuns the monster for 3 s.'],
  [/dead/, 'Death Stare', 'Finishes a monster below 20% health.'],
  [/angry|mog|smirk|side eye|vertical/, 'Mog', 'Monster attacks 40% slower for 6 s.'],
  [/happy|xd|smile/, 'Good Vibes', 'Resets the team\'s Q and E.'],
  [/frog/, 'Ribbit', 'Summons a frog that fights for 8 s.'],
  [/clown/, 'Clown Fiesta', 'For 5 s the monster attacks a random target, sometimes itself.'],
  // plain eyes get their own ultimates too
  [/round/, 'Puppy Eyes', 'So sad the monster stops for a turn. Heals a little, then hits.'],
  [/normal/, 'Focus Shot', 'One clean shot: big damage, often crits.'],
  [/tired/, 'Power Nap', 'Sleeps it off: heals 30% and wakes up with energy.'],
  [/flat/, 'Deadpan', 'Three flat hits that ignore armor.'],
  [/worried/, 'Panic Mode', 'Swings wildly: a big hit, bigger when hurt.'],
  [/.*/, 'Wildcard', 'A random ultimate from the list above.'],
];
const MOUTH_P = [
  [/gold tooth/, 'Gold Tooth', '+10% loot.'], [/btc coin|mon coin/, 'Coin Purse', '+10% $CHOG from bounties.'],
  [/rainbow/, 'Rainbow Puke', 'Basic attacks poison.'], [/bubblegum/, 'Sticky', 'Basic attacks slow a little.'],
  [/grit/, 'Gritted Teeth', '+2 armor.'], [/lip bite/, 'Lip Bite', '+8% critical chance.'],
  [/smile/, 'Bright Side', 'Heals 1% health per second.'], [/sad|worried/, 'Revenge', '+30% damage when an ally falls.'],
  [/clown/, 'Heckle', 'The monster targets it more often.'], [/drool/, 'Drool', 'Monster has a 10% chance to slip.'],
  [/.*/, 'Steady', '+5% health.'],
];
const ACC_ITEM = [
  [/knife/, 'Knife', 'Hits bleed.'], [/^coin$/, 'Lucky Coin', '+10% critical chance.'], [/cigar/, 'Smoke Screen', '+15% dodge.'],
  [/green candle/, 'Green Candle', 'Damage grows 3% per hit.'], [/red candle/, 'Red Candle', 'Monster deals 10% less damage.'],
  [/heart/, 'Spare Heart', 'Survives one knockout.'], [/fwog|pepe/, 'Pet Frog', 'A frog joins the fight.'], [/sb/, 'Skateboard', 'Moves 25% faster.'],
];
const TIER_POWER = { Common: 1, Uncommon: 1.03, Rare: 1.06, Epic: 1.09, Legendary: 1.12 };

const pick = (table, v) => { const s = String(v || '').toLowerCase(); return s ? table.find(([re]) => re.test(s)) : undefined; };

/** traits: { Body: 'Tuxedo', Eyes: 'fire laser', ... } as OpenSea / token metadata lists them. */
export function buildKit(traits, { name = 'Chog' } = {}) {
  const t = traits || {};
  const sources = [['Aura', AURA_EL], ['Eyes', EYES_EL], ['Body', BODY_EL], ['Head', HEAD_EL], ['Base', BASE_EL], ['Background', BG_EL]];
  const hit = sources.map(([type, table]) => [type, pick(table, t[type])]).find(([, m]) => m);
  const element = hit ? hit[1][1] : 'plain';
  const elementFrom = hit ? hit[0] : null;
  const classId = (pick(BODY_CLASS, t.Body) || [0, 'street'])[1];
  const C = CLASSES[classId], E = ELEMENTS[element];
  const head = pick(HEAD_E, t.Head) || [0, 'Headbutt', 'A quick hit that stuns for half a second.'];
  const eyes = pick(EYES_R, t.Eyes) || EYES_R.at(-1);
  const signature = /1:1/.test(t.Base || '');
  const R = signature
    ? { key: 'R', name: `${name}'s Signature`, text: 'A one-of-one ultimate made for this Chog.', from: 'Base 1:1' }
    : { key: 'R', name: eyes[1] === 'Laser Beam' ? `${ELEMENTS[(pick(EYES_EL, t.Eyes) || [0, element])[1]].name} Laser` : eyes[1], text: eyes[2], from: `Eyes: ${t.Eyes || 'none'}` };
  const mouth = pick(MOUTH_P, t.Mouth) || MOUTH_P.at(-1);
  const acc = pick(ACC_ITEM, t.Accessory);
  const undead = /skull/i.test(t.Form || '') || /skull/i.test(t.Base || '');
  const naked = /yes/i.test(t.Naked || '');
  const power = TIER_POWER[t.Tier] || 1;
  return {
    name, element, elementInfo: E, elementFrom,
    class: classId, classInfo: C,
    stats: {
      hp: Math.round(C.hp * power * (naked ? 0.9 : 1)),
      atk: Math.round(C.atk * power * 10) / 10,
      def: C.def + (naked ? -1 : 0) + (mouth && mouth[1] === 'Gritted Teeth' ? 2 : 0),
      speed: naked ? 1.15 : 1,
    },
    abilities: [
      { key: 'Q', name: `${E.name === 'Plain' ? '' : E.name + ' '}${C.q}`.trim(), text: `Basic attack. ${E.effect[0].toUpperCase()}${E.effect.slice(1)}.`, from: `Body: ${t.Body || 'none'}` },
      { key: 'W', name: C.w[0], text: C.w[1], from: `Class: ${C.name}` },
      { key: 'E', name: head[1], text: head[2], from: `Head: ${t.Head || 'none'}` },
      R,
    ],
    passive: { name: mouth[1], text: mouth[2], from: `Mouth: ${t.Mouth || 'none'}` },
    item: acc ? { name: acc[1], text: acc[2], from: `Accessory: ${t.Accessory}` } : null,
    perks: [
      undead && { name: 'Undead', text: 'Gets back up once with 25% health.', from: 'Skull' },
      naked && { name: 'Unburdened', text: '15% faster, 10% less health, -1 armor.', from: 'Naked' },
    ].filter(Boolean),
    power, tier: t.Tier || 'Common',
    stance: t.Side === 'Left' ? 'left' : 'right',
  };
}

/* ---------- ghost Chogs: random trait sets drawn from the real distribution ---------- */
// Optional trait types: Chogs without one simply don't list it (counts below SUPPLY).
export function randomTraits(rand = Math.random) {
  const out = {};
  for (const [type, values] of Object.entries(TRAITS)) {
    const listed = values.reduce((s, [, n]) => s + n, 0);
    let r = rand() * Math.max(listed, SUPPLY);
    if (r >= listed) continue; // this ghost has no trait of this type
    for (const [v, n] of values) { r -= n; if (r < 0) { out[type] = v; break; } }
  }
  return out;
}

/** Deterministic random from a seed, so a ghost Chog keeps its traits for the day. */
export function seeded(seed) {
  let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
