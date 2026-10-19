// Runs every Monday at 00:10 UTC. When the pool week has just ended, it pays the top 10 (see netlify/lib/pool.mjs).
import { POOL } from '../../src/pool.js';
import { weekId } from '../lib/score.mjs';
import { payWeek } from '../lib/pool.mjs';

export default async () => {
  const lastWeek = weekId(new Date(Date.now() - 24 * 3600 * 1000)); // the week that ended a few minutes ago
  if (lastWeek !== POOL.week) return;
  const report = await payWeek();
  console.log(`pool ${POOL.week}: ${report.mode}, ${report.winners.length} winners`);
};
export const config = { schedule: '10 0 * * 1' };
