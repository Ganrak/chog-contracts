// Wallet connection, kept deliberately small. The page can only ever ask a wallet for three things:
//   1. eth_requestAccounts  - see the address (to look up its Chogs)
//   2. personal_sign        - sign a plain-text message proving the Chogs are yours (free, no gas)
//   3. wallet_revokePermissions - forget the connection
// There is no code here that sends a transaction, requests an approval or switches networks.

const KEY = 'chog-contracts-wallet';
const wallets = new Map();

// EIP-6963: every installed wallet announces itself, so we can list them by name and icon
addEventListener('eip6963:announceProvider', (e) => wallets.set(e.detail.info.uuid, e.detail));
const ask = () => dispatchEvent(new Event('eip6963:requestProvider'));
ask();

/** Installed wallets: [{ info: { name, icon, rdns }, provider }]. Falls back to window.ethereum. */
export function listWallets() {
  ask();
  const list = [...wallets.values()];
  if (!list.length && window.ethereum) list.push({ info: { name: 'Browser wallet', icon: '', rdns: 'injected' }, provider: window.ethereum });
  return list;
}

/** Asks the wallet for its address. Throws a readable Error if the player says no. */
export async function connect(w) {
  try {
    const [address] = await w.provider.request({ method: 'eth_requestAccounts' });
    if (!address) throw new Error('No address came back');
    save({ address, wallet: w.info.name, rdns: w.info.rdns });
    return address;
  } catch (err) {
    if (err?.code === 4001) throw new Error('You closed the wallet window. Nothing was shared.');
    throw new Error(err?.message || 'The wallet did not answer');
  }
}

/** The exact text the player signs: readable, dated, single-use, and says what it is not. */
export function ownershipMessage(address, tokens, nonce = randomNonce(), issuedAt = new Date().toISOString()) {
  return [
    `${location.host || 'chog-contracts'} wants you to confirm you own these Chogs:`,
    address,
    '',
    `Chogs: ${tokens.length ? tokens.map((t) => (typeof t === 'number' ? `#${t}` : t)).join(', ') : 'none yet'}`,
    '',
    'This is a signature, not a transaction.',
    'It costs no gas, moves nothing and approves nothing.',
    '',
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
  ].join('\n');
}
const randomNonce = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A rental offer: the owner lets hunters borrow one Chog. Off-chain, so cancelling is free and instant. */
export function listingMessage(address, token, name, { hours = 24, share = 30, nonce = randomNonce(), issuedAt = new Date().toISOString() } = {}) {
  return [
    `${location.host || 'chog-contracts'}: rent out ${name} (token ${token})`,
    address,
    '',
    `Hunters may borrow ${name} for ${hours} hours at a time.`,
    `You get ${share}% of every bounty it wins.`,
    'The NFT never leaves your wallet. You can cancel any time.',
    '',
    'This is a signature, not a transaction.',
    'It costs no gas, moves nothing and approves nothing.',
    '',
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
  ].join('\n');
}

/** Signs a plain-text message with personal_sign. `refused` is the text shown if the player says no. */
export async function signText(w, address, message, refused = 'You chose not to sign. Nothing changed.') {
  const hex = '0x' + [...new TextEncoder().encode(message)].map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    return await w.provider.request({ method: 'personal_sign', params: [hex, address] });
  } catch (err) {
    if (err?.code === 4001) throw new Error(refused);
    throw new Error(err?.message || 'The wallet did not sign');
  }
}

/** Asks for the ownership signature of `message` (the one the player was shown). Returns { message, signature }. */
export async function signOwnership(w, address, tokens, message = ownershipMessage(address, tokens)) {
  const signature = await signText(w, address, message, 'You chose not to sign. You can still hunt; signing only unlocks renting out and saving for good.');
  save({ ...load(), signed: { at: Date.now(), tokens } });
  return { message, signature };
}

/** Forgets the connection here, and asks the wallet to drop its permission where it supports that. */
export async function disconnect(w) {
  try { await w?.provider?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch {}
  try { localStorage.removeItem(KEY); } catch {}
}

export function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }
export const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
