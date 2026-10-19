// Speech bubbles: short lines a Chog says in the arena, picked from its own traits when it has a matching one,
// so a Mon Cap Chog says "gm, FUD." and a Clown Eye Chog honks. The Apprentice has its own voice, both as the
// hunter and as the sidekick cheering a real Chog on. {m} = the monster's name.

const GENERIC = {
  enter: ['FUD detected. Let\'s work.', 'Another day, another FUD.', '{m}? Never heard of it.', 'That bounty is mine.', 'Read the chart, not the FUD.'],
  ult: ['Ultimate. No refunds.', 'This one\'s for every gm you ruined!', 'Full send!', 'Bye, FUD.'],
  weak: ['Found the weak spot!', 'That\'s a skill issue, {m}.', 'Weakness exploited.'],
  low: ['Just a dip. Holding.', 'Diamond paws, diamond paws...', 'Not selling. Not falling.'],
  win: ['FUD neutralized.', 'Back to building.', 'Ser, that was easy.', 'Another bag secured.'],
  lose: ['Strategic retreat...', 'Be right back with potions.', 'Not financial advice to fight that.'],
};

// [trait, pattern, { event: lines }]
const BY_TRAIT = [
  ['Head', /mon (cap|beanie)/i, { enter: ['gm, FUD.', 'gm to everyone except {m}.'], win: ['gn, {m}.'] }],
  ['Head', /mmga/i, { enter: ['Make Monad Great Again.', 'MMGA. FUD goes home.'], win: ['Monad: great again.'] }],
  ['Body', /chug/i, { enter: ['Chug life. Hold my drink.'], win: ['Cheers to that.'] }],
  ['Head', /chog cap/i, { enter: ['Chog cap on. Brain on.'], win: ['Cap stays on. You stay down.'] }],
  ['Head', /crown/i, { enter: ['Kneel, peasant FUD.'], win: ['The crown stays on.'], ult: ['Royal decree: be gone!'] }],
  ['Head', /peace/i, { enter: ['Peace and love... right after this.'], win: ['Peace restored.'] }],
  ['Head', /boob/i, { enter: ['Focus, {m}. Focus.'] }],
  ['Eyes', /laser/i, { enter: ['My eyes are loaded.'], ult: ['Lasers. Eyes. Goodbye.', 'Pew pew, FUD.'] }],
  ['Eyes', /clown/i, { enter: ['Honk honk, rug boy.'], win: ['Who\'s the clown now?'], ult: ['Clown Fiesta, baby!'] }],
  ['Eyes', /vr/i, { enter: ['Scanning FUD... weak spot found.'], win: ['Simulation complete. You lost.'] }],
  ['Eyes', /glass|viper/i, { enter: ['Shades on. FUD off.'], win: ['Too cool to lose.'] }],
  ['Body', /ceo/i, { enter: ['I have a meeting in five. Make it quick.'], win: ['Quarterly results: you lost.'] }],
  ['Body', /astro/i, { enter: ['Houston, we have a FUD problem.'], win: ['To the moon. Not you.'] }],
  ['Body', /hoodie/i, { enter: ['Built different. Literally a builder.'] }],
  ['Body', /duck/i, { enter: ['Quack. That\'s a threat.'], win: ['Quack quack. Bounty.'] }],
  ['Form', /skull/i, { enter: ['Been dead before. You\'re next.'], low: ['Already dead. Still here.'] }],
  ['Mouth', /lip bite/i, { enter: ['Oh, you\'re in trouble.'] }],
  ['Accessory', /fwog/i, { enter: ['Fwog says: ribbit you.'] }],
  ['Accessory', /coin/i, { enter: ['This coin says you lose.'] }],
  ['Accessory', /pepe/i, { enter: ['Feels good. FUD bad.'] }],
  ['Accessory', /green candle/i, { enter: ['Only green candles here.'], win: ['Green candle, red monster.'] }],
  ['Aura', /burning|fiery|fire/i, { enter: ['Things are about to get spicy.'], ult: ['Burn, FUD, burn!'] }],
  ['Aura', /aqua|cool/i, { enter: ['Let me wash that FUD off.'] }],
  ['Aura', /wind/i, { enter: ['Blowing this FUD away.'] }],
  ['Aura', /royal/i, { win: ['Bow to the aura.'] }],
];

const APPRENTICE = {
  enter: ['I made this mask myself!', 'Training day! Don\'t laugh.', 'One day I\'ll have a real Chog...'],
  ult: ['Paper-bag power!', 'Wildcard! I hope it works!'],
  weak: ['Did you see that?!', 'I hit it! I actually hit it!'],
  low: ['This is fine. Totally fine.', 'My mask is getting soggy...'],
  win: ['I did it! Can I keep the bounty?', 'Wait till the real Chogs hear!'],
  lose: ['Ow. My mask...', 'I need a real Chog for this.'],
};
const SIDEKICK = {
  enter: ['Go get \'em, boss!', 'I\'m taking notes!', 'Boss, it\'s a big one!'],
  ult: ['WOAH!', 'Teach me that one!', 'That was so cool!'],
  low: ['Boss, careful!', 'I\'ve got potions! ...somewhere.'],
  win: ['Boss is the best!', 'Can I hold the trophy?'],
  lose: ['Boss!! Hang on!', 'I\'ll carry you home, boss.'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A line for this hunter and event, or null. Trait lines win most of the time when the Chog has one. */
export function chogLine(event, traits = {}, ctx = {}, ghost = false) {
  let pool = ghost ? APPRENTICE[event] : null;
  if (!ghost) {
    const own = BY_TRAIT.filter(([t, re, lines]) => re.test(String(traits[t] || '')) && lines[event]).flatMap(([, , lines]) => lines[event]);
    pool = own.length && Math.random() < 0.75 ? own : GENERIC[event];
  }
  return pool?.length ? pick(pool).replaceAll('{m}', ctx.monster || 'FUD') : null;
}
export const sidekickLine = (event) => (SIDEKICK[event] ? pick(SIDEKICK[event]) : null);
