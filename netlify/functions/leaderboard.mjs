// GET /api/leaderboard?week=YYYY-MM-DD → { week, entries: [{ wallet, name, token, dmg, hunts, wins }] }, best first.
import { getStore } from '@netlify/blobs';
import { weekId, json } from '../lib/score.mjs';

export default async (req) => {
  const asked = new URL(req.url).searchParams.get('week');
  const week = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : weekId();
  const store = getStore({ name: `boss-${week}`, consistency: 'strong' });
  const { blobs } = await store.list({ prefix: 'w/' });
  const profiles = getStore({ name: 'profiles', consistency: 'strong' });
  const entries = (await Promise.all(blobs.map((x) => store.get(x.key, { type: 'json' })))).filter(Boolean)
    .sort((a, b) => b.dmg - a.dmg).slice(0, 100);
  // the hunter name each wallet chose (if any) goes next to its Chog's name
  const handles = await Promise.all(entries.map((e) => profiles.get(e.wallet, { type: 'json' }).catch(() => null)));
  const out = entries.map(({ wallet, name, token, dmg, hunts, wins }, i) => ({ wallet, handle: handles[i]?.name || null, name, token, dmg, hunts, wins }));
  return json({ week, entries: out });
};
export const config = { path: '/api/leaderboard' };
