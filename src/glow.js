// Spotlight cards: a soft light follows the pointer, and the edge of every card near it lights up (purple on the
// left of the screen, shading to Chog pink on the right). Ported from a React "spotlight card" to plain CSS + one
// listener. Each card gets the pointer in its own coordinates (--mx / --my), so a card lifting on hover stays lit
// correctly. Only with a real mouse, and never with reduced motion.
const SEL = '.contract, .hunter, .tile, .move';

export function startGlow() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('glow-on');
  let x = -9999, y = -9999, queued = false;
  const paint = () => {
    queued = false;
    document.documentElement.style.setProperty('--gh', (255 + (x / innerWidth) * 75).toFixed(0));
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -240 || r.top > innerHeight + 240 || r.width === 0) continue; // off screen: leave it
      el.style.setProperty('--mx', `${Math.round(x - r.left)}px`);
      el.style.setProperty('--my', `${Math.round(y - r.top)}px`);
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; queue(); }, { passive: true });
  addEventListener('scroll', queue, { passive: true });
  document.addEventListener('pointerleave', () => { x = y = -9999; queue(); }); // the pointer left the page: lights out
}
