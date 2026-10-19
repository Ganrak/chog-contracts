// Shared bits for the leaderboard functions: the week, signed hunt tickets, JSON replies.
// A ticket is { w: wallet, seed, nonce, iat, week }, base64url, with an HMAC so nobody can make one up or change
// its seed. SCORE_SECRET (a long random string) is set once in the site's environment variables.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const weekStart = (now = new Date()) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
export const weekId = (now = new Date()) => weekStart(now).toISOString().slice(0, 10);
export const TICKET_LIFE = 45 * 60 * 1000; // a hunt has to be finished within 45 minutes of starting
export const isWallet = (w) => /^0x[0-9a-fA-F]{40}$/.test(w || '');

function secret() {
  const s = process.env.SCORE_SECRET;
  if (!s || s.length < 16) throw new Error('SCORE_SECRET is not set');
  return s;
}
const mac = (body) => createHmac('sha256', secret()).update(body).digest('base64url');

export function makeTicket(wallet, level) {
  // kind: 'hunt' keeps the other sealed tokens (a challenge, a pass) from ever being played as a hunt ticket
  const t = { kind: 'hunt', w: wallet.toLowerCase(), seed: randomBytes(4).readUInt32LE(0), nonce: randomBytes(12).toString('base64url'), iat: Date.now(), week: weekId(), lv: level };
  const body = Buffer.from(JSON.stringify(t)).toString('base64url');
  return { ticket: `${body}.${mac(body)}`, seed: t.seed, level: t.lv };
}
export function readTicket(ticket) {
  const [body, sig] = String(ticket || '').split('.');
  if (!body || !sig) throw new Error('bad ticket');
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad ticket');
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}
// Small signed tokens for the "send MON to yourself" login: a challenge (wallet + exact amount + time) and,
// once the transfer is found on Monad, a weekly pass that stands in for the weekly signature.
export function seal(obj) { const body = Buffer.from(JSON.stringify(obj)).toString('base64url'); return `${body}.${mac(body)}`; }
export function unseal(token, kind) {
  const t = readTicket(token); // same HMAC check
  if (t.kind !== kind) throw new Error('bad token');
  return t;
}
export const CHALLENGE_LIFE = 20 * 60 * 1000; // the self-transfer has to be made within 20 minutes
export const makePass = (wallet) => seal({ kind: 'pass', w: wallet.toLowerCase(), week: weekId() });
// a wallet is proven for this week by its weekly signature, or by a pass from a self-transfer
export async function provenWallet({ wallet, week, signature, pass }, verifyMessage, lbMessage) {
  if (pass) { try { const p = unseal(pass, 'pass'); return p.w === wallet.toLowerCase() && p.week === week; } catch { return false; } }
  return verifyMessage({ address: wallet, message: lbMessage(wallet, week), signature }).catch(() => false);
}
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
