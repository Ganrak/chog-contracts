// FX Lab: a test version of the arena. Pick any Chog and monster, then play each fight effect on demand
// (or all of them in a row) from scripted events. Real fights work too. Nothing here is ever saved.
import { ELEMENTS } from './kit.js';

const ELS = ['fire', 'aqua', 'volt', 'wild', 'shadow', 'holy', 'charm', 'plain'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function scenarios(el) {
  const use = (key, name, e = el, ult = false) => ({ t: 'use', key, name, el: e, ult });
  const hit = (n, e = el, tag = null, extra = {}) => ({ t: 'dmg', to: 'foe', n, el: e, tag, ...extra });
  const foe = (name, kind) => ({ t: 'foeUse', name, kind });
  const hurt = (n, heavy = false, tag) => ({ t: 'dmg', to: 'me', n, heavy, tag });
  return [
    ['Your attacks', [
      ['Normal hit', [use('Q', 'Strike'), hit(34)]],
      ['Weak spot', [use('Q', 'Strike'), hit(58, el, 'WEAK SPOT')]],
      ['Crit', [use('Q', 'Strike'), hit(61, el, 'CRIT')]],
      ['Resisted', [use('Q', 'Strike'), hit(19, el, 'RESISTED')]],
      ['Volt chain', [use('Q', 'Volt Snap', 'volt'), hit(30, 'volt'), hit(12, 'volt')]],
      ['5-hit combo', [use('R', 'Deal With It', el, true), { t: 'energy', n: 0 }, hit(20), hit(32, el, 'CRIT'), hit(19), hit(21), hit(35, el, 'CRIT')]],
      ['Ultimate', [use('R', 'Signature', el, true), { t: 'energy', n: 0 }, hit(160)]],
      ['Execute', [use('R', 'Death Stare', 'shadow', true), hit(88, 'shadow', 'EXECUTE')]],
    ]],
    ['Element hits', ELS.map((e) => [ELEMENTS[e].name, [use('Q', `${ELEMENTS[e].name} hit`, e), hit(30, e)]])],
    ['Monster attacks', [
      ['Hit', [foe('Claw', 'hit'), hurt(16)]],
      ['Heavy hit', [foe('Grave Slam', 'heavy'), hurt(38, true)]],
      ['Poison', [foe('Rot Breath', 'poison'), hurt(8), { t: 'status', to: 'me', s: 'poison', text: 'Poison ×2' }]],
      ['Energy steal', [foe('Rug Pull', 'drain'), hurt(14), { t: 'energy', n: 0, text: 'Energy stolen' }]],
      ['Weaken', [foe('Wail', 'weaken'), hurt(10), { t: 'status', to: 'me', s: 'weak', text: 'Weakened' }]],
      ['Armor up', [foe('Harden', 'armor'), { t: 'status', to: 'foe', s: 'armor', text: 'Armor up' }]],
      ['Hits itself', [foe('Claw', 'hit'), hit(20, 'charm', 'HIT ITSELF')]],
    ]],
    ['Defence', [
      ['Shield', [use('W', 'Ward', 'guard'), { t: 'shield', to: 'me', n: 30 }]],
      ['Shield breaks', [foe('Claw', 'hit'), { t: 'shield', to: 'me', n: 0, absorbed: 18 }]],
      ['Block + counter', [use('W', 'Grit', 'guard'), { t: 'status', to: 'me', s: 'guard', text: 'Grit' }, foe('Claw', 'hit'), { t: 'block', to: 'me', n: 11 }, hurt(7), hit(22, el, null, { counter: true })]],
      ['Dodge', [use('W', 'Dodge Roll', 'guard'), { t: 'status', to: 'me', s: 'evade', text: 'Rolling' }, foe('Claw', 'hit'), { t: 'miss', to: 'me' }]],
      ['Heal', [use('E', 'Second Wind'), { t: 'heal', to: 'me', n: 24 }]],
      ['Full health', [use('E', 'Second Wind'), { t: 'heal', to: 'me', n: 0 }]],
      ['Revive', [{ t: 'revive', n: 20 }]],
    ]],
    ['Effects', [
      ['Stun', [use('R', 'Heartbreaker', 'charm', true), hit(40, 'charm'), { t: 'status', to: 'foe', s: 'stun', text: 'Stunned 2 turns' }, { t: 'foeSkip' }]],
      ['Burn', [{ t: 'status', to: 'foe', s: 'burn', text: 'Burning' }, hit(14, 'fire', 'BURN', { tick: true })]],
      ['Poison tick', [{ t: 'status', to: 'foe', s: 'poison', text: 'Poison ×3' }, hit(12, 'wild', 'POISON', { tick: true })]],
      ['Frog', [{ t: 'status', to: 'me', s: 'frog', text: 'Frog joined' }, hit(10, 'wild', 'FROG', { tick: true })]],
      ['Buff', [use('E', 'Royal Decree'), { t: 'status', to: 'me', s: 'buff', text: '+40% damage' }]],
      ['Ult charged', [use('Q', 'Strike'), hit(30), { t: 'energy', n: 3 }]],
      ['Adrenaline', [{ t: 'rage', text: 'Adrenaline! Your hits grow stronger every turn.' }]],
    ]],
    ['Arena', [
      ['Perfect guard', [use('W', 'Fortify', 'guard'), { t: 'status', to: 'me', s: 'guard', text: 'Fortified' }, foe('Grave Slam', 'heavy'), { t: 'block', to: 'me', n: 38 }, { t: 'perfect' }, { t: 'energy', n: 1 }]],
      ['Boss enraged', [use('Q', 'Strike'), hit(60), { t: 'phase', text: 'The boss is enraged!' }]],
    ]],
    ['Knockout', [
      ['Win K.O. (finisher)', [use('R', 'Signature', el, true), { t: 'energy', n: 0 }, hit(200, el, 'CRIT'), { t: 'end', win: true }]],
      ['Lose K.O.', [foe('Grave Slam', 'heavy'), hurt(60, true), { t: 'end', win: false }]],
    ]],
  ];
}

/** hunters, monsters: lists to pick from. open(hunter, monster) opens the arena and returns { el, close, labPlay }. */
export function startLab({ hunters, monsters, open }) {
  let hi = 0, mi = 0, fight = null, groups = [], running = false, stop = false;
  const panel = document.createElement('aside');
  panel.className = 'lab'; panel.setAttribute('aria-label', 'FX Lab');
  document.body.appendChild(panel); document.documentElement.classList.add('lab-on');
  const isOpen = () => fight && !document.querySelector('#hunt').hidden;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function reopen() {
    fight?.close();
    fight = open(hunters[hi], monsters[mi]);
    groups = scenarios(fight.el);
    paint();
  }
  function paint() {
    const h = hunters[hi];
    panel.innerHTML = `<div class="lab-head"><b>FX Lab</b><span>test mode · nothing is saved</span><button type="button" data-lab="min" aria-label="Hide or show the lab">${panel.classList.contains('min') ? '+' : '–'}</button></div>
      <div class="lab-body">
        <label>Chog <select data-lab="hunter">${hunters.map((x, i) => `<option value="${i}" ${i === hi ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>Monster <select data-lab="monster">${monsters.map((m, i) => `<option value="${i}" ${i === mi ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
        <div class="lab-row"><button type="button" class="lab-main" data-lab="all">${running ? 'Stop' : '▶ Play all'}</button><button type="button" data-lab="new">New fight</button></div>        <p class="lab-note">${esc(h.name)} is ${esc(ELEMENTS[fight?.el]?.name || '')}. Each monster has its own arena. A real fight works too: Q W E R, potions 1 2 3, or Auto. Pick the Wyrm (boss) and fight to see it enrage at half health.</p>
        ${groups.map(([title, list], g) => `<h4>${title}</h4><div class="lab-btns">${list.map(([name], i) => `<button type="button" data-g="${g}" data-i="${i}">${esc(name)}</button>`).join('')}</div>`).join('')}
      </div>`;
  }
  async function run(g, i) {
    if (!isOpen()) reopen();
    const [name, events] = groups[g][1][i];
    panel.querySelectorAll('[data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === String(g) && b.dataset.i === String(i)));
    await fight.labPlay(structuredClone(events));
    if (/K\.O\./.test(name)) { await sleep(1400); if (!stop || !running) reopen(); } // back to a fresh fight after a knockout
  }
  async function playAll() {
    running = true; stop = false; paint();
    for (let g = 0; g < groups.length && !stop; g++) {
      for (let i = 0; i < groups[g][1].length && !stop; i++) { await run(g, i); await sleep(450); }
    }
    running = false; stop = false; paint();
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lab === 'min') { panel.classList.toggle('min'); paint(); return; }
    if (b.dataset.lab === 'new') { stop = true; reopen(); return; }    if (b.dataset.lab === 'all') { if (running) stop = true; else playAll(); return; }
    if (b.dataset.g && !running) run(Number(b.dataset.g), Number(b.dataset.i));
  });
  panel.addEventListener('change', (e) => {
    const s = e.target.closest('select'); if (!s) return;
    if (s.dataset.lab === 'hunter') hi = Number(s.value); else mi = Number(s.value);
    stop = true; reopen();
  });
  reopen();
}
