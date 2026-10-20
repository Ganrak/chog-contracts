// Wannabe's room: the lodge's back room where the Wannabe Chog lives. Hurt hunters rest in its bed, the Wannabe
// talks when you click it, and the player decorates it: items go on the shelf and the floor. Items are earned
// (first win, a streak, a monster trophy, three stars in Chog Drop) or bought with test $CHOG.
// This file holds the item list, the saved layout and what the Wannabe says; main.js draws the room.

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A line for the Wannabe, from what is going on: who is in bed, which Chogs you have, trophies, scars. */
export function wannabeLine({ sore = false, sleeping = [], away = [], chogs = [], trophies = {}, scars = [], placed = [] } = {}) {
  const lines = [
    'I made a new mask. This one has ears!',
    'Don\'t tell anyone, but the Wyrm scares me.',
    'One day I\'ll have a real Chog. I\'ll call it... Chog.',
    'I practise my Q every night. Q! Q! Q!',
  ];
  if (sore) lines.push('Ow. Still sore from that fight.', 'I\'m resting. Doctor\'s orders. I\'m the doctor.', 'Tuck me in? Please?');
  if (sleeping.length) {
    const s = pick(sleeping);
    lines.push(`Shh. ${s} is sleeping. I put a cold towel on it.`, `${s} took a big hit. Sit with it a bit?`, 'Tuck them in. It helps, I swear.');
  }
  if (away.length) { const a = pick(away); lines.push(`Wonder where ${a} is right now. Hope it packed socks.`, `I left the light on for ${a}.`, `When ${a} gets back I want ALL the stories.`); }
  if (chogs.length) { const c = pick(chogs); lines.push(`Is ${c} really yours? Can I hold it? Just once?`, `${c} is so cool. Teach me a move!`); }
  else lines.push('Real Chogs come in here sometimes. I just stare at them.', 'If you ever get a Chog, bring it here. I\'ll make it a bed.');
  const won = Object.entries(trophies).filter(([, n]) => n);
  if (won.length) { const [kind, n] = pick(won); lines.push(n > 1 ? `${n} ${kind}s! We should put one on the shelf.` : `Our first ${kind}! I'll never forget it.`); }
  if (scars.length) lines.push(`We'll get that ${pick(scars)} next time. I know it.`);
  if (placed.length) { const it = pick(placed); lines.push(`I love the ${it.toLowerCase()}. Best room ever.`, `Careful with the ${it.toLowerCase()}! I just dusted it.`); }
  else lines.push('My shelf is so empty. Got anything for it?');
  return pick(lines);
}

/* ---------- decorating ----------
   Slots are spots on the painted room, in % of the stage (x = centre, y = bottom edge, h = item height).
   Wall slots take wall items (pictures), the others take small things. Items: earned ones carry `earn` (a test
   on the player's stats and the hint shown until then); shop ones a test $CHOG `price`. Pictures come from the
   user's ChatGPT sheets, cut by scripts/cut-sprites.ps1; the portrait and the poster are drawn live. */
export const SLOTS = [
  { id: 'shelf1', x: 20.5, y: 86.2, h: 12, label: 'Shelf, left' },
  { id: 'shelf2', x: 28.2, y: 86.2, h: 12, label: 'Shelf, middle' },
  { id: 'shelf3', x: 35.9, y: 86.2, h: 12, label: 'Shelf, right' },
  // two pictures on the middle wall, the second one higher and to the right
  { id: 'wall1', x: 46, y: 45, h: 21, label: 'Wall, left', wall: true },
  { id: 'wall2', x: 59, y: 66, h: 18, label: 'Wall, right', wall: true },
];
const MONSTERS = ['ghoul', 'troll', 'thief', 'golem', 'harpy', 'wyrm', 'wraith'];
const NAMES = { ghoul: 'Ghoul', troll: 'Troll', thief: 'Thief', golem: 'Golem', harpy: 'Harpy', wyrm: 'Wyrm', wraith: 'Wraith' };
export const ITEMS = [
  // earned
  { id: 'plant', name: 'Potted plant', ready: true, earn: { hint: 'Win your first hunt', test: (s) => s.wins >= 1 } },
  { id: 'cup', name: 'Gold cup', ready: true, earn: { hint: 'Keep a 3-day streak', test: (s) => s.streak >= 3 } },
  { id: 'figurine', name: 'Chog figurine', ready: true, earn: { hint: 'Get 3 stars in Chog Drop', test: (s) => s.dropStars >= 3 } },
  { id: 'mask', name: 'Cardboard mask', ready: true, earn: { hint: 'Bring a real Chog', test: (s) => s.chogs >= 1 } },
  // wall pictures, drawn live: your own Chog's NFT art in a frame, and your Chog as a brick mosaic
  { id: 'portrait', name: 'Your Chog portrait', wall: true, live: true, ready: true, earn: { hint: 'Bring a real Chog', test: (s) => s.chogs >= 1 } },
  { id: 'poster', name: 'Brick Chog poster', wall: true, live: true, ready: true, earn: { hint: 'Build a Chog in Brick Studio', test: (s) => s.bricksBuilt } },
  ...MONSTERS.map((k) => ({ id: `trophy-${k}`, name: `${NAMES[k]} trophy`, img: `assets/monsters/${k}.png`, ready: true, earn: { hint: `Hunt a ${NAMES[k]}`, test: (s) => (s.trophies[k] || 0) >= 1 } })),
  // shop (test $CHOG)
  { id: 'candle', name: 'Candle', ready: true, price: 8 },
  { id: 'books', name: 'Stack of books', ready: true, price: 10 },
  { id: 'cactus', name: 'Little cactus', ready: true, price: 15 },
  { id: 'piggy', name: 'Piggy bank', ready: true, price: 20 },
  { id: 'sword', name: 'Toy sword', ready: true, price: 25 },
  { id: 'globe', name: 'Snow globe', ready: true, price: 30 },
  { id: 'frame', name: 'Monad picture', wall: true, ready: true, price: 40 },
  { id: 'lava', name: 'Lava lamp', ready: true, price: 50 },
].map((it) => ({ img: `assets/room/items/${it.id}.png`, ...it }));

/* colours for the painted curtains (the rug was tried too, but its edges never recoloured cleanly): recoloured copies of those exact pixels (scripts/recolor-region.ps1),
   laid over the painting; 'purple' is the painting itself. Box = where the copy sits, in % of the stage. */
export const PAINTS = {
  curtains: { name: 'Curtains', dir: 'curtains', box: [86.54, 4.04, 7.00, 40.06], price: 10 },
};
export const COLORS = [['purple', '#8a5cd6'], ['red', '#c8323c'], ['teal', '#1fa69a'], ['gold', '#d9a227'], ['green', '#3f9a3a'], ['blue', '#3a6fd1']];

const KEY = 'chog-contracts-room';
export function loadRoom() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    // spots that no longer exist (the old floor spot) give their item back
    if (r && r.slots) return { bought: r.bought || [], slots: Object.fromEntries(Object.entries(r.slots).filter(([s]) => SLOTS.some((x) => x.id === s))), paint: r.paint || {} };
  } catch {}
  return { bought: [], slots: {}, paint: {} };
}
export function saveRoom(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {} }
/** Does the player have this item? */
export const owns = (it, room, stats) => (it.earn ? it.earn.test(stats) : room.bought.includes(it.id));
/** Can this item go in this slot? Pictures only on the wall, small things only on the shelf and floor. */
export const fits = (it, slot) => !!it.wall === !!slot.wall;
