// Replaying a weekly-boss hunt: the same code the browser fights with, run again from the seed the server handed
// out and the keys the player pressed (Q W E R, and P0 P1 P2 for potions). Used by the server to score a hunt,
// so a made-up damage number is worth nothing: only what the replay deals counts.
import { createFight, act, quaff, seededRand } from './combat.js';
import { hunterStats, MONSTERS, bossWeek } from './game.js';

export const MAX_LEVEL = 20, MAX_KEYS = 120;

// a hunter name for the board: 3-16 letters, digits, _ or spaces; names that pose as the project are refused
const RESERVED = /chog ?nft|chogcontract|monad|admin|official|support|moderator|team|ganraktv/i;
export function cleanName(n) {
  const s = String(n || '').replace(/\s+/g, ' ').trim();
  return /^[A-Za-z0-9_ ]{3,16}$/.test(s) && !RESERVED.test(s.replace(/[\s_]/g, '')) ? s : null;
}

// the message a player signs once a week to put their wallet on the board (the browser asks, the server checks)
export const lbMessage = (wallet, week) => `Chog Contracts · weekly boss leaderboard\nWallet: ${wallet.toLowerCase()}\nWeek of: ${week}\n\nThis only proves the wallet is yours so your boss damage can be ranked. It costs nothing and allows nothing else.`;

// at: when the hunt started (the boss's weak spot turns every Monday, so the replay uses that week's boss)
export function replayBoss({ traits, name, level, keys, seed, at = Date.now() }) {
  const boss = { ...MONSTERS.find((m) => m.boss), ...bossWeek(new Date(at)) };
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  const stats = hunterStats({ traits, name, ghost: false }, { level: lv });
  const rand = seededRand(seed);
  const f = createFight(stats, boss, { level: lv, ghost: false, rand });
  let potion = false;
  for (const k of keys.slice(0, MAX_KEYS)) {
    if (f.over) break;
    if (/^P[012]$/.test(k)) { if (!potion) { potion = true; quaff(f, Number(k[1])); } } // one potion per fight
    else if (/^[QWER]$/.test(k)) act(f, k, rand);
  }
  return { dmg: f.foe.maxHp - f.foe.hp, win: f.win, turns: f.turn, over: f.over, level: lv };
}
