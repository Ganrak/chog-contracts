// POST /api/profile { wallet, name, signature, week } → { name }: sets the hunter name shown on the board.
// The same weekly signature that ranks a wallet proves it's yours, so nobody can rename someone else.
// GET /api/profile?wallet=0x… → { name } (or { name: null })
import { getStore } from '@netlify/blobs';
import { verifyMessage } from 'viem';
import { weekId, isWallet, json, provenWallet } from '../lib/score.mjs';
import { lbMessage, cleanName } from '../../src/replay.js';

const profiles = () => getStore({ name: 'profiles', consistency: 'strong' });

export default async (req) => {
  if (req.method === 'GET') {
    const w = new URL(req.url).searchParams.get('wallet');
    if (!isWallet(w)) return json({ error: 'A wallet address is needed.' }, 400);
    const p = await profiles().get(w.toLowerCase(), { type: 'json' });
    return json({ name: p?.name || null });
  }
  if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);
  const b = await req.json().catch(() => null);
  if (!b || !isWallet(b.wallet)) return json({ error: 'Bad request.' }, 400);
  const wallet = b.wallet.toLowerCase(), name = cleanName(b.name);
  if (!name) return json({ error: 'Use 3 to 16 letters, numbers, spaces or _. Names that look official are taken.' }, 400);
  if (b.week !== weekId()) return json({ error: 'Sign again for this week.' }, 410);
  const ok = await provenWallet({ wallet, week: b.week, signature: b.signature, pass: b.pass }, verifyMessage, lbMessage);
  if (!ok) return json({ error: 'The wallet signature does not match.' }, 401);
  await profiles().setJSON(wallet, { name, updated: Date.now() });
  return json({ name });
};
export const config = { path: '/api/profile' };
