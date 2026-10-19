// GET /api/pool → { pool, standings, report }: the launch pool, who would win it right now, and once paid, the
// payments with their transaction hashes (anyone can check them on Monad).
import { POOL } from '../../src/pool.js';
import { json } from '../lib/score.mjs';
import { standings, payouts } from '../lib/pool.mjs';

export default async () => {
  const report = await payouts().get(POOL.week, { type: 'json' });
  return json({ pool: POOL, standings: report ? null : await standings(), report });
};
export const config = { path: '/api/pool' };
