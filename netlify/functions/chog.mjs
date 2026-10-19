// A Chog's story lives with the token, not the browser: level, journal, scars, trophies, earnings.
// GET  /api/chog?tokens=1,2,3                                     → { stories: { "1": { story, owner, updated } } }
// POST /api/chog { wallet, token, story, week, signature | pass }   → { updated }
// Anyone can read any Chog's story (it follows the NFT to its next owner); only the wallet that holds the token
// right now, proven by this week's signature or self-transfer pass, can write it. Every string is stripped of
// markup characters and the size is capped, so a story can't carry HTML to the people who view it.
import { getStore } from '@netlify/blobs';
import { verifyMessage } from 'viem';
import { weekId, isWallet, json, provenWallet } from '../lib/score.mjs';
import { lbMessage } from '../../src/replay.js';
import { readChog } from '../../src/chain.js';
import { SUPPLY } from '../../src/traits.js';

const MAX_BYTES = 40_000, MAX_LOG = 200, MAX_READ = 60;
const stories = () => getStore({ name: 'stories', consistency: 'strong' });
const okToken = (n) => Number.isInteger(n) && n >= 1 && n <= SUPPLY;

// deep copy keeping only plain data: strings without markup, finite numbers, booleans, arrays and objects
function clean(v, depth = 0) {
  if (depth > 6) return null;
  // markup characters go; straight quotes become curly ones, so "don't" still reads right but can't close an attribute
  if (typeof v === 'string') return v.replace(/[<>`&\\]/g, '').replace(/"/g, '”').replace(/'/g, '’').slice(0, 400);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v === null) return v;
  if (Array.isArray(v)) return v.slice(-MAX_LOG).map((x) => clean(x, depth + 1));
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 60)) if (/^[\w-]{1,40}$/.test(k)) o[k] = clean(x, depth + 1);
    return o;
  }
  return null;
}

export default async (req) => {
  if (req.method === 'GET') {
    const asked = String(new URL(req.url).searchParams.get('tokens') || '').split(',').map(Number).filter(okToken).slice(0, MAX_READ);
    const store = stories();
    const got = await Promise.all(asked.map((t) => store.get(`t/${t}`, { type: 'json' }).catch(() => null)));
    const out = {}; asked.forEach((t, i) => { if (got[i]) out[t] = got[i]; });
    return json({ stories: out });
  }
  if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);
  const b = await req.json().catch(() => null);
  const token = Number(b?.token);
  if (!b || !isWallet(b.wallet) || !okToken(token) || typeof b.story !== 'object' || !b.story) return json({ error: 'Bad request.' }, 400);
  if (JSON.stringify(b.story).length > MAX_BYTES) return json({ error: 'That story is too long.' }, 413);
  if (b.week !== weekId()) return json({ error: 'Sign again for this week.' }, 410);
  const wallet = b.wallet.toLowerCase();
  if (!(await provenWallet({ wallet, week: b.week, signature: b.signature, pass: b.pass }, verifyMessage, lbMessage))) return json({ error: 'The wallet signature does not match.' }, 401);

  let chog; try { chog = await readChog(token); } catch { return json({ error: 'Monad could not be read right now. Try again.' }, 503); }
  if (chog.owner !== wallet) return json({ error: 'That Chog is not in this wallet.' }, 403);

  const story = clean(b.story);
  story.level = Math.max(1, Math.min(50, Math.floor(Number(story.level) || 1)));
  const updated = Date.now();
  await stories().setJSON(`t/${token}`, { story, owner: wallet, updated });
  return json({ updated });
};
export const config = { path: '/api/chog' };
