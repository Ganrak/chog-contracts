// The demo page's own code (moved out of demo.html so the Content-Security-Policy can forbid inline scripts).
import { buildKit, randomTraits, seeded, ELEMENTS } from './kit.js';
import { MONSTERS, monsterFromPost, remember, injure, injuredLeft, healNow, spendChog, grantChog, INJURY_H, HEAL_COST, tuckIn, tuckWait, TUCK_MIN, TUCK_EVERY_MIN, bounty, payBounty, chogBalance, fmtChog, dailyContracts, dailyState, winDaily, dayKey, loadProgress, saveProgress, fresh, xpToNext, hunterStats, matchup, settle, drink, loadBag, addPotion, usePotion, newOwner } from './game.js';
import { simulate, seededRand } from './combat.js';
import { lbMessage, cleanName } from './replay.js';
import { openHunt } from './arena.js';
import { POTIONS, rewardCan } from './potions.js';
import { mosaic, cutPieces, PALETTE } from './brick.js';
import { startBrickBuilder } from './brick3d.js';
import { startChogDrop } from './chogdrop.js';
import { startArcade } from './arcade.js';
import { startRunner } from './runner.js';
import { startGate } from './gate.js';
import { startHero } from './hero.js';
import { PLACES as TRIP_PLACES, TRIPS as TRIP_LENGTHS, SNACKS as TRIP_SNACKS, fastMode, setFastMode, planTrip, tripLeft, tripBack, tripResult } from './expedition.js';
import { tripMapSvg } from './tripmap.js';
import { rentalLog, demoOwnerStats, loadPaid, savePaid } from './rental.js';
import { wannabeLine, SLOTS as ROOM_SLOTS, ITEMS as ROOM_ITEMS, PAINTS as ROOM_PAINTS, COLORS as ROOM_COLORS, loadRoom, saveRoom, owns, fits } from './room.js';
import { readChog, walletChogs } from './chain.js';
import { startGlow } from './glow.js';
import { startGateLines } from './gatelines.js';import { play as sfx, sfxOn, setSfx } from './sfx.js';
import { drawShareCard, shareHunt, saveCard, shareImage } from './share.js';
import { musicOn, setMusic } from './music.js';
import { startMotion as startTouches } from './motion.js';
import { listWallets, connect, ownershipMessage, signOwnership, listingMessage, signText, disconnect, load as loadWallet, short } from './wallet.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// image addresses from NFT metadata: only our own files, https or inline images, and always escaped
const img = (u) => esc(/^(https:\/\/|assets\/|data:image\/)/.test(String(u || '')) ? u : '');
const wait = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(ms, 120) : ms));

/* ---------- hunters: the Wannabe for everyone, plus the Chogs you bring or hire. SAMPLES are three real Chogs
   (traits as read from Chog Genesis metadata) used only as art: the gate cards and the Brick Studio sample ---------- */
const SAMPLES = [
  { id: '812', token: 812, name: 'CHOG #304', img: 'assets/chogs/812.webp',
    traits: { Background: 'Rosie', Base: 'Origin', Skin: 'Pink', Side: 'Left', Body: 'Red Sleeveless', Mouth: 'normal smile', Eyes: 'Clown Eye', Head: 'Mon Beanie', Form: 'Chog', Tier: 'Uncommon', Naked: 'No' } },
  { id: '68', token: 68, name: 'CHOG #1529', img: 'assets/chogs/68.webp',
    traits: { Background: 'Light Purple', Aura: 'Fiery Aura', Base: 'Origin', Skin: 'Yellow', Side: 'Right', Body: 'Astro Suit', Mouth: 'wo', Eyes: 'fire laser', Form: 'Chog', Tier: 'Common', Naked: 'No' } },
  { id: '61', token: 61, name: 'CHOG #1522', img: 'assets/chogs/61.webp',
    traits: { Background: 'Lemon', Aura: 'Pink Mist', Base: 'Skull', Skin: 'White', Side: 'Right', Body: 'CEO Vest', Eyes: 'fire laser', Head: 'BOOB Cap', Form: 'Skull', Tier: 'Rare', Naked: 'No' } },
];
const HUNTERS = [
  { id: 'ghost', token: null, name: 'Wannabe Chog', ghost: true, traits: randomTraits(seeded(`ghost-${new Date().toISOString().slice(0, 10)}`)) },
];
// players without an NFT all hunt as the Apprentice (a kid in a homemade cardboard Chog mask); holders hunt as their own NFT
const SPRITE = '<img class="pix" src="assets/chogs/apprentice.png" alt="The Wannabe Chog: a kid in a homemade paper-bag Chog mask">';
const APPR_FACE = '<img class="pix" src="assets/chogs/apprentice-face.png" alt="">';
// in the arena the Apprentice is animated: an attack strip and a poses strip (idle, cheer, hit, defeated), 4 frames each
const APPR_ARENA = '<div class="strip appr-strip posing" style="aspect-ratio:480/512"><img class="atk" src="assets/chogs/apprentice-attack.png" alt=""><img class="pose" src="assets/chogs/apprentice-poses.png" alt="The Wannabe Chog"></div>';
const art = (h) => (h.ghost ? SPRITE : `<img src="${img(h.img)}" alt="${esc(h.name)}, token ${esc(h.token)}">`);

/* ---------- monsters, drawn by hand ---------- */
const MON_COLOR = { ghoul: '#7FA35B', troll: '#A08C55', thief: '#7A63B8', golem: '#B0703F', harpy: '#D9708F', wyrm: '#C23A48', wraith: '#8E8AA6' };
// hand-drawn enemies (cut from one ChatGPT sheet by scripts/cut-sheet.ps1); harpy and wyrm face right, so the arena mirrors them
// in the arena each enemy is its attack strip (scripts/cut-frames.ps1): 300 px per frame, height per enemy
const STRIP_H = { ghoul: 248, troll: 227, thief: 218, golem: 230, harpy: 213, wyrm: 202, wraith: 198 };
const STRIP_FLIP = new Set(['wyrm']); // the wyrm breathes to the right in the sheet
const monsterArt = (kind, inArena = false) => {
  const k = kind in MON_COLOR ? kind : 'wraith';
  if (!inArena) return `<img class="mon" src="assets/monsters/${k}.png" alt="">`;
  return `<div class="strip${STRIP_FLIP.has(k) ? ' flip' : ''}" style="aspect-ratio:300/${STRIP_H[k]}"><img src="assets/monsters/attack/${k}.png" alt=""></div>`;
};

/* ---------- Chogs brought from Monad (kept in this browser) ----------
   Ownership: a Chog is yours when the wallet you CONNECTED holds it (a wallet only connects for the person who
   controls it) or you signed for it. A pasted address or token id only gives a preview: anyone can paste anyone's.
   Previews show the card and moves but can't hunt, travel, decorate or be built. (Demo: kept in this browser;
   the full game checks the wallet and signature on a server.) */
const OWNED_KEY = 'chog-contracts-owned';
const ownedTokens = () => { let a = []; try { a = JSON.parse(localStorage.getItem(OWNED_KEY)) || []; } catch {} return [...new Set([...a, ...verifiedTokens(), ...whaleTest()])]; };
// "Try whale mode" (account menu): six test Chogs, so anyone can see what a big holder gets. Kept apart from the wallet's own list.
const WHALE_KEY = 'chog-contracts-whale-test';
const whaleTest = () => { try { return JSON.parse(localStorage.getItem(WHALE_KEY)) || []; } catch { return []; } };
const setOwned = (tokens) => { try { localStorage.setItem(OWNED_KEY, JSON.stringify(tokens)); } catch {} };
const isOwned = (h) => !!h && !h.ghost && !h.hired && ownedTokens().includes(h.token);
const isPreview = (h) => !!h && !!h.brought && !isOwned(h);
const BROUGHT_KEY = 'chog-contracts-brought';
const MAX_CHOGS = 60; // a whale's whole stable, within reason
const asHunter = (c) => ({ id: `t${c.tokenId}`, token: c.tokenId, name: c.name, img: c.image, traits: c.traits, brought: true });
/** Adds Chogs read from Monad; a token already on the list is refreshed, not doubled. Returns the entries. */
function addHunters(list) {
  return list.map((h) => {
    const i = HUNTERS.findIndex((x) => x.token === h.token);
    if (i < 0) { HUNTERS.splice(HUNTERS.length - 1, 0, h); return h; } // the ghost stays last
    if (HUNTERS[i].brought) HUNTERS[i] = h; else HUNTERS[i].traits = h.traits; // built-in demo Chogs keep their local art
    return HUNTERS[i];
  });
}
try { addHunters(JSON.parse(localStorage.getItem(BROUGHT_KEY)) || []); } catch {}
const saveBrought = () => { try { localStorage.setItem(BROUGHT_KEY, JSON.stringify(HUNTERS.filter((h) => h.brought))); } catch {} };

/* ---------- hunters for hire (test mode: the hire lives in this browser, nothing is signed or paid) ---------- */
const HIRE_KEY = 'chog-contracts-hired', HIRE_MS = 24 * 3600 * 1000, OWNER_CUT = 0.3;
const FOR_HIRE = [
  { token: 2, name: 'CHOG #1463', img: 'assets/chogs/2.webp', traits: { Background: 'Sunlight', Aura: 'Aqua Aura', Base: 'Origin', Skin: 'Origin', Side: 'Left', Body: 'Mon Hoodie', Mouth: 'Flat', Eyes: 'Modern VR', Head: 'Chog Cap', Form: 'Chog', Tier: 'Uncommon', Naked: 'No' } },
  { token: 164, name: 'CHOG #1625', img: 'assets/chogs/164.webp', traits: { Background: 'Sky Blue', Aura: 'Yellow Aura', Base: 'Origin', Skin: 'Yellow', Side: 'Right', Body: 'Black Trackset', Mouth: 'Smile', Eyes: 'Anime Glass', Head: 'Peace hat', Form: 'Chog', Tier: 'Common', Naked: 'No' } },
  { token: 43, name: 'CHOG #1504', img: 'assets/chogs/43.webp', traits: { Background: 'Rosie', Aura: 'Wind', Base: 'Origin', Skin: 'Origin', Side: 'Left', Body: 'Red jacket', Mouth: 'Smile', Eyes: 'Chog Viper', Head: 'Mon Cap', Form: 'Chog', Tier: 'Uncommon', Naked: 'No' } },
  { token: 66, name: 'CHOG #1527', img: 'assets/chogs/66.webp', traits: { Background: 'Light Magenta', Aura: 'Royal Aura', Base: 'Origin', Skin: 'Origin', Side: 'Right', Body: 'Duck Float', Mouth: 'Lip Bite', Eyes: 'Anime Glass', Head: 'Crown', Form: 'Chog', Tier: 'Common', Naked: 'No' } },
].map((c) => ({ ...c, id: `h${c.token}`, element: buildKit(c.traits).element }));
let hires = (() => { try { return JSON.parse(localStorage.getItem(HIRE_KEY)) || {}; } catch { return {}; } })();
const saveHires = () => { try { localStorage.setItem(HIRE_KEY, JSON.stringify(hires)); } catch {} };
const hoursLeft = (h) => Math.max(0, Math.ceil(((hires[h.token] || 0) - Date.now()) / 3600000));
/** Keeps the hunters list in step with the hires: active hires join (before the apprentice), expired ones leave. */
function syncHires() {
  for (const c of FOR_HIRE) {
    const active = (hires[c.token] || 0) > Date.now(), i = HUNTERS.findIndex((h) => h.id === c.id);
    if (active && i < 0) HUNTERS.splice(HUNTERS.length - 1, 0, { ...c, hired: true });
    if (!active && i >= 0) { HUNTERS.splice(i, 1); delete hires[c.token]; if (current?.id === c.id) current = HUNTERS[0]; }
  }
  saveHires();
}
function hire(token) {
  hires[token] = Date.now() + HIRE_MS; syncHires(); sfx('coin');
  current = HUNTERS.find((h) => h.token === token && h.hired);
  try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
  renderAll(); renderHire(); payRentals(); // rentals that finished while you were away get paid now
  document.getElementById('board-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderHire() {
  $('#hire').innerHTML = FOR_HIRE.map((c) => {
    const k = buildKit(c.traits, { name: c.name }), E = k.elementInfo, left = hoursLeft(c), st = hunterStats(c, prog(c));
    return `<article class="offer${left ? ' hired' : ''}" id="offer-${c.token}" style="--c:${E.color}">
      <img src="${img(c.img)}" alt="${esc(c.name)}, token ${c.token}">
      <div><h3>${esc(c.name)}</h3><p>${esc(k.classInfo.name)} · Power ${st.power}</p>${(() => { const s = demoOwnerStats(c.token); return `<p class="own-earn">Owner earned <b>${fmtChog(s.earned)} $CHOG</b> from ${s.rentals} rentals</p>`; })()}
      <div class="row"><span class="chip" style="--c:${E.color}"><i></i>${E.name}</span>${left
        ? `<button type="button" class="btn ghost" data-use="${c.token}">Hunt · ${left} h left</button>`
        : `<button type="button" class="btn" data-hire="${c.token}">Hire 24 h</button>`}</div></div>
    </article>`;
  }).join('') + listings.map((l) => { // your own offers sit in the same market; you can't hire your own Chog
    const k = buildKit(l.traits, { name: l.name }), E = k.elementInfo;
    return `<article class="offer yours" style="--c:${E.color}">
      <img src="${img(l.img)}" alt="${esc(l.name)}, token ${esc(l.token)}">
      <div><h3>${esc(l.name)}</h3><p>${E.name} ${esc(k.classInfo.name)} · your listing · since ${when(l.at)}</p>
      <div class="row"><span class="chip" style="--c:var(--pink)"><i></i>Yours</span><button type="button" class="btn ghost" data-unlist="${l.token}">Unlist</button></div></div>
    </article>`;
  }).join('');
  renderMine(); renderEarn();
}
$('#hire').addEventListener('click', (e) => {
  const h = e.target.closest('[data-hire]'), u = e.target.closest('[data-use]');
  if (h) hire(Number(h.dataset.hire));
  if (u) { current = HUNTERS.find((x) => x.token === Number(u.dataset.use) && x.hired); renderAll(); document.getElementById('board-title').scrollIntoView({ behavior: 'smooth' }); }
});

/* ---------- state ---------- */const progress = loadProgress();
const prog = (h) => (progress[h.id] ||= fresh());
let current = HUNTERS[0];
syncHires();
try { const saved = localStorage.getItem('chog-contracts-demo-hunter'); if (saved) current = HUNTERS.find((h) => h.id === saved) || current; } catch {}
// the board: the training Ghoul, today's two contracts, (a forged one), and the weekly boss last
const TRAINING = { ...MONSTERS[0], training: true }, BOSS = MONSTERS.find((m) => m.boss);
let today = dayKey();
const contracts = [TRAINING, ...dailyContracts(today), BOSS];
// a new day while the page is open: swap in the new pair
setInterval(() => {
  if (dayKey() === today) { paintDaily(); return; }
  today = dayKey();
  const fresh2 = dailyContracts(today), at = contracts.findIndex((m) => m.daily);
  contracts.splice(at, 2, ...fresh2); renderBoard();
}, 30000);
let bossLeft = 0.62; // community health bar of the Wild Hunt (sample start)

/* ---------- rendering ---------- */
const avatar = (h) => (h.ghost ? APPR_FACE : `<img src="${img(h.img)}" alt="">`);
function renderMe() {
  const st = hunterStats(current, prog(current)), p = prog(current);
  $('#me').innerHTML = `<span class="av">${avatar(current)}<i class="dot${wAddr ? ' on' : ''}" title="${wAddr ? 'Wallet connected' : 'No wallet connected'}"></i></span>
    <div><b>${esc(current.name)}</b><br><span>Lv ${p.level} · Power ${st.power} · ${fmtChog(chogBalance())} $CHOG</span></div><i class="caret" aria-hidden="true"></i>`;
  $('#me').setAttribute('aria-label', `Your account: hunting as ${current.name}, ${fmtChog(chogBalance())} $CHOG${wAddr ? ', wallet connected' : ''}`);
  if (!$('#acct').hidden) renderAcct();
}

/* ---------- account panel: wallet, balance, every hunter you can use, shortcuts ---------- */
function renderAcct() {
  const ds = dailyState(), all = HUNTERS.map((h) => prog(h));
  const hunts = all.reduce((n, p) => n + (p.log?.length || 0), 0), trophies = all.reduce((n, p) => n + Object.values(p.trophies).reduce((a, b) => a + b, 0), 0);
  const v = verifiedTokens();
  $('#acct').innerHTML = `
    <div class="a-head">
      <span class="av">${avatar(current)}</span>
      <div class="who"><b${wAddr && !myName() ? ' class="addr"' : ''}>${wAddr ? esc(myName() || short(wAddr)) : 'Guest hunter'}</b>
        <span>${wAddr ? `${v.length ? `${v.length} verified Chog${v.length > 1 ? 's' : ''}` : 'Not verified yet'}` : 'No wallet: progress stays in this browser'}</span><br>
        <span class="a-badge${wAddr ? ' on' : ''}">${wAddr ? 'Wallet connected' : 'Not connected'}</span></div>
      ${wAddr ? '<button type="button" class="btn ghost" data-a="disconnect">Disconnect</button>' : '<button type="button" class="btn" data-a="connect">Connect</button>'}
    </div>
    ${wAddr ? `<form class="a-name" data-a-form="name"><label for="a-name-in">Hunter name <small>shown on the weekly board</small></label>
      <div><input id="a-name-in" maxlength="16" autocomplete="off" spellcheck="false" placeholder="e.g. FUD Slayer" value="${esc(myName() || '')}"><button type="submit" class="btn">Save</button></div>
      <p class="a-name-msg" aria-live="polite"></p></form>` : ''}
    <div class="a-bal">
      <div class="gold"><b>${fmtChog(chogBalance())}</b><span>$CHOG (test)</span></div>
      <div><b>${ds.streak}</b><span>Day streak</span></div>
      ${listings.length ? `<div><b>${fmtChog(rentals().reduce((s, r) => s + r.log.earned, 0))}</b><span>From rentals</span></div>` : ''}
      <div><b>${trophies}</b><span>${trophies === 1 ? 'Trophy' : 'Trophies'} · ${hunts} ${hunts === 1 ? 'hunt' : 'hunts'}</span></div>
    </div>
    <div><p class="j-h">Your hunters</p></div>
    <ul class="a-list">${HUNTERS.map((h) => {
      const p = prog(h), E = hunterStats(h, p).kit.elementInfo, t = Object.values(p.trophies).reduce((a, b) => a + b, 0);
      const tag = h.ghost ? '<em>No NFT</em>' : h.hired ? `<em class="h">Hired · ${hoursLeft(h)} h</em>` : v.includes(h.token) ? '<em class="v">Verified</em>' : h.brought ? '<em>Loaded</em>' : '<em>Demo</em>';
      return `<li><button type="button" data-a="pick" data-id="${esc(h.id)}" aria-current="${h === current}" style="--c:${E.color}">${avatar(h)}
        <span><b>${esc(h.name)}</b><small>Lv ${p.level} · ${E.name} · ${t} ${t === 1 ? 'trophy' : 'trophies'}</small></span>${tag}</button></li>`;
    }).join('')}</ul>
    <div class="a-links">
      <button type="button" data-a="journal">Journal</button>
      <button type="button" data-a="whale" class="a-whale">${whaleTest().length ? 'Leave whale mode' : 'Try whale mode'}</button>
      <button type="button" data-a="go" data-to="${v.length ? 'mine' : 'hire-title'}">${v.length ? 'Rent out a Chog' : 'Hire a hunter'}</button>
      <button type="button" data-a="go" data-to="safety-title">Safety</button>
    </div>
    <div class="a-foot"><p>Test mode: nothing here is on-chain yet.</p><button type="button" class="a-reset" data-a="reset">Reset demo</button></div>`;
}
function toggleAcct(open = $('#acct').hidden) {
  $('#acct').hidden = !open; $('#me').setAttribute('aria-expanded', String(open));
  if (open) { renderAcct(); sfx('click'); }
}
$('#me').addEventListener('click', () => toggleAcct());
document.addEventListener('click', (e) => { if (!$('#acct').hidden && !e.target.closest('.acct-wrap')) toggleAcct(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#acct').hidden) { toggleAcct(false); $('#me').focus(); } });
$('#acct').addEventListener('submit', async (e) => { // the hunter name
  if (!e.target.matches('[data-a-form="name"]')) return;
  e.preventDefault();
  const msg = e.target.querySelector('.a-name-msg'), btn = e.target.querySelector('button');
  btn.disabled = true; msg.textContent = 'Saving…';
  const said = await saveName(e.target.querySelector('input').value);
  renderAcct(); renderLeaderboard();
  const again = $('#acct .a-name-msg'); if (again) again.textContent = said;
});
$('#acct').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'connect') { toggleAcct(false); openWallet(); }
  if (a === 'disconnect') { try { localStorage.removeItem(PASS_KEY); } catch {} await disconnect(wActive); wActive = null; wAddr = null; wTokens = []; setOwned([]); paintConnect(); renderAll(); renderHire(); renderAcct(); }
  if (a === 'pick') {
    current = HUNTERS.find((h) => h.id === b.dataset.id) || current;
    try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
    renderAll(); toggleAcct(false); openProfile(current); // picking a hunter here also shows its profile
  }
  if (a === 'journal') { toggleAcct(false); openProfile(current); }
  if (a === 'whale') { // add or remove the six test Chogs, then reload so the door greets the whale
    const on = whaleTest(), ids = new Set(on.map((tok) => `t${tok}`));
    if (on.length) { for (let i = HUNTERS.length - 1; i >= 0; i--) if (ids.has(HUNTERS[i].id)) HUNTERS.splice(i, 1); listings = listings.filter((l) => !on.includes(l.token)); saveListings(); try { localStorage.removeItem(WHALE_KEY); } catch {} }
    else {
      const art = ['812', '68', '61', '2', '43', '66'], base = SAMPLES.map((s) => s.traits);
      const set = art.map((a, i) => ({ id: `t${9001 + i}`, token: 9001 + i, name: `Test Chog ${i + 1}`, img: `assets/chogs/${a}.webp`, traits: { ...base[i % 3], Aura: ['Electric Aura', 'Mint Aura', 'Aqua Aura', 'Fiery Aura', 'Royal Aura', 'Smoke Aura'][i] }, brought: true })); // six different elements, so auto-pick has choices
      addHunters(set); try { localStorage.setItem(WHALE_KEY, JSON.stringify(set.map((h) => h.token))); } catch {}
    }
    saveBrought(); location.reload();
  }
  if (a === 'go') { toggleAcct(false); document.getElementById(b.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (a === 'reset') {
    if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Tap again to erase'; setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Reset demo'; }, 3000); return; }
    // keep only the sound settings; everything else this demo saved goes
    try { Object.keys(localStorage).filter((k) => k.startsWith('chog-contracts') && !/-(sfx|music)$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
    location.reload();
  }
});
// one short line per class for the hunter cards (the full move list lives in the fight)
const ROLE_LINE = { Damage: 'hits hard', Defense: 'takes the hits', Support: 'keeps the team up', Control: 'makes monsters miss turns', Chaos: 'unpredictable', Balanced: 'good at everything' };
/* ---------- a whale's stable: with 4+ Chogs of your own the big cards become a compact grid with a summary,
   an element filter and one button to rent out every idle Chog ---------- */
const STABLE_AT = 4;
let stableFilter = 'all';
const statusOf = (h) => { const p = prog(h); return p.trip ? ['away', tripBack(p.trip) ? 'Back!' : 'Away'] : injuredLeft(p) ? ['hurt', 'Injured'] : listings.some((l) => l.token === h.token) ? ['earn', 'Earning'] : h.hired ? ['hired', 'Hired'] : ['ready', 'Ready']; };
function renderStable() {
  const owned = HUNTERS.filter((h) => h.brought && isOwned(h)), count = { ready: 0, earn: 0, hurt: 0, away: 0 };
  for (const h of owned) { const s = statusOf(h)[0]; if (s in count) count[s] += 1; }
  const els = [...new Set(HUNTERS.map((h) => hunterStats(h, prog(h)).kit.element))];
  if (stableFilter !== 'all' && !els.includes(stableFilter)) stableFilter = 'all';
  const shown = HUNTERS.filter((h) => stableFilter === 'all' || hunterStats(h, prog(h)).kit.element === stableFilter);
  const idle = idleOwned().length;
  $('#hunters').classList.add('is-stable');
  $('#hunters').innerHTML = `<div class="stable-head">
      <div><b>Your stable</b><span>${owned.length} Chogs · ${count.ready} ready${count.earn ? ` · ${count.earn} earning` : ''}${count.hurt ? ` · ${count.hurt} injured` : ''}${count.away ? ` · ${count.away} away` : ''}</span></div>
      ${idle > 1 ? `<button type="button" class="btn ghost" data-rent-all>Rent out all ${idle} idle</button>` : ''}
      <div class="stable-filter" role="group" aria-label="Filter by element"><button type="button" data-sfilter="all" aria-pressed="${stableFilter === 'all'}">All</button>${els.map((e) => `<button type="button" data-sfilter="${e}" aria-pressed="${stableFilter === e}" style="--c:${ELEMENTS[e].color}"><i></i>${ELEMENTS[e].name}</button>`).join('')}</div>
    </div>
    <div class="stable-grid">${shown.map((h) => { const p = prog(h), st = hunterStats(h, p), E = st.kit.elementInfo, [sk, sl] = statusOf(h);
      return `<button type="button" class="tile" data-id="${h.id}" aria-pressed="${h === current}" style="--c:${E.color}"><span class="t-art">${art(h)}</span><b>${esc(h.ghost ? 'Wannabe' : h.name)}</b><small>${E.name} · ${st.power}</small><i class="t-st ${sk}">${sl}</i></button>`; }).join('')}</div>`;
}
function renderHunters() {
  if (HUNTERS.filter((h) => h.brought && isOwned(h)).length >= STABLE_AT) { renderStable(); return; }
  $('#hunters').classList.remove('is-stable');
  $('#hunters').innerHTML = HUNTERS.map((h) => {
    const p = prog(h), st = hunterStats(h, p), k = st.kit, E = k.elementInfo;
    const trophies = Object.values(p.trophies).reduce((a, b) => a + b, 0);
    return `<button type="button" class="hunter" data-id="${h.id}" aria-pressed="${h === current}" style="--c:${E.color}">
      <div class="art">${art(h)}<span class="info" data-prof title="Profile and journal" aria-hidden="true">i</span>${p.trip ? `<span class="away-tag">${tripBack(p.trip) ? 'Back!' : 'Away'}</span>` : injuredLeft(p) ? '<span class="hurt-tag">Injured</span>' : ''}<span class="tag">${h.ghost ? 'No NFT' : h.hired ? `Hired · ${hoursLeft(h)} h left` : `${listings.some((l) => l.token === h.token) ? 'Earning' : isOwned(h) ? 'Yours' : h.brought ? 'Preview' : 'Chog'}`}</span></div>
      <div><h3>${esc(h.name)}</h3><p class="tok">${h.ghost ? 'Free trial · no NFT needed' : h.hired ? `Owner keeps ${OWNER_CUT * 100}% of the loot` : `${esc(k.classInfo.name)} · ${esc(k.tier)}`}</p></div>
      <div class="row"><span class="chip" style="--c:${E.color}"><i></i>${E.name}</span><span class="pw">${st.power}<small>POWER</small></span></div>
      <p class="feats"><b style="color:${E.color}">${E.name}</b> ${esc(E.effect)}<br><b>${esc(k.classInfo.name)}</b> ${esc(ROLE_LINE[k.classInfo.role] || '')}</p>
      <div><div class="row"><span class="lv">Lv ${p.level} · ${trophies} trophies</span><span class="lv">${p.xp}/${xpToNext(p.level)} XP</span></div><div class="xp" style="--w:${(p.xp / xpToNext(p.level) * 100).toFixed(0)}%"><i></i></div></div>
    </button>`;
  }).join('') + (HUNTERS.some((h) => !h.ghost) ? '' : `<button type="button" class="hunter slot" data-slot="connect"><span class="plus">+</span><div><h3>Your Chog</h3><p class="tok">Connect your wallet and it hunts as itself. No Chog? Hire one below.</p></div></button>`);
}
// auto-pick (on unless switched off): with 2+ Chogs, a contract goes to the best ready one for it
const AUTO_KEY = 'chog-contracts-autopick';
const autoPickOn = () => { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch { return true; } };
$('#daily').addEventListener('change', (e) => { if (!e.target.matches('[data-autopick]')) return; try { localStorage.setItem(AUTO_KEY, e.target.checked ? '1' : '0'); } catch {} renderBoard(); });
// the strip above the board: streak and time until the next pair
function paintDaily() {
  const ds = dailyState(), left = dailyContracts(today).filter((m) => !ds.done.includes(m.id)).length;
  const mid = new Date(); mid.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((mid - Date.now()) / 60000)), h = Math.floor(mins / 60), mm = mins % 60;
  const bonus = Math.min(50, ds.streak * 10);
  $('#daily').innerHTML = `
    <div class="d-streak${ds.streak ? ' on' : ''}"><b>${ds.streak}</b><span>day streak${ds.streak ? ` · +${bonus}% XP` : ''}</span></div>
    <p>${left ? `<b>${left} of 2</b> contracts left today.` : '<b>Both cleared today.</b>'} ${ds.clearedToday ? 'Streak safe for today.' : ds.streak ? 'Clear one today to keep the streak.' : 'Clear one a day to start a streak.'}</p>
    <span class="d-next">New contracts in ${h} h ${String(mm).padStart(2, '0')} min</span>
    ${HUNTERS.filter((x) => !x.ghost && (isOwned(x) || x.hired)).length > 1 ? `<label class="d-auto" title="Each contract goes to your best ready Chog for it: the right element first, then power"><input type="checkbox" data-autopick ${autoPickOn() ? 'checked' : ''}> Auto-pick the best Chog</label>` : ''}`;
}
function renderBoard() {
  const st = hunterStats(current, prog(current)), lvl = prog(current).level, ds = dailyState();
  const hurt = injuredLeft(prog(current)), away = !!prog(current).trip; // away on an expedition (or back but not unpacked)
  paintDaily(); paintHurt();
  // with several Chogs of your own, each contract names the best one for it (element first, then power)
  const squad = HUNTERS.filter((h) => !h.ghost && (isOwned(h) || h.hired) && ['ready', 'hired'].includes(statusOf(h)[0])).map((h) => ({ h, s: hunterStats(h, prog(h)) }));
  const score = (s, m) => s.power * matchup(s, m).mult;
  const curOk = !current.ghost && !hurt && !away && !isPreview(current);
  $('#board').innerHTML = contracts.map((m, i) => {
    const best = squad.length > 1 ? squad.reduce((a, b) => (score(b.s, m) > score(a.s, m) ? b : a)) : null;
    const better = best && best.h !== current && (!curOk || score(best.s, m) > score(st, m) * 1.05) ? best : null;
    // auto-pick: this contract goes to the best ready Chog you have (it's named on the button), unless switched off
    const auto = autoPickOn() && better ? better : null;
    const H = auto ? auto.h : current, S = auto ? auto.s : st, L = prog(H).level, hHurt = auto ? 0 : hurt, hAway = auto ? false : away;
    // odds = how often the autopilot wins this fight; smart play beats it
    const mu = matchup(S, m), pct = Math.round(simulate(S, m, { level: L, ghost: !!H.ghost }, 120) * 100);
    // the Apprentice is the free trial: training + today's easy contract. The rest needs a Chog (yours or hired)
    const chogOnly = !!H.ghost && !(m.training || (m.daily && m.id.endsWith('-0'))), locked = chogOnly || (m.boss && L < m.unlock);
    const preview = isPreview(H); // someone else's Chog, pasted: look, don't play
    const hire = FOR_HIRE.find((c) => c.element === m.weak && !hoursLeft(c)) || FOR_HIRE.find((c) => !hoursLeft(c));
    const col = pct >= 65 ? 'var(--good)' : pct >= 40 ? 'var(--ember)' : 'var(--bad)';
    // only say something the chip doesn't already say
    const note = mu.mult > 1 ? `${auto ? esc(H.name) + '\'s' : 'Your'} ${ELEMENTS[S.kit.element].name} hits its weak spot` : mu.mult < 1 ? `It shrugs off ${ELEMENTS[S.kit.element].name}` : '';
    const P = POTIONS[m.reward];
    return `<article class="contract ${m.boss ? 'boss' : ''}${m.custom ? ' mine' : ''}${chogOnly ? ' chog-lock' : ''}" style="--c:${MON_COLOR[m.kind] || MON_COLOR.wraith}">
      <div class="art">${monsterArt(m.kind)}</div>
      <p class="eyebrow">${m.boss ? 'Weekly · shared boss' : m.custom ? 'Forged from your post' : m.daily ? 'Today\'s contract' : 'Training contract'}${m.daily && ds.done.includes(m.id) ? ' <span class="done">Cleared</span>' : ''}</p>
      <h3>${esc(m.name)}</h3>
      <q>${m.forge ? marked(m.quote, m.forge.words) : esc(m.quote)}</q>
      ${m.forge ? `<p class="why">${skulls(m.forge.level)} FUD level ${m.forge.level} · ${esc(m.forge.why)}</p>` : ''}
      <div class="row"><span class="chip" style="--c:${ELEMENTS[m.weak].color}"><i></i>Weak ${ELEMENTS[m.weak].name}</span><span class="reward" style="--c:${P.color}" title="Drops a ${P.name} potion: ${esc(P.effect)}"><i></i>+ ${P.name} potion</span></div>
      ${m.boss ? `<div class="shared"><div class="bar" style="--w:${(bossLeft * 100).toFixed(1)}%"><i></i></div><span>Everyone hits the same boss · weak spot changes every Monday (next: ${ELEMENTS[m.nextWeak]?.name || ''})</span></div>` : ''}
      <div class="odds">${chogOnly ? '<div><span>Needs a Chog</span></div>' : locked ? `<div><span>Unlocks at level ${m.unlock}</span></div>` : `<div title="How often your hunter wins this on autopilot. Playing it yourself does better."><b style="color:${col}">${pct}%</b> <span>win chance</span></div>`}<span class="bounty">${fmtChog(bounty(m))} $CHOG</span></div>
      ${note && !chogOnly ? `<p class="lv">${esc(note)}</p>` : ''}
      ${chogOnly ? `<p class="lv lock-why">The Wannabe only trains. This one needs a real Chog: yours or a hired one.</p>${hire ? `<button type="button" class="hint-hire" data-scroll-hire="${hire.token}">Hire a Chog for this</button>` : ''}` : ''}
      ${!chogOnly && mu.mult <= 1 && FOR_HIRE.some((c) => c.element === m.weak && !hoursLeft(c)) ? `<button type="button" class="hint-hire" data-scroll-hire="${FOR_HIRE.find((c) => c.element === m.weak).token}">No ${ELEMENTS[m.weak].name} Chog? Hire one</button>` : ''}
      ${better && !auto ? `<button type="button" class="hint-best" data-best="${better.h.id}">Best for this: ${esc(better.h.name)} (${better.s.kit.elementInfo.name})</button>` : ''}
      ${preview ? '<button type="button" class="btn" data-verify>Connect wallet to play</button>' : `<button type="button" class="btn${auto ? ' auto' : ''}" data-hunt="${i}"${auto ? ` data-auto="${H.id}"` : ''} ${locked || hHurt || hAway ? 'disabled' : ''}>${chogOnly ? 'Chog only' : hAway ? (tripBack(prog(H).trip) ? 'Back! Unpack in the room' : 'On an expedition') : hHurt ? `Injured · ${dur(hHurt)}` : locked ? `Reach level ${m.unlock}` : auto ? `Hunt with ${esc(H.name)} · ${S.kit.elementInfo.name}` : 'Hunt'}</button>`}
    </article>`;
  }).join('');
}
// injuries: 3 h for the Wannabe and hired Chogs, 1.5 h for a Chog you own
const injuryHours = (h) => (isOwned(h) ? INJURY_H.owner : INJURY_H.other);
const dur = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
// the injury strip above the board: time left, and a healer for test $CHOG
let hurtShown = false;
function paintHurt() {
  const bar = $('#hurt'), p = prog(current), left = injuredLeft(p);
  hurtShown = left > 0; bar.hidden = !hurtShown; if (!hurtShown) return;
  const can = chogBalance() >= HEAL_COST && !isPreview(current);
  bar.innerHTML = `<span class="h-ico">✚</span><p><b>${esc(current.name)} is injured</b> · back in ${dur(left)}. Rest, switch hunter, or pay the healer.</p>
    <button type="button" class="btn" id="heal" ${can ? '' : 'disabled'}>${can ? `Heal now · ${fmtChog(HEAL_COST)} $CHOG` : `Healer needs ${fmtChog(HEAL_COST)} $CHOG`}</button>`;
}
$('#hurt').addEventListener('click', (e) => {
  if (!e.target.closest('#heal')) return;
  if (!isPreview(current) && healNow(prog(current))) { saveProgress(progress); sfx('heal'); renderAll(); }
});
setInterval(() => {
  const hired = HUNTERS.filter((h) => h.hired).length; syncHires(); // a 24 h hire runs out even with the tab open
  if (hired !== HUNTERS.filter((h) => h.hired).length) { renderAll(); renderHire(); return; }
  if (hurtShown !== injuredLeft(prog(current)) > 0) renderAll(); else if (hurtShown) renderBoard();
}, 20000);
/* ---------- Chog Journal ---------- */
const KIND_NAME = { ghoul: 'Ghoul', troll: 'Troll', thief: 'Thief', golem: 'Golem', harpy: 'Harpy', wyrm: 'Wyrm', wraith: 'Wraith' };
const when = (t) => new Date(t).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
/* the journal lives in a profile window: tap a selected hunter card (or its ⓘ) to open it */
let profH = null;
function openProfile(h) { if ($('#prof').parentNode !== document.body) document.body.append($('#prof')); // fixed overlay must not sit inside an animated tab
  profH = h; journalAll = false; renderJournal(); $('#prof').hidden = false; document.body.style.overflow = 'hidden'; sfx('click'); $('#prof-x').focus(); }
function closeProfile() { if ($('#prof').hidden) return; $('#prof').hidden = true; profH = null; document.body.style.overflow = ''; }
function profStatus(h, p) {
  if (p.trip) return tripBack(p.trip) ? ['ok', 'Back from its trip'] : ['away', 'Away on an expedition'];
  if (injuredLeft(p)) return ['bad', `Injured · back in ${dur(injuredLeft(p))}`];
  if (listings.some((l) => l.token === h.token)) return ['gold', 'Earning for you'];
  return ['ok', 'Ready to hunt'];
}
function profRent(h) { // what renting has done for this Chog
  const mine = rentals().find(({ l }) => l.token === h.token);
  if (mine) {
    const { log } = mine, wins = log.done.filter((e) => e.win).length;
    return `<div class="p-rent"><p class="j-h">Rented out · simulated in the demo</p>
      <div class="p-rent-top"><b>+${fmtChog(log.earned)} $CHOG</b><span>${log.done.length} rentals · ${log.done.length ? Math.round(wins / log.done.length * 100) : 0}% won · hunting the ${esc(log.nowHunt)} now</span></div>
      ${log.done.length ? `<ul>${log.done.slice(-3).reverse().map((e) => `<li>${e.win ? 'Beat' : 'Lost to'} the ${esc(e.monster)}<em>${e.win ? `+${fmtChog(e.earned)}` : '0'}</em></li>`).join('')}</ul>` : '<p class="j-note">The first renter is on the way.</p>'}</div>`;
  }
  if (isOwned(h)) return `<div class="p-rent"><p class="j-h">Renting</p><p class="j-note">Not rented out. Other hunters can rent it and you get 30% of every bounty it wins.</p></div>`;
  if (h.hired) { const s = demoOwnerStats(h.token); return `<div class="p-rent"><p class="j-h">Renting</p><p class="j-note">Its owner earned <b class="gold">${fmtChog(s.earned)} $CHOG</b> from ${s.rentals} rentals without lifting a finger.</p></div>`; }
  return '';
}
function renderJournal() {
  if ($('#prof').hidden && !profH) return;
  const h = profH || current, p = prog(h), k = hunterStats(h, p).kit, E = k.elementInfo, log = p.log || [];
  const [stCls, stText] = profStatus(h, p), listed = listings.some((l) => l.token === h.token);
  const wins = Object.values(p.trophies).reduce((a, b) => a + b, 0), drunk = p.drunk || [0, 0, 0];
  const who = h.ghost ? 'Wannabe journal · fades after 24 h without a Chog'
    : h.hired ? 'Hired · its owner sees these hunts too'
    : `${k.classInfo.name} · ${E.name}`;
  const note = h.ghost ? 'Get a Chog (or hire one) and its journal stays for good.'
    : 'This journal belongs to the Chog, not your wallet. A new owner keeps its story but starts again at level 1.';
  $('#journal').innerHTML = `
    <div class="j-card" style="--c:${E.color}">
      <div class="j-who">${h.ghost ? APPR_FACE : `<img src="${img(h.img)}" alt="${esc(h.name)}">`}
        <div><h3 id="prof-name">${esc(h.name)}</h3><p>${esc(who)}</p><span class="p-status ${stCls}">${esc(stText)}</span></div></div>
      <div class="j-stats">
        <div><b>${p.level}</b><span>Level</span></div>
        <div><b>${log.filter((e) => !e.trip).length}</b><span>Hunts</span></div>
        <div><b>${wins}</b><span>Trophies</span></div>
        <div><b>${log.filter((e) => !e.win && !e.trip && !e.avenged).length}</b><span>Scars</span></div>
        <div><b>${fmtChog(p.earned || 0)}</b><span>$CHOG</span></div>
      </div>
      <div><p class="j-h">Trophy wall</p></div>
      <div class="trophies">${Object.keys(KIND_NAME).map((kind) => { const n = p.trophies[kind] || 0;
        return `<div class="trophy${n ? ' got' : ''}" style="--c:${MON_COLOR[kind]}" title="${KIND_NAME[kind]}${n ? ` ×${n}` : ': not hunted yet'}"><img src="assets/monsters/${kind}.png" alt="${KIND_NAME[kind]}${n ? `, hunted ${n} times` : ', not hunted yet'}">${n ? `<i>×${n}</i>` : ''}</div>`; }).join('')}</div>
      <div><p class="j-h">Potions drunk in fights</p></div>
      <div class="drunk">${POTIONS.map((P, i) => `<span style="--c:${P.color}"><i></i>${P.name} ×${drunk[i]}</span>`).join('')}</div>
      <p class="j-note">${esc(note)}</p>
    </div>
    <div class="j-card">
      ${profRent(h)}
      <p class="j-h">Hunt log</p>
      ${log.length ? `<ol class="j-log">${log.slice(0, journalAll ? log.length : 4).map((e) => `<li class="${e.win ? '' : `lost${e.avenged ? ' avenged' : ''}`}${e.trip ? ' trip' : ''}">
          <img src="assets/monsters/${e.kind in KIND_NAME ? e.kind : 'wraith'}.png" alt="">
          <div><b>${e.trip ? `Back from ${esc(e.name)}` : `${e.win ? 'Hunted' : 'Lost to'} the ${esc(e.name)}`}</b>${e.trip ? (e.win ? ' <span class="scar ok">Expedition</span>' : ' <span class="scar">Came back hurt</span>') : e.win ? ` in ${e.turns} turns` : e.avenged ? ' <span class="scar ok">Scar · avenged</span>' : ' <span class="scar">Scar</span>'}
          <q>${esc(e.quote)}</q>
          <small>${when(e.at)}${e.forged ? ' · forged from a post' : ''}${e.boss ? ' · shared boss' : ''}${e.hired ? ' · hired' : ''}${e.prev ? ' · previous owner' : ''}${e.potion != null ? ` · ${POTIONS[e.potion].name} potion` : ''}${e.chog ? ` · ${fmtChog(e.chog)} $CHOG` : ''}</small></div></li>`).join('')}</ol>${log.length > 4 ? `<button type="button" class="h-own" data-jall>${journalAll ? 'Show the latest 4' : `Show all ${log.length} hunts`}</button>` : ''}`
        : `<p class="j-empty">No hunts yet. Take a contract and ${esc(h.name)} writes its first page.</p>`}
    </div>
    <div class="p-acts">
      ${isPreview(h) ? '<button type="button" class="btn" data-verify>Connect wallet to play</button>' : `<button type="button" class="btn" data-phunt>Hunt with it</button>`}
      ${isOwned(h) ? (listed ? `<button type="button" class="btn ghost" data-unlist="${h.token}">Stop renting</button>` : `<button type="button" class="btn ghost" data-list="${h.token}">Rent it out</button>`) : ''}
      ${log.length ? '<button type="button" class="btn ghost" data-jshare>Share its story</button>' : ''}
    </div>`;
}
let journalAll = false; // the hunt log shows the latest 4 until asked for more
$('#journal').addEventListener('click', (e) => {
  const h = profH || current;
  if (e.target.closest('[data-jall]')) { journalAll = !journalAll; renderJournal(); }
  if (e.target.closest('[data-jshare]')) shareStory(h);
  if (e.target.closest('[data-phunt]')) {
    current = h; try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
    closeProfile(); renderAll(); $('#board').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (e.target.closest('[data-verify]')) { closeProfile(); openWallet(); }
  const l = e.target.closest('[data-list]'), u = e.target.closest('[data-unlist]');
  if (l) { closeProfile(); startListing(Number(l.dataset.list)); }
  if (u) { unlist(Number(u.dataset.unlist)); renderJournal(); }
});
$('#prof').addEventListener('click', (e) => { if (e.target === e.currentTarget || e.target.closest('#prof-x')) closeProfile(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProfile(); });
// snapshot window: shows the picture first, then Post on X (phones: share sheet) or Save
let snapData = null;
function openSnap(cv, title, text, name) {
  snapData = { cv, text, name };
  $('#snap-title').textContent = title; $('#snap-img').src = cv.toDataURL('image/png');
  $('#snap-msg').textContent = 'Phone: the picture goes straight into your post. Computer: it saves first, then drop it into the post that opens.';
  $('#snap').hidden = false; $('#snap-go').focus();
}
$('#snap').addEventListener('click', async (e) => {
  if (e.target === $('#snap') || e.target.closest('#snap-x')) { $('#snap').hidden = true; return; }
  if (!snapData) return;
  if (e.target.closest('#snap-go')) { const r = await shareImage(snapData.cv, snapData.text, snapData.name); sfx('coin'); $('#snap-msg').textContent = r === 'shared' ? 'Shared!' : r === 'cancelled' ? 'Cancelled.' : 'Picture saved, and the post is open on X. Attach the picture there.'; }
  if (e.target.closest('#snap-save')) { const a = document.createElement('a'); a.href = $('#snap-img').src; a.download = snapData.name; document.body.appendChild(a); a.click(); a.remove(); $('#snap-msg').textContent = 'Saved to your downloads.'; }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#snap').hidden) $('#snap').hidden = true; });
// the story card: one picture of a Chog's whole record, for X (1200×675)
async function shareStory(h) {
  const p = prog(h), k = hunterStats(h, p).kit, E = k.elementInfo, log = p.log || [];
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const pic = await loadPic(h.ghost ? 'assets/chogs/apprentice.png' : h.img).catch(() => null);
  const mons = Object.fromEntries(await Promise.all(Object.keys(KIND_NAME).map(async (kd) => [kd, await loadPic(`assets/monsters/${kd}.png`).catch(() => null)])));
  c.fillStyle = '#0e0b1a'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(260, 340, 0, 260, 340, 520); g.addColorStop(0, E.color + '55'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  // the Chog, framed, on the left
  c.fillStyle = '#f4f1fe'; c.beginPath(); c.roundRect(58, 120, 400, 400, 28); c.fill();
  c.save(); c.beginPath(); c.roundRect(68, 130, 380, 380, 22); c.clip(); c.fillStyle = '#201a3a'; c.fillRect(68, 130, 380, 380);
  if (pic) { if (h.ghost) { const s = Math.min(340 / pic.width, 360 / pic.height), w = pic.width * s, hh = pic.height * s; c.drawImage(pic, 258 - w / 2, 500 - hh, w, hh); } else c.drawImage(pic, 68, 130, 380, 380); }
  c.restore();
  c.textBaseline = 'alphabetic'; c.fillStyle = '#e845a4'; c.font = '700 18px "JetBrains Mono", monospace'; c.fillText('THE STORY OF', 500, 150);
  c.fillStyle = '#f4f1fe'; c.font = '400 72px Koulen, Impact, sans-serif'; c.fillText(h.name.toUpperCase(), 500, 222);
  c.fillStyle = 'rgba(244,241,254,.7)'; c.font = '600 20px "JetBrains Mono", monospace';
  c.fillText(h.ghost ? 'WANNABE · NO NFT YET' : `TOKEN ${h.token} · ${k.classInfo.name.toUpperCase()} · ${E.name.toUpperCase()}`, 500, 258);
  // numbers
  const stats = [[p.level, 'LEVEL'], [log.filter((e) => !e.trip).length, 'HUNTS'], [Object.values(p.trophies).reduce((a, b) => a + b, 0), 'TROPHIES'], [log.filter((e) => e.trip).length, 'TRIPS'], [log.filter((e) => !e.win && !e.trip && !e.avenged).length, 'SCARS']];
  stats.forEach(([n, l], i) => { const x = 500 + i * 128; c.fillStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.roundRect(x, 284, 116, 92, 14); c.fill();
    c.fillStyle = '#f4f1fe'; c.font = '700 40px "JetBrains Mono", monospace'; c.fillText(String(n), x + 16, 336); c.fillStyle = 'rgba(244,241,254,.6)'; c.font = '600 14px "JetBrains Mono", monospace'; c.fillText(l, x + 16, 362); });
  // trophies won
  let tx = 500; for (const kd of Object.keys(KIND_NAME)) { if (!p.trophies[kd] || !mons[kd]) continue; c.drawImage(mons[kd], tx, 392, 56, 56); tx += 62; }
  // the latest three entries
  c.font = '500 19px Inter, system-ui, sans-serif';
  log.slice(0, 3).forEach((e, i) => { const y = 488 + i * 34;
    c.fillStyle = e.trip ? '#d9a227' : e.win ? '#5ce68a' : '#ff8a8a'; c.beginPath(); c.arc(508, y - 6, 6, 0, 7); c.fill();
    c.fillStyle = '#f4f1fe'; const line = e.trip ? `Back from ${e.name}` : `${e.win ? 'Hunted' : 'Lost to'} the ${e.name}`;
    c.fillText(line.length > 52 ? line.slice(0, 51) + '…' : line, 524, y); });
  c.fillStyle = '#a99bfc'; c.font = '600 16px "JetBrains Mono", monospace'; c.fillText('CHOG CONTRACTS · EVERY HUNT IS WRITTEN INTO THE CHOG · #CHOGATHON', 58, 620);
  openSnap(cv, `The story of ${h.name}`, `The story of my ${h.name} so far: level ${p.level}, ${stats[2][0]} trophies, ${stats[3][0]} trips. Written into the Chog itself. @ChogNFT #Chogathon`, `chog-story-${(h.token || 'wannabe')}.png`);
  sfx('click');
}
// the glowing figure in the hero: the Wannabe as a cut-out, a real Chog as a lit card
function renderHeroHunter() {
  const h = current, box = $('#cine-hunter'); if (!box) return;
  box.innerHTML = h.ghost ? `<img class="cut" src="assets/chogs/apprentice.png" alt="The Wannabe Chog"><b>Wannabe Chog</b>` : `<img class="nft" src="${img(h.img)}" alt="${esc(h.name)}"><b>${esc(h.name)}</b>`;
}
const renderAll = () => { renderMe(); renderHunters(); renderBoard(); renderJournal(); renderHeroHunter(); renderEarn(); renderLeaderboard(); };

/* ---------- weekly boss leaderboard: total damage dealt to this week's boss. It resets every Monday with the boss.
   Your own score is real (kept in this browser); the other hunters are sample players for the demo, the same all
   week. In the full game the board is shared, and the top 10 split the weekly $CHOG pool. ---------- */
const LB_KEY = 'chog-contracts-weekly';
// weeks start on Monday 00:00 UTC, the same on every player's clock and on the server
const weekStart = (now = new Date()) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
const weekId = () => weekStart().toISOString().slice(0, 10);
function loadWeekly() {
  let w = null; try { w = JSON.parse(localStorage.getItem(LB_KEY)); } catch {}
  return w && w.week === weekId() ? w : { week: weekId(), dmg: 0, hunts: 0, wins: 0 }; // a new week starts from zero
}
function addBossDamage(dmg, win) {
  const w = loadWeekly(); w.dmg += Math.max(0, Math.round(dmg)); w.hunts += 1; if (win) w.wins += 1;
  try { localStorage.setItem(LB_KEY, JSON.stringify(w)); } catch {}
}
const LB_NAMES = ['nadhunter', 'chogmaxi', 'purplefren', 'wenmainnet', 'fudslayer', 'molandak_fan', 'gmonad', 'rugproof', 'bigchog', 'laser_eyes', 'monadmaxxer', 'chogsmith'];
const LB_SPLIT = [0.25, 0.18, 0.13, 0.1, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04]; // share of the weekly pool for places 1 to 10
/* the live board: when the site runs with its server (Netlify functions under /api), scores are real. A ranked hunt
   needs a connected wallet that owns the Chog; the server hands out a seed, the fight is played with it, and the keys
   pressed are sent back and replayed on the server (src/replay.js). Elsewhere (the preview, the artifact) the board
   falls back to sample players. */
let live = null; // { week, entries: [{ wallet, name, dmg, hunts, wins }] } from the server, or null
const SIG_KEY = 'chog-contracts-lb-sig';
async function loadLive() {
  try {
    const r = await fetch(`/api/leaderboard?week=${weekId()}`, { cache: 'no-store' });
    live = r.ok && /json/.test(r.headers.get('content-type') || '') ? await r.json() : null;
  } catch { live = null; }
  renderLeaderboard();
}
// a ranked ticket for a boss hunt, or null (then the hunt is played and kept locally, as before)
// once a week: a free signature that proves the wallet (no transaction, no approval); kept for the week
async function weeklySig(refused) {
  if (!wAddr || !wActive) return null;
  const week = weekId();
  let saved = null; try { saved = JSON.parse(localStorage.getItem(SIG_KEY)); } catch {}
  if (saved && saved.week === week && saved.wallet === wAddr.toLowerCase()) return saved.sig;
  const sig = await signText(wActive, wAddr, lbMessage(wAddr, week), refused).catch(() => null);
  if (sig) try { localStorage.setItem(SIG_KEY, JSON.stringify({ week, wallet: wAddr.toLowerCase(), sig })); } catch {}
  return sig;
}
// or, without connecting: a pass from sending MON to yourself (see the self-transfer box in the wallet window)
const PASS_KEY = 'chog-contracts-pass';
function savedPass() { try { const p = JSON.parse(localStorage.getItem(PASS_KEY)); return p && p.week === weekId() ? p : null; } catch { return null; } }
const myPass = () => { const p = savedPass(); return p && wAddr && p.wallet === wAddr.toLowerCase() ? p.pass : null; };
async function weeklyProof(refused) {
  const pass = myPass(); if (pass) return { pass };
  const signature = await weeklySig(refused); return signature ? { signature } : null;
}
// the hunter name this wallet shows on the board (kept here too, so it shows before the board loads)
const NAME_KEY = 'chog-contracts-name';
const myName = () => { try { const n = JSON.parse(localStorage.getItem(NAME_KEY)); return n && wAddr && n.wallet === wAddr.toLowerCase() ? n.name : null; } catch { return null; } };
async function saveName(name) {
  const clean = cleanName(name);
  if (!clean) return 'Use 3 to 16 letters, numbers, spaces or _. Names that look official are taken.';
  if (!live) { try { localStorage.setItem(NAME_KEY, JSON.stringify({ wallet: wAddr.toLowerCase(), name: clean })); } catch {} return 'Saved in this browser. On the live site it shows on the board.'; }
  const proof = await weeklyProof('You chose not to sign. Your name was not changed.'); if (!proof) return 'Not signed, so the name was not changed.';
  const r = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: wAddr, name: clean, ...proof, week: weekId() }) }).catch(() => null);
  const out = r ? await r.json().catch(() => ({})) : {};
  if (!r?.ok) return out.error || 'Could not save the name right now.';
  try { localStorage.setItem(NAME_KEY, JSON.stringify({ wallet: wAddr.toLowerCase(), name: out.name })); } catch {}
  await loadLive();
  return `Saved: you're "${out.name}" on the board.`;
}
async function rankedTicket(h) {
  if (!live || !wAddr || (!wActive && !myPass()) || !h || h.ghost || h.hired || !h.token || !isOwned(h)) return null;
  const week = weekId();
  const proof = await weeklyProof('You chose not to sign. This hunt still counts here, just not on the shared board.');
  if (!proof) return null;
  const r = await fetch('/api/boss-start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: wAddr }) }).catch(() => null);
  if (!r?.ok) return null;
  return { ...(await r.json()), wallet: wAddr, proof, week, token: h.token };
}
async function submitRanked(t, res, level) {
  const r = await fetch('/api/boss-finish', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: t.ticket, wallet: t.wallet, ...t.proof, week: t.week, token: t.token, level, keys: res.keys }) }).catch(() => null);
  const out = r ? await r.json().catch(() => null) : null;
  await loadLive();
  return out; // { dmg, rank } or { error }
}
function renderLeaderboard() {
  const el = $('#lb'); if (!el) return;
  if (live?.entries) return renderLiveBoard(el);
  const id = weekId(); let s = 0; for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const rivals = LB_NAMES.map((n) => { const hunts = 2 + Math.floor(rnd() * 9); return { name: n, dmg: Math.round(hunts * (180 + rnd() * 190)), hunts, wins: Math.floor(hunts * (0.3 + rnd() * 0.6)) }; });
  const w = loadWeekly(), me = { name: `You · ${myName() || current.name}`, dmg: w.dmg, hunts: w.hunts, wins: w.wins, me: true };
  const all = [...rivals, me].sort((a, b) => b.dmg - a.dmg), myRank = all.indexOf(me) + 1;
  const end = new Date(weekStart().getTime() + 7 * 864e5), left = end - Date.now(), d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5);
  const row = (r, i) => `<li class="${r.me ? 'me' : ''}${i < 3 ? ` top top${i + 1}` : ''}"><span class="lb-rank">${i + 1}</span><span class="lb-name">${esc(r.name)}${r.me ? '' : ' <small>demo</small>'}</span><span class="lb-dmg">${r.dmg.toLocaleString('en-US')}</span><span class="lb-hunts">${r.wins}/${r.hunts}</span><span class="lb-share">${i < 10 ? `${Math.round(LB_SPLIT[i] * 100)}%` : '–'}</span></li>`;
  const top = all.slice(0, 10).map(row).join('');
  el.innerHTML = `<div class="lb-head"><div><p class="eyebrow">This week</p><h3>Boss leaderboard</h3><p>Total damage dealt to <b>${esc(BOSS.name)}</b>. Top 10 split the weekly $CHOG pool.</p></div>
    <div class="lb-clock"><small>Resets in</small><b>${d}d ${h}h</b></div></div>
    <ol class="lb-list"><li class="lb-cols"><span>#</span><span>Hunter</span><span>Damage</span><span>Wins</span><span>Pool</span></li>${top}${myRank > 10 ? `<li class="lb-gap">…</li>${row(me, myRank - 1)}` : ''}</ol>
    <p class="lb-note">${w.hunts ? `You're <b>#${myRank}</b> with ${w.dmg.toLocaleString('en-US')} damage.` : 'Hunt the weekly boss to get on the board.'} Other names are sample players in this demo.</p>`;
}
function renderLiveBoard(el) {
  const me = (wAddr || '').toLowerCase(), list = live.entries || [];
  const end = new Date(weekStart().getTime() + 7 * 864e5), left = end - Date.now(), d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5);
  const myRank = list.findIndex((e) => e.wallet === me) + 1;
  const row = (r, i) => `<li class="${r.wallet === me ? 'me' : ''}${i < 3 ? ` top top${i + 1}` : ''}"><span class="lb-rank">${i + 1}</span><span class="lb-name">${esc(r.handle || short(r.wallet))} <small>${esc(r.name || 'Chog')}</small></span><span class="lb-dmg">${Number(r.dmg).toLocaleString('en-US')}</span><span class="lb-hunts">${r.wins}/${r.hunts}</span><span class="lb-share">${i < 10 ? `${Math.round(LB_SPLIT[i] * 100)}%` : '–'}</span></li>`;
  const rows = list.slice(0, 10).map(row).join('') + (myRank > 10 ? `<li class="lb-gap">…</li>${row(list[myRank - 1], myRank - 1)}` : '');
  const canRank = wAddr && HUNTERS.some((x) => x.brought && isOwned(x));
  el.innerHTML = `<div class="lb-head"><div><p class="eyebrow">This week · live</p><h3>Boss leaderboard</h3><p>Total damage dealt to <b>${esc(BOSS.name)}</b>. Every hunt is replayed on the server before it counts. Top 10 split the weekly $CHOG pool.</p></div>
    <div class="lb-clock"><small>Resets in</small><b>${d}d ${h}h</b></div></div>
    <ol class="lb-list"><li class="lb-cols"><span>#</span><span>Hunter</span><span>Damage</span><span>Wins</span><span>Pool</span></li>${rows || '<li class="lb-gap">No hunts yet this week. Be the first.</li>'}</ol>
    <p class="lb-note">${myRank ? `You're <b>#${myRank}</b>.` : canRank ? 'Hunt the weekly boss with your Chog to get on the board.' : 'Connect the wallet that holds your Chog to get on the board.'}</p>`;
}
$('#board').addEventListener('click', (e) => {
  const bb = e.target.closest('[data-best]');
  if (bb) { current = HUNTERS.find((h) => h.id === bb.dataset.best) || current; try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {} renderAll(); sfx('click'); return; }
  const b = e.target.closest('[data-scroll-hire]'); if (!b) return; const o = document.getElementById(`offer-${b.dataset.scrollHire}`); o?.scrollIntoView({ behavior: 'smooth', block: 'center' }); o?.animate([{ boxShadow: '0 0 0 3px #e845a4' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1600 }); });

$('#hunters').addEventListener('click', (e) => {
  const sf = e.target.closest('[data-sfilter]'); if (sf) { stableFilter = sf.dataset.sfilter; renderHunters(); return; }
  if (e.target.closest('[data-rent-all]')) { startListingMany(idleOwned().map((h) => h.token)); return; }
  const s = e.target.closest('[data-slot]'); // the empty slots: bring your own, or hire one
  if (s) { if (s.dataset.slot === 'connect') openWallet(); else $('#hire-sec').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const b = e.target.closest('[data-id]'); if (!b) return;
  const h = HUNTERS.find((x) => x.id === b.dataset.id);
  if (e.target.closest('[data-prof]') || h === current) { openProfile(h); return; } // a second tap (or the ⓘ) opens its profile
  current = h;
  try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
  renderAll();
});
$('#board').addEventListener('click', (e) => {
  if (e.target.closest('[data-verify]')) { openWallet(); $('#wpick-msg').textContent = `Connect the wallet that holds ${current.name} to play it.`; return; }
  const b = e.target.closest('[data-hunt]'); if (!b || b.disabled) return;
  if (b.dataset.auto) { // auto-pick: switch to the Chog named on the button, then go
    current = HUNTERS.find((h) => h.id === b.dataset.auto) || current;
    try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
    renderAll();
  }
  hunt(contracts[Number(b.dataset.hunt)]);
});
$('#bring-alt').addEventListener('click', (e) => { // the paste box opens only when asked for
  const row = $('#bring-row'); row.hidden = !row.hidden; e.currentTarget.setAttribute('aria-expanded', String(!row.hidden));
  if (!row.hidden) $('#bring-in').focus();
});
$('#bring').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('#bring-in').value.trim(), msg = $('#bring-msg'), btn = e.submitter || $('#bring [type="submit"]');
  const isWallet = /^0x[0-9a-fA-F]{40}$/.test(v), id = Number(v);
  if (!isWallet && !(Number.isInteger(id) && id >= 1 && id <= 1969)) { msg.textContent = 'Paste a wallet address (0x + 40 characters) or a Chog Genesis token id from 1 to 1969.'; return; }
  btn.disabled = true;
  msg.textContent = isWallet ? 'Looking up the Chogs in this wallet on Monad…' : `Reading token ${id} from Monad…`;
  try {
    const scanning = (p) => { msg.textContent = `New Chog since our last list? Checking all 1,969 on Monad (about 45 s)… ${Math.round(p * 100)}%. Know your token id? Paste it instead for an instant load.`; };
    const found = isWallet ? await walletChogs(v, { onProgress: scanning }) : [await readChog(id)];
    if (!found.length) { msg.textContent = 'No Chog Genesis in this wallet yet. You can still hunt as the Wannabe Chog, or try a token id.'; return; }
    const list = addHunters(found.slice(0, MAX_CHOGS).map(asHunter));
    saveBrought();
    current = list[0];
    try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
    const yours = list.some(isOwned);
    msg.textContent = (isWallet ? `Found ${found.length} Chog${found.length > 1 ? 's' : ''}${found.length > MAX_CHOGS ? `, showing ${MAX_CHOGS}` : ''}.` : `${list[0].name} loaded.`) + (yours ? ' Its traits are now its moves.' : ' Preview only: connect the wallet that holds it to play.');
    $('#bring-in').value = '';
    renderAll();
  } catch (err) {
    msg.textContent = /fetch|network|Failed/i.test(String(err))
      ? (/claude|usercontent/.test(location.hostname) ? 'This Claude preview can\'t reach Monad, so it can\'t load wallets. It works on the live site.' : 'Could not reach Monad just now. Check your connection and try again.')
      : `${err.message}. Try again in a moment.`;
  } finally { btn.disabled = false; }
});
/* ---------- wallet connect: only an address and an optional free signature (see src/wallet.js) ---------- */
const wpop = $('#wpop');
let wActive = null, wAddr = loadWallet()?.address || savedPass()?.wallet || null, wTokens = [];
const verifiedTokens = () => loadWallet()?.signed?.tokens || [];
function paintConnect() {
  const b = $('#connect'); b.textContent = wAddr ? short(wAddr) : 'Connect wallet'; b.classList.toggle('addr', !!wAddr);
  // once connected, a plain way out sits right next to the address
  let out = $('#disconnect');
  if (!out) { out = document.createElement('button'); out.type = 'button'; out.id = 'disconnect'; out.className = 'btn ghost'; out.textContent = 'Disconnect'; out.addEventListener('click', () => $('#wdisc').click()); b.after(out); }
  out.hidden = !wAddr;
  renderMe();
}
function wShow(step) { for (const s of ['pick', 'done', 'list']) $(`#wstep-${s}`).hidden = step !== s; }
function openWallet() {
  if (wAddr && wActive) { wShow('done'); wpop.hidden = false; return; }
  const list = listWallets(), box = $('#wlist');
  box.replaceChildren();
  if (!list.length) box.innerHTML = '<p>No wallet found in this browser. Install one that supports Monad (MetaMask, Rabby, Phantom or Backpack, for example) and reload. Or paste your address instead: that needs no wallet at all.</p>';
  for (const w of list) { // built with DOM calls: wallet names and icons come from browser extensions
    const b = document.createElement('button'); b.type = 'button';
    if (w.info.icon) { const i = document.createElement('img'); i.src = w.info.icon; i.alt = ''; b.append(i); }
    b.append(w.info.name); b.addEventListener('click', () => pickWallet(w)); box.append(b);
  }
  $('#wmsg-pick').textContent = ownershipMessage('0xYourAddress', ['(the Chogs in your wallet)'], '(random)', '(now)');
  $('#wpick-msg').textContent = '';
  wShow('pick'); wpop.hidden = false; sfx('click');
}
/** Remembers who holds each Chog. A different wallet turning up with it means it was sold: level and potions start over, the story stays. */
function noteOwners(addr, tokens) {
  const a = String(addr).toLowerCase(), reset = [];
  for (const tok of tokens) {
    const p = (progress[`t${tok}`] ||= fresh());
    if (p.owner && p.owner !== a && (p.level > 1 || p.xp > 0)) { newOwner(p); reset.push(HUNTERS.find((h) => h.token === tok)?.name || `Chog ${tok}`); }
    p.owner = a;
  }
  saveProgress(progress);
  if (reset.length) toast(`New owner: <b>${esc(reset.join(', '))}</b> starts again at level 1. Its story stays in the journal.`);
}
async function pickWallet(w) {
  $('#wpick-msg').textContent = `Waiting for ${w.info.name}…`;
  try { wAddr = await connect(w); wActive = w; } catch (err) { $('#wpick-msg').textContent = err.message; return; }
  wShow('done'); paintConnect(); $('#wstatus').textContent = '';
  $('#wsum').innerHTML = `<b>${esc(short(wAddr))}</b> · looking up its Chogs on Monad…`;
  wTokens = []; setOwned([]); // the new wallet decides what's yours
  try {
    const found = await walletChogs(wAddr, { onProgress: (p) => { $('#wsum').innerHTML = `<b>${esc(short(wAddr))}</b> · checking all 1,969 Chogs on Monad… ${Math.round(p * 100)}%`; } });
    wTokens = found.map((c) => c.tokenId); setOwned(wTokens); // the connected wallet holds these: they're yours
    noteOwners(wAddr, wTokens);
    if (found.length) {
      const list = addHunters(found.slice(0, MAX_CHOGS).map(asHunter)); saveBrought();
      current = list[0]; try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {}
      renderAll();
    }
    $('#wsum').innerHTML = found.length
      ? `<b>${esc(short(wAddr))}</b> holds <b>${found.length} Chog${found.length > 1 ? 's' : ''}</b>${found.length > MAX_CHOGS ? ` (showing ${MAX_CHOGS})` : ''}. ${found.length > 1 ? 'They\'re' : 'It\'s'} on your hunter list now.`
      : `<b>${esc(short(wAddr))}</b> holds no Chog Genesis yet. Hunt as the Wannabe Chog, or hire one.`;
  } catch {
    $('#wsum').innerHTML = `<b>${esc(short(wAddr))}</b> is connected, but Monad didn't answer just now. Try again in a moment.`;
  }
  $('#wmsg').textContent = ownershipMessage(wAddr, wTokens);
  $('#wsign').disabled = !wTokens.length;
  if (pendingList != null) startListing(pendingList); // they came here from "List for hire"
}
$('#connect').addEventListener('click', openWallet);

/* ---------- log in without connecting: send an exact amount of MON from your wallet to itself ----------
   The server hands out the amount and later finds the transfer on Monad (netlify/functions/self-verify.mjs).
   The MON goes back into the same wallet; nothing here ever shows another address. */
let spChallenge = null, spTimer = 0;
const spMsg = (s) => { $('#sp-msg').textContent = s; };
$('#selfpay').addEventListener('submit', async (e) => {
  e.preventDefault();
  const addr = $('#sp-addr').value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { spMsg('Paste your wallet address: 0x and 40 letters or numbers.'); return; }
  spMsg('Getting your amount…');
  const r = await fetch('/api/self-verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: addr }) }).catch(() => null);
  const out = r && /json/.test(r.headers.get('content-type') || '') ? await r.json().catch(() => null) : null;
  if (!r?.ok || !out?.challenge) { spMsg(out?.error || 'This works on the live site (chog-contracts.netlify.app).'); return; }
  spChallenge = { ...out, wallet: addr };
  $('#sp-amt').textContent = out.amount; $('#sp-to').textContent = addr;
  $('#sp-step1').hidden = true; $('#sp-step2').hidden = false; spMsg('');
  clearInterval(spTimer);
  spTimer = setInterval(() => {
    const left = spChallenge ? spChallenge.expires - Date.now() : 0;
    if (left <= 0) { clearInterval(spTimer); $('#sp-left').textContent = 'time is up'; spMsg('Time ran out. Close this and get a new amount.'); return; }
    $('#sp-left').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  }, 1000);
  $('#sp-tx').focus();
});
$('#selfpay').addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]'); if (!c || !spChallenge) return;
  navigator.clipboard?.writeText(c.dataset.copy === 'amount' ? spChallenge.amount : spChallenge.wallet).then(() => { c.textContent = 'Copied'; setTimeout(() => { c.textContent = 'Copy'; }, 1500); }).catch(() => {});
});
$('#sp-check').addEventListener('click', async () => {
  if (!spChallenge) return;
  const tx = $('#sp-tx').value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) { spMsg('Paste the transaction hash: 0x and 64 letters or numbers.'); return; }
  const btn = $('#sp-check'); btn.disabled = true; spMsg('Looking for it on Monad…');
  const r = await fetch('/api/self-verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: spChallenge.wallet, challenge: spChallenge.challenge, tx }) }).catch(() => null);
  const out = r ? await r.json().catch(() => null) : null;
  btn.disabled = false;
  if (!r?.ok || !out?.pass) { spMsg(out?.error || 'Could not check it right now. Try again.'); return; }
  try { localStorage.setItem(PASS_KEY, JSON.stringify({ wallet: spChallenge.wallet.toLowerCase(), week: out.week, pass: out.pass })); } catch {}
  clearInterval(spTimer);
  wAddr = spChallenge.wallet; wActive = null; spChallenge = null;
  paintConnect(); spMsg('Found it. Loading your Chogs…');
  wTokens = []; setOwned([]);
  try {
    const found = await walletChogs(wAddr);
    wTokens = found.map((c) => c.tokenId); setOwned(wTokens); noteOwners(wAddr, wTokens);
    if (found.length) { const list = addHunters(found.slice(0, MAX_CHOGS).map(asHunter)); saveBrought(); current = list[0]; try { localStorage.setItem('chog-contracts-demo-hunter', current.id); } catch {} }
    renderAll(); renderLeaderboard();
    toast(found.length ? `You're in: <b>${found.length} Chog${found.length > 1 ? 's' : ''}</b> on your list. Boss hunts count on the board this week.` : 'You\'re in. This wallet holds no Chog Genesis yet: hunt as the Wannabe Chog, or hire one.');
    wpop.hidden = true;
  } catch { spMsg('You\'re in, but Monad didn\'t answer when loading your Chogs. Reload in a moment.'); }
  $('#sp-step1').hidden = false; $('#sp-step2').hidden = true; $('#sp-tx').value = ''; $('#sp-addr').value = '';
});
// past the top, the header drops its logo and only the tab bar and account box ride along
const markScrolled = () => document.documentElement.classList.toggle('scrolled', scrollY > 60);
addEventListener('scroll', markScrolled, { passive: true }); markScrolled();
// the logo takes you home: the Hunt page, back at the top
document.querySelectorAll('[data-home]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault(); document.querySelector('.tabs [data-tab="hunt"]')?.click(); scrollTo({ top: 0, behavior: 'smooth' });
}));

/* ---------- renting out your own Chog: verified owners sign an off-chain offer (cancel = delete it) ---------- */
const LIST_KEY = 'chog-contracts-listings';
let listings = (() => { try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; } catch { return []; } })();
const saveListings = () => { try { localStorage.setItem(LIST_KEY, JSON.stringify(listings)); } catch {} };
let pendingList = null;
// local testing only: on localhost a 'test owner' flag lets you try renting without a wallet in the browser (never on the live site)
const TEST_OWNER = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && (() => { try { return localStorage.getItem('chog-contracts-test-owner') === '1'; } catch { return false; } })();
const ownedVerified = () => { const v = verifiedTokens(); return HUNTERS.filter((h) => h.brought && v.includes(h.token)); };
function renderMine() { $('#mine').innerHTML = ''; } // renting out lives in one line under 'Got a Chog?' now
/** Rent out one Chog, or a whole stable at once: one signature covers every token in the list. */
function startListing(token) { startListingMany([token]); }
function startListingMany(tokens) {
  const hs = tokens.map((tok) => HUNTERS.find((x) => x.brought && x.token === tok)).filter(Boolean); if (!hs.length) return;
  const label = hs.length > 1 ? `${hs.length} Chogs` : hs[0].name;
  if (!TEST_OWNER && !wActive) { pendingList = hs[0].token; openWallet(); $('#wpick-msg').textContent = `Connect the wallet that holds ${label} to sign the listing.`; return; }
  if (!TEST_OWNER && hs.some((h) => !wTokens.includes(h.token))) { pendingList = null; wShow('done'); wpop.hidden = false; $('#wstatus').textContent = `This wallet doesn't hold ${label}. Connect the one that does.`; return; }
  pendingList = null;
  $('#wlist-title').textContent = `List ${label} for hire`;
  $('#wlmsg').textContent = listingMessage(wAddr || '0x0000 (test wallet)', hs.map((h) => h.token).join(', '), label);
  $('#wlstatus').textContent = ''; $('#wlsign').disabled = false; $('#wlsign').dataset.tokens = hs.map((h) => h.token).join(',');
  wShow('list'); wpop.hidden = false;
}
$('#wlsign').addEventListener('click', async (e) => {
  const toks = e.currentTarget.dataset.tokens.split(',').map(Number), hs = toks.map((tok) => HUNTERS.find((x) => x.brought && x.token === tok)).filter(Boolean);
  $('#wlstatus').textContent = 'Check your wallet: it shows the same text as above.';
  try {
    const sig = TEST_OWNER && !wActive ? 'test-signature' : await signText(wActive, wAddr, $('#wlmsg').textContent, 'You chose not to sign. Nothing was listed.');
    listings = listings.filter((l) => !toks.includes(l.token));
    for (const h of hs) listings.push({ token: h.token, name: h.name, img: h.img, traits: h.traits, owner: wAddr || 'test', at: Date.now(), sig });
    saveListings(); sfx('coin'); renderHire(); renderHunters(); renderBoard();
    $('#wlstatus').innerHTML = `<span class="verified">${hs.length > 1 ? `${hs.length} Chogs are` : `${esc(hs[0].name)} is`} listed.</span> Hunters can hire ${hs.length > 1 ? 'them' : 'it'} now; you can stop any time.`;
    $('#wlsign').disabled = true;
  } catch (err) { $('#wlstatus').textContent = err.message; }
});
function unlist(token) { listings = listings.filter((l) => l.token !== token); saveListings(); renderHire(); renderHunters(); renderBoard(); sfx('click'); }
function unlistAll() { listings = []; saveListings(); renderHire(); renderHunters(); renderBoard(); sfx('click'); }
// owned Chogs free to rent right now: not listed, not hurt, not away
const idleOwned = () => HUNTERS.filter((h) => h.brought && isOwned(h) && !listings.some((l) => l.token === h.token) && !injuredLeft(prog(h)) && !prog(h).trip);
/* ---------- earning while you sleep: listed Chogs and their renters (simulated in the demo, src/rental.js) ---------- */
const rentals = () => listings.map((l) => ({ l, log: rentalLog(l.token, l.at, Date.now(), fastMode()) }));
let toastT = 0;
function toast(html) { const el = $('#toast'); el.innerHTML = html; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 5500); }
/** Pays finished rentals into the test balance once each, and says so. */
function payRentals() {
  const paid = loadPaid(); let total = 0, who = null;
  for (const { l, log } of rentals()) {
    const seen = paid[l.token]?.at === l.at ? paid[l.token].n : 0, fresh = log.done.slice(seen);
    if (!fresh.length) continue;
    paid[l.token] = { at: l.at, n: log.done.length }; const sum = fresh.reduce((s, e) => s + e.earned, 0);
    if (sum) { total += sum; who = l; }
  }
  savePaid(paid);
  if (total) { grantChog(total); sfx('coin'); renderMe(); toast(`<b>${esc(who.name)}</b> won a hunt for its renter: <b>+${fmtChog(total)}</b> test $CHOG to you`); }
}
function renderEarn() { // one plain line for owners under "Got a Chog?": rent it out, or how it's doing
  const box = $('#earn'); if (!box) return;
  const live = rentals(), idle = idleOwned();
  const lines = [];
  if (live.length > 2) {
    const earned = live.reduce((s, r) => s + r.log.earned, 0);
    lines.push(`<p class="rent-line"><span><b>${live.length} Chogs</b> are working for you · <span class="gold">+${fmtChog(earned)} $CHOG</span> so far</span><button type="button" data-unlist-all>Stop all</button><small>simulated in the demo</small></p>`);
  } else for (const { l, log } of live) lines.push(`<p class="rent-line"><span><b>${esc(l.name)}</b> is working for you · hunting the ${esc(log.nowHunt)} right now · <span class="gold">+${fmtChog(log.earned)} $CHOG</span> so far</span><button type="button" data-unlist="${l.token}">Stop</button><small>simulated in the demo</small></p>`);
  if (idle.length > 1) lines.push(`<p class="rent-line"><span>${live.length ? `${idle.length} more` : `<b>${idle.length} Chogs</b>`} sitting idle: let them work for you, you get 30% of every bounty they win.</span><button type="button" data-rent-all>Rent out all ${idle.length}</button></p>`);
  else if (idle.length && !live.length) lines.push(`<p class="rent-line"><span>Let <b>${esc(idle[0].name)}</b> work for you: other hunters rent it, you get 30% of every bounty.</span><button type="button" data-list="${idle[0].token}">Rent it out</button></p>`);
  box.innerHTML = lines.join('');
}$('#earn').addEventListener('click', (e) => {
  const l = e.target.closest('[data-list]'), u = e.target.closest('[data-unlist]');
  if (l) startListing(Number(l.dataset.list));
  if (u) unlist(Number(u.dataset.unlist));
  if (e.target.closest('[data-rent-all]')) startListingMany(idleOwned().map((h) => h.token));
  if (e.target.closest('[data-unlist-all]')) unlistAll();
  if (e.target.closest('[data-open-wallet]')) openWallet();
});
// the hero's two hooks: hire one, or bring yours and let it earn
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-hook]'); if (!b) return;
  $(b.dataset.hook === 'hire' ? '#hire-sec' : '#bring').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
setInterval(() => { payRentals(); renderEarn(); }, 20000);
for (const id of ['#mine', '#hire']) $(id).addEventListener('click', (e) => {
  const l = e.target.closest('[data-list]'), u = e.target.closest('[data-unlist]'), o = e.target.closest('[data-open-wallet]');
  if (l) startListing(Number(l.dataset.list));
  if (u) unlist(Number(u.dataset.unlist));
  if (o) openWallet();
});
$('#wsign').addEventListener('click', async () => {
  $('#wstatus').textContent = 'Check your wallet: it shows the same text as above.';
  try {
    await signOwnership(wActive, wAddr, wTokens, $('#wmsg').textContent);
    $('#wstatus').innerHTML = '<span class="verified">Signed. Your Chogs are marked as verified.</span> In the full game our server checks the signature; in this demo it stays in your browser.';
    sfx('coin'); renderAll(); renderHire(); payRentals(); // rentals that finished while you were away get paid now
  } catch (err) { $('#wstatus').textContent = err.message; }
});
$('#wdisc').addEventListener('click', async () => {
  await disconnect(wActive); wActive = null; wAddr = null; wTokens = []; setOwned([]);
  try { localStorage.removeItem(PASS_KEY); } catch {} // a self-transfer login ends here too
  paintConnect(); wpop.hidden = true; renderAll(); renderHire(); payRentals(); // rentals that finished while you were away get paid now
  $('#bring-msg').textContent = 'Disconnected. Your wallet no longer shares its address with this site.';
});
wpop.addEventListener('click', (e) => { if (e.target === wpop || e.target.closest('[data-wclose]')) wpop.hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !wpop.hidden) wpop.hidden = true; });
paintConnect();

/* ---------- FUD Forge ---------- */
const skulls = (n) => `<span class="skulls" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
// underline the words that fed the monster (words are letters/digits/$/% only, so they are safe inside a regex)
function marked(quote, words) {
  const safe = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
  if (!safe.length) return esc(quote);
  return esc(quote).replace(new RegExp(`(?<![\\w$])(${safe.join('|')})(?!\\w)`, 'gi'), '<mark>$1</mark>');
}
function previewFud() {
  const v = $('#post').value.trim(), out = $('#forge-read');
  if (!v) { out.textContent = ''; return; }
  const m = monsterFromPost(v);
  out.innerHTML = `<span>Reading:</span> <b>${esc(m.name)}</b> ${skulls(m.forge.level)} <span>Power ${m.power} · weak to ${ELEMENTS[m.weak].name}</span>`;
}
const FORGE_KEY = 'chog-contracts-forged';
try { const saved = localStorage.getItem(FORGE_KEY); if (saved) contracts.splice(contracts.length - 1, 0, monsterFromPost(saved)); } catch {}
function forge(text) {
  const m = monsterFromPost(text);
  try { localStorage.setItem(FORGE_KEY, text); } catch {}
  const old = contracts.findIndex((x) => x.custom); // one forged monster at a time
  if (old >= 0) contracts.splice(old, 1);
  contracts.splice(contracts.length - 1, 0, m); // before the boss
  $('#post').value = ''; previewFud();
  renderBoard(); sfx('monster');
  const card = $(`#board [data-hunt="${contracts.indexOf(m)}"]`)?.closest('.contract');
  card?.classList.add('forged');
  card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
$('#compose').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#post').value.trim(); if (!text) { $('#post').focus(); return; }
  forge(text);
});
$('#post').addEventListener('input', previewFud);
$('#samples').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) forge(b.textContent); });

/* ---------- the hunt: turn-based, in the arena ---------- */
let stopCan = null;
async function hunt(m) {
  const p = prog(current);
  const ranked = m.boss ? await rankedTicket(current).catch(() => null) : null; // the weekly boss counts on the shared board
  // a ranked hunt is fought at the server's fixed level (as its replay is), so everyone meets the boss on equal terms
  const lvl = ranked?.level || p.level, st = ranked?.level ? hunterStats(current, { level: lvl }) : hunterStats(current, p);
  if (ranked?.level) toast(`Ranked hunt: every Chog fights the boss at <b>level ${lvl}</b>, so only traits and play decide the board.`);
  openHunt({
    hunter: current, level: lvl, stats: st, monster: m, rand: ranked ? seededRand(ranked.seed) : Math.random,
    art: current.ghost ? APPR_ARENA : art(current), beast: monsterArt(m.kind, true), monColor: MON_COLOR[m.kind] || MON_COLOR.wraith,
    bag: loadBag(), onQuaff: (i) => { usePotion(i); drink(p, i); saveProgress(progress); }, // one free potion per fight
    onFinish: (res, close, fled = 0) => {
      if (!res) { // left the fight: before the first turn nothing happens; after it, running away is a loss
        if (fled > 0) { remember(p, m, { win: false, turns: fled }, { hired: !!current.hired }); injure(p, injuryHours(current)); saveProgress(progress); }
        renderAll(); return;
      }
      if (res.win && res.loot) p.xp += 10 * res.loot; // loot first, so it can count towards a level-up
      const gain = settle(p, m, res.win, res.mult);
      if (res.win) { const paid = payBounty(m, !!current.hired); gain.chog = paid.mine; gain.ownerCut = paid.owner; addPotion(m.reward); } // the potion goes straight into your bag
      if (res.win && m.daily) { // today's contract: keeps the streak, and the streak adds XP
        const d = winDaily(m.id, today), extra = Math.round(gain.xp * d.bonus);
        p.xp += extra; gain.xp += extra; gain.streak = d.streak; gain.bonus = d.bonus;
        while (p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level += 1; gain.levelUp = true; gain.level = p.level; }
      }
      gain.avenged = res.win && (p.log || []).some((e) => !e.win && !e.trip && e.kind === m.kind && !e.avenged);
      remember(p, m, res, { hired: !!current.hired, chog: res.win ? bounty(m) : 0 });
      if (!res.win) injure(p, injuryHours(current)); // losing hurts: hours off, or pay a healer
      if (m.boss) { bossLeft = Math.max(0.05, bossLeft - (res.win ? 0.06 : 0.02)); addBossDamage(res.dmg || 0, res.win); if (ranked) submitRanked(ranked, res, lvl); }
      saveProgress(progress);
      setTimeout(() => showResult(m, res, gain, close), 1500); // time to see the win/lose line first
    },
  });
}

function showResult(m, res, gain, close) {
  const box = $('#result'), weak = ELEMENTS[m.weak].name;
  if (res.win) {
    const P = POTIONS[m.reward];
    // the money first; the potion sits on the side as loot
    box.innerHTML = `<div class="card win">
      <div class="w-main"><p class="eyebrow">Contract complete · ${res.turns} turns${m.boss ? ' · shared boss hit' : ''}${gain.streak ? ` · streak ${gain.streak} day${gain.streak > 1 ? 's' : ''}` : ''}</p>
      <h3 class="w-chog">+${fmtChog(gain.chog)} <small>$CHOG</small></h3>
      ${m.quote ? `<blockquote class="w-fud">“${esc(m.quote)}”<span class="stamp">DEBUNKED</span></blockquote>` : ''}
      ${current.hired ? `<p class="w-owner"><b>+${fmtChog(gain.ownerCut)} $CHOG</b> to the owner of ${esc(current.name)}<span>${OWNER_CUT * 100}% for renting it out, without lifting a finger</span></p>` : ''}
      <div class="gains"><span>+${gain.xp} XP${gain.bonus ? ` · streak +${Math.round(gain.bonus * 100)}%` : ''}</span><span>+1 trophy</span>${gain.avenged ? '<span class="up">Scar avenged!</span>' : ''}${res.loot ? `<span>+${res.loot} fragment</span>` : ''}${gain.levelUp ? `<span class="up">Level ${gain.level}! · +8% health & damage</span>` : ''}</div>
      ${current.ghost ? '<p class="fade-note">Wannabe trophies fade in 24 h. With a Chog they stay for good.</p>' : ''}
      <div class="acts"><button type="button" class="btn" id="done">Collect</button><button type="button" class="btn ghost" id="share">Share on X</button></div></div>
      <aside class="w-loot"><canvas id="reward-can" aria-label="${P.name} potion bottle labelled with ${esc(P.chog)}"></canvas><div><b>${P.name} potion</b><small>${P.effect}</small><small class="w-bag">In your bag · ×${loadBag()[m.reward]}</small></div></aside></div>
      <div class="share-pop" id="share-pop" hidden><div class="share-in">
        <p class="eyebrow">Your hunt card</p><img id="share-img" alt="Share card: ${esc(current.name)} hunted the ${esc(m.name)}">
        <div class="acts"><button type="button" class="btn" id="share-go">Post on X</button><button type="button" class="btn ghost" id="share-save">Save image</button><button type="button" class="btn ghost" id="share-x">Close</button></div>
        <p class="lv" id="share-msg">Phone: the card goes straight into your post. Computer: it saves first, then drop it into the post that opens.</p>
      </div></div>`;
  } else {
    box.innerHTML = `<div class="card"><div class="noCan">fled</div>
      <div><p class="eyebrow">Injured</p><h3>The ${esc(m.name)} got away</h3>
      <p>${esc(current.name)} is hurt and can't hunt for ${injuryHours(current)} hours${current.ghost || current.hired ? ' (a Chog you own heals in half the time)' : ' (owners heal twice as fast)'}, unless a healer patches it up for ${fmtChog(HEAL_COST)} $CHOG. The loss goes into its journal as a scar; beat a ${esc(KIND_NAME[m.kind] || 'monster')} later to avenge it.</p>
      <p class="lv">Next time guard (W) when it says HEAVY, or bring a ${weak} Chog.</p>
      <div class="gains"><span>+${gain.xp} XP</span><span class="hurt">Injured · ${injuryHours(current)} h</span><span class="hurt">+1 scar</span>${gain.levelUp ? `<span class="up">Level ${gain.level}! · +8% health & damage</span>` : ''}</div>
      <button type="button" class="btn" id="done">Back to the board</button></div></div>`;
  }
  box.hidden = false;
  if (res.win) {
    rewardCan($('#reward-can'), m.reward).then((stop) => { stopCan = stop; }).catch(() => {});
    const P = POTIONS[m.reward], E = ELEMENTS[m.weak];
    const card = { hunterName: current.name, hunterImg: current.ghost ? 'assets/chogs/apprentice.png' : current.img, cutout: !!current.ghost,
      monsterName: m.name, monsterImg: `assets/monsters/${m.kind in MON_COLOR ? m.kind : 'wraith'}.png`, quote: m.quote, turns: res.turns,
      weakName: E.name, weakColor: E.color, potionName: P.name, potionColor: P.color, level: prog(current).level, bounty: gain.chog };
    let cv = null;
    const pop = $('#share-pop'), msg = $('#share-msg');
    $('#share').onclick = async () => {
      sfx('click'); pop.hidden = false;
      cv ||= await drawShareCard(card);
      try { $('#share-img').src = cv.toDataURL('image/png'); } catch { msg.textContent = 'This Chog\'s picture can\'t be put on a card here. You can still post the text.'; }
      $('#share-go').focus();
    };
    $('#share-go').onclick = async () => {
      const r = await shareHunt(cv, card); sfx('coin');
      msg.textContent = r === 'saved' ? 'Card saved. Attach it to the post that just opened on X.' : r === 'shared' ? 'Shared. Nice hunt.' : r === 'cancelled' ? 'Cancelled.' : 'Post opened on X.';
    };
    $('#share-save').onclick = async () => { msg.textContent = (await saveCard(cv, card)) ? 'Card saved to your downloads.' : 'Could not save the card here.'; };
    $('#share-x').onclick = () => { pop.hidden = true; $('#share').focus(); };  }
  $('#done').focus();
  $('#done').addEventListener('click', (e) => {
    if (res.win) sfx('drink');
    stopCan?.(); stopCan = null; box.hidden = true; close(); renderAll();
  }, { once: true });
}

const sfxBtn = $('#sfx');
const paintSfx = () => { sfxBtn.setAttribute('aria-pressed', String(sfxOn())); sfxBtn.querySelector('em').textContent = sfxOn() ? 'SFX on' : 'SFX off'; };
sfxBtn.addEventListener('click', () => { setSfx(!sfxOn()); paintSfx(); sfx('click'); });
paintSfx();
const musicBtn = $('#music');
const paintMusic = () => { musicBtn.setAttribute('aria-pressed', String(musicOn())); musicBtn.querySelector('em').textContent = musicOn() ? 'Music on' : 'Music off'; };
musicBtn.addEventListener('click', () => { setMusic(!musicOn()); paintMusic(); sfx('click'); });
paintMusic();

/* ---------- Brick Studio tab: the Chog's real art as a brick mosaic (src/brick.js) ---------- */
let studio = null, b3d = null; // studio: { h, size, m, pic }; b3d: the 3D view

/* ---------- the arcade (src/arcade.js): a painted room of cabinets. Pick one and the camera dives into its screen;
   the game takes the room's place, with a way back out ---------- */
let arcade = null, runner = null, arcadeGame = 'room'; // 'room', or the game you're in
const GAME_NAME = { studio: 'Brick Studio', drop: 'Chog Drop', run: 'Wannabe Run' };
let diving = false;
function openArcade() {
  if (!arcade) arcade = startArcade($('#arcade'), { onPick: enterGame });
  setGame(arcadeGame);
}
async function enterGame(g) {
  if (diving) return; diving = true; sfx('click');
  $('#arcade').scrollIntoView({ behavior: 'smooth', block: 'center' });
  await arcade.dive(g);
  setGame(g); diving = false;
  const panel = document.querySelector(`#studio [data-gp="${g}"]`);
  $('#ar-bar').scrollIntoView({ block: 'start' }); scrollBy(0, -80);
  panel?.animate([{ opacity: 0, transform: 'scale(1.06)', filter: 'brightness(1.8)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
async function leaveGame() {
  if (diving) return; diving = true; const from = arcadeGame; sfx('click');
  setGame('room');
  $('#arcade').scrollIntoView({ block: 'center' });
  await arcade.dive(from, true); diving = false; // backs out of the same screen
}
$('#ar-back').addEventListener('click', leaveGame);
function setGame(g) {
  arcadeGame = g;
  const inRoom = g === 'room';
  $('#arcade').hidden = !inRoom; $('#ar-bar').hidden = inRoom; $('#ar-now').textContent = GAME_NAME[g] || '';
  document.querySelectorAll('#studio [data-gp]').forEach((p) => { p.hidden = p.dataset.gp !== g; });
  arcade?.setActive(g); arcade?.pause(!inRoom); drop?.pause(g !== 'drop'); runner?.pause(g !== 'run');
  if (g === 'run' && !runner) {
    runner = startRunner($('#run-cv'), { onState: (s) => {
      if (!s.over) return;
      const reward = s.coins * 5; if (reward) { grantChog(reward); renderMe(); }
      sfx(reward ? 'coin' : 'hurt');
      $('#run-msg').innerHTML = `Score <b>${s.score}</b> · best <b>${s.best}</b>${s.coins ? ` · <span class="gold">+${fmtChog(reward)} test $CHOG</span> from ${s.coins} coin${s.coins > 1 ? 's' : ''}` : ''}`;
      $('#run-start').textContent = 'Run again'; $('#run-over').hidden = false;
    } });
  }
}
$('#run-start').addEventListener('click', () => { $('#run-over').hidden = true; runner?.start(); sfx('click'); });
// your own Chogs (loaded or verified); without one, a single sample Chog to try it with
const studioHunters = () => { const own = HUNTERS.filter(isOwned); return own.length ? own : SAMPLES.slice(0, 1); };
function setTab(tab) {
  if (tab === 'arcade') tab = 'brick'; // the address says #arcade; inside, the tab keeps its old name (#brick links still work)
  const brick = tab === 'brick', room = tab === 'room';
  planning = null; // an open expedition form never survives a tab change
  document.body.classList.toggle('tab-brick', brick); $('#studio').hidden = !brick; drop?.pause(!brick || arcadeGame !== 'drop');
  runner?.pause(!brick || arcadeGame !== 'run'); arcade?.pause(!brick);
  if (brick) openArcade();
  document.body.classList.toggle('tab-room', room); $('#room').hidden = !room;
  document.querySelectorAll('.tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  if (brick) openStudio();
  if (room) renderRoom();
  scrollTo({ top: 0 });
}

/* ---------- Wannabe's room (src/room.js: items, saved layout, lines) ---------- */
const sleeping = () => HUNTERS.filter((h) => (h.ghost || isOwned(h)) && injuredLeft(prog(h)) > 0); // only your own beds
let room = loadRoom(), selSlot = null, decoOpen = false; // the decorate drawer stays shut until asked for
// what the player has done, for the earned items
function roomStats() {
  const trophies = {}; for (const h of HUNTERS) for (const [k, n] of Object.entries(prog(h).trophies)) trophies[k] = (trophies[k] || 0) + n;
  let dropStars = 0;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('chog-contracts-drop-')) dropStars = Math.max(dropStars, JSON.parse(localStorage.getItem(k))?.stars || 0); } catch {}
  return { trophies, wins: Object.values(trophies).reduce((a, b) => a + b, 0), streak: dailyState().streak, dropStars, chogs: HUNTERS.filter(isOwned).length };
}
const itemById = (id) => ROOM_ITEMS.find((it) => it.id === id);
// your own Chog (loaded or verified) for the live wall pictures; the poster falls back to the sample Chog
const ownChog = () => HUNTERS.find(isOwned);
let posterURL = null, posterFor = null;
async function makePoster() { // the Chog as a 24×24 brick mosaic, drawn once per Chog
  const h = ownChog() || SAMPLES[0]; if (posterFor === h.id && posterURL) return;
  try {
    const m = mosaic(await loadPic(h.img), 24, 12), s = 10, cv = document.createElement('canvas'); cv.width = cv.height = m.size * s;
    const c = cv.getContext('2d');
    for (let k = 0; k < m.grid.length; k++) { const x = (k % m.size) * s, y = Math.floor(k / m.size) * s; c.fillStyle = PALETTE[m.grid[k]].hex; c.fillRect(x, y, s, s); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x + s / 2, y + s / 2, s * 0.3, 0, 7); c.fill(); }
    posterURL = cv.toDataURL('image/png'); posterFor = h.id; renderDeco();
  } catch {}
}
function itemArt(it) {
  if (it.id === 'portrait') { const h = ownChog(); return `<span class="pframe">${h ? `<img src="${img(h.img)}" alt="">` : ''}</span>`; }
  if (it.id === 'poster') return `<span class="poster">${posterURL ? `<img src="${posterURL}" alt="">` : ''}</span>`;
  return `<img src="${it.img}" alt="">`;
}
// the sky in the window follows the player's clock
// test override (shown with fast mode on): 'day' | 'dusk' | 'night', anything else = the player's clock
const LIGHT_KEY = 'chog-contracts-light';
const lightPick = () => { try { return localStorage.getItem(LIGHT_KEY) || 'auto'; } catch { return 'auto'; } };
const skyNow = () => { const o = lightPick(); if (o !== 'auto') return o; const h = new Date().getHours(); return h >= 8 && h < 17 ? 'day' : (h >= 17 && h < 20) || (h >= 6 && h < 8) ? 'dusk' : 'night'; };
function renderDeco() {
  const stats = roomStats(), placedIds = Object.values(room.slots);
  if (!posterURL || posterFor !== (ownChog() || SAMPLES[0]).id) makePoster();
  $('#r-sky').className = `r-sky ${skyNow()}`;
  $('#r-paints').innerHTML = Object.entries(room.paint).filter(([part, c]) => ROOM_PAINTS[part] && c && c !== 'purple').map(([part, c]) => { const b = ROOM_PAINTS[part].box;
    return `<img src="assets/room/${ROOM_PAINTS[part].dir}/${c}.png" alt="" style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%">`; }).join('');
  $('#r-slots').innerHTML = ROOM_SLOTS.map((s) => { const it = itemById(room.slots[s.id]);
    return `<button type="button" class="r-slot${it ? '' : ' empty'}${selSlot === s.id ? ' sel' : ''}" data-slot="${s.id}" style="--x:${s.x};--y:${s.y};--h:${s.h}" aria-label="${it ? `${esc(it.name)} on the ${s.label.toLowerCase()}, click to take it down` : `Empty spot: ${s.label.toLowerCase()}`}">${it ? itemArt(it) : ''}</button>`; }).join('');
  const sel = ROOM_SLOTS.find((s) => s.id === selSlot);
  const shown = ROOM_ITEMS.filter((it) => it.ready && (!sel || fits(it, sel)));
  const paintRow = (part) => `<div class="r-paint-row"><b>${ROOM_PAINTS[part].name}</b>${ROOM_COLORS.map(([c, hex]) => { const have = c === 'purple' || room.bought.includes(`${part}-${c}`), on = (room.paint[part] || 'purple') === c;
    return `<button type="button" class="r-sw${have ? '' : ' locked'}" data-paint="${part}:${c}" style="--c:${hex}" aria-pressed="${on}" title="${c[0].toUpperCase() + c.slice(1)}${have ? '' : ` · ${fmtChog(ROOM_PAINTS[part].price)} $CHOG`}" aria-label="${part} ${c}${have ? '' : `, buy for ${ROOM_PAINTS[part].price} test $CHOG`}"></button>`; }).join('')}</div>`;
  $('#room').classList.toggle('decorating', decoOpen);
  $('#r-gear').setAttribute('aria-pressed', String(decoOpen));
  if (!decoOpen) { $('#r-deco').innerHTML = ''; return; } // shut: just the two round buttons on the room (camera, gear)
  $('#r-deco').innerHTML = `<div class="row"><h3>Decorate</h3><span class="bal">${fmtChog(chogBalance())} test $CHOG</span><button type="button" class="btn ghost" data-deco-close>Done</button></div>
    <p>${sel ? `Pick something for the ${sel.label.toLowerCase()}.` : 'Click an item to put it in the room, or a spot in the room first. Pictures go on the wall. Click an item in the room to take it down.'}</p>
    <div class="r-items">${shown.map((it) => { const have = owns(it, room, stats), on = placedIds.includes(it.id);
      const state = on ? 'placed' : have ? '' : it.price ? 'shop' : 'locked';
      const note = on ? 'In the room' : have ? (it.wall ? 'Hang it up' : 'Put it up') : it.price ? `Buy · ${fmtChog(it.price)} $CHOG` : it.earn.hint;
      return `<button type="button" class="r-item ${state}" data-item="${it.id}" ${state === 'locked' ? 'aria-disabled="true"' : ''}>${itemArt(it)}<b>${esc(it.name)}</b><small>${esc(note)}</small></button>`; }).join('')}</div>
    ${paintRow('curtains')}${fastMode() ? `<div class="r-paint-row"><b>Light (test)</b>${[['auto', 'Auto'], ['day', 'Morning'], ['dusk', 'Evening'], ['night', 'Night']].map(([v, l]) => `<button type="button" class="r-light" data-light="${v}" aria-pressed="${lightPick() === v}">${l}</button>`).join('')}</div>` : ''}
    <div class="acts"><button type="button" class="btn ghost" id="r-faucet" title="Demo only: test tokens, worth nothing">+10,000 test $CHOG</button></div>`;
}
// the room's two corner buttons: snap a photo, and the gear that opens decorating
$('#r-cam').addEventListener('click', () => shareRoom());
$('#r-gear').addEventListener('click', () => { decoOpen = !decoOpen; selSlot = null; sfx('click'); renderDeco(); if (decoOpen) $('#r-deco').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
$('#r-slots').addEventListener('click', (e) => {
  const b = e.target.closest('[data-slot]'); if (!b || !decoOpen) return; // the room is just a room until you decorate
  const id = b.dataset.slot;
  if (room.slots[id]) { delete room.slots[id]; saveRoom(room); selSlot = null; sfx('click'); }
  else selSlot = selSlot === id ? null : id;
  renderDeco();
});
$('#r-deco').addEventListener('click', (e) => {
  if (e.target.closest('[data-deco-close]')) { decoOpen = false; selSlot = null; renderDeco(); return; }
  const lb = e.target.closest('[data-light]');
  if (lb) { try { localStorage.setItem(LIGHT_KEY, lb.dataset.light); } catch {} sfx('click'); renderDeco(); return; }
  if (e.target.closest('#r-faucet')) { grantChog(10000); sfx('coin'); renderMe(); renderDeco(); kidSay('Ooh, shiny test tokens! Let\'s go shopping.'); return; }
  const p = e.target.closest('[data-paint]');
  if (p) { // rug / curtain colours: purple is the painting, the rest are bought once
    const [part, c] = p.dataset.paint.split(':'), key = `${part}-${c}`;
    if (c !== 'purple' && !room.bought.includes(key)) {
      if (!spendChog(ROOM_PAINTS[part].price)) { kidSay(`A new ${ROOM_PAINTS[part].name.toLowerCase()} costs ${fmtChog(ROOM_PAINTS[part].price)} $CHOG. Go hunt something!`); return; }
      room.bought.push(key); sfx('coin'); renderMe();
    }
    room.paint[part] = c; saveRoom(room); sfx('click'); renderDeco(); return;
  }
  const b = e.target.closest('[data-item]'); if (!b) return;
  const it = itemById(b.dataset.item), stats = roomStats();
  if (Object.values(room.slots).includes(it.id)) { for (const [s, v] of Object.entries(room.slots)) if (v === it.id) delete room.slots[s]; saveRoom(room); renderDeco(); return; }
  if (!owns(it, room, stats)) {
    if (!it.price) return; // earned items unlock by playing
    if (!spendChog(it.price)) { kidSay(`We need ${fmtChog(it.price)} $CHOG for that. Go hunt something!`); return; }
    room.bought.push(it.id); sfx('coin'); renderMe();
  }
  const pickable = ROOM_SLOTS.filter((s) => fits(it, s));
  const slot = pickable.find((s) => s.id === selSlot && !room.slots[s.id])?.id || pickable.find((s) => !room.slots[s.id])?.id;
  if (!slot) { kidSay(it.wall ? 'The wall is full! Take a picture down first.' : 'No room left! Take something down first.'); renderDeco(); return; }
  room.slots[slot] = it.id; selSlot = null; saveRoom(room); sfx('click');
  kidSay(it.id === 'portrait' ? `${ownChog()?.name || 'Your Chog'} on my wall! Best day ever.` : `Ooh, the ${it.name.toLowerCase()}! Perfect.`); renderDeco();
});
// share card: the room as it looks now, drawn onto a 1200×675 canvas
async function shareRoom() {
  const st = $('#room-stage'), W = 1200, H = Math.round(W * 941 / 1672), cv = document.createElement('canvas'); cv.width = W; cv.height = H + 64;
  const c = cv.getContext('2d'), load = (src) => loadPic(src).catch(() => null), box = (el) => { const r = el.getBoundingClientRect(), s = st.getBoundingClientRect(); return [(r.left - s.left) / s.width * W, (r.top - s.top) / s.height * H, r.width / s.width * W, r.height / s.height * H]; };
  const bg = await load('assets/room/room.jpg'); if (bg) c.drawImage(bg, 0, 0, W, H);
  const sky = $('#r-sky'); if (!sky.classList.contains('night')) { const [x, y, w, h] = box(sky); const g = c.createLinearGradient(0, y, 0, y + h); if (sky.classList.contains('day')) { g.addColorStop(0, '#7cc4ff'); g.addColorStop(1, '#bfe6ff'); } else { g.addColorStop(0, '#5b3f8f'); g.addColorStop(0.6, '#e0727a'); g.addColorStop(1, '#ffb36b'); } c.fillStyle = g; c.fillRect(x, y, w, h); }
  for (const el of st.querySelectorAll('.r-slot .pframe, .r-slot .poster')) { const [x, y, w, h] = box(el); c.fillStyle = el.classList.contains('poster') ? '#f2ead8' : '#6e4a2c'; c.fillRect(x, y, w, h); }
  for (const el of st.querySelectorAll('.r-paints img, .r-sleepers img, .r-slot img, .r-kid img')) { const im = await load(el.src); if (!im) continue; const [x, y, w, h] = box(el); c.drawImage(im, x, y, w, h); }
  c.fillStyle = '#0e0b1a'; c.fillRect(0, H, W, 64);
  c.fillStyle = '#f2ece0'; c.font = '400 34px Koulen, sans-serif'; c.textBaseline = 'middle'; c.fillText("WANNABE'S ROOM", 24, H + 33);
  c.fillStyle = '#a99bfc'; c.font = '600 18px "JetBrains Mono", monospace'; c.textAlign = 'right'; c.fillText('CHOG CONTRACTS · #Chogathon', W - 24, H + 33);
  openSnap(cv, 'Wannabe\'s room', 'Decorated my Wannabe\'s room in Chog Contracts. @ChogNFT #Chogathon', 'wannabe-room.png');
  kidSay('Say cheese!'); sfx('click');
}
/* ---------- expeditions (src/expedition.js): plan, wait, decide, unpack ---------- */
const travellers = () => HUNTERS.filter((h) => h.ghost || isOwned(h)); // your own Chogs and the Wannabe; hired Chogs only hunt, previews can't travel
let planning = null; // { id, place, trip, snacks } while the send form is open
const clock = (t) => new Date(t).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
function renderTrips() {
  const now = Date.now(), unit = fastMode() ? 'min' : 'h';
  const rows = travellers().map((h) => {
    const p = prog(h), t = p.trip, st = hunterStats(h, p), el = st.kit.element;
    const head = (pill, cls, action = '') => `<div class="tr-top">${avatar(h)}<div class="tr-who"><b>${esc(h.name)}</b><span class="tr-pill ${cls}">${pill}</span></div>${action}</div>`;
    if (!t) {
      const why = injuredLeft(p) ? `Injured · ${dur(injuredLeft(p))}` : '';
      if (planning?.id !== h.id) return `<li class="tr-card">${head(why || 'At the lodge', why ? 'hurt' : 'home', `<button type="button" class="btn tr-cta" data-plan="${esc(h.id)}" ${why ? 'disabled' : ''}>Send out</button>`)}</li>`;
      const places = TRIP_PLACES.filter((pl) => (h.ghost ? pl.wannabe : true));
      const pl = TRIP_PLACES.find((x) => x.id === planning.place), tr = TRIP_LENGTHS.find((x) => x.id === planning.trip);
      const risk = tr.risk - (pl.weak === el ? 0.12 : 0) - (planning.snacks ? 0.1 : 0);
      const back = new Date(now + tr.hours * (fastMode() ? 60 : 3600) * 1000);
      return `<li class="tr-card open">${head('Planning a trip', 'plan')}
        <p class="tr-step">Where to</p>
        <div class="tr-places">${places.map((x) => `<button type="button" class="tr-place" data-place="${x.id}" aria-pressed="${planning.place === x.id}">${x.kind ? `<img src="assets/monsters/${x.kind}.png" alt="">` : '<i class="tr-yard">🏡</i>'}<b>${x.name}</b><small>${x.blurb}</small>${x.weak && x.weak === el ? `<em>${ELEMENTS[el].name} fits</em>` : ''}</button>`).join('')}</div>
        ${h.ghost ? '<p class="tr-note">The Wannabe only explores the backyard. Real Chogs go further.</p>' : ''}
        <p class="tr-step">How long</p>
        <div class="tr-seg" role="group">${TRIP_LENGTHS.map((x) => `<button type="button" data-len="${x.id}" aria-pressed="${planning.trip === x.id}"><b>${x.hours} ${unit}</b><small>${x.id === 'short' ? 'Safe' : x.id === 'mid' ? 'Some risk' : 'Risky · big haul'}</small></button>`).join('')}</div>
        <label class="tr-snacks"><input type="checkbox" data-snacks ${planning.snacks ? 'checked' : ''}><span>Pack snacks</span><small>${fmtChog(TRIP_SNACKS)} test $CHOG · lowers the risk</small></label>
        <div class="tr-foot"><span>Back at ${clock(back)} · risk <b class="r-${risk < 0.12 ? 'low' : risk < 0.25 ? 'mid' : 'high'}">${risk < 0.12 ? 'low' : risk < 0.25 ? 'medium' : 'high'}</b></span><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn" data-go="${esc(h.id)}">Send ${esc(h.name)}</button></div></li>`;
    }
    const place = TRIP_PLACES.find((x) => x.id === t.place), seen = t.diary.filter((d) => d.at <= now), back = tripBack(t);
    const ch = t.choice, asking = !back && now >= ch.at && !ch.pick;
    // diary lines and the decision, in time order
    const entries = seen.map((d) => ({ at: d.at, html: esc(d.text) }));
    if (ch.pick || (back && now >= ch.at)) entries.push({ at: ch.at, pick: true, html: `${esc(ch.q)} <b>${ch.pick ? 'You said' : `${esc(h.name)} decided`}: ${esc((ch.pick || ch.auto) === 'a' ? ch.a : ch.b)}.</b> ${esc(((ch.pick || ch.auto) === 'a' ? ch.ra : ch.rb) || '')}` });
    const diary = entries.length ? `<ol class="tr-diary">${entries.sort((x, y) => x.at - y.at).map((d) => `<li${d.pick ? ' class="tr-pick"' : ''}><time>${clock(d.at)}</time>${d.html}</li>`).join('')}</ol>` : '<p class="tr-note">No news yet. The first diary page arrives soon.</p>';
    if (back) {
      const r = tripResult(t, el);
      return `<li class="tr-card back">${head(`Back from ${place.name}`, 'back', `<button type="button" class="btn tr-cta" data-unpack="${esc(h.id)}">Unpack</button>`)}${diary}
        <p class="tr-end">${esc(r.ending)}</p>
        <div class="gains"><span>+${r.xp} XP</span>${r.chog ? `<span class="g-chog">+${fmtChog(r.chog)} $CHOG</span>` : ''}${r.match ? `<span>${ELEMENTS[el].name} bonus</span>` : ''}${r.hurt ? '<span class="hurt">Injured</span>' : ''}</div></li>`;
    }
    const pct = Math.min(100, (now - t.start) / (t.end - t.start) * 100);
    return `<li class="tr-card away">${head(`${place.name} · ${dur(tripLeft(t))} left`, 'away', `<button type="button" class="btn ghost tr-cta" data-map="${esc(h.id)}">Map</button>`)}
      <button type="button" class="tr-bar" data-map="${esc(h.id)}" aria-label="Show ${esc(h.name)} on the map"><i style="width:${pct.toFixed(1)}%"></i></button>${diary}
      ${asking ? `<div class="tr-ask"><p>${esc(ch.q)}</p><div class="acts"><button type="button" class="btn" data-pick="${esc(h.id)}:a">${esc(ch.a)}</button><button type="button" class="btn ghost" data-pick="${esc(h.id)}:b">${esc(ch.b)}</button></div><small>No answer by the time it's back? ${esc(h.name)} decides.</small></div>` : ''}</li>`;
  });
  $('#r-trips').innerHTML = `<div class="tr-head"><div><p class="eyebrow">Out in the world</p><h3>Expeditions</h3></div><label class="tr-fast"><input type="checkbox" data-fast ${fastMode() ? 'checked' : ''}><span>Fast mode</span><small>demo</small></label></div>
    <p class="tr-sub">Send a Chog away. It writes a diary, and comes home with XP and test $CHOG.</p>
    <ul class="tr-list">${rows.join('')}</ul>`;
}$('#r-trips').addEventListener('change', (e) => {
  if (e.target.matches('[data-fast]')) { setFastMode(e.target.checked); renderTrips(); renderDeco(); } // the test light switch shows with fast mode
  if (e.target.matches('[data-snacks]') && planning) { planning.snacks = e.target.checked; renderTrips(); } // the risk line updates
});
$('#r-trips').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const find = (id) => HUNTERS.find((x) => x.id === id);
  if (b.dataset.plan) { const h = find(b.dataset.plan); planning = { id: h.id, place: h.ghost ? 'backyard' : 'swamp', trip: 'short', snacks: false }; }
  else if (b.dataset.place) planning.place = b.dataset.place;
  else if (b.dataset.len) planning.trip = b.dataset.len;
  else if (b.hasAttribute('data-cancel')) planning = null;
  else if (b.dataset.go) {
    const h = find(b.dataset.go), p = h && prog(h);
    // checked again at the last moment: the form may be stale (hurt, away, or no longer yours since it opened)
    if (!h || !travellers().includes(h) || p.trip || injuredLeft(p)) { planning = null; renderTrips(); return; }
    const st = hunterStats(h, p);
    if (planning.snacks && !spendChog(TRIP_SNACKS)) { kidSay(`Snacks cost ${fmtChog(TRIP_SNACKS)} $CHOG. Go without, or hunt a bit first.`); return; }
    p.trip = planTrip({ name: h.name, traits: h.traits, cls: st.kit.classInfo.name, element: st.kit.element, ghost: !!h.ghost }, planning.place, planning.trip, planning.snacks);
    planning = null; saveProgress(progress); sfx('coin'); renderAll();
    kidSay(h.ghost ? 'Backyard adventure! Back soon!' : `Bye ${h.name}! Bring me a story!`);
    openTripMap(h); // watch it set off
  } else if (b.dataset.map) { openTripMap(find(b.dataset.map)); return; }
  else if (b.dataset.pick) {
    const [id, pick] = b.dataset.pick.split(':'), h = find(id), t = prog(h).trip;
    if (t && !t.choice.pick && !tripBack(t)) { t.choice.pick = pick; saveProgress(progress); sfx('click'); }
  } else if (b.dataset.unpack) {
    const h = find(b.dataset.unpack), p = prog(h), t = p.trip, el = hunterStats(h, p).kit.element, r = tripResult(t, el);
    const place = TRIP_PLACES.find((x) => x.id === t.place);
    p.xp += r.xp; while (p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level += 1; }
    if (r.chog) grantChog(r.chog);
    if (r.hurt) injure(p, injuryHours(h));
    p.log ||= []; p.since ||= Date.now();
    p.log.unshift({ at: Date.now(), kind: place.kind || 'ghoul', name: place.name, quote: t.diary[0]?.text || '', win: r.ok, trip: true, turns: 0, potion: null, chog: r.chog });
    p.log.length = Math.min(p.log.length, 40);
    p.trip = null; saveProgress(progress); sfx(r.ok ? 'win' : 'hurt'); renderAll(); renderRoom();
    kidSay(r.ok ? `${h.ghost ? 'I' : h.name} made it back! What a trip.` : `${h.ghost ? 'Ow. I' : `Oh no, ${h.name}`} got hurt out there. ${h.ghost ? 'Worth it.' : 'Into the bed!'}`);
  } else return;
  renderTrips(); renderDeco(); // the balance in the decorate panel moves too
});
setInterval(() => { if (!$('#room').hidden && !planning) { renderTrips(); renderBeds(); } }, 5000); // diary lines and the choice arrive while you watch (not while the send form is open)

/* ---------- trip map (src/tripmap.js): the road to the place, the Chog on it, diary pins, the halfway choice ---------- */
let mapH = null, mapTimer = 0;
function paintTripMap() {
  const h = mapH, t = h && prog(h).trip; if (!t) { closeTripMap(); return; }
  const place = TRIP_PLACES.find((x) => x.id === t.place), now = Date.now(), back = tripBack(t), ch = t.choice;
  const asking = !back && now >= ch.at && !ch.pick, last = [...t.diary].filter((d) => d.at <= now).pop();
  const pic = h.ghost ? 'assets/chogs/apprentice-face.png' : (/^(https:\/\/|assets\/)/.test(h.img || '') ? h.img : null);
  const f = Math.min(1, (now - t.start) / (t.end - t.start)), where = back ? 'Back at the lodge' : f < 0.3 ? `On the road to ${place.name}` : f < 0.7 ? `Exploring ${place.name}` : 'Heading home';
  $('#tmap-body').innerHTML = `<div class="tm-head"><div><p class="eyebrow">Expedition</p><h3 id="tmap-title">${esc(h.name)} · ${esc(place.name)}</h3></div><span class="tr-pill ${back ? 'back' : 'away'}">${back ? 'Back!' : `${esc(where)} · ${dur(tripLeft(t))} left`}</span></div>
    <div class="tm-stage${asking ? ' asking' : ''}">${tripMapSvg({ t, place, h: { name: h.name, img: pic, ghost: !!h.ghost }, places: TRIP_PLACES, now, night: skyNow() === 'night' })}
      ${asking ? `<div class="tm-ask" role="dialog" aria-label="${esc(h.name)} needs you"><p class="eyebrow">${esc(h.name)} needs you</p><p class="tm-q-text">${esc(ch.q)}</p><div class="acts"><button type="button" class="btn" data-mpick="a">${esc(ch.a)}</button><button type="button" class="btn ghost" data-mpick="b">${esc(ch.b)}</button></div><small>No answer by the time it's back? ${esc(h.name)} decides.</small></div>` : ''}</div>
    <p class="tm-last">${last ? `<time>${clock(last.at)}</time> ${esc(last.text)}` : 'No diary page yet. The first one arrives soon.'}</p>
    ${back ? '<p class="tm-last">It\'s home. Unpack it in the Expeditions panel to see what it brought back.</p>' : ''}`;
}
function openTripMap(h) {
  if (!h || !prog(h).trip) return;
  if ($('#tmap').parentNode !== document.body) document.body.append($('#tmap'));
  mapH = h; paintTripMap(); $('#tmap').hidden = false; document.body.style.overflow = 'hidden'; $('#tmap-x').focus();
  clearInterval(mapTimer); mapTimer = setInterval(paintTripMap, fastMode() ? 500 : 2000);
}
function closeTripMap() { if ($('#tmap').hidden) return; clearInterval(mapTimer); $('#tmap').hidden = true; mapH = null; document.body.style.overflow = ''; renderTrips(); }
$('#tmap').addEventListener('click', (e) => {
  if (e.target === e.currentTarget || e.target.closest('#tmap-x')) { closeTripMap(); return; }
  const b = e.target.closest('[data-mpick]'), t = mapH && prog(mapH).trip;
  if (b && t && !t.choice.pick && !tripBack(t)) { t.choice.pick = b.dataset.mpick; saveProgress(progress); sfx('click'); paintTripMap(); }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTripMap(); });
function renderRoom() { renderDeco(); renderTrips(); renderBeds(); }
function renderBeds() { // the bed, the sore Wannabe and the 'In bed' list
  const beds = sleeping();
  // real Chogs lie in the bed; a hurt Wannabe just stands there sore (it's its own room)
  $('#r-kid').classList.toggle('sore', beds.some((h) => h.ghost));
  $('#r-sleepers').innerHTML = beds.filter((h) => !h.ghost).slice(0, 3).map((h) => `${avatar(h).replace('<img ', `<img title="${esc(h.name)}, resting" `)}`).join('');
  $('#r-care').innerHTML = beds.length
    ? `<h3>In bed</h3><ul>${beds.map((h) => { const p = prog(h), wait = tuckWait(p);
        return `<li>${avatar(h)}<span><b>${esc(h.name)}</b><small>Back in ${dur(injuredLeft(p))}</small></span><button type="button" class="btn${wait ? ' ghost' : ''}" data-tuck="${esc(h.id)}" ${wait ? 'disabled' : ''}>${wait ? `Resting · ${dur(wait)}` : `Tuck in · −${TUCK_MIN} min`}</button></li>`; }).join('')}</ul>
       <p>Sit with a hurt hunter and it heals ${TUCK_MIN} min faster. Once every ${TUCK_EVERY_MIN} min each.</p>`
    : '<h3>Everyone is up</h3><p>Nobody is hurt. When a hunter loses, it rests in this bed, and visiting it here helps it heal faster.</p>';
}
$('#r-care').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tuck]'); if (!b) return;
  const h = HUNTERS.find((x) => x.id === b.dataset.tuck);
  if (h && tuckIn(prog(h))) { saveProgress(progress); sfx('heal'); renderAll(); renderRoom(); kidSay(h.ghost ? 'Thanks! I feel better already.' : `There you go, ${h.name}. Sleep tight.`); }
});
let sayT = 0;
function kidSay(text) {
  const say = $('#r-say'), kid = $('#r-kid');
  say.textContent = text; say.hidden = false;
  kid.classList.remove('hop'); void kid.offsetWidth; kid.classList.add('hop');
  clearTimeout(sayT); sayT = setTimeout(() => { say.hidden = true; }, 4200);
}
$('#r-kid').addEventListener('click', () => {
  const all = HUNTERS.map((h) => prog(h)), trophies = {};
  for (const p of all) for (const [k, n] of Object.entries(p.trophies)) trophies[KIND_NAME[k] || k] = (trophies[KIND_NAME[k] || k] || 0) + n;
  const scars = [...new Set(all.flatMap((p) => (p.log || []).filter((e) => !e.win && !e.trip && !e.avenged).map((e) => KIND_NAME[e.kind] || 'monster')))];
  kidSay(wannabeLine({ away: HUNTERS.filter((h) => !h.ghost && prog(h).trip).map((h) => h.name), sore: sleeping().some((h) => h.ghost), sleeping: sleeping().filter((h) => !h.ghost).map((h) => h.name), chogs: HUNTERS.filter(isOwned).map((h) => h.name), trophies, scars, placed: Object.values(room.slots).map((id) => itemById(id)?.name).filter(Boolean) }));
  sfx('click');
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const a = e.target.closest('[data-tab]'); if (!a) return;
  e.preventDefault(); history.replaceState(null, '', location.pathname + location.search); setTab(a.dataset.tab); sfx('click'); // the address stays clean: no #tab in it
});
const loadPic = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function openStudio() {
  const list = studioHunters(), pick = list.includes(current) ? current : list[0];
  $('#st-sample').hidden = list.some(isOwned);
  $('#st-chog').innerHTML = list.map((h) => `<option value="${esc(h.id)}"${h === pick ? ' selected' : ''}>${esc(h.name)}</option>`).join('');
  await buildStudio(pick, studio?.size || 32);
}
// the workbench reports its state here: progress, this step's colours, and the save to keep
const BUILD_KEY = (h, size) => `chog-contracts-bricks-${h.token}-${size}`;
let saveT = 0, clickT = 0;
function paintBench(s) {
  $('#st-progress').innerHTML = s.finished ? `<b>Built!</b> ${s.total.toLocaleString('en-US')} pieces` : `Step <b>${s.step}</b> / ${s.steps} · ${s.placed.toLocaleString('en-US')} / ${s.total.toLocaleString('en-US')} pieces`;
  $('#st-colors').innerHTML = s.finished
    ? `<p class="done">${esc(studio.h.name)} is built. Turn it with Spin, or play Chog Drop below.</p>`
    : s.colors.map((c) => `<button type="button" data-col="${c.i}" aria-pressed="${s.selected === c.i}" title="${esc(PALETTE[c.i].name)}" aria-label="${esc(PALETTE[c.i].name)}, ${c.left} left" style="--c:${PALETTE[c.i].hex}"><i></i><b>${c.left}</b></button>`).join('');
  $('#st-playbtn').textContent = b3d?.playing() ? 'Pause' : 'Play';
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(BUILD_KEY(studio.h, studio.size), s.saved); } catch {} }, 400);
}
async function buildStudio(h, size) {
  $('#st-progress').textContent = 'Laying out the bricks…';
  try {
    await Promise.race([Promise.all(['64px Koulen', '500 20px Inter', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f))), wait(2000)]).catch(() => {});
    const pic = await loadPic(h.img), m = mosaic(pic, size);
    if (studio?.h !== h) resetDrop();
    studio = { h, size, m, pic };
    arcade?.setChog(h.img); // the Brick Studio cabinet shows this Chog in pixels
    // the workbench (three.js), created the first time the studio opens; each Chog and size keeps its own progress
    b3d ||= startBrickBuilder($('#st-3d'), {
      onChange: paintBench,
      onPlace: () => { const now = performance.now(); if (now - clickT > 70) { clickT = now; sfx('click'); } },
      onStepDone: (all) => sfx(all ? 'win' : 'coin'),
    });
    let saved = null; try { saved = localStorage.getItem(BUILD_KEY(h, size)); } catch {}
    b3d.setMosaic(m, cutPieces(m, h.token), saved);
  } catch { $('#st-progress').textContent = 'Could not load this Chog\'s picture. Try another one.'; }
}
let playSpeed = 1;
$('#st-colors').addEventListener('click', (e) => { const b = e.target.closest('[data-col]'); if (b) { b3d?.select(Number(b.dataset.col)); sfx('click'); } });
$('#st-fill').addEventListener('click', () => { b3d?.fillStep(); });
$('#st-reset').addEventListener('click', () => { b3d?.reset(); });
$('#st-playbtn').addEventListener('click', () => { if (!b3d) return; b3d.play(b3d.playing() ? 0 : playSpeed); $('#st-playbtn').textContent = b3d.playing() ? 'Pause' : 'Play'; });
document.querySelector('.st-play').addEventListener('click', (e) => {
  const b = e.target.closest('[data-speed]'); if (!b) return;
  playSpeed = Number(b.dataset.speed);
  document.querySelectorAll('.st-play [data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  if (b3d?.playing()) b3d.play(playSpeed);
});
document.querySelector('.st-views').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) b3d?.view(b.dataset.view); });
$('#st-chog').addEventListener('change', (e) => { const h = HUNTERS.find((x) => x.id === e.target.value); if (h) buildStudio(h, studio?.size || 32); });
document.querySelector('.st-size').addEventListener('click', (e) => {
  const b = e.target.closest('[data-size]'); if (!b || !studio) return;
  document.querySelectorAll('.st-size [data-size]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  buildStudio(studio.h, Number(b.dataset.size));
});

/* ---------- Chog Drop: the Tetris-like mini game under the workbench (src/chogdrop.js) ---------- */
let drop = null, dropSize = 12;
const DROP_KEY = (h, n) => `chog-contracts-drop-${h.token}-${n}`;
const secs = (t) => `${t.toFixed(1)}s`;
function dropBest() { try { return JSON.parse(localStorage.getItem(DROP_KEY(studio.h, dropSize))); } catch { return null; } }
function resetDrop() {
  drop?.stop(); drop = null;
  const cv = $('#dr-cv'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  $('#dr-over').hidden = false; $('#dr-result').hidden = true; $('#drop .drop-stats').hidden = false;
  $('#dr-msg').textContent = 'Pieces of your Chog fall from the top. Each one has one right spot. Turn it, steer it, drop it in. A wrong landing breaks it and costs 5 seconds.';
  $('#dr-time').textContent = '0.0s'; $('#dr-miss').textContent = '0'; $('#dr-left').textContent = '–';
  queueMicrotask(() => { const b = studio && dropBest(); $('#dr-best').textContent = b ? secs(b.score) : '–'; });
}
function startDrop() {
  if (!studio?.pic) return;
  drop?.stop();
  // the picture is 3× finer than the board: each board cell carries a 3×3 patch, so pieces are real
  // tetrominoes (cut on a blank grid, any colours) with a piece of the Chog printed on them
  const h = studio.h, K = 3, detail = mosaic(studio.pic, dropSize * K, 16);
  const pieces = cutPieces({ size: dropSize, grid: new Array(dropSize * dropSize).fill(0) }, h.token * 31 + dropSize);
  $('#dr-over').hidden = true; $('#dr-result').hidden = true; $('#drop .drop-stats').hidden = false;
  drop = startChogDrop($('#dr-cv'), { size: dropSize, k: K, detail }, pieces, {
    seed: Date.now() % 1e9, target: $('#dr-target').checked,
    onState: (s) => { $('#dr-time').textContent = secs(s.time); $('#dr-miss').textContent = String(s.misses); $('#dr-left').textContent = `${s.left} / ${s.playable}`; },
    onLock: () => sfx('click'),
    onMiss: () => sfx('hurt'),
    onEnd: (r) => {
      const stars = r.misses <= 1 ? 3 : r.misses <= 4 ? 2 : 1, best = dropBest(), isBest = !best || r.score < best.score;
      if (isBest) try { localStorage.setItem(DROP_KEY(h, dropSize), JSON.stringify({ score: r.score, misses: r.misses, stars, at: Date.now() })); } catch {}
      $('#dr-best').textContent = secs(isBest ? r.score : best.score);
      // the result goes beside the board, so the finished picture stays in full view
      $('#dr-result').innerHTML = `<p class="stars" aria-label="${stars} of 3 stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></p>
        <h4>${esc(h.name)} is built!${isBest ? ' <em>New best</em>' : ''}</h4>
        <dl><div><dt>Time</dt><dd>${secs(r.time - r.misses * 5)}</dd></div><div><dt>Mistakes</dt><dd>${r.misses}${r.misses ? ` <small>+${r.misses * 5}s</small>` : ''}</dd></div><div class="sc"><dt>Score</dt><dd>${secs(r.score)}</dd></div></dl>
        <button type="button" class="btn" id="dr-again">Play again</button>`;
      $('#dr-result').hidden = false; $('#drop .drop-stats').hidden = true; sfx('win');
    },
  });
}
$('#dr-start').addEventListener('click', () => { startDrop(); sfx('click'); });
$('#dr-result').addEventListener('click', (e) => { if (e.target.closest('#dr-again')) { startDrop(); sfx('click'); } });
$('#dr-target').addEventListener('change', (e) => drop?.setTarget(e.target.checked));
$('#drop').querySelector('.st-size').addEventListener('click', (e) => {
  const b = e.target.closest('[data-drop]'); if (!b) return;
  dropSize = Number(b.dataset.drop);
  $('#drop').querySelectorAll('[data-drop]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  resetDrop(); sfx('click');
});
$('#drop').querySelector('.drop-pad').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b && drop) drop[b.dataset.k](); });
document.addEventListener('visibilitychange', () => drop?.pause(document.hidden || $('#studio').hidden)); // only runs while you can see it

renderAll(); renderHire(); payRentals(); // rentals that finished while you were away get paid now
if (['#arcade', '#brick', '#room'].includes(location.hash)) setTab(location.hash.slice(1));
startGlow(); // cards light up where the mouse is (src/glow.js)
startTouches(); // numbers roll up, buttons spring (src/motion.js)
loadLive(); // the shared weekly board, when the site runs with its server
/* back to the top: the button shows once you're well down the page; a purple wave rises with the Wannabe, the page
   jumps to the top behind it, and the wave carries on up and away (as on the Tatlıca site, without GSAP) */
{
  const btn = $('#topbtn'), rise = $('#rise');
  let rising = false;
  addEventListener('scroll', () => btn.classList.toggle('is-on', scrollY > innerHeight * 0.8 && !rising), { passive: true });
  btn.addEventListener('click', async () => {
    if (rising) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { scrollTo({ top: 0, behavior: 'auto' }); return; }
    rising = true; btn.classList.remove('is-on'); rise.classList.add('is-on'); sfx('click');
    const H = innerHeight, W = 80, body = rise.querySelector('.rise-body img');
    const up = rise.animate([{ transform: `translateY(${H + W}px)` }, { transform: 'translateY(0)' }], { duration: 900, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' });
    body.animate([{ transform: 'translateY(60px) scale(.8)' }, { transform: 'translateY(-14px) scale(1.05)', offset: 0.7 }, { transform: 'none' }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
    await Promise.race([up.finished, new Promise((r) => setTimeout(r, 1000))]);
    scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 250));
    const away = rise.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-(H + W * 2)}px)` }], { duration: 900, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' });
    await Promise.race([away.finished, new Promise((r) => setTimeout(r, 1000))]);
    rise.classList.remove('is-on'); rise.getAnimations().forEach((a) => a.cancel()); body.getAnimations().forEach((a) => a.cancel());
    rising = false;
  });
}// back/forward and edited links switch tabs too
addEventListener('hashchange', () => { const tab = location.hash.slice(1); if (tab === 'arcade' || tab === 'brick' || tab === 'room' || tab === 'hunt' || tab === '') setTab(tab || 'hunt'); });
// the door shows your own Chogs if this browser has seen your wallet before; otherwise two sample Chogs, picked at random
const gateOwned = HUNTERS.filter((h) => h.brought && isOwned(h)), gateMine = gateOwned.slice(0, 6), WHALE = 5; // 5+ Chogs: the door rolls out the gold

const gateSpare = [...SAMPLES].sort(() => Math.random() - 0.5);
// FX Lab (demo.html?lab, or the separate test copy): no door, straight into a test arena; nothing is saved
const LAB = window.CHOG_LAB === true || new URLSearchParams(location.search).has('lab');
if (LAB) {
  $('#gate')?.remove(); document.documentElement.classList.add('entered', 'intro-seen');
  import('./fxlab.js').then(({ startLab }) => startLab({
    hunters: HUNTERS, // every kind of monster, so each arena ground can be seen (the boss last)
    monsters: [...MONSTERS.filter((m) => !m.boss), ...['testnet forever, chain is stuck and broken', 'floor is down bad, -80%, dump it', 'chogs are mid jpegs, no utility'].map(monsterFromPost), BOSS],
    open: (h, m) => {
      const st = hunterStats(h, fresh());
      return { el: st.kit.element, ...openHunt({ hunter: h, level: 1, stats: st, monster: m, art: h.ghost ? APPR_ARENA : art(h), beast: monsterArt(m.kind, true), monColor: MON_COLOR[m.kind] || MON_COLOR.wraith, bag: [3, 3, 3], lab: true, onFinish: () => {} }) };
    },
  }));
} else if ($('#gate')) startGateLines($('#gate-lines')), startGate({ gate: $('#gate'), canvas: $('#gate-gl'), pctEl: $('#gate-pct'), tagEl: $('#gate-tag'), hunters: [...gateMine, ...gateSpare].slice(0, Math.max(2, gateMine.length)), spare: gateSpare, welcome: gateOwned.length ? (gateOwned.length > 1 ? `Your ${gateOwned.length} Chogs are waiting` : 'Your Chog is waiting') : '', whale: gateOwned.length >= WHALE ? gateOwned.length : 0, boss: { name: BOSS.name, img: 'assets/monsters/wyrm.png' }, onDone: startMotion });
else startMotion();
// motion: each section rises in the first time it scrolls into view; its cards animate once, then stay still
// (it starts when you walk through the lodge door, so nothing plays unseen behind the intro)
function startMotion() {
  if (document.documentElement.classList.contains('entered')) return;
  document.documentElement.classList.add('entered');
  // the hero's entrance and the sections rising in play once per visitor
  let seen = false;
  try { seen = !!localStorage.getItem('chog-contracts-intro-seen'); if (!seen) localStorage.setItem('chog-contracts-intro-seen', '1'); } catch {}
  if (seen) { document.documentElement.classList.add('intro-seen'); return; } // been here before: no sliding text, the page just shows up
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion');
  const rv = new IntersectionObserver((list) => {
    for (const e of list) if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); setTimeout(() => e.target.classList.add('seen'), 1400); }
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.sec').forEach((s) => { s.classList.add('rv'); rv.observe(s); });
  // belt and braces: whatever is on screen after a scroll or a moment shows up, so content can never stay hidden
  const sweep = () => document.querySelectorAll('.sec.rv:not(.in)').forEach((s) => { const r = s.getBoundingClientRect(); if (r.height && r.top < innerHeight && r.bottom > 0) { s.classList.add('in', 'seen'); rv.unobserve(s); } });
  addEventListener('scroll', sweep, { passive: true }); addEventListener('hashchange', () => setTimeout(sweep, 400)); addEventListener('click', () => setTimeout(sweep, 450)); // tab switches
  setTimeout(sweep, 1800);
}
startHero({
  el: $('#hero-scene'), monsterFromPost, elements: ELEMENTS, getHunter: () => current,
  onHunt: (text) => forge(text), // puts it on the board, scrolls there and flashes the card
  onOwn: () => { $('#compose').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#post').focus({ preventScroll: true }), 500); },
});
// the cinematic hero's two ways in (only when that hero is on the page)
document.querySelector('.cine-cta')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-go-pick]')) { e.preventDefault(); $('#pick-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (e.target.closest('[data-go-forge]')) { $('#compose').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#post').focus({ preventScroll: true }), 500); }
});
