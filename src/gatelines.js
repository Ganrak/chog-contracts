// Lines behind the lodge door: two fans of thin curves, drawn ONCE onto a canvas and then left alone (no animation,
// so they cost nothing next to the door's WebGL). Each curve takes a colour from a small night palette.
const VW = 696, VH = 316;
const PALETTE = ['131,110,249', '232,69,164', '91,200,255', '255,214,107', '169,155,252']; // Monad purple, Chog pink, ice blue, gold, lilac

export function startGateLines(canvas) {
  if (!canvas) return;
  const count = matchMedia('(max-width: 760px)').matches ? 6 : 10, lines = [];
  for (const p of [1, -1]) {
    for (let k = 0; k < count; k++) {
      const i = Math.round(k * (36 / count)), o = i * 5 * p;
      lines.push({
        path: new Path2D(`M-${380 - o} -${189 + i * 6}C-${380 - o} -${189 + i * 6} -${312 - o} ${216 - i * 6} ${152 - o} ${343 - i * 6}C${616 - o} ${470 - i * 6} ${684 - o} ${875 - i * 6} ${684 - o} ${875 - i * 6}`),
        color: PALETTE[(k + (p > 0 ? 0 : 2)) % PALETTE.length], width: 0.35 + i * 0.015, alpha: 0.12 + i * 0.012,
      });
    }
  }
  const c = canvas.getContext('2d');
  const draw = () => {
    const W = canvas.width = Math.round(canvas.clientWidth / 2), H = canvas.height = Math.round(canvas.clientHeight / 2); // half resolution is plenty
    const s = Math.max(W / VW, H / VH);
    c.setTransform(s, 0, 0, s, (W - VW * s) / 2, (H - VH * s) / 2); c.lineCap = 'round';
    for (const l of lines) { c.globalAlpha = l.alpha; c.strokeStyle = `rgb(${l.color})`; c.lineWidth = l.width; c.stroke(l.path); }
  };
  draw();
  const onResize = () => { if (canvas.isConnected) draw(); else removeEventListener('resize', onResize); };
  addEventListener('resize', onResize);
}
