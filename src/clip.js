// Victory clip: after a win, an 8-second 1280×720 MP4 of the hunt, made in the browser (WebCodecs + mp4-muxer from
// our own vendor folder). The FUD post types itself, turns into the monster, your Chog steps in, one laser slice,
// DEBUNKED, the bounty counts up, and the site's name closes it. Every frame is drawn at its exact time, so it
// takes a few seconds and doesn't depend on the tab being in front.
const W = 1280, H = 720, FPS = 30, LEN = 8;
const loadImg = (src) => new Promise((res) => {
  const i = new Image(); i.crossOrigin = 'anonymous';
  i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const span = (t, a, b) => clamp((t - a) / (b - a)); // 0 → 1 between a and b
const back = (t) => { const s = 1.7; t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; }; // overshoot pop

export const canMakeClip = () => 'VideoEncoder' in window && 'VideoFrame' in window;

function wrap(c, text, width, max) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > width && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/\s*\S*$/, '')}…`; }
  return out;
}

function painter(c, o, img) {
  const quote = `“${o.quote}”`, bounty = Math.max(0, Math.round(o.bounty || 0));
  const strip = ['#836ef9', '#a99bfc', '#e845a4', '#7831ff'];
  const sparks = Array.from({ length: 40 }, (_, i) => ({ a: (i / 40) * Math.PI * 2 + (i % 3) * 0.2, s: 260 + (i * 97) % 340, r: 2 + (i % 4) }));
  const MX = 880, MY = 400, CX = 330, CY = 410; // monster and Chog centres

  function bg(t) {
    c.fillStyle = '#0e0b1a'; c.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
    glow(320 + Math.sin(t * 0.7) * 30, 420, 460, 'rgba(131,110,249,.32)'); glow(920, 380, 460, 'rgba(232,69,164,.22)');
    for (let i = 0; i < W / 18; i++) { c.fillStyle = strip[i % 4]; c.globalAlpha = 0.5 + 0.5 * (((i * 7 + Math.floor(t * 6)) % 5) / 5); c.fillRect(i * 18, 0, 14, 8); }
    c.globalAlpha = 1;
  }
  function header(a) {
    if (a <= 0) return;
    c.save(); c.globalAlpha = a;
    if (img.logo) { c.save(); c.beginPath(); c.roundRect(44, 34, 48, 48, 11); c.clip(); c.drawImage(img.logo, 44, 34, 48, 48); c.restore(); }
    c.font = '40px "Koulen", Impact, sans-serif'; c.textBaseline = 'middle'; c.letterSpacing = '2px'; c.fillStyle = '#f4f1fe'; c.textAlign = 'left';
    c.fillText('CHOG', 106, 60); const cw = c.measureText('CHOG ').width;
    c.strokeStyle = '#a99bfc'; c.lineWidth = 1.5; c.strokeText('CONTRACTS', 106 + cw, 60);
    c.restore();
  }
  // 1. the FUD post types itself out (0 – 2 s), then cracks away
  function post(t) {
    const inA = ease(span(t, 0, 0.35)), out = span(t, 1.85, 2.25);
    if (inA <= 0 || out >= 1) return;
    c.save();
    c.globalAlpha = inA * (1 - out);
    const w = 760, x = (W - w) / 2, y = 250 - (1 - inA) * 30;
    c.translate(W / 2, y + 100); c.rotate(out * 0.08); c.scale(1 - out * 0.1, 1 - out * 0.1); c.translate(-W / 2, -(y + 100));
    c.fillStyle = '#16112a'; c.strokeStyle = 'rgba(169,155,252,.35)'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(x, y, w, 200, 22); c.fill(); c.stroke();
    c.fillStyle = '#3a2f5e'; c.beginPath(); c.arc(x + 50, y + 50, 22, 0, Math.PI * 2); c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.letterSpacing = '0px';
    c.fillStyle = '#f4f1fe'; c.font = '700 22px "Inter", sans-serif'; c.fillText('anon', x + 86, y + 40);
    c.fillStyle = '#8a80b5'; c.font = '500 17px "JetBrains Mono", monospace'; c.fillText('@anon · just now', x + 86, y + 64);
    const shown = quote.slice(0, Math.floor(quote.length * span(t, 0.3, 1.5)));
    c.fillStyle = '#f4f1fe'; c.font = 'italic 30px "Inter", sans-serif';
    wrap(c, shown, w - 80, 3).forEach((l, i) => c.fillText(l, x + 40, y + 112 + i * 38));
    if (out > 0) { c.strokeStyle = '#e2333d'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 30, y + 118); c.lineTo(x + 30 + (w - 60) * ease(out * 2), y + 108); c.stroke(); }
    c.restore();
    c.save(); c.globalAlpha = inA * (1 - out); c.font = '600 18px "JetBrains Mono", monospace'; c.letterSpacing = '4px'; c.textAlign = 'center'; c.fillStyle = '#a99bfc';
    c.fillText('SOMEONE ON X SAID…', W / 2, 200); c.restore();
  }
  // 2. the monster and the Chog face off (2 – 3.6 s)
  function faceoff(t) {
    const m = back(span(t, 2.0, 2.6)), h = back(span(t, 2.35, 2.95)), slice = span(t, 3.7, 4.0);
    const gone = span(t, 4.1, 4.9);
    if (m <= 0) return;
    // the monster (split in two by the slice, the halves sliding apart and fading)
    if (img.mon && gone < 1) {
      const s = 430 * m, x = MX - s / 2, y = MY - s / 2 + Math.sin(t * 3) * 6;
      const shake = slice > 0 && slice < 1 ? (Math.random() - 0.5) * 16 : 0;
      const half = (sign) => {
        c.save(); c.globalAlpha = 1 - gone;
        c.beginPath();
        if (sign < 0) { c.moveTo(x - 50, y - 50); c.lineTo(x + s + 50, y - 50); c.lineTo(x + s + 50, y + s * 0.25); c.lineTo(x - 50, y + s * 0.75); }
        else { c.moveTo(x - 50, y + s * 0.75); c.lineTo(x + s + 50, y + s * 0.25); c.lineTo(x + s + 50, y + s + 50); c.lineTo(x - 50, y + s + 50); }
        c.closePath(); c.clip();
        c.drawImage(img.mon, x + shake + sign * gone * 60, y + sign * gone * 70, s, s);
        c.restore();
      };
      if (slice >= 1) { half(-1); half(1); } else { c.save(); c.drawImage(img.mon, x + shake, y, s, s); c.restore(); }
    }
    // monster name
    if (gone < 1) {
      c.save(); c.globalAlpha = clamp(m) * (1 - gone); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 40px "Grenze Gotisch", serif'; c.fillStyle = '#f4f1fe'; c.fillText(o.monsterName, MX, 640);
      c.font = '600 16px "JetBrains Mono", monospace'; c.letterSpacing = '3px'; c.fillStyle = o.weakColor || '#ffd66b';
      c.fillText(`WEAK TO ${String(o.weakName || '').toUpperCase()}`, MX, 680); c.restore();
    }
    // the hunter: a framed NFT card, or the Wannabe's full-body cut-out
    if (h > 0 && img.chog) {
      c.save(); c.translate(CX - (1 - h) * 300, CY); c.rotate(-0.05);
      if (o.cutout) { const s = 360; c.drawImage(img.chog, -s / 2, -s / 2 - 20, s, s); }
      else {
        c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.shadowOffsetY = 16;
        c.fillStyle = '#f4f1fe'; c.beginPath(); c.roundRect(-160, -170, 320, 320, 26); c.fill(); c.shadowColor = 'transparent';
        c.save(); c.beginPath(); c.roundRect(-150, -160, 300, 300, 18); c.clip(); c.drawImage(img.chog, -150, -160, 300, 300); c.restore();
      }
      c.font = '36px "Koulen", Impact, sans-serif'; c.letterSpacing = '2px'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = String(o.hunterName).toUpperCase(), lw = c.measureText(label).width + 40;
      c.fillStyle = '#836ef9'; c.beginPath(); c.roundRect(-lw / 2, 160, lw, 54, 13); c.fill();
      c.fillStyle = '#fff'; c.fillText(label, 0, 189);
      c.restore();
    }
    // VS
    const vs = span(t, 2.7, 3.0) * (1 - span(t, 3.6, 3.8));
    if (vs > 0) { c.save(); c.globalAlpha = vs; c.font = '96px "Koulen", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e845a4'; c.translate(605, 400); c.scale(0.6 + 0.4 * back(vs), 0.6 + 0.4 * back(vs)); c.fillText('VS', 0, 0); c.restore(); }
  }
  // 3. one hit: a laser slice across the monster, a white flash and sparks (3.7 – 4.4 s)
  function hit(t) {
    const a = span(t, 3.6, 3.8), fade = span(t, 4.0, 4.4);
    if (a <= 0 || fade >= 1) return;
    c.save(); c.globalAlpha = 1 - fade; c.lineCap = 'round';
    const x0 = MX - 300, y0 = MY + 170, x1 = MX + 300, y1 = MY - 170, k = ease(a);
    for (const [w, col] of [[34, 'rgba(232,69,164,.35)'], [16, '#e845a4'], [6, '#fff']]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); c.stroke();
    }
    c.restore();
    const f = span(t, 3.8, 3.86) * (1 - span(t, 3.86, 4.2));
    if (f > 0) { c.fillStyle = `rgba(255,255,255,${0.75 * f})`; c.fillRect(0, 0, W, H); }
    const sp = span(t, 3.85, 4.6);
    if (sp > 0 && sp < 1) {
      c.save(); c.globalAlpha = 1 - sp;
      for (const p of sparks) { c.fillStyle = p.r > 3 ? '#ffd66b' : '#e845a4'; c.beginPath(); c.arc(MX + Math.cos(p.a) * p.s * ease(sp), MY + Math.sin(p.a) * p.s * ease(sp), p.r * 2, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
  }
  // 4. DEBUNKED stamp and the bounty counting up (4.4 – 8 s)
  function payoff(t) {
    const s = back(span(t, 4.4, 4.75));
    if (s <= 0) return;
    c.save(); c.translate(MX, 300); c.rotate(-0.12); c.scale(1.6 - 0.6 * s, 1.6 - 0.6 * s); c.globalAlpha = clamp(s);
    c.font = '92px "Koulen", Impact, sans-serif'; c.letterSpacing = '6px'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText('DEBUNKED').width + 60;
    c.strokeStyle = '#e2333d'; c.lineWidth = 8; c.beginPath(); c.roundRect(-tw / 2, -62, tw, 124, 16); c.stroke();
    c.fillStyle = '#e2333d'; c.fillText('DEBUNKED', 0, 6);
    c.restore();
    const b = span(t, 4.9, 6.2), bA = ease(span(t, 4.8, 5.1));
    if (bA > 0) {
      c.save(); c.globalAlpha = bA; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '110px "Koulen", Impact, sans-serif'; c.letterSpacing = '3px'; c.fillStyle = '#ffd66b';
      c.shadowColor = 'rgba(255,214,107,.5)'; c.shadowBlur = 30;
      c.fillText(`+${Math.round(bounty * ease(b)).toLocaleString('en-US')}`, MX, 470);
      c.shadowColor = 'transparent';
      c.font = '600 20px "JetBrains Mono", monospace'; c.letterSpacing = '4px'; c.fillStyle = '#c9bfff';
      c.fillText(`TEST $CHOG BOUNTY · ${o.turns} TURNS`, MX, 545);
      c.restore();
    }
  }
  // 5. the closing line (6.4 – 8 s)
  function outro(t) {
    const a = ease(span(t, 6.3, 6.8));
    if (a <= 0) return;
    c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(14,11,26,.82)'; c.fillRect(0, H - 120 * a, W, 120);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '44px "Koulen", Impact, sans-serif'; c.letterSpacing = '2px'; c.fillStyle = '#f4f1fe';
    c.fillText('FUD IS A MONSTER. YOUR CHOG HUNTS IT.', W / 2, H - 78);
    c.font = '600 20px "JetBrains Mono", monospace'; c.letterSpacing = '3px'; c.fillStyle = '#ffd66b';
    c.fillText('PLAY FREE · CHOG-CONTRACTS.NETLIFY.APP · #CHOGATHON', W / 2, H - 34);
    c.restore();
  }
  return (t) => { bg(t); header(1); post(t); faceoff(t); hit(t); payoff(t); outro(t); };
}

/** Makes the clip. o: the share card's data. onProgress(0..1). Returns an MP4 Blob. */
export async function makeClip(o, onProgress = () => {}) {
  if (!canMakeClip()) throw new Error('This browser can\'t make videos. Try Chrome or Edge.');
  await Promise.race([Promise.all(['40px "Koulen"', '700 40px "Grenze Gotisch"', '600 20px "JetBrains Mono"', 'italic 30px "Inter"', '700 22px "Inter"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2000))]).catch(() => {});
  const [chog, mon, logo] = await Promise.all([loadImg(o.hunterImg), loadImg(o.monsterImg), loadImg('assets/brand/logo.png')]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const draw = painter(c, o, { chog, mon, logo });

  const { Muxer, ArrayBufferTarget } = await import('../vendor/mp4-muxer/mp4-muxer.js');
  let codec = null;
  for (const cand of ['avc1.640028', 'avc1.4d0028', 'avc1.42e01f']) {
    const s = await VideoEncoder.isConfigSupported({ codec: cand, width: W, height: H, bitrate: 5e6, framerate: FPS }).catch(() => null);
    if (s?.supported) { codec = cand; break; }
  }
  if (!codec) throw new Error('No video encoder here. Try Chrome or Edge.');
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
  let fail = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { fail = e; } });
  enc.configure({ codec, width: W, height: H, bitrate: 5e6, framerate: FPS });
  const total = LEN * FPS;
  for (let i = 0; i < total; i++) {
    if (fail) throw fail;
    draw(i / FPS);
    let frame;
    // a Chog picture from a server that refuses CORS leaves the canvas unreadable: say so plainly
    try { frame = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); }
    catch { throw new Error('This Chog\'s picture can\'t go into a video here. The image card still works.'); }
    enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); frame.close();
    if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    if (i % 10 === 0) { onProgress(i / total); await new Promise((r) => setTimeout(r, 0)); }
  }
  await enc.flush(); enc.close(); muxer.finalize();
  onProgress(1);
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
