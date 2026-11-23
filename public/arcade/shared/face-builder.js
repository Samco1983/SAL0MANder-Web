/* SAL0MANder Face Builder (shared by all arcade games). Kids build a cartoon face from parts: our own art.
   A face is ONE number: 10000 + eyes*1000 + mouth*100 + top*10 + brows. Online, only that number is ever sent.
   The chosen face is saved on this device only (localStorage 'sal0mander.face'), so it follows a kid across games. */
(function () {
  'use strict';
  const BASE = 10000, W = [1000, 100, 10, 1], KEY = 'sal0mander.face';
  const PARTS = [['Eyes', ['Dots', 'Big', 'Shades', 'Stars', 'Sleepy', 'Wink']], ['Mouth', ['Smile', 'Grin', 'Flat', 'Oh', 'Tongue']],
    ['Top', ['None', 'Cat ears', 'Antenna', 'Crown', 'Spikes', 'Bow']], ['Brows', ['None', 'Happy', 'Angry', 'Raised']]];
  const parts = v => W.map(w => Math.floor((v - BASE) / w) % 10);
  const isFace = v => Number.isInteger(v) && v >= BASE && v < BASE + 10000 && parts(v).every((p, i) => p < PARTS[i][1].length);
  const code = p => BASE + p.reduce((s, n, i) => s + n * W[i], 0);
  const random = () => code(PARTS.map(([, o]) => Math.floor(Math.random() * o.length)));
  function load(fallback) { try { const v = Number(localStorage.getItem(KEY)); if (isFace(v)) return v; } catch { /* storage off */ } return fallback ?? code([1, 0, 4, 1]); }
  function save(v) { try { if (isFace(v)) localStorage.setItem(KEY, String(v)); } catch { /* storage off */ } }
  // Draw a face centred at (0,0) with size R on ctx, in one colour c.
  function draw(ctx, id, c, R) {
    const [e, m, t, b] = isFace(id) ? parts(id) : [0, 0, 0, 0];
    ctx.save(); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = R * 0.16;
    const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1 * R, y1 * R); ctx.lineTo(x2 * R, y2 * R); ctx.stroke(); };
    const smile = (y, w) => { ctx.beginPath(); ctx.arc(0, y, w, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); };
    const star = (x, y, s) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? s * 0.4 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); };
    for (const s of [-1, 1]) {
      const x = s * R * 0.35, y = -R * 0.1;
      if (e === 0) dot(x, y, R * 0.15);
      else if (e === 1) { ctx.lineWidth = R * 0.09; ctx.beginPath(); ctx.arc(x, y, R * 0.21, 0, Math.PI * 2); ctx.stroke(); dot(x, y + R * 0.04, R * 0.09); ctx.lineWidth = R * 0.16; }
      else if (e === 3) star(x, y, R * 0.24);
      else if (e === 4) { ctx.beginPath(); ctx.arc(x, y - R * 0.08, R * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      else if (e === 5) { if (s < 0) dot(x, y, R * 0.15); else L(0.22, -0.1, 0.5, -0.1); }
    }
    if (e === 2) ctx.fillRect(-R * 0.75, -R * 0.3, R * 1.5, R * 0.34);
    ctx.lineWidth = R * 0.1;
    if (b === 1) for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * R * 0.35, -R * 0.3, R * 0.2, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
    else if (b > 1) for (const s of [-1, 1]) { if (b === 2) L(s * 0.18, -0.38, s * 0.55, -0.5); else L(s * 0.2, -0.52, s * 0.52, -0.52); }
    ctx.lineWidth = R * 0.16;
    if (m === 0) smile(R * 0.05, R * 0.42);
    else if (m === 1) { ctx.beginPath(); ctx.arc(0, R * 0.15, R * 0.38, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fill(); }
    else if (m === 2) L(-0.3, 0.35, 0.3, 0.35);
    else if (m === 3) { ctx.lineWidth = R * 0.1; ctx.beginPath(); ctx.arc(0, R * 0.36, R * 0.13, 0, Math.PI * 2); ctx.stroke(); }
    else { smile(R * 0.05, R * 0.42); dot(R * 0.15, R * 0.5, R * 0.11); }
    ctx.lineWidth = R * 0.16;
    if (t === 1) { ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.45); ctx.lineTo(-R * 0.62, -R * 0.95); ctx.lineTo(-R * 0.28, -R * 0.62); ctx.moveTo(R * 0.8, -R * 0.45); ctx.lineTo(R * 0.62, -R * 0.95); ctx.lineTo(R * 0.28, -R * 0.62); ctx.stroke(); }
    else if (t === 2) { L(0, -0.62, 0, -0.9); dot(0, -R * 0.97, R * 0.1); }
    else if (t === 3) { ctx.beginPath(); ctx.moveTo(-R * 0.45, -R * 0.6); ctx.lineTo(-R * 0.45, -R * 0.95); ctx.lineTo(-R * 0.22, -R * 0.75); ctx.lineTo(0, -R * 0.97); ctx.lineTo(R * 0.22, -R * 0.75); ctx.lineTo(R * 0.45, -R * 0.95); ctx.lineTo(R * 0.45, -R * 0.6); ctx.closePath(); ctx.fill(); }
    else if (t === 4) { ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(-R * 0.75 + i * R * 0.25, i % 2 ? -R * 0.95 : -R * 0.65); ctx.lineTo(R * 0.75, -R * 0.6); ctx.lineTo(-R * 0.75, -R * 0.6); ctx.closePath(); ctx.fill(); }
    else if (t === 5) { ctx.beginPath(); ctx.moveTo(R * 0.45, -R * 0.75); ctx.lineTo(R * 0.15, -R * 0.95); ctx.lineTo(R * 0.15, -R * 0.55); ctx.closePath(); ctx.moveTo(R * 0.45, -R * 0.75); ctx.lineTo(R * 0.75, -R * 0.95); ctx.lineTo(R * 0.75, -R * 0.55); ctx.closePath(); ctx.fill(); dot(R * 0.45, -R * 0.75, R * 0.09); }
    ctx.restore();
  }
  window.FaceBuilder = Object.freeze({ PARTS, BASE, KEY, parts, isFace, code, random, load, save, draw });
})();
