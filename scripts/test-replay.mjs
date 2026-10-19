// Checks that a boss hunt played the way the browser plays it gives exactly the damage the server's replay
// gets, for many seeds and Chogs. Run: npm run test:replay
import { createFight, act, quaff, autoMove, seededRand } from '../src/combat.js';
import { hunterStats, MONSTERS } from '../src/game.js';
import { replayBoss } from '../src/replay.js';
import { randomTraits, seeded } from '../src/kit.js';

const boss = MONSTERS.find((m) => m.boss);
let ok = 0, bad = 0, cheat = 0;
for (let n = 0; n < 300; n++) {
  const traits = randomTraits(seeded(`chog-${n}`)), name = `Chog #${n}`, level = 1 + (n % 12), seed = (n * 2654435761) >>> 0;
  // the browser: a seeded fight, keys recorded as they're pressed (autopilot here), a potion now and then
  const rand = seededRand(seed), f = createFight(hunterStats({ traits, name }, { level }), boss, { level, ghost: false, rand }), keys = [];
  if (n % 3 === 0) { keys.push(`P${n % 3}`); quaff(f, n % 3); }
  while (!f.over && keys.length < 100) { const k = autoMove(f); keys.push(k); act(f, k, rand); }
  const played = f.foe.maxHp - f.foe.hp;
  const r = replayBoss({ traits, name, level, keys, seed });
  if (r.dmg === played && r.win === f.win) ok++; else { bad++; if (bad < 5) console.log('MISMATCH', { n, played, replay: r.dmg }); }
  // a cheat: claiming a higher level than was played changes nothing the server records, it replays its own way
  if (replayBoss({ traits, name, level: 999, keys, seed }).level === 20) cheat++;
}
console.log(`replay matches: ${ok}/${ok + bad}; level capped at 20: ${cheat}/300`);
process.exit(bad ? 1 : 0);
