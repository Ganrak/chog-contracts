// The hunt arena: draws the fight from combat.js and plays its events back with effects.
import { ELEMENTS } from './kit.js';
import { createFight, act, quaff, moves, intentText, autoMove, rage, TUNE, HEAL_ULT } from './combat.js';
import { POTIONS } from './potions.js';
import { play as sfx } from './sfx.js';
import { setMood } from './music.js';
import { startLiving } from './living.js';
import { chogLine, sidekickLine } from './quips.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduce() ? Math.min(ms, 80) : ms));
// an animation's finished promise never settles while the page isn't painting (hidden tab); never let that stall a fight
const settled = (anim, ms) => Promise.race([anim.finished.catch(() => {}), new Promise((r) => setTimeout(r, ms + 120))]);
const STATUS = {
  burn: ['Burn', '#c2541b'], poison: ['Poison', '#3f8a52'], slow: ['Slow', '#2f7fb0'], stun: ['Stun', '#b0367a'], exposed: ['Exposed', '#b08a1f'],
  mog: ['Mogged', '#6b4fb0'], confused: ['Confused', '#b0367a'], armor: ['Armor', '#5a5d6b'], guard: ['Guard', '#2f7fb0'], evade: ['Evade', '#2f7fb0'],
  buff: ['Buff', '#b5641b'], weak: ['Weak', '#7a2a3a'], frog: ['Frog', '#3f8a52'], rage: ['Adrenaline', '#c2223a'], enraged: ['Enraged', '#c2223a'],
};
/* ---------- first-fight coaching: short tips at the right moment, each shown once, only in the first fights ---------- */
const COACH_KEY = 'chog-contracts-coach';
const coachState = (() => { try { return JSON.parse(localStorage.getItem(COACH_KEY)) || { fights: 0, seen: [] }; } catch { return { fights: 0, seen: [] }; } })();
const saveCoach = () => { try { localStorage.setItem(COACH_KEY, JSON.stringify(coachState)); } catch {} };
const HEALS = /Wind|Blessing|Pride/;
let noCoach = false; // set while the FX Lab is open
function coachTip(id, text, key) {
  if (noCoach || coachState.fights > 3 || coachState.seen.includes(id)) return false;
  coachState.seen.push(id); saveCoach();
  const box = $('#coach'); if (!box) return false;
  box.querySelector('span').textContent = text; box.hidden = false;
  document.querySelectorAll('.move.hint').forEach((b) => b.classList.remove('hint'));
  if (key) document.querySelector(`.move[data-key="${key}"]`)?.classList.add('hint');
  return true;
}
function clearCoach() { const box = $('#coach'); if (box) box.hidden = true; document.querySelectorAll('.move.hint').forEach((b) => b.classList.remove('hint')); }

/* ---------- icons: one painted sheet (assets/fx/icons.webp, 6 × 5), picked by number ---------- */
const ICON = { fire: 0, aqua: 1, volt: 2, wild: 3, shadow: 4, holy: 5, charm: 6, plain: 7, hit: 8, heavy: 9, poison: 10, drain: 11,
  shield: 12, armor: 13, dodge: 14, heal: 15, buff: 16, weak: 17, stun: 18, ult: 19, energy: 20, slow: 21, exposed: 22, mog: 23,
  confused: 24, frog: 25, rage: 26, enraged: 27, hp: 28, mana: 29 };
const ico = (name, cls = '') => (name in ICON ? `<i class="ico ${cls}" style="--c:${ICON[name] % 6};--r:${Math.floor(ICON[name] / 6)}" aria-hidden="true"></i>` : '');
// what each move's icon shows (Q is your element; the rest by what the move does)
const MOVE_ICON = { Bribe: 'stun', Grit: 'shield', Ward: 'shield', Fortify: 'armor', Decoy: 'dodge', 'Dodge Roll': 'dodge',
  'Royal Decree': 'buff', 'Cap Tip': 'buff', Rally: 'buff', 'Chog Pride': 'buff', Blink: 'dodge', Jeet: 'dodge', Phalanx: 'shield', 'Cold Front': 'slow',
  'Second Wind': 'heal', Blessing: 'heal', Honk: 'confused', Distraction: 'stun', Pickpocket: 'drain', Pump: 'buff', Overclock: 'energy', Gore: 'plain',
  Headbutt: 'stun', Spores: 'poison', Foresight: 'exposed', Scanner: 'exposed', Rewind: 'heal', 'Deal With It': 'ult', 'Flood of Tears': 'heal',
  Heartbreaker: 'charm', 'Death Stare': 'shadow', Mog: 'mog', 'Good Vibes': 'heal', Ribbit: 'frog', 'Clown Fiesta': 'confused',
  'Bucket Toss': 'slow', 'Peace Out': 'heal', 'Rain Cloud': 'slow', 'Star Power': 'buff', Curveball: 'plain', Hyperfocus: 'buff', 'Hair Flip': 'dodge',
  'Free Trade': 'energy', 'Stay Inside': 'shield', 'Puppy Eyes': 'stun', 'Focus Shot': 'ult', 'Power Nap': 'heal', Deadpan: 'armor', 'Panic Mode': 'rage', Wildcard: 'ult' };
const STATUS_ICON = { burn: 'fire', poison: 'poison', slow: 'slow', stun: 'stun', exposed: 'exposed', mog: 'mog', confused: 'confused', armor: 'armor',
  guard: 'shield', evade: 'dodge', buff: 'buff', weak: 'weak', frog: 'frog', rage: 'rage', enraged: 'enraged' };
const INTENT_ICON = { hit: 'hit', heavy: 'heavy', poison: 'poison', drain: 'drain', armor: 'armor', weaken: 'weak' };
const POTION_ICON = ['hp', 'mana', 'buff'];

// arena grounds (drawn in demo.html as .props groups); the monster's kind picks one
const THEMES = { ghoul: 1, troll: 1, thief: 1, golem: 1, harpy: 1, wyrm: 1, wraith: 1 };
const INTENT_COLOR = { hit: '#FF8A1F', heavy: '#E2333D', poison: '#6CC48A', drain: '#9C8FC4', armor: '#A8A3B5', weaken: '#D9708F' };

/* ---------- embers drifting up while the arena is open ---------- */
function embers(canvas) {
  const ctx = canvas.getContext('2d'); let w = 0, h = 0, raf = 0;
  const parts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.05, r: 0.6 + Math.random() * 1.8, p: Math.random() * 6 }));
  const size = () => { w = canvas.width = canvas.clientWidth * devicePixelRatio; h = canvas.height = canvas.clientHeight * devicePixelRatio; };
  size(); addEventListener('resize', size);
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, w, h);
    for (const q of parts) {
      q.y -= q.v * dt; q.p += dt; if (q.y < -0.05) { q.y = 1.05; q.x = Math.random(); }
      const x = (q.x + Math.sin(q.p) * 0.01) * w, y = q.y * h, a = Math.min(1, (1 - q.y) * 1.4) * 0.8;
      ctx.fillStyle = `rgba(255,${140 + (q.r * 30) | 0},60,${a})`;
      ctx.beginPath(); ctx.arc(x, y, q.r * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
    }
    raf = requestAnimationFrame(loop);
  };
  if (!reduce()) raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
}

/**
 * Opens the arena. opts: { hunter, level, stats, monster, art (html), beast (html), monColor, onFinish(result) }
 * onFinish gets { win, turns, loot, mult } once the player has seen the end of the fight.
 */
// rand: a seeded stream for ranked boss hunts (the server replays them); keys: every key pressed, in order
export function openHunt({ hunter, level, stats, monster, art, beast, monColor, bag = [0, 0, 0], onFinish, onQuaff, lab = false, rand = Math.random }) {
  const f = createFight(stats, monster, { level, ghost: !!hunter.ghost, rand });
  const pressed = []; // every key pressed, in order (a ranked boss hunt sends these for the server to replay)
  noCoach = lab;
  const el = ELEMENTS[f.element], hc = el.color;
  const root = $('#hunt'), arena = $('#arena'), fx = $('#fx'), call = $('#callout'), logEl = $('#log');
  arena.style.setProperty('--hc', hc); arena.style.setProperty('--mc', monColor); arena.classList.remove('rage', 'cine', 'lost', 'quake', 'phase2', 'slowmo');
  arena.dataset.theme = monster.kind in THEMES ? monster.kind : 'wraith'; // each monster fights on its own ground
  fx.innerHTML = ''; // nothing left over from the last fight
  const buzz = (p) => { try { if (!reduce() && navigator.userActivation?.hasBeenActive !== false && matchMedia('(pointer: coarse)').matches) navigator.vibrate?.(p); } catch {} }; // phones: feel the big moments (only after a tap, only on touch screens)
  $('#me-art').innerHTML = art; $('#foe-art').innerHTML = beast;
  $('#foe-art').className = 'beast'; $('#foe-art').style.visibility = '';
  $('#foe-art').dataset.size = monster.boss ? 'mega' : monster.kind; // each kind its own size; the weekly boss is mega
  $('#me-art').className = `standee${hunter.ghost ? ' sprite' : ''}`; // the Apprentice is a cut-out character, not a framed NFT
  $('#me-name').textContent = `${hunter.name} · Lv ${level}`; $('#foe-name').textContent = monster.name;
  $('#result').hidden = true; logEl.textContent = `${monster.name} blocks the road. Pick a move.`;
  root.hidden = false; document.documentElement.style.overflow = 'hidden'; setMood('hunt');
  const stopEmbers = embers($('#embers'));
  let busy = false, auto = false, closed = false;
  // real NFT Chogs come alive from their traits (aura, tier, element); the Apprentice has its own drawn frames
  const life = hunter.ghost ? null : startLiving({ card: $('#me-art'), host: $('#me-body'), traits: hunter.traits, color: hc });
  const laserEyes = !hunter.ghost && /laser$/i.test(f.kit.abilities[3].name);

  // speech bubbles, and the Apprentice as a sidekick cheering on a real Chog (src/quips.js has the lines)
  const sk = $('#sidekick'), skStrip = sk.querySelector('.appr-strip');
  sk.hidden = !!hunter.ghost; sk.className = 'sidekick';
  const skPose = (n) => skStrip.style.setProperty('--f', n);
  skPose(0);
  const skHop = () => { if (sk.hidden || reduce()) return; sk.classList.remove('hop'); void sk.offsetWidth; sk.classList.add('hop'); };
  const bubbles = {};
  function say(who, node, text, side = 'right', ms = 2300) {
    if (!text || closed) return;
    bubbles[who]?.remove();
    const r = node.getBoundingClientRect(), a = arena.getBoundingClientRect(), b = document.createElement('div');
    b.className = `say ${side}`; b.textContent = text;
    // right/left: beside the speaker; up: above its head (the sidekick, so it never covers the Chog)
    b.style.left = `${(side === 'right' ? r.right - 10 : side === 'left' ? r.left + 10 : r.left + r.width * 0.5) - a.left}px`;
    b.style.top = `${r.top - a.top + (side === 'up' ? -4 : r.height * 0.3)}px`;
    fx.appendChild(b); bubbles[who] = b;
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 320); }, ms);
  }
  const ctx = { monster: monster.name };
  const meSay = (ev, ms) => say('me', $('#me-art'), chogLine(ev, hunter.traits, ctx, !!hunter.ghost), 'right', ms);
  const skSay = (ev) => { if (!sk.hidden) say('sk', sk, sidekickLine(ev), 'up', 2000); };
  let saidWeak = false, saidLow = false;
  // opening: the Chog talks, then the monster answers with the FUD it was made from
  setTimeout(() => { meSay('enter', 2400); setTimeout(() => skSay('enter'), 1300); setTimeout(() => say('foe', $('#foe-art'), `“${monster.quote}”`, 'left', 2800), 2700); }, 500);

  /* ---------- HUD ---------- */
  function chips(list) { return list.map(([s, extra]) => { const [label, c] = STATUS[s]; return `<span style="--sc:${c}">${ico(STATUS_ICON[s], 'sm')}${label}${extra ? ` ${extra}` : ''}</span>`; }).join(''); }
  const moveIcon = (m) => (m.key === 'Q' ? f.element : /laser$/i.test(m.name) ? f.laserEl : /signature/i.test(m.name) ? 'ult' : MOVE_ICON[m.name] || (m.ult ? 'ult' : 'buff'));
  function hud() {
    const me = f.me, foe = f.foe;
    $('#me-bar').style.setProperty('--w', `${(me.hp / me.maxHp * 100).toFixed(1)}%`);
    $('#me-bar').style.setProperty('--s', `${Math.min(100, me.shield / me.maxHp * 100).toFixed(1)}%`);
    $('#me-nums').textContent = `${me.hp}/${me.maxHp}${me.shield ? ` +${me.shield}` : ''}`;
    $('#foe-bar').style.setProperty('--w', `${(foe.hp / foe.maxHp * 100).toFixed(1)}%`);
    $('#foe-nums').textContent = `${foe.hp}/${foe.maxHp}`;
    $('#pips').innerHTML = [0, 1, 2].map((i) => `<span class="${i < me.energy ? 'on' : ''}"></span>`).join('') + `<small>${me.energy >= 3 ? 'ULT READY' : 'ENERGY'}</small>`;
    $('#me-status').innerHTML = chips([me.guard > 0 && ['guard'], me.evade > 0 && ['evade'], me.dmg > 0 && ['buff', `+${Math.round(me.dmg * 100)}%`], me.weak > 0 && ['weak'], me.poison > 0 && ['poison', `×${me.poison}`], me.frog > 0 && me.frog < 50 && ['frog', me.frog], rage(f) > 1 && ['rage', `+${Math.round((rage(f) - 1) * 100)}%`]].filter(Boolean));
    $('#foe-status').innerHTML = chips([foe.phase2 && ['enraged'], foe.burn > 0 && ['burn', foe.burn], foe.poison > 0 && ['poison', `×${foe.poison}`], foe.slow > 0 && ['slow'], foe.stun > 0 && ['stun'], foe.exposed > 0 && ['exposed'], foe.mog > 0 && ['mog'], foe.confused > 0 && ['confused'], foe.armor > 0 && ['armor']].filter(Boolean));
    const it = intentText(f), ic = it.stunned ? '#B0367A' : INTENT_COLOR[it.kind];
    const intent = $('#intent');
    intent.className = `intent${it.kind === 'heavy' && !it.stunned ? ' heavy' : ''}`;
    intent.style.setProperty('--ic', ic);
    intent.innerHTML = it.stunned ? `<i>SKIP</i>${ico('stun', 'md')}Stunned: loses its next move` : `<i>${it.kind === 'heavy' ? 'HEAVY' : 'NEXT'}</i>${ico(INTENT_ICON[it.kind], 'md')}${esc(it.text)}`;
    const rageNote = f.turn >= TUNE.rageTurn ? 'Adrenaline' : `Adrenaline at turn ${TUNE.rageTurn}`;
    $('#turn').textContent = `Turn ${f.turn} · ${f.foe.name.split(' ').pop()} is weak to ${ELEMENTS[f.foe.weak].name} · ${rageNote}`;
    $('#bag').innerHTML = POTIONS.map((P, i) => `<button type="button" class="pot" data-pot="${i}" style="--pc:${P.color}" title="${P.name} potion: ${P.effect}" aria-label="Drink a ${P.name} potion (${bag[i]} left): ${P.effect}" ${bag[i] > 0 && !f.quaffed && !busy && !f.over && !auto ? '' : 'disabled'}>${ico(POTION_ICON[i], 'pi')}<b>${bag[i]}</b></button>`).join('')
      + `<small>${f.quaffed ? 'Potion used' : bag.some((n) => n > 0) ? '1 potion per fight · free' : 'No potions yet: win contracts'}</small>`;
    // each button: a big icon, the move's name, and one short line (what it does, or when it is ready); the full text is the tooltip
    $('#moves').innerHTML = moves(f).map((m) => `<button type="button" class="move${m.ult ? ' ult' : ''}" data-key="${m.key}" title="${esc(m.text)}" aria-label="${esc(`${m.key}: ${m.name}. ${m.text}`)}" ${m.ready && !busy && !f.over && !auto ? '' : 'disabled'} style="--mcol:${m.el || hc}">
      <span class="k">${m.key}</span>${ico(moveIcon(m), 'mv')}<div class="mv-t"><b>${esc(m.name)}</b>
      <strong${m.ready ? '' : ' class="wait"'}>${esc(m.ready ? m.short : m.ult ? `${m.need} more energy` : `Ready in ${m.cd}`)}</strong></div></button>`).join('');
  }

  function coachMoment() {
    if (busy || auto || f.over) return;
    const it = f.foe.intent, ms = moves(f), ready = (k) => ms.find((m) => m.key === k)?.ready;
    if (f.turn === 1 && coachTip('read', 'The monster shows its next move above its head. Your four moves come from your Chog\'s traits.')) return;
    if (it.kind === 'heavy' && f.foe.stun === 0 && ready('W') && coachTip('guard', 'A heavy attack is coming. Press W to guard against it.', 'W')) return;
    const healUlt = HEAL_ULT.test(f.kit.abilities[3].name);
    if (ready('R') && !healUlt && coachTip('ult', 'Energy full: your ultimate is ready. Press R.', 'R')) return;
    if (ready('R') && healUlt && f.me.hp / f.me.maxHp < 0.55 && coachTip('ult', 'Your ultimate heals. Save it for when you\'re hurt, like now: press R.', 'R')) return;
    if (f.me.hp / f.me.maxHp < 0.45 && ready('E') && HEALS.test(f.kit.abilities[2].name) && coachTip('heal', 'Low on health? Your E move heals.', 'E')) return;
  }

  /* ---------- effects ---------- */
  const along = (a, m, b, t) => (t < 0.5 ? { x: a.x + (m.x - a.x) * t * 2, y: a.y + (m.y - a.y) * t * 2 } : { x: m.x + (b.x - m.x) * (t - 0.5) * 2, y: m.y + (b.y - m.y) * (t - 0.5) * 2 });
  const center = (node) => { const r = node.getBoundingClientRect(), a = arena.getBoundingClientRect(); return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width, h: r.height }; };
  function pop(node, text, sub, color, small, big) {
    const c = center(node), p = document.createElement('div');
    p.className = `pop${small ? ' small' : ''}${big ? ' big' : ''}`; p.style.left = `${c.x + (Math.random() - 0.5) * 40}px`; p.style.top = `${c.y - c.h * 0.25}px`; p.style.color = color;
    p.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`; fx.appendChild(p); setTimeout(() => p.remove(), 1100);
  }
  // the Apprentice is drawn from two 4-frame strips (attack; idle/cheer/hit/defeated); NFT Chogs are framed cards
  const appr = () => $('#me-art .appr-strip');
  const mePose = (n) => { const s = appr(); if (!s) return; s.classList.add('posing'); s.style.setProperty('--f', n); };
  let swingT = [];
  function meSwing() {
    const s = appr(); if (!s || reduce()) return;
    swingT.forEach(clearTimeout); s.classList.remove('posing'); s.style.setProperty('--f', 0);
    swingT = [[1, 110], [2, 230], [3, 430]].map(([n, t]) => setTimeout(() => s.style.setProperty('--f', n), t));
    swingT.push(setTimeout(() => { if (!f.over) mePose(0); }, 640));
  }
  function shake(node) { node.classList.remove('hit'); void node.offsetWidth; node.classList.add('hit'); setTimeout(() => node.classList.remove('hit'), 400); }
  function lunge(node, dx) { if (reduce()) return; node.style.transform = `translateX(${dx}px) rotate(${dx > 0 ? 3 : -3}deg)`; setTimeout(() => { node.style.transform = ''; }, 170); }
  async function orb(from, to, color, ms = 280, small = false) {
    if (reduce()) return;
    const a = center(from), b = center(to), o = document.createElement('div');
    o.className = `orb${small ? ' small' : ''}`; o.style.setProperty('--oc', color); fx.appendChild(o);
    // a slight arc, with a short trail of sparks behind it
    const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 40 - Math.random() * 30 };
    const anim = o.animate([{ transform: `translate(${a.x}px,${a.y}px) scale(.6)` }, { transform: `translate(${mid.x}px,${mid.y}px) scale(1)`, offset: 0.5 }, { transform: `translate(${b.x}px,${b.y}px) scale(1.3)` }], { duration: ms, easing: 'ease-in' });
    if (!small) [0.3, 0.55, 0.8].forEach((t) => setTimeout(() => burst(null, { n: 3, color, spread: 18, dur: 380, size: [4, 8], at: along(a, mid, b, t) }), ms * Math.sqrt(t))); // ease-in: the orb reaches t at about √t of the time
    await settled(anim, ms);
    o.remove();
  }
  // two beams from the card's eyes, for Chogs whose Eyes trait gives them a laser ultimate
  async function laser(to, color) {
    if (reduce()) return;
    const ar = arena.getBoundingClientRect();
    const pts = life.eyes().map((p) => ({ x: p.x - ar.left, y: p.y - ar.top }));
    for (const p of pts) { // a flare on each eye
      const fl = document.createElement('div'); fl.className = 'flare'; fl.style.setProperty('--oc', color);
      fl.style.left = `${p.x}px`; fl.style.top = `${p.y}px`; fx.appendChild(fl); setTimeout(() => fl.remove(), 750);
    }
    await Promise.all(pts.map((p) => ray(null, to, color, p, 15)));
  }
  async function ray(from, to, color, origin, thick) {
    if (reduce()) return;
    const a = origin || center(from), b = center(to), r = document.createElement('div');
    if (thick) { r.style.height = `${thick}px`; r.style.marginTop = `${-thick / 2}px`; }
    const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    r.className = 'ray'; r.style.setProperty('--oc', color); r.style.left = `${a.x}px`; r.style.top = `${a.y}px`; r.style.width = `${len}px`;
    fx.appendChild(r);
    const anim = r.animate([{ transform: `rotate(${ang}rad) scaleX(0)`, opacity: 1 }, { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.4 }, { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 0 }], { duration: 650, easing: 'ease-out' });
    await settled(anim, 650);
    r.remove();
  }
  function ring(node) { const c = center(node), r = document.createElement('div'); r.className = 'ring'; r.style.left = `${c.x}px`; r.style.top = `${c.y + c.h * 0.45}px`; fx.appendChild(r); setTimeout(() => r.remove(), 900); }
  function bubble(node) { const b = document.createElement('div'); b.className = 'bubble'; node.appendChild(b); setTimeout(() => b.remove(), 900); }
  function callout(key, name, color) { call.style.setProperty('--cc', color); call.innerHTML = `<small>${key}</small>${esc(name)}`; call.classList.add('on'); }

  /* ---------- hit effects: sparks in the element's style, impact rings, slashes, flashes ---------- */
  const HIT_FX = {
    fire: { cls: 'flame', up: 70, grav: -50, sig: 'fire' }, aqua: { cls: 'drop', up: 40, grav: 120 }, volt: { cls: 'spark', sig: 'bolt' },
    wild: { cls: 'leaf', grav: 70 }, shadow: { cls: 'smoke', size: [16, 30], spread: 70, sig: 'void' }, holy: { cls: 'star', up: 70, grav: -40, size: [9, 15], sig: 'pillar' },
    charm: { cls: 'heart', up: 60, grav: -30, size: [10, 18], sig: 'heart' }, plain: { cls: 'spark', sig: 'pow' },
  };
  let uid = 0; // unique ids for the SVG gradients and clips below
  // each element's signature on impact, drawn with the same care as the volt bolt
  const SIG = {
    bolt(node, color) { const b = fxEl('bolt', node, color, 440); if (b) b.innerHTML = '<svg viewBox="0 0 60 120" aria-hidden="true"><path d="M34 0 12 56h18L18 120l32-70H32L46 0Z"/></svg>'; },
    // shadow: a dark vortex opens on the monster and tendrils lash out of it
    void(node, color) {
      const v = fxEl('void', node, color, 900); if (!v) return;
      const arms = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5, r = 82 + Math.random() * 14, bend = (Math.random() < 0.5 ? -1 : 1) * 0.9;
        const ex = Math.cos(a) * r, ey = Math.sin(a) * r, mx = Math.cos(a + bend) * r * 0.55, my = Math.sin(a + bend) * r * 0.55;
        return `<path d="M0 0Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" pathLength="100" style="animation-delay:${(i * 0.03).toFixed(2)}s"/>`;
      }).join('');
      v.innerHTML = `<i></i><svg viewBox="-100 -100 200 200" aria-hidden="true">${arms}</svg>`;
    },
    // holy: a pillar of light drops from the sky onto the monster, with a halo where it lands
    pillar(node, color) {
      const c = center(node), p = fxEl('pillar', node, color, 800, { x: c.x, y: 0 }); if (!p) return;
      p.style.height = `${c.y + c.h * 0.42}px`;
      fxEl('halo', node, color, 800, { x: c.x, y: c.y + c.h * 0.42 });
      const g = fxEl('glint', node, color, 700); if (g) g.innerHTML = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0-50 7-7 50 0 7 7 0 50-7 7-50 0-7-7Z"/></svg>';
    },
    // fire: a fireball bursts on the monster and flames lick up its body
    fire(node, color, big) {
      fxEl(`fireboom${big ? ' big' : ''}`, node, color, 800);
      burnFx(node, !big);
    },
    // charm: a big painted heart pops on the monster, then breaks in two (assets/fx/heart, heartbroken)
    heart(node, color) {
      const h = fxEl('heartfx', node, color, 1000); if (!h) return;
      h.innerHTML = '<img class="hfull" src="assets/fx/heart.webp" alt=""><img class="hl" src="assets/fx/heartbroken.webp" alt=""><img class="hr" src="assets/fx/heartbroken.webp" alt="">';
    },
    // plain: a comic-book starburst
    pow(node, color, big) {
      const p = fxEl('pow', node, color, 700); if (!p) return;
      const pts = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 26 + Math.random() * 6 : 46 + Math.random() * 6; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
      const word = big ? 'WHAM!' : ['POW!', 'BAM!', 'BONK!', 'SMACK!'][Math.floor(Math.random() * 4)];
      p.innerHTML = `<svg viewBox="-55 -55 110 110" aria-hidden="true"><polygon points="${pts}"/><text y="7">${word}</text></svg>`;
    },
  };
  // a shield-shaped barrier in front of your Chog: rises when you shield or guard, cracks when it soaks a hit
  const shieldAt = () => { const c = center($('#me-art')); return { x: c.x + c.w * 0.42, y: c.y }; };
  // (painted: assets/fx/shield, shieldbroken; a light sweeps across it, masked to its shape)
  function shieldFx(broken) {
    const s = fxEl(`shieldfx${broken ? ' broken' : ''}`, null, '#8FD3FF', broken ? 750 : 1150, shieldAt()); if (!s) return;
    const src = `assets/fx/${broken ? 'shieldbroken' : 'shield'}.webp`;
    s.innerHTML = `<img src="${src}" alt="">${broken ? '' : `<i class="sh-shine" style="--m:url(${src})"></i>`}`;
  }
  const TICK_FX = { BURN: { cls: 'flame', color: '#FF8A1F', up: 60, grav: -40 }, POISON: { cls: 'bubbleP', color: '#6CC48A', up: 50, grav: -30 }, FROG: { cls: 'leaf', color: '#6CC48A', grav: 50 } };
  // particles flying out of a point (or, inward, gathering into it); every one cleans itself up even in a frozen tab
  function burst(node, { n = 12, color = '#fff', cls = 'spark', spread = 110, up = 0, grav = 0, dur = 700, size = [6, 13], at, inward = false } = {}) {
    if (reduce() || closed) return;
    const c = at || center(node);
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'), s = size[0] + Math.random() * (size[1] - size[0]);
      p.className = `pt ${cls}`; p.style.setProperty('--oc', color);
      p.style.cssText += `;left:${c.x}px;top:${c.y}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;font-size:${s * 1.5}px`;
      const a = Math.random() * Math.PI * 2, d = spread * (0.35 + Math.random() * 0.65);
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.75 - up, rot = (Math.random() - 0.5) * 540, t = dur * (0.7 + Math.random() * 0.6);
      const frames = inward
        ? [{ transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5}px) scale(1)`, opacity: 1, offset: 0.45 }, { transform: 'translate(0,0) scale(.3)', opacity: 0.9 }]
        : [{ transform: 'translate(0,0) scale(1.2)', opacity: 1 }, { transform: `translate(${dx * 0.75}px,${dy * 0.75}px) scale(.9) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px,${dy + grav}px) scale(.25) rotate(${rot}deg)`, opacity: 0 }];
      fx.appendChild(p);
      p.animate(frames, { duration: t, easing: inward ? 'ease-in' : 'cubic-bezier(.12,.75,.3,1)', fill: 'forwards' });
      setTimeout(() => p.remove(), t + 60);
    }
  }
  function fxEl(cls, node, color, ms, at) { // a one-shot effect centred on a fighter
    if (reduce() || closed) return null;
    const c = at || center(node), d = document.createElement('div');
    d.className = cls; d.style.left = `${c.x}px`; d.style.top = `${c.y}px`; d.style.setProperty('--oc', color);
    fx.appendChild(d); setTimeout(() => d.remove(), ms); return d;
  }
  function flash(color) { if (reduce()) return; const d = document.createElement('div'); d.className = 'flash'; d.style.setProperty('--oc', color); fx.appendChild(d); setTimeout(() => d.remove(), 340); }
  // a camera punch: `scale` composes with the quake's `transform`, so both can play at once
  function punch(s = 1.035) { if (!reduce()) arena.animate([{ scale: 1 }, { scale: s, offset: 0.25 }, { scale: 1 }], { duration: 320, easing: 'ease-out' }); }
  function impact(node, el, color, big) {
    const k = HIT_FX[el] || HIT_FX.plain;
    fxEl(`impact${big ? ' big' : ''}`, node, color, 650);
    burst(node, { n: big ? 24 : 12, color, cls: k.cls, up: k.up || 0, grav: k.grav || 0, spread: (k.spread || 110) * (big ? 1.45 : 1), size: k.size });
    if (k.sig) SIG[k.sig](node, color, big);
    if (big) { flash(color); punch(); }
  }
  // a short-lived look on a fighter (scorched, envenomed); restarts if it is already on
  function tint(node, cls, ms) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); clearTimeout(node[`_${cls}`]); node[`_${cls}`] = setTimeout(() => node.classList.remove(cls), ms); }
  // burn: tongues of fire rise from the monster's feet and wrap it, embers fly; a tick is a smaller blaze
  function burnFx(node, small) {
    const c = center(node), n = small ? 6 : 11;
    const f = fxEl(`burnfx${small ? ' small' : ''}`, null, '#FF8A1F', small ? 1000 : 1500, { x: c.x, y: c.y + c.h * 0.42 }); if (!f) return;
    f.style.setProperty('--w', `${c.w * 0.95}px`); f.style.setProperty('--h', `${c.h * (small ? 0.6 : 0.95)}px`);
    f.innerHTML = Array.from({ length: n }, (_, i) => { // ragged tongues: uneven heights, some licking up from the body, gaps to see through
      const x = ((i + 0.5) / n - 0.5) * 100 + (Math.random() - 0.5) * 8, mid = 1 - Math.abs(x) / 60;
      return `<i style="--x:${x.toFixed(1)}%;--s:${(0.3 + mid * 0.4 + Math.random() * 0.35).toFixed(2)};--b:${(Math.random() < 0.35 ? Math.random() * 30 : 0).toFixed(0)}%;--dl:${(Math.random() * 0.3).toFixed(2)}s;--fd:${(0.1 + Math.random() * 0.1).toFixed(2)}s"></i>`;
    }).join('');
    burst(node, { n: small ? 8 : 18, color: '#FF8A1F', cls: 'flame', up: 110, grav: -70, spread: 90, size: [6, 13], dur: 900 });
    tint(node, 'scorch', small ? 800 : 1300);
  }
  // poison: a snake's fangs strike, two bite marks are left, venom drips and bubbles up
  function fangs(node) {
    const c = center(node), f = fxEl('fangs', null, '#6CC48A', 1300, { x: c.x, y: c.y - c.h * 0.05 }); if (!f) return;
    f.style.setProperty('--w', `${Math.min(220, c.w * 0.75)}px`);
    // the painted fangs (assets/fx/fangs.webp) strike down; two bite marks appear where the tips land
    f.innerHTML = '<img class="fg-up" src="assets/fx/fangs.webp" alt=""><i class="bite" style="left:27%"></i><i class="bite" style="left:73%"></i>';
    setTimeout(() => { // the bite lands: venom splashes and drips
      if (closed) return;
      const b = { x: c.x, y: c.y - c.h * 0.05 + Math.min(220, c.w * 0.75) * 0.375 }; // where the bite marks are
      burst(null, { n: 16, color: '#6CC48A', cls: 'drop', up: 30, grav: 140, spread: 80, size: [6, 12], at: b });
      burst(null, { n: 10, color: '#9be07a', cls: 'bubbleP', up: 80, grav: -50, spread: 70, size: [8, 15], at: b, dur: 1000 });
      tint(node, 'envenom', 1100); sfx('hit');
    }, 260);
  }
  // a poison tick: venom seeps out, bubbles rise, a sickly green pulse
  function venomTick(node) {
    burst(node, { n: 10, color: '#6CC48A', cls: 'bubbleP', up: 70, grav: -50, spread: 60, size: [7, 14], dur: 900 });
    burst(node, { n: 6, color: '#3f8a52', cls: 'drop', grav: 110, spread: 40, size: [5, 9] });
    tint(node, 'envenom', 700);
  }
  // a monster's hit: painted claw marks rake across your Chog (red; tinted for poison, drain, weaken)
  function slash(node, hue, heavy) { const s = fxEl(`slash${heavy ? ' heavy' : ''}`, node, '#ff4d5e', 620); if (s) { s.style.setProperty('--hue', hue); s.innerHTML = '<img src="assets/fx/claws.webp" alt="">'; } }
  function ko(text, color, cls = '') { const a = arena.getBoundingClientRect(); const k = fxEl(`ko ${cls}`, null, color, 1400, { x: a.width / 2, y: a.height * 0.42 }); if (k) k.textContent = text; }
  // the finisher: one clean cut across the monster, and its two halves slide apart
  function splitFoe(node) {
    if (reduce()) return;
    const r = node.getBoundingClientRect(), a = arena.getBoundingClientRect();
    const half = (clip, dx, dy, rot) => {
      const d = node.cloneNode(true); d.removeAttribute('id'); d.className = 'beast half';
      Object.assign(d.style, { left: `${r.left - a.left}px`, top: `${r.top - a.top}px`, width: `${r.width}px`, height: `${r.height}px`, clipPath: clip });
      fx.appendChild(d);
      d.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * 0.15}px,${dy * 0.05}px)`, opacity: 1, offset: 0.3 }, { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 }], { duration: 1200, easing: 'cubic-bezier(.4,0,.8,.5)', fill: 'forwards' });
      setTimeout(() => d.remove(), 1300);
    };
    half('polygon(0 0,100% 0,100% 28%,0 68%)', -40, -50, -14);
    half('polygon(0 68%,100% 28%,100% 100%,0 100%)', 34, 70, 12);
    node.style.visibility = 'hidden';
  }
  // the ultimate: the scene darkens, black bars slide in, energy gathers on your Chog before it fires
  async function charge(color) {
    if (reduce()) return;
    arena.classList.add('cine');
    burst($('#me-art'), { n: 24, color, inward: true, spread: 180, dur: 520, size: [5, 11] });
    fxEl('impact charge', $('#me-art'), color, 620);
    await wait(500);
  }
  function freshMoves() { const m = $('#moves'); m.classList.remove('fresh'); void m.offsetWidth; m.classList.add('fresh'); }

  /* ---------- play one turn's events ---------- */
  async function play(events) {
    const meB = $('#me-body'), foeB = $('#foe-body'), meA = $('#me-art'), foeA = $('#foe-art');
    let shotDone = false, lastUse = null, lastFoe = null;
    const FOE_HUE = { poison: '115deg', drain: '255deg', weaken: '-30deg' }; // claw marks recoloured from red
    for (const e of events) {
      if (closed) return;
      if (e.t === 'use') {
        lastUse = e; shotDone = false;
        const c = ELEMENTS[e.el]?.color || (e.el === 'guard' ? '#8FD3FF' : hc);
        callout(e.key, e.name, c); logEl.textContent = `${hunter.name} uses ${e.name}.`;
        sfx(e.ult ? 'ult' : e.el === 'guard' ? 'shield' : 'click');
        if (e.ult) await charge(c);
        meSwing(); life?.strike(c); lunge(meB, 30);
        if (e.ult) { meSay('ult', 1800); skPose(1); skHop(); setTimeout(() => skPose(0), 1300); if (Math.random() < 0.6) setTimeout(() => skSay('ult'), 900); } else skHop();
        await wait(220);
      } else if (e.t === 'dmg' && e.to === 'foe') {
        const c = ELEMENTS[e.el]?.color || hc;
        const big = !e.tick && (e.tag === 'CRIT' || e.tag === 'EXECUTE' || (!!lastUse?.ult && !shotDone));
        if (!e.tick && lastUse && !shotDone) { shotDone = true; await (lastUse.ult ? (laserEyes ? laser(foeA, c) : ray(meA, foeA, c)) : orb(meA, foeA, c)); if (lastUse.ult) arena.classList.add('quake'); }
        else if (!e.tick && (lastUse || e.counter)) await orb(meA, foeA, c, 170, true); // follow-up hits: volt chain, combos, a Grit counter
        sfx(e.tag === 'CRIT' || e.tag === 'EXECUTE' ? 'crit' : e.tag === 'WEAK SPOT' ? 'weak' : 'hit');
        if (e.tag === 'WEAK SPOT' && !saidWeak) { saidWeak = true; meSay('weak', 1800); }
        if (e.tag === 'WEAK SPOT') coachTip('weak', 'Weak spot! Your Chog\'s element hits this monster for +70%. Bring the right element and fights get easy.');
        hud(); shake(foeA);
        if (e.tick) {
          if (e.tag === 'BURN') burnFx(foeA, true); else if (e.tag === 'POISON') venomTick(foeA);
          else { const k = TICK_FX[e.tag]; if (k) burst(foeA, { n: 6, color: k.color, cls: k.cls, up: k.up || 0, grav: k.grav || 0, spread: 60, size: [6, 11] }); }
        }
        else impact(foeA, e.el, c, big || e.tag === 'WEAK SPOT');
        pop(foeA, `-${e.n}`, e.counter && !e.tag ? 'COUNTER' : e.tag, e.tag === 'WEAK SPOT' || e.tag === 'CRIT' || e.tag === 'EXECUTE' ? c : '#fff', e.tick, big);
        if (big) { buzz(25); await wait(90); } // a beat of hit-stop so the big ones land
        await wait(e.tick ? 420 : 380); arena.classList.remove('quake');
        if (shotDone && lastUse?.ult) setTimeout(() => arena.classList.remove('cine'), 250);
      } else if (e.t === 'heal') {
        hud();
        if (!e.n) { pop(meA, 'Full health', null, '#7CE2A0', true); await wait(300); continue; }
        if (!e.tick) sfx('heal'); life?.heal(f.me.hp / f.me.maxHp);
        burst(meA, { n: e.tick ? 4 : 10, color: '#7CE2A0', cls: 'plus', up: 70, grav: -50, spread: 70, size: [9, 16] });
        pop(meA, `+${e.n}`, e.tick ? null : 'HEAL', '#7CE2A0', e.tick); await wait(e.tick ? 320 : 450);
      }
      else if (e.t === 'shield') {
        if (!e.absorbed) sfx('shield'); hud();
        if (e.absorbed) { shieldFx(true); burst(meA, { n: 14, color: '#8FD3FF', cls: 'shard', spread: 140, grav: 70, size: [8, 15], at: shieldAt() }); pop(meA, `-${e.absorbed}`, 'SHIELD', '#8FD3FF', true); }
        else { shieldFx(false); bubble(meB); burst(meA, { n: 8, color: '#8FD3FF', cls: 'star', spread: 90, up: 20, size: [8, 13], at: shieldAt() }); pop(meA, `+${e.n}`, 'SHIELD', '#8FD3FF'); }
        await wait(380);
      }
      else if (e.t === 'status') {
        hud();
        const node = e.to === 'me' ? meA : foeA, sc = STATUS[e.s]?.[1] || '#ffffff';
        pop(node, e.text, null, `color-mix(in srgb, ${sc} 45%, #fff)`, true);
        if (e.s === 'guard') shieldFx(false);
        if (e.s === 'guard' || e.s === 'evade') bubble(meB);
        if (e.s === 'stun') burst(foeA, { n: 8, color: '#ffd66b', cls: 'star', up: 70, spread: 80, size: [10, 16] });
        if (e.s === 'armor') fxEl('hexwall', foeA, '#A8A3B5', 780);
        if (e.s === 'buff') burst(meA, { n: 12, color: '#FF8A1F', cls: 'flame', up: 80, grav: -40, spread: 70 });
        if (e.s === 'weak') burst(meA, { n: 10, color: '#7a2a3a', cls: 'smoke', grav: 80, spread: 70, size: [14, 24] });
        if (e.s === 'poison') fangs(node);
        if (e.s === 'burn') burnFx(foeA, false);
        if (['slow', 'exposed', 'mog', 'confused'].includes(e.s)) burst(foeA, { n: 8, color: sc, spread: 80, up: 30 });
        await wait(380);
      }
      else if (e.t === 'rage') { sfx('warn'); arena.classList.add('rage'); hud(); logEl.textContent = e.text; flash('#E2333D'); pop(meA, 'ADRENALINE', 'HITS GROW STRONGER', '#ff5a6e'); await wait(900); }
      else if (e.t === 'energy') {
        if (e.n > 0 && !e.text) sfx('energy'); hud();
        if (e.text === 'Energy stolen') orb(meA, foeA, '#9C8FC4', 260, true);
        if (e.text) pop(meA, e.text, null, '#9C8FC4', true);
        if (e.n >= 3 && !lastUse?.ult) burst(meA, { n: 10, color: hc, inward: true, spread: 120, dur: 420, size: [5, 9] }); // the ultimate just charged
        await wait(120);
      }
      else if (e.t === 'foeSkip') { call.classList.remove('on'); lastUse = null; logEl.textContent = `${f.foe.name} is stunned and loses its move.`; burst(foeA, { n: 6, color: '#ffd66b', cls: 'star', up: 60, spread: 60, size: [10, 15] }); pop(foeA, 'Stunned', 'SKIPS', '#e98ac3'); await wait(600); }
      else if (e.t === 'foeUse') {
        call.classList.remove('on'); lastUse = null; lastFoe = e.kind;
        logEl.textContent = `${f.foe.name} uses ${e.name}.`;
        const strip = foeA.querySelector('.strip');
        const frame = (n) => strip?.style.setProperty('--f', n);
        frame(1); // wind-up while the red warning grows
        sfx(e.kind === 'heavy' ? 'warn' : 'monster');
        if (e.kind === 'heavy' || e.kind === 'hit' || e.kind === 'poison' || e.kind === 'drain') {
          ring(meB); if (e.kind === 'heavy') foeA.classList.add('windup');
          await wait(e.kind === 'heavy' ? 650 : 420);
          foeA.classList.remove('windup');
          frame(2); lunge(foeB, -34); if (e.kind === 'heavy') sfx('monster'); await wait(160);
        } else { await wait(260); frame(2); pop(foeA, e.name, null, '#fff', true); await wait(420); }
        setTimeout(() => { if (!f.win) frame(3); }, 380); setTimeout(() => { if (!f.win) frame(0); }, 620); // recover, then back to ready
      } else if (e.t === 'miss') { sfx('miss'); lunge(meB, -26); burst(meA, { n: 6, color: '#8FD3FF', spread: 70, size: [4, 8] }); pop(meA, 'Miss', null, '#8FD3FF'); await wait(450); }
      else if (e.t === 'block') { fxEl('impact', meA, '#8FD3FF', 650); pop(meA, `Blocked ${e.n}`, null, '#8FD3FF', true); await wait(250); }
      else if (e.t === 'dmg' && e.to === 'me') {
        if (!e.tick) { sfx('hurt'); swingT.forEach(clearTimeout); mePose(2); setTimeout(() => { if (!f.over) mePose(0); }, 520); }
        hud(); life?.hurt(f.me.hp / f.me.maxHp); shake(meA);
        if (!e.tick) { skPose(2); setTimeout(() => { if (!f.over) skPose(0); }, 600); slash(meA, FOE_HUE[lastFoe] || '0deg', e.heavy); burst(meA, { n: e.heavy ? 14 : 8, color: '#ff6a6a', spread: e.heavy ? 130 : 90, grav: 40, size: [5, 10] }); }
        else if (e.tag === 'POISON') venomTick(meA);
        if (!saidLow && f.me.hp > 0 && f.me.hp / f.me.maxHp < 0.35) { saidLow = true; meSay('low', 2000); setTimeout(() => skSay('low'), 900); }
        if (e.heavy) { buzz(50); arena.classList.add('quake'); flash('#E2333D'); punch(1.025); setTimeout(() => arena.classList.remove('quake'), 420); }
        pop(meA, `-${e.n}`, e.tag, '#ff8a8a', e.tick, e.heavy); await wait(e.tick ? 380 : 480);
      }
      else if (e.t === 'revive') { hud(); flash('#e9e2ff'); burst(meA, { n: 18, color: '#e9e2ff', inward: true, spread: 150, dur: 500 }); pop(meA, 'Back up!', 'UNDEAD', '#e9e2ff'); await wait(700); }
      else if (e.t === 'end') { // the knockout: a slow-motion cut splits the monster in two, or the scene drains of colour
        call.classList.remove('on'); arena.classList.remove('cine');
        if (e.win) {
          arena.classList.add('slowmo'); await wait(360); // a held breath
          const r = foeA.getBoundingClientRect(), a = arena.getBoundingClientRect();
          const cut = fxEl('finslash', null, '#ffffff', 900, { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height * 0.48 });
          if (cut) { cut.style.width = `${Math.hypot(r.width, r.height * 0.4) * 1.5}px`; cut.style.setProperty('--ang', `${Math.atan2(-r.height * 0.4, r.width)}rad`); }
          sfx('crit'); await wait(170);
          splitFoe(foeA); flash('#ffffff'); punch(1.05); buzz([30, 40, 90]);
          burst(foeA, { n: 34, color: monColor, spread: 230, size: [8, 18], grav: 80 }); burst(foeA, { n: 14, color: '#fff', spread: 160 });
          ko('K.O.', '#ffd66b');
          await wait(950); arena.classList.remove('slowmo');
        } else { arena.classList.add('lost'); ko('K.O.', '#ff5a6e'); buzz([80, 50, 120]); await wait(650); }
      }
      else if (e.t === 'phase') { // the boss below half health: enraged
        sfx('warn'); hud(); logEl.textContent = e.text;
        arena.classList.add('cine', 'quake', 'phase2'); foeA.classList.add('enraged'); flash('#E2333D'); buzz([60, 40, 60]);
        burst(foeA, { n: 30, color: '#E2333D', cls: 'flame', up: 90, grav: -40, spread: 150, size: [8, 16] });
        ko('ENRAGED', '#ff4d5e', 'banner'); sfx('monster');
        await wait(1300); arena.classList.remove('quake', 'cine'); hud();
      }
      else if (e.t === 'perfect') { // you read the heavy attack: time slows for a beat
        arena.classList.add('slowmo'); sfx('crit'); flash('#ffd66b'); punch(1.03); buzz([20, 30, 20]);
        burst(meA, { n: 16, color: '#ffd66b', cls: 'star', spread: 130, up: 30, size: [10, 16] });
        ko('PERFECT!', '#ffd66b', 'banner'); hud();
        await wait(750); arena.classList.remove('slowmo');
      }
    }
    call.classList.remove('on'); arena.classList.remove('cine'); hud();
  }

  async function turn(key) {
    if (busy || f.over || closed) return;
    clearCoach();
    busy = true; hud();
    const events = act(f, key, rand); if (events.length) pressed.push(key);
    await play(events);
    if (closed) return;
    busy = false; hud(); coachMoment();
    if (f.over) return finish();
    if (auto) { await wait(350); if (auto && !busy) turn(autoMove(f)); } // auto may have been switched off during the pause
    else freshMoves();
  }
  function finish() {
    stopEmbers();
    logEl.textContent = f.win ? `${f.foe.name} is down.` : `${hunter.name} is knocked out.`;
    swingT.forEach(clearTimeout); mePose(f.win ? 1 : 3); // Apprentice: sword up, or sitting with its mask knocked off
    if (f.win) life?.win(); else life?.lose();
    meSay(f.win ? 'win' : 'lose', 2200); skPose(f.win ? 1 : 3); if (f.win) skHop(); setTimeout(() => skSay(f.win ? 'win' : 'lose'), 700);
    $('#me-art').classList.add(f.win ? 'cheer' : 'down');
    sfx(f.win ? 'win' : 'lose');
    if (f.win) $('#foe-art').classList.add('down');
    onFinish?.({ win: f.win, turns: f.turn, loot: f.loot, mult: f.element === monster.weak ? 1.5 : 1, dmg: f.foe.maxHp - f.foe.hp, keys: [...pressed] }, close);
  }
  function close() {
    closed = true; stopEmbers(); clearCoach(); life?.stop();
    root.hidden = true; document.documentElement.style.overflow = ''; setMood('lodge');
    removeEventListener('keydown', keys);
  }
  function keys(e) {
    if (root.hidden) return;
    const k = e.key.toUpperCase();
    if (['Q', 'W', 'E', 'R'].includes(k)) { const b = document.querySelector(`.move[data-key="${k}"]`); if (b && !b.disabled) turn(k); }
    if (['1', '2', '3'].includes(k)) document.querySelector(`.pot[data-pot="${Number(k) - 1}"]:not(:disabled)`)?.click(); // 1-3 drink a potion
  }
  addEventListener('keydown', keys);
  if (lab) clearCoach(); else { coachState.fights += 1; saveCoach(); } // the FX Lab never touches saved state
  $('#coach-ok').onclick = clearCoach;
  $('#bag').onclick = async (e) => { // a potion is free: it doesn't use your turn, but only one per fight
    const b = e.target.closest('[data-pot]'); if (!b || b.disabled || busy || f.over || closed) return;
    const i = Number(b.dataset.pot); bag[i] -= 1; onQuaff?.(i);
    busy = true; clearCoach(); hud(); sfx('drink'); callout('', `${POTIONS[i].name} potion`, POTIONS[i].color);
    logEl.textContent = `${hunter.name} drinks a ${POTIONS[i].name} potion.`;
    burst($('#me-art'), { n: 16, color: POTIONS[i].color, cls: 'bubbleP', up: 90, grav: -60, spread: 80, size: [7, 14] });
    fxEl('impact', $('#me-art'), POTIONS[i].color, 650);
    await wait(260);
    pressed.push(`P${i}`); await play(quaff(f, i)); if (closed) return;
    busy = false; hud(); coachMoment();
    if (auto && !f.over) turn(autoMove(f)); // Auto was switched on while drinking: carry on with it
  };
  $('#moves').onclick = (e) => { const b = e.target.closest('.move'); if (b && !b.disabled) turn(b.dataset.key); };
  const autoBtn = $('#auto');
  autoBtn.setAttribute('aria-pressed', 'false');
  autoBtn.onclick = () => { auto = !auto; autoBtn.setAttribute('aria-pressed', String(auto)); hud(); if (auto && !busy && !f.over) turn(autoMove(f)); };
  $('#leave').onclick = () => { if (!f.over) { close(); onFinish?.(null, () => {}, (f.turn || 1) - 1); } }; // turns played: running away after the first one counts as a loss
  hud(); if (!lab) coachMoment();
  // the FX Lab plays scripted events straight through the same effects
  const labPlay = async (events) => { if (busy || closed) return; busy = true; clearCoach(); hud(); await play(events); if (closed) return; busy = false; hud(); };
  return { close, labPlay };
}
