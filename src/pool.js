// The launch prize pool: real $CHOG for the top 10 of one week's boss board, paid automatically when the week ends.
// Shared by the site (to show it) and the payout function (to pay it).
export const POOL = {
  week: '2026-10-19',                                   // the boss week it pays (weeks start Monday 00:00 UTC)
  amount: 10000,                                         // $CHOG for the whole week
  token: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777',   // $CHOG on Monad, as listed on chog.xyz
  decimals: 18,
  minHunts: 3,                                           // a score needs at least this many boss hunts
  split: [0.25, 0.18, 0.13, 0.1, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04], // places 1 to 10
};
export const poolPrize = (rank) => Math.round(POOL.amount * (POOL.split[rank] || 0)); // rank from 0
