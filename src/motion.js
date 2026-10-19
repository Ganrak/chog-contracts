// Two small touches of motion, no library:
//  1. count-up: money and score numbers roll up from 0 the first time they come into view
//  2. press: buttons sink a little under the finger and spring back when released
// Both stay off for people who ask for reduced motion.

const COUNT = '.bounty, .lb-dmg, .w-chog, .bal, b.gold';
const PRESS = 'button, .btn, .tabs a, [role="button"]';
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- count-up ---------- */
const counted = new Set(); // "selector text" pairs already rolled once, so a re-render with the same value stays still
const NUM = /\d[\d,]*(\.\d+)?/;

function textNodeWithNumber(el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (NUM.test(n.nodeValue)) return n;
  return null;
}
function roll(el) {
  const node = textNodeWithNumber(el); if (!node) return;
  const key = `${el.className}|${el.textContent}`;
  if (counted.has(key)) return;
  counted.add(key);
  const m = node.nodeValue.match(NUM), raw = m[0], target = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(target) || target < 10) return; // tiny numbers don't need a show
  const before = node.nodeValue.slice(0, m.index), after = node.nodeValue.slice(m.index + raw.length);
  const decimals = (m[1] || '').length ? m[1].length - 1 : 0, commas = raw.includes(',');
  const fmt = (v) => (commas ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals));
  const dur = Math.min(1400, 500 + Math.log10(target) * 180), t0 = performance.now();
  const step = (now) => {
    if (!node.isConnected) return;
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    node.nodeValue = before + fmt(p < 1 ? target * e : target) + after;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function startMotion() {
  if (reduce()) return;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { io.unobserve(en.target); roll(en.target); }
  }, { threshold: 0.6 });
  const watch = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches(COUNT)) io.observe(root);
    root.querySelectorAll(COUNT).forEach((el) => io.observe(el));
  };
  watch(document.body);
  new MutationObserver((list) => { for (const m of list) m.addedNodes.forEach(watch); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- press ---------- */
  // uses the separate `scale` property, so it never fights a button's own transform (hover lifts, slides)
  let held = null;
  const release = () => {
    if (!held) return;
    const { el, anim } = held; held = null;
    anim.cancel();
    el.animate([{ scale: 0.94 }, { scale: 1.04 }, { scale: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
  };
  addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.(PRESS);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    release();
    held = { el, anim: el.animate([{ scale: 1 }, { scale: 0.94 }], { duration: 90, easing: 'ease-out', fill: 'forwards' }) };
  }, { passive: true });
  addEventListener('pointerup', release, { passive: true });
  addEventListener('pointercancel', release, { passive: true });
  addEventListener('blur', release);
}
