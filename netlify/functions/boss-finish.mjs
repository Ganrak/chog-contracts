// POST /api/boss-finish { ticket, wallet, signature | pass, week, token, keys } → { dmg, win, total }
// (a "level" in the request is ignored: the ticket carries the fixed ranked level)
// The hunt is replayed here from the ticket's seed and the keys pressed; only the replay's damage is recorded.
// Checks: the ticket is ours, unused, fresh and this week's; the wallet signed this week's message; the wallet
// owns the Chog right now (read from Monad).
import { getStore } from '@netlify/blobs';
import { verifyMessage } from 'viem';
import { readTicket, weekId, isWallet, json, TICKET_LIFE, provenWallet } from '../lib/score.mjs';
import { replayBoss, lbMessage, MAX_KEYS, RANKED_LEVEL } from '../../src/replay.js';
import { readChog } from '../../src/chain.js';

const MAX_HUNTS_PER_WEEK = 80; // a ceiling against bots; far above what a person plays

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const b = await req.json().catch(() => null);
  if (!b || !isWallet(b.wallet) || !Array.isArray(b.keys) || b.keys.length > MAX_KEYS || !Number.isInteger(Number(b.token))) return json({ error: 'Bad request.' }, 400);
  const wallet = b.wallet.toLowerCase();

  let t; try { t = readTicket(b.ticket); } catch { return json({ error: 'This hunt was not started here.' }, 400); }
  if (t.kind !== 'hunt' || !Number.isFinite(t.iat) || !t.nonce || !Number.isInteger(t.seed)) return json({ error: 'This hunt was not started here.' }, 400);
  if (t.w !== wallet) return json({ error: 'This hunt belongs to another wallet.' }, 403);
  if (Date.now() - t.iat > TICKET_LIFE) return json({ error: 'This hunt took too long to finish.' }, 410);
  if (t.week !== weekId()) return json({ error: 'That week is over.' }, 410);

  const okSig = await provenWallet({ wallet, week: t.week, signature: b.signature, pass: b.pass }, verifyMessage, lbMessage);
  if (!okSig) return json({ error: 'The wallet signature does not match.' }, 401);

  const store = getStore({ name: `boss-${t.week}`, consistency: 'strong' });
  if (await store.get(`nonce/${t.nonce}`)) return json({ error: 'This hunt was already counted.' }, 409);
  await store.set(`nonce/${t.nonce}`, '1');

  let chog; try { chog = await readChog(Number(b.token)); } catch { return json({ error: 'Monad could not be read right now. Try again.' }, 503); }
  if (chog.owner !== wallet) return json({ error: 'That Chog is not in this wallet.' }, 403);

  const keys = b.keys.map(String);
  // the level comes from the signed ticket, never from the request: a browser could claim any level
  const r = replayBoss({ traits: chog.traits, name: chog.name, level: t.lv ?? RANKED_LEVEL, keys, seed: t.seed, at: t.iat });

  const entry = (await store.get(`w/${wallet}`, { type: 'json' })) || { wallet, dmg: 0, hunts: 0, wins: 0 };
  if (entry.hunts >= MAX_HUNTS_PER_WEEK) return json({ error: 'That is enough boss hunts for one week.' }, 429);
  entry.dmg += r.dmg; entry.hunts += 1; if (r.win) entry.wins += 1;
  entry.name = chog.name; entry.token = chog.tokenId; entry.updated = Date.now();
  await store.setJSON(`w/${wallet}`, entry);
  return json({ dmg: r.dmg, win: r.win, total: entry.dmg });
};
export const config = { path: '/api/boss-finish' };
