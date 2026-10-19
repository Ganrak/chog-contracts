// POST /api/boss-start { wallet } → { ticket, seed }: the seed the weekly-boss hunt is played with, in a signed ticket.
import { makeTicket, isWallet, json } from '../lib/score.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const { wallet } = await req.json().catch(() => ({}));
  if (!isWallet(wallet)) return json({ error: 'A wallet address is needed.' }, 400);
  try { return json(makeTicket(wallet)); } catch (err) { return json({ error: err.message }, 500); }
};
export const config = { path: '/api/boss-start' };
