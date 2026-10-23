// Hero scene: the whole idea in a few seconds. A FUD post types itself out, its FUD words light up, it cracks
// and a monster climbs out of it, then your Chog steps in to face it. Loops through sample posts.
// Built from plain DOM + CSS transitions (see .h-* styles in demo.html); text goes in with textContent only.

const SAMPLES = [
  'gas fees on monad are a total joke',
  'this is a rug waiting to happen, devs will exit scam',
  'chain is DOWN again, broken and stuck',
  '$CHOG is going to ZERO, everyone is dumping!!',
  'everyone knows it is literally over, cope',
];
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * el: the scene container. monsterFromPost: game.js. getHunter(): { name, img, ghost }.
 * elements: game ELEMENTS (for the weak-spot colour). onHunt(text): forge it onto the board.
 * Returns stop().
 */
export function startHero({ el, monsterFromPost, getHunter, elements, onHunt, onOwn }) {
  el.innerHTML = `
    <div class="h-post" aria-hidden="true">
      <div class="h-ph"><i></i><div><b>anon</b><span>@anon · just now</span></div><em>post on X</em></div>
      <p class="h-text"></p>
    </div>
    <p class="h-quote" aria-hidden="true"></p>
    <div class="h-burst" aria-hidden="true"></div>
    <div class="h-mon"><img alt=""><div class="h-name"><b></b><span class="h-meta"></span></div></div>
    <div class="h-chog"><img alt=""><b></b></div>
    <div class="h-vs" aria-hidden="true">VS</div>
    <div class="h-cta"><button type="button" class="btn" data-h="hunt">Hunt it</button><button type="button" class="h-own" data-h="own">or forge your own FUD</button></div>
    <p class="sr-only" aria-live="polite"></p>`;
  const q = (s) => el.querySelector(s);
  const text = q('.h-text'), monImg = q('.h-mon img'), monName = q('.h-name b'), meta = q('.h-meta');
  const chogImg = q('.h-chog img'), chogName = q('.h-chog b'), live = q('.sr-only');
  let i = 0, gen = 0, current = null, paused = false;

  const sleep = (ms, g) => new Promise((res, rej) => setTimeout(() => (g === gen ? res() : rej(new Error('stale'))), reduce() ? Math.min(ms, 60) : ms));
  const state = (s) => { el.dataset.s = s; };

  // the post text, with the FUD words wrapped in <mark> (built node by node, never as HTML)
  function paintMarked(t, words, lit) {
    text.replaceChildren();
    if (!lit || !words.length) { text.textContent = t; return; }
    const re = new RegExp(`(?<![\\w$])(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\\w)`, 'gi');
    let last = 0;
    for (const m of t.matchAll(re)) {
      text.append(t.slice(last, m.index));
      const mk = document.createElement('mark'); mk.textContent = m[0]; text.append(mk);
      last = m.index + m[0].length;
    }
    text.append(t.slice(last));
  }

  async function play() {
    const g = ++gen;
    try {
      for (;;) {
        const t = SAMPLES[i % SAMPLES.length]; i += 1;
        const m = monsterFromPost(t), h = getHunter(); current = { text: t, monster: m };
        // load the next pictures before they're needed
        monImg.src = `assets/monsters/${m.kind}.webp`;
        chogImg.src = h.ghost ? 'assets/chogs/apprentice.webp' : h.img; chogImg.classList.toggle('pix', !!h.ghost);
        chogName.textContent = h.name;
        monName.textContent = m.name;
        q('.h-quote').textContent = `“${t}”`;
        const E = elements[m.weak];
        meta.replaceChildren();
        const lvl = document.createElement('span'); lvl.className = 'h-lvl'; lvl.textContent = `FUD level ${m.forge.level}`;
        const weak = document.createElement('span'); weak.className = 'h-weak'; weak.style.setProperty('--c', E.color); weak.textContent = `Weak to ${E.name}`;
        meta.append(lvl, weak);

        state('type'); text.textContent = '';
        if (reduce()) text.textContent = t;
        else for (let n = 1; n <= t.length; n++) { text.textContent = t.slice(0, n); await sleep(32, g); }
        await sleep(350, g);
        state('mark'); paintMarked(t, m.forge.words, true);
        await sleep(1000, g);
        state('forge');
        await sleep(650, g);
        state('mon'); live.textContent = `The post became the ${m.name}.`;
        await sleep(700, g);
        state('face'); live.textContent = `${h.name} steps in to hunt the ${m.name}.`;
        for (let w = 0; w < 4200 || paused; w += 100) await sleep(100, g); // holds while the pointer is on the scene
        state('out');
        await sleep(450, g);
      }
    } catch { /* a newer loop took over */ }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]'); if (!b || !current) return;
    if (b.dataset.h === 'hunt') onHunt(current.text);
    if (b.dataset.h === 'own') onOwn();
  });
  // hold the final frame while the pointer is on it, so people can read and click
  el.addEventListener('pointerenter', () => { paused = true; });
  el.addEventListener('pointerleave', () => { paused = false; });
  el.addEventListener('focusin', () => { paused = true; });
  el.addEventListener('focusout', () => { paused = false; });

  // only run while visible. It starts once and keeps going: a repeated "visible" signal must not restart it
  // (that restarted the scene from the top over and over, so it flickered)
  let running = false, onScreen = false;
  const start = () => { if (running || !onScreen || document.hidden) return; running = true; play(); };
  const stop = () => { gen += 1; running = false; };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); else stop(); }, { threshold: 0.2 });
  io.observe(el);
  // a hidden tab only slows the timers down; when it comes back the scene carries on where it was, it never jumps to the start
  const vis = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', vis);
  return () => { gen += 1; io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
