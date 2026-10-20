// Expeditions: send a Chog away for 1, 8 or 24 hours (minutes in fast mode). Before it leaves you pick where
// (each place is a monster's home, and a Chog whose element beats that monster does better), how long (longer =
// riskier, bigger reward) and whether to pack snacks (test $CHOG, lowers the risk). While away it can't hunt.
// Its travel diary fills in as time passes, in the dry style of a survival log, and halfway through something
// happens that needs a decision; answer it on the site, or the Chog decides by itself, in character.
// When it's back: XP and test $CHOG, the diary goes into its journal, and a long trip gone wrong means an injury.

export const PLACES = [
  { id: 'backyard', name: 'The Backyard', kind: null, weak: null, blurb: 'Behind the lodge. Safe. Mostly.', wannabe: true },
  { id: 'swamp', name: 'Gas Swamps', kind: 'troll', weak: 'aqua', blurb: 'Troll country. Bring a nose peg.' },
  { id: 'alley', name: 'Rug Alley', kind: 'thief', weak: 'charm', blurb: 'Thieves everywhere. Hold your bag.' },
  { id: 'peaks', name: 'Lagstone Peaks', kind: 'golem', weak: 'volt', blurb: 'Golems doze on every ledge.' },
  { id: 'woods', name: 'Murmur Woods', kind: 'wraith', weak: 'holy', blurb: 'Whispers in the fog. Vague ones.' },
  { id: 'crypt', name: 'Deadchain Crypt', kind: 'ghoul', weak: 'fire', blurb: 'Where dead chains are buried.' },
];
export const TRIPS = [
  { id: 'short', name: 'Short', hours: 1, risk: 0.08, xp: 40, chog: 150 },
  { id: 'mid', name: 'Medium', hours: 8, risk: 0.2, xp: 120, chog: 600 },
  { id: 'long', name: 'Long', hours: 24, risk: 0.35, xp: 280, chog: 1500 },
];
export const SNACKS = 300; // test $CHOG
const FAST_KEY = 'chog-contracts-fast-trips';
export const fastMode = () => { try { return localStorage.getItem(FAST_KEY) === '1'; } catch { return false; } };
export const setFastMode = (on) => { try { localStorage.setItem(FAST_KEY, on ? '1' : '0'); } catch {} };

// small seeded random, so a trip's diary and choice are fixed the moment it starts
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pickR = (r, list) => list[Math.floor(r() * list.length)];

/* ---------- the diary ----------
   A dry survival-log voice. Lines come from the place, the Chog's own traits, its element, and luck.
   {n} = the Chog's name. A trip never repeats a line. */
const PLACE_LINES = {
  backyard: [
    'Found a stick. Named it Stick.',
    'A squirrel stared at {n}. {n} stared back. Nobody won.',
    'Dug a hole. Found another hole.',
    'Practised the sword swing on a bush. The bush is fine.',
    'Built a fort out of two chairs and a blanket. Unbreachable.',
    'Hunted a monster. It was a garden gnome. Still counts.',
    'Ate a berry. Probably fine. Waiting to find out.',
    'Drew a map of the backyard. It is mostly "grass".',
    'A worm crossed the path. Let it pass. Respect.',
    'Tried to whistle. Produced air.',
    'Climbed the fence. Saw the other side. Also backyard.',
    'Named every cloud. One looks like a Chog. Best cloud.',
    'Lost a sock. The backyard gives nothing back.',
    'Practised a heroic pose for twenty minutes. Nailed it.',
    'Wrote "WANNABE WAS HERE" on a rock. History.',
  ],
  swamp: [
    'The air tastes like gas fees.',
    'A bubble burst. Smelled like a failed transaction.',
    'Walked in circles. The swamp has no map, only vibes.',
    'A Troll snored nearby. {n} tiptoed past.',
    'Boots full of swamp water. Morale: damp.',
    'A frog croaked "wen refund". Ignored it.',
    'Found a sign: "Gas: 900 gwei". The sign is old. Very old.',
    'Mosquitoes the size of tokens. Swatted three.',
    'A log turned out to be a sleeping Troll. Apologised to the log.',
    'Something in the mud tried to take {n}\'s boot. Negotiated.',
    'The fog smells like regret and onions.',
    'Made camp on the only dry rock. It sank a little overnight.',
    'Heard a Troll complain about prices to another Troll.',
    'Found a pond so still it looked like a chart that never moves.',
    'Counted the bubbles. Lost count at "a lot".',
  ],
  alley: [
    'Someone tried to sell {n} a "guaranteed 100x".',
    'Counted the coins twice. Still all there. Suspicious.',
    'Every door says "trust me". {n} did not.',
    'A shadow followed {n} for two blocks, then gave up.',
    'A man in a long coat whispered "presale". Kept walking.',
    'Found a wallet on the ground. It was empty. Of course it was.',
    'A street sign pointed in four directions at once.',
    'Got offered a "free airdrop". Asked for the catch. Silence.',
    'Saw a Thief practising a sad face in a window.',
    'Bought a hot snack. Checked the change three times.',
    'A cat stole a fish from a Thief. Justice exists.',
    'Every wall has a poster: "DEV IS DOXXED (trust)".',
    'Slept with one eye open. Then the other. Then neither.',
    'A Thief tried the "dropped coin" trick. {n} invented it.',
    'Rain washed the alley. It is still not clean.',
  ],
  peaks: [
    'The climb is slow. Everything here is slow.',
    'A Golem woke up, looked at {n}, went back to sleep.',
    'Found a ledge with a view. Monad looked tiny and fast.',
    'A rock fell. Then another rock. Lag, probably.',
    'Waited for a bridge to load. It loaded. Crossed carefully.',
    'Thin air. Thinner jokes. Kept going.',
    'A goat passed {n} on the climb. Humbling.',
    'Snow started. Then buffered. Then started again.',
    'Found a Golem\'s diary. Every entry: "rested".',
    'Echo said "hello" a full minute after {n} did.',
    'A cloud got stuck on the peak. Helped it along.',
    'Built a snow Chog. It has more personality than some Golems.',
    'The path forked. Both forks were uphill. Classic.',
    'Saw an eagle. The eagle was faster than this mountain.',
    'Lunch on a cliff. The view was worth the sandwich.',
  ],
  woods: [
    'Heard whispers: "everyone knows...". Knows what? Nobody said.',
    'The fog made {n} doubt everything for a minute.',
    'Followed a light. It was a firefly. Probably.',
    'A Wraith murmured something vague and left.',
    'A tree said "sources say". Asked which sources. The tree went quiet.',
    'Walked past the same mushroom four times. Or four mushrooms.',
    'An owl asked "who?". Nobody ever answers the owl.',
    'Found a note nailed to a tree: "it\'s over". Under it: "it\'s not".',
    'The fog lifted for a second. Everything was fine. Then it came back.',
    'A Wraith tried to start a rumour. It forgot the rumour.',
    'Slept under a big tree. Dreamed of clear skies and green candles.',
    'Rumour has it the woods have an exit. Rumour was right, eventually.',
    'Heard "trust me bro" echo between the trees.',
    'Picked berries. Fog-flavoured.',
    'Left breadcrumbs. A Wraith ate them. Vaguely.',
  ],
  crypt: [
    'Read the tombstones. So many "dead chains". All alive.',
    'Something rattled in a coffin. {n} kept walking.',
    'Cold in here. {n} made a small fire.',
    'Found a ghost writing FUD on the walls. Erased it.',
    'A skeleton offered a handshake. Declined politely.',
    'A tomb said "HERE LIES MONAD (2024)". Crossed it out.',
    'Candles lit themselves. Very rude of them.',
    'A Ghoul moaned "nobody uses it". {n} used it. Right there.',
    'Echoes said "dead, dead, dead". {n} said "alive". Echo stopped.',
    'Found a crown in a crypt. It was cardboard. Kept it anyway.',
    'Dust everywhere. Sneezed. Woke something. Ran.',
    'A spider web spelled "ngmi". Swept it.',
    'Tripped over a bone. The bone apologised.',
    'Made a candle-lit dinner. Alone. With ghosts. Cozy.',
    'Counted the coffins. One more than before. Did not check.',
  ],
};
// lines from the Chog's own traits: [trait key, pattern, line]
const TRAIT_LINES = [
  // clowns are the best travellers
  ['Eyes', /clown/i, 'Honked at a monster. It ran. Comedy works.'],
  ['Eyes', /clown/i, 'Juggled three rocks for a Troll. The Troll clapped. Tipped a coin.'],
  ['Mouth', /clown/i, 'Did a pratfall on purpose. A Ghoul laughed so hard it fell apart.'],
  ['Head', /clown nose/i, 'Honked the nose at a sentry. Let through for "being too silly to be a threat".'],
  ['Head', /rainbow wig/i, 'The wig scared off two Wraiths and one very confused bird.'],
  // eyes
  ['Eyes', /laser/i, 'The lasers lit the way. Very handy. A bit scary.'],
  ['Eyes', /laser/i, 'Toasted bread with the lasers at camp. Perfect toast.'],
  ['Eyes', /cry|tear/i, 'Cried a little at a sunset. Felt better. Kept going.'],
  ['Eyes', /dead/i, 'A Ghoul mistook {n} for one of its own. Easy pass.'],
  ['Eyes', /heart/i, 'Fell in love with a waterfall. Will write.'],
  ['Eyes', /tired/i, 'Napped. Woke up. Napped again. Called it "pacing".'],
  ['Eyes', /vr|visor/i, 'Saw the whole route on the visor. It was mostly ads.'],
  ['Eyes', /frog/i, 'Frogs saluted. {n} saluted back. Diplomacy.'],
  ['Eyes', /angry|thug|mog/i, 'Gave a monster one look. It walked the other way.'],
  ['Eyes', /btc glass/i, 'Looked at everything through orange glasses. Still not convinced.'],
  // heads
  ['Head', /crown/i, 'Locals bowed to the crown. {n} pretended not to notice.'],
  ['Head', /wizard/i, 'Cast a spell to find the path. Found a sandwich instead. Fine.'],
  ['Head', /horn/i, 'Got stuck in a low doorway by the horns. Waited for help. None came.'],
  ['Head', /helmet/i, 'A rock hit the helmet. The rock lost.'],
  ['Head', /mafia|robber/i, 'Made a Thief an offer it couldn\'t refuse. It refused. Awkward.'],
  ['Head', /banana/i, 'A monkey followed {n} for an hour. It was about the banana.'],
  ['Head', /shroom/i, 'A mushroom on the path waved at the mushroom on {n}\'s head.'],
  ['Head', /plumber/i, 'Fixed a leaking pipe in the middle of nowhere. Nobody asked. Felt good.'],
  ['Head', /cap|beanie|hat|bucket/i, 'Lost the {Head} in the wind. Chased it down. Worth it.'],
  // bodies
  ['Body', /tux/i, 'Overdressed for a swamp. Still the best-dressed thing there.'],
  ['Body', /ceo|vest/i, 'Held a meeting with a frog. The frog agreed to everything.'],
  ['Body', /astro/i, 'Checked the stars through the helmet. Still there.'],
  ['Body', /inmate|prisoner/i, 'A guard did a double take. {n} waved. Kept walking, briskly.'],
  ['Body', /banana suit/i, 'Every monkey in the area now considers {n} family.'],
  ['Body', /shark suit/i, 'Swam across a river. Fish kept a respectful distance.'],
  ['Body', /duck float/i, 'Floated across the river on the duck. Elegant. Mostly.'],
  ['Body', /golden armor/i, 'The armour shone so bright a Wraith had to sit down.'],
  ['Body', /hawaiian/i, 'Declared it beach time. There was no beach. Declared it anyway.'],
  ['Body', /mummy/i, 'Unravelled a bit on the climb. Rewrapped at camp.'],
  ['Body', /homeless/i, 'Slept rough. Honestly, slept great.'],
  ['Body', /squid game/i, 'Someone shouted "red light". {n} froze. Habit.'],
  // mouth, aura, form, tier
  ['Mouth', /drool/i, 'Drooled on the map. The map is now a different map.'],
  ['Mouth', /rainbow puke/i, 'Got seasick on solid ground. Rainbow everywhere. Pretty, actually.'],
  ['Mouth', /bubblegum/i, 'Blew a bubble so big it floated {n} over a ditch.'],
  ['Mouth', /gold tooth/i, 'Smiled at a Thief. The Thief eyed the gold tooth. Stopped smiling.'],
  ['Mouth', /coin/i, 'Flipped the coin to pick a path. Heads: left. It landed on its edge.'],
  ['Aura', /.+/, 'The {Aura} kept the dark away at night.'],
  ['Form', /skull/i, 'A ghost asked {n} for directions. Rude to assume.'],
  ['Base', /radioactive/i, 'Glowed in the dark. Doubled as the campfire.'],
  ['Tier', /legendary|epic/i, 'A stranger recognised {n}. Asked for an autograph. Signed it.'],
];
// element lines: something only a Chog of that element would do
const ELEMENT_LINES = {
  fire: ['Lit the campfire with a sneeze.', 'Dried everyone\'s socks. Hero of the camp.'],
  aqua: ['Found fresh water where nobody else could.', 'Swam where others had to walk around.'],
  volt: ['Charged a dead lantern with one finger.', 'Hair stood up all night. Static is a lifestyle.'],
  charm: ['Talked a guard into a free meal. And dessert.', 'Made friends with something that wanted to eat {n}.'],
  wild: ['Slept in a tree like it was a hotel.', 'Followed animal tracks to a shortcut.'],
  holy: ['A small light followed {n} the whole night.', 'Blessed a sad-looking rock. It looked happier.'],
  shadow: ['Walked through the dark like it was noon.', 'Vanished for a minute. Came back with snacks.'],
};
const HOME_LINE = 'This place felt like home turf. {n} knew exactly what to do.'; // the element beats the local monster
const GOOD_LINES = [
  'Home before dark. Bag heavy, spirits high.',
  'Came back taller somehow. Probably the confidence.',
  'Walked in like nothing happened. Pockets full.',
  'Back at the lodge. Told the story twice. Improved it the second time.',
  'Home. Slept fourteen hours. Earned it.',
  'Returned with a tan, a story and a bag of loot.',
  'Made it back. The Wannabe asked for every detail.',
  'Strolled home whistling. Successfully, this time.',
];
const HURT_LINES = [
  'Slipped. Twisted something. Limping home.',
  'Got ambushed on the way back. Made it, barely.',
  'Came home with a bandage and a different attitude.',
  'Lost the fight with a cliff. The cliff is fine.',
  'Back, bruised, and very ready for bed.',
  'Ran the last mile. Not by choice.',
];

/* ---------- the halfway choice ----------
   Four per place. a: the bold option (more reward, more risk), b: the careful one; ra / rb say what happened.
   If you don't answer, the Chog picks in character: brawlers and dealers go bold, the rest stay careful. */
const CHOICES = {
  backyard: [
    { q: 'A big dog guards the shed. There might be snacks inside.', a: 'Sneak in', b: 'Pet the dog, leave', ra: 'Got the snacks. The dog got half.', rb: 'The dog is now a best friend.' },
    { q: 'The neighbour\'s cat is up a tree and yelling.', a: 'Climb up', b: 'Get a ladder', ra: 'Saved the cat. Fell out of the tree. Worth it.', rb: 'The cat came down on its own while the ladder was found.' },
    { q: 'A mysterious box sits by the fence.', a: 'Open it', b: 'Poke it with a stick', ra: 'It was full of old Chog stickers. Jackpot.', rb: 'Stick says it\'s just a box. Stick was right.' },
    { q: 'Rain clouds roll in.', a: 'Keep exploring', b: 'Run under the porch', ra: 'Soaked. Found a puddle with a frog king in it.', rb: 'Dry. Watched the rain. Very peaceful.' },
  ],
  swamp: [
    { q: 'A Troll offers a shortcut through its gas tunnel.', a: 'Hold breath, go', b: 'Take the long way', ra: 'Held breath for 3 minutes. New record. Never again.', rb: 'The long way had nice frogs.' },
    { q: 'Something shiny glints at the bottom of the bog.', a: 'Dive for it', b: 'Fish for it with a stick', ra: 'Came up with a gold coin and a lot of mud.', rb: 'The stick caught a boot. A nice boot, though.' },
    { q: 'Two Trolls argue about fees and block the bridge.', a: 'Walk right through', b: 'Wait for them to finish', ra: 'They were too busy arguing to notice.', rb: 'They never finish. Found another bridge.' },
    { q: 'A swamp witch offers a mystery potion.', a: 'Drink it', b: 'Say no thanks', ra: 'Burped green for an hour. Felt amazing.', rb: 'The witch shrugged and drank it herself.' },
  ],
  alley: [
    { q: 'A Thief offers a "secret map". No questions asked.', a: 'Take the map', b: 'Walk away', ra: 'The map was real. Shockingly.', rb: 'Walked away. Heard the Thief sigh.' },
    { q: 'A crowd gathers around a shell game.', a: 'Play a round', b: 'Watch from afar', ra: 'Won. The Thief running it is still confused.', rb: 'Watched three people lose. Learned a lot.' },
    { q: 'Someone drops a bag and runs.', a: 'Chase them', b: 'Look in the bag', ra: 'Caught them. It was their lunch. Gave it back.', rb: 'The bag had a note: "not a rug, promise".' },
    { q: 'A door marked "VIP ONLY" is slightly open.', a: 'Slip inside', b: 'Knock first', ra: 'It was a party. Got free snacks before anyone noticed.', rb: 'Nobody answered. The mystery remains.' },
  ],
  peaks: [
    { q: 'A sleeping Golem blocks the path. A ledge goes around it.', a: 'Climb over it', b: 'Take the ledge', ra: 'The Golem woke up halfway and waved.', rb: 'The ledge was narrow. Did not look down. Mostly.' },
    { q: 'A storm is coming. A cave is nearby.', a: 'Push to the summit', b: 'Shelter in the cave', ra: 'Beat the storm to the top. The view was unreal.', rb: 'The cave had cave paintings of Chogs. Ancient fans.' },
    { q: 'An old rope bridge sways over a gap.', a: 'Cross it', b: 'Find another way', ra: 'Crossed. The bridge creaked. So did {n}.', rb: 'Another way took two hours. Legs hate it.' },
    { q: 'A Golem asks for help moving a boulder.', a: 'Push with it', b: 'Offer advice instead', ra: 'Moved it. The Golem gave a shiny pebble as thanks.', rb: 'The Golem took the advice. Very slowly.' },
  ],
  woods: [
    { q: 'A voice in the fog says "follow me".', a: 'Follow the voice', b: 'Stay on the path', ra: 'It led to a clearing full of glowing flowers.', rb: 'The voice got bored and went away.' },
    { q: 'A Wraith offers to tell {n} "the truth about everything".', a: 'Listen', b: 'Cover ears and hum', ra: 'The truth was vague. Very vague. Moving on.', rb: 'Hummed so loud a bird joined in.' },
    { q: 'Two paths: one with signs, one without.', a: 'No signs', b: 'Follow the signs', ra: 'No signs, no lies. Found a hidden pond.', rb: 'The signs said "probably this way". They were right.' },
    { q: 'Something rustles in the bushes.', a: 'Jump in', b: 'Throw a pinecone', ra: 'A family of rabbits. They were not impressed.', rb: 'The pinecone came back. Thrown. Left quickly.' },
  ],
  crypt: [
    { q: 'A sealed coffin hums. Something valuable inside?', a: 'Open it', b: 'Leave it sealed', ra: 'A ghost popped out, said "boo", gave {n} a coin.', rb: 'The humming stopped. That was worse.' },
    { q: 'A Ghoul challenges {n} to a staring contest.', a: 'Accept', b: 'Decline politely', ra: 'Won. Ghouls can\'t blink. Or can they. {n} won anyway.', rb: 'The Ghoul looked hurt. Left it a cookie.' },
    { q: 'A staircase goes further down. It\'s very dark.', a: 'Go down', b: 'Stay up here', ra: 'Found a forgotten treasure room. Mostly dust. Some treasure.', rb: 'Upstairs was cozy enough.' },
    { q: 'A ghost asks {n} to deliver a letter "to the living".', a: 'Take the letter', b: 'Say you\'re busy', ra: 'Delivered it to the Wannabe. It\'s a love letter to snacks.', rb: 'The ghost wrote an angry review.' },
  ],
};
const BOLD = /brawl|deal|trick|blast/i;

/** Plans a trip the moment it starts. hunter: { name, traits, cls, element, ghost }. Returns the trip to store on the Chog. */
export function planTrip(hunter, placeId, tripId, snacks) {
  const place = PLACES.find((p) => p.id === placeId), trip = TRIPS.find((t) => t.id === tripId);
  const seed = (Date.now() ^ hunter.name.length * 7919) >>> 0, r = rng(seed);
  const len = trip.hours * (fastMode() ? 60 : 3600) * 1000, start = Date.now();
  // diary: 3 entries for short, 5 for medium, 7 for long, spread over the trip
  const count = { short: 3, mid: 5, long: 7 }[trip.id];
  const pool = [...PLACE_LINES[place.id]];
  if (!hunter.ghost) { // the Wannabe's traits are just a mask; real Chogs bring their own stories
    for (const [key, re, line] of TRAIT_LINES) { const v = hunter.traits?.[key]; if (v && re.test(v)) pool.push(line.replaceAll(`{${key}}`, v)); }
    pool.push(...(ELEMENT_LINES[hunter.element] || []));
  }
  const lines = [];
  if (!hunter.ghost && place.weak && place.weak === hunter.element) lines.push(HOME_LINE);
  while (lines.length < count && pool.length) lines.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  // shuffle so the home-turf line isn't always first
  for (let i = lines.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [lines[i], lines[k]] = [lines[k], lines[i]]; }
  const diary = lines.map((t, i) => ({ at: start + Math.round(len * (i + 0.5) / (count + 1)), text: t.replaceAll('{n}', hunter.name) }));
  const c = pickR(r, CHOICES[place.id]), fill = (s) => s.replaceAll('{n}', hunter.name);
  const choice = { q: fill(c.q), a: c.a, b: c.b, ra: fill(c.ra), rb: fill(c.rb), at: start + Math.round(len * 0.45), pick: null, auto: BOLD.test(hunter.cls || '') ? 'a' : 'b' };
  return { place: place.id, trip: trip.id, start, end: start + len, snacks: !!snacks, seed, diary, choice, roll: r() };
}

export const tripLeft = (t) => (t ? Math.max(0, t.end - Date.now()) : 0);
export const tripBack = (t) => !!t && Date.now() >= t.end;

/** How it went. element: the Chog's element key. Fixed once the trip is over (uses the stored roll). */
export function tripResult(t, element) {
  const place = PLACES.find((p) => p.id === t.place), trip = TRIPS.find((x) => x.id === t.trip);
  const match = !!place.weak && place.weak === element;
  const pick = t.choice.pick || t.choice.auto, bold = pick === 'a';
  let risk = trip.risk - (match ? 0.12 : 0) - (t.snacks ? 0.1 : 0) + (bold ? 0.08 : -0.04);
  risk = Math.max(0.02, Math.min(0.6, risk));
  const ok = t.roll >= risk, mult = (match ? 1.3 : 1) * (bold ? 1.35 : 1);
  return {
    ok, match, bold, decided: t.choice.pick ? 'you' : 'chog',
    xp: Math.round(trip.xp * mult * (ok ? 1 : 0.4)),
    chog: ok ? Math.round(trip.chog * mult / 50) * 50 : 0,
    hurt: !ok && trip.id !== 'short',
    ending: ok ? GOOD_LINES[t.seed % GOOD_LINES.length] : HURT_LINES[t.seed % HURT_LINES.length],
    // what came of the halfway choice (older trips may not have it)
    outcome: (pick === 'a' ? t.choice.ra : t.choice.rb) || '',
  };
}
