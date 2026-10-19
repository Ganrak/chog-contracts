// Share card: after a win, draw a 1200×675 image (the X card size) of your Chog standing over the monster
// it hunted, with the FUD it came from, and let the player post it. X's post link can't carry an image, so
// phones get the system share sheet (image attached) and desktops save the image and open a ready post.
const W = 1200, H = 675;
const loadImg = (src) => new Promise((res) => {
  const i = new Image(); i.crossOrigin = 'anonymous';
  i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});

function cover(c, img, x, y, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function contain(c, img, x, y, w, h) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  c.drawImage(img, x + (w - iw) / 2, y + (h - ih), iw, ih); // stand on the bottom edge
}
// wrap text into at most `max` lines, ending with … if it doesn't fit
function lines(c, text, width, max) {
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (c.measureText(t).width > width && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/\s*\S*$/, '')}…`; }
  return out;
}

/**
 * opts: { hunterName, hunterImg, cutout (the Apprentice: a full-body cut-out, not a square NFT), monsterName, monsterImg, quote, turns, weakName,
 *         weakColor, potionName, potionColor, level }
 * Returns a canvas.
 */
export async function drawShareCard(o) {
  await Promise.race([Promise.all(['64px "Koulen"', '700 40px "Grenze Gotisch"', '500 20px "JetBrains Mono"', 'italic 28px "Inter"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2000))]).catch(() => {});
  const [chog, mon, logo] = await Promise.all([loadImg(o.hunterImg), loadImg(o.monsterImg), loadImg('assets/brand/logo.png')]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  // night background with Monad purple and Chog pink glows
  c.fillStyle = '#0e0b1a'; c.fillRect(0, 0, W, H);
  const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  glow(260, 380, 420, 'rgba(131,110,249,.35)'); glow(930, 380, 420, 'rgba(232,69,164,.22)');
  // pixel strip along the top, like the Chog sites
  const strip = ['#836ef9', '#a99bfc', '#e845a4', '#7831ff'];
  for (let i = 0; i < W / 18; i++) { c.fillStyle = strip[i % 4]; c.globalAlpha = 0.55 + 0.45 * ((i * 7) % 5) / 5; c.fillRect(i * 18, 0, 14, 8); }
  c.globalAlpha = 1;

  // header: logo + wordmark, and the result tag
  if (logo) { c.save(); c.beginPath(); c.roundRect(48, 36, 52, 52, 12); c.clip(); c.drawImage(logo, 48, 36, 52, 52); c.restore(); }
  c.fillStyle = '#f4f1fe'; c.font = '44px "Koulen", Impact, sans-serif'; c.textBaseline = 'middle'; c.letterSpacing = '2px';
  c.fillText('CHOG', 116, 66);
  const cw = c.measureText('CHOG ').width;
  c.strokeStyle = '#a99bfc'; c.lineWidth = 1.6; c.strokeText('CONTRACTS', 116 + cw, 66);
  c.font = '600 18px "JetBrains Mono", monospace'; c.letterSpacing = '3px'; c.textAlign = 'right'; c.fillStyle = '#5ce68a';
  c.fillText(`CONTRACT COMPLETE · ${o.turns} TURNS`, W - 48, 66);
  c.textAlign = 'left';

  // the hunter: framed NFT (or the Apprentice cut-out), bottom left
  const fx = 58, fy = 140, fs = 370;
  c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.shadowOffsetY = 16;
  c.fillStyle = '#f4f1fe'; c.beginPath(); c.roundRect(fx - 10, fy - 10, fs + 20, fs + 20, 30); c.fill(); c.restore();
  c.save(); c.beginPath(); c.roundRect(fx, fy, fs, fs, 22); c.clip();
  c.fillStyle = '#201a3a'; c.fillRect(fx, fy, fs, fs);
  if (chog) { if (o.cutout) contain(c, chog, fx + 20, fy + 14, fs - 40, fs - 28); else cover(c, chog, fx, fy, fs, fs); }
  c.restore();
  // name plate
  c.font = '40px "Koulen", Impact, sans-serif'; c.letterSpacing = '1px';
  const plate = `${o.hunterName.toUpperCase()} · LV ${o.level}`, pw = c.measureText(plate).width + 40;
  c.fillStyle = '#836ef9'; c.beginPath(); c.roundRect(fx + fs / 2 - pw / 2, fy + fs - 6, pw, 54, 14); c.fill();
  c.fillStyle = '#000'; c.globalAlpha = 0.35; c.fillRect(fx + fs / 2 - pw / 2 + 6, fy + fs + 48, pw - 6, 6); c.globalAlpha = 1;
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(plate, fx + fs / 2, fy + fs + 22); c.textAlign = 'left';

  // the monster, bottom right, with a HUNTED stamp
  const mx = 800, my = 150, ms = 370;
  if (mon) { c.save(); c.globalAlpha = 0.9; c.filter = 'saturate(.75)'; contain(c, mon, mx, my, ms, ms); c.restore(); }
  c.save(); c.translate(mx + ms / 2, my + ms - 40); c.rotate(-0.16);
  c.font = '64px "Koulen", Impact, sans-serif'; c.letterSpacing = '6px'; c.textAlign = 'center';
  c.lineWidth = 6; c.strokeStyle = '#E2333D'; c.strokeRect(-150, -42, 300, 84);
  c.fillStyle = '#E2333D'; c.fillText('HUNTED', 0, 4); c.restore();

  // middle: what happened
  // the middle block is measured first so it can sit centred between the two pictures
  const cx = 462, cwid = 330;
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
  c.font = '700 54px "Grenze Gotisch", Georgia, serif';
  const title = lines(c, o.monsterName, cwid, 2);
  c.font = 'italic 25px "Inter", system-ui, sans-serif';
  const q = lines(c, `“${o.quote}”`, cwid, 4);
  const blockH = 30 + title.length * 56 + 16 + q.length * 34 + 18 + 36;
  let y = Math.max(150, 140 + (fs + 50) / 2 - blockH / 2);
  c.font = '600 17px "JetBrains Mono", monospace'; c.letterSpacing = '3px'; c.fillStyle = '#e845a4';
  c.fillText('FUD POST → MONSTER', cx, y + 14); y += 30;
  c.font = '700 54px "Grenze Gotisch", Georgia, serif'; c.letterSpacing = '0px'; c.fillStyle = '#f4f1fe';
  title.forEach((l) => { y += 56; c.fillText(l, cx, y - 8); });
  y += 16;
  c.font = 'italic 25px "Inter", system-ui, sans-serif'; c.fillStyle = 'rgba(244,241,254,.78)';
  q.forEach((l) => { y += 34; c.fillText(l, cx, y - 8); });
  // chips: weak spot and potion
  let chipX = cx, chipY = y + 18;
  const chip = (dot, text) => {
    c.font = '700 16px "JetBrains Mono", monospace'; c.letterSpacing = '1px';
    const w = c.measureText(text).width + 44;
    if (chipX > cx && chipX + w > cx + cwid) { chipX = cx; chipY += 46; } // wrap rather than run into the monster
    c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.roundRect(chipX, chipY, w, 36, 18); c.fill();
    c.fillStyle = dot; c.beginPath(); c.arc(chipX + 18, chipY + 18, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4f1fe'; c.fillText(text, chipX + 32, chipY + 24); chipX += w + 10;
  };
  chip(o.weakColor, `WEAK ${o.weakName.toUpperCase()}`);
  chip(o.potionColor, `${o.potionName.toUpperCase()} POTION`);
  if (o.bounty) chip('#f2b82e', `+${Math.round(o.bounty).toLocaleString('en-US')} $CHOG`);

  // footer
  c.font = '500 18px "JetBrains Mono", monospace'; c.letterSpacing = '2px'; c.fillStyle = 'rgba(244,241,254,.6)';
  c.fillText('YOUR CHOG IS A MONSTER HUNTER FOR HIRE', 48, H - 40);
  c.textAlign = 'right'; c.fillStyle = '#a99bfc'; c.fillText('#CHOGATHON', W - 48, H - 40);
  return cv;
}

const toBlob = (cv) => new Promise((res) => { try { cv.toBlob((b) => res(b), 'image/png'); } catch { res(null); } });

/** The post text, with the site link only when we're on a real address (not a preview). */
export function shareText(o) {
  const link = /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent|localhost/.test(location.hostname) ? `\n${location.origin}${location.pathname}` : '';
  return `My ${o.hunterName} just hunted the ${o.monsterName}\nFUD: “${o.quote}”\nYour Chog is a monster hunter too. @ChogNFT #Chogathon${link}`;
}

/** Phones: share sheet with the image. Desktop: save the image, then open a ready post on X. Returns what happened. */
export async function shareHunt(cv, o) {
  const blob = await toBlob(cv), text = shareText(o), name = `chog-hunt-${o.monsterName.toLowerCase().replace(/[^a-z]+/g, '-')}.png`;
  const file = blob && new File([blob], name, { type: 'image/png' });
  if (file && navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  if (blob) saveBlob(blob, name);
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return blob ? 'saved' : 'text-only';
}
/** Any picture (e.g. the room): phones get the share sheet, desktop saves it and opens a ready post on X. */
export async function shareImage(cv, text, name) {
  const blob = await toBlob(cv), file = blob && new File([blob], name, { type: 'image/png' });
  const link = /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent|localhost/.test(location.hostname) ? `\n${location.origin}${location.pathname}` : '';
  if (file && navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], text: text + link }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  if (blob) saveBlob(blob, name);
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text + link)}`, '_blank', 'noopener');
  return blob ? 'saved' : 'text-only';
}
export async function saveCard(cv, o) {
  const blob = await toBlob(cv); if (!blob) return false;
  saveBlob(blob, `chog-hunt-${o.monsterName.toLowerCase().replace(/[^a-z]+/g, '-')}.png`); return true;
}
export function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
