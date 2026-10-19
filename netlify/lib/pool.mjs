// Working out who wins the launch pool, and paying them.
// Rules: best-3 score from the boss board; at least POOL.minHunts hunts; the Chog that scored must have been in the
// same wallet when the pool opened (snapshot), so Chogs spread over new wallets afterwards don't count.
// Paying needs two settings in Netlify (never in the code): POOL_KEY, the key of a wallet that holds only the pool,
// and POOL_LIVE=yes. Without both it only writes a report of what it would send.
import { getStore } from '@netlify/blobs';
import { createWalletClient, createPublicClient, http, defineChain, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { POOL, poolPrize } from '../../src/pool.js';
import { RPC } from '../../src/chain.js';
import snapshot from './pool-snapshot.mjs';

const monad = defineChain({ id: 143, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const ERC20 = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
export const payouts = () => getStore({ name: 'payouts', consistency: 'strong' });

/** Who would be paid for the pool week right now: { winners: [...], skipped: [...] } */
export async function standings() {
  const store = getStore({ name: `boss-${POOL.week}`, consistency: 'strong' });
  const { blobs } = await store.list({ prefix: 'w/' });
  const entries = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean).sort((a, b) => b.dmg - a.dmg);
  const winners = [], skipped = [];
  for (const e of entries) {
    if (winners.length >= POOL.split.length) break;
    const why = e.hunts < POOL.minHunts ? `only ${e.hunts} of ${POOL.minHunts} hunts`
      : snapshot.owners[e.token] !== e.wallet ? `Chog #${e.token} was not in this wallet when the pool opened` : null;
    if (why) { skipped.push({ wallet: e.wallet, token: e.token, dmg: e.dmg, why }); continue; }
    winners.push({ rank: winners.length + 1, wallet: e.wallet, token: e.token, name: e.name, dmg: e.dmg, amount: poolPrize(winners.length) });
  }
  return { week: POOL.week, amount: POOL.amount, winners, skipped };
}

/** Pays the week once (safe to run again: places already paid are skipped). */
export async function payWeek() {
  const store = payouts();
  const report = (await store.get(POOL.week, { type: 'json' })) || { ...(await standings()), payments: {} };
  const live = process.env.POOL_LIVE === 'yes' && /^0x[0-9a-fA-F]{64}$/.test(process.env.POOL_KEY || '');
  report.mode = live ? 'live' : 'report only';
  report.ranAt = new Date().toISOString();
  if (live) {
    const account = privateKeyToAccount(process.env.POOL_KEY);
    const wallet = createWalletClient({ account, chain: monad, transport: http(RPC) });
    const chain = createPublicClient({ chain: monad, transport: http(RPC) });
    for (const w of report.winners) {
      if (report.payments[w.wallet]?.status === 'paid') continue;
      try {
        const hash = await wallet.writeContract({ address: POOL.token, abi: ERC20, functionName: 'transfer', args: [w.wallet, parseUnits(String(w.amount), POOL.decimals)] });
        const rc = await chain.waitForTransactionReceipt({ hash });
        report.payments[w.wallet] = { status: rc.status === 'success' ? 'paid' : 'failed', tx: hash, amount: w.amount };
      } catch (err) { report.payments[w.wallet] = { status: 'failed', error: String(err.shortMessage || err.message).slice(0, 200), amount: w.amount }; }
      await store.setJSON(POOL.week, report); // saved after every payment, so a rerun never pays twice
    }
    report.paidAt = new Date().toISOString();
  }
  await store.setJSON(POOL.week, report);
  return report;
}
