// Log in without connecting a wallet: send an exact, odd amount of MON from your wallet to the same wallet.
// POST /api/self-verify { wallet }                   → { challenge, amount, wei, expires }
// POST /api/self-verify { wallet, challenge, tx }    → { pass, week }
// The MON never leaves your wallet (to === from); only gas is spent. Being able to move funds out of an address
// proves you hold its keys as well as a signature does. Each challenge has its own amount and a 5-minute window,
// and a transaction can be used only once. The pass stands in for the weekly signature until the week ends.
import { getStore } from '@netlify/blobs';
import { randomInt } from 'node:crypto';
import { seal, unseal, makePass, weekId, isWallet, json, CHALLENGE_LIFE } from '../lib/score.mjs';
import { RPC } from '../../src/chain.js';

const MON = 10n ** 18n;
const showMon = (wei) => { const s = wei.toString().padStart(19, '0'); return `${s.slice(0, -18)}.${s.slice(-18).replace(/0+$/, '')}`; };
async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (!res.ok) throw new Error(`Monad RPC answered ${res.status}`);
  const j = await res.json(); if (j.error) throw new Error(j.error.message || 'RPC error');
  return j.result;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const b = await req.json().catch(() => null);
  if (!b || !isWallet(b.wallet)) return json({ error: 'A wallet address is needed.' }, 400);
  const wallet = b.wallet.toLowerCase();

  // step 1: hand out an amount that is unique enough to match one transfer: 0.01 + up to 0.009999 MON
  if (!b.challenge) {
    const wei = MON / 100n + BigInt(randomInt(1, 10000)) * 10n ** 12n;
    try {
      const iat = Date.now();
      return json({ challenge: seal({ kind: 'ch', w: wallet, wei: wei.toString(), iat }), amount: showMon(wei), wei: wei.toString(), expires: iat + CHALLENGE_LIFE });
    } catch (err) { return json({ error: err.message }, 500); }
  }

  // step 2: find the transfer on Monad and check it
  let ch; try { ch = unseal(b.challenge, 'ch'); } catch { return json({ error: 'Start again: that code did not come from here.' }, 400); }
  if (ch.w !== wallet) return json({ error: 'This code was made for another address.' }, 403);
  if (Date.now() - ch.iat > CHALLENGE_LIFE) return json({ error: 'Time ran out. Get a new amount and send again.' }, 410);
  const tx = String(b.tx || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(tx)) return json({ error: 'Paste the transaction hash: 0x and 64 letters or numbers.' }, 400);

  let t, rc, block;
  try {
    [t, rc] = await Promise.all([rpc('eth_getTransactionByHash', [tx]), rpc('eth_getTransactionReceipt', [tx])]);
    if (!t || !rc) return json({ error: 'Monad does not show this transaction yet. Wait a few seconds and try again.' }, 404);
    block = await rpc('eth_getBlockByNumber', [rc.blockNumber, false]);
  } catch { return json({ error: 'Monad could not be read right now. Try again.' }, 503); }

  if (rc.status !== '0x1') return json({ error: 'That transaction failed on Monad.' }, 400);
  if (t.from?.toLowerCase() !== wallet) return json({ error: 'That transaction was not sent from this address.' }, 403);
  if (t.to?.toLowerCase() !== wallet) return json({ error: 'Send it to yourself: the "to" address has to be your own address.' }, 400);
  if (BigInt(t.value) !== BigInt(ch.wei)) return json({ error: `The amount has to be exactly ${showMon(BigInt(ch.wei))} MON.` }, 400);
  if (Number(BigInt(block.timestamp)) * 1000 < ch.iat - 60_000) return json({ error: 'That transaction is older than this code. Send a new one.' }, 400);

  const store = getStore({ name: 'self-verify', consistency: 'strong' });
  if (await store.get(`tx/${tx}`)) return json({ error: 'That transaction was already used.' }, 409);
  await store.set(`tx/${tx}`, wallet);
  try { return json({ pass: makePass(wallet), week: weekId() }); } catch (err) { return json({ error: err.message }, 500); }
};
export const config = { path: '/api/self-verify' };
