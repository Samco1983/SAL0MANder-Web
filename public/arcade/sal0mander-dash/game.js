import { Circuit, STEP, CUBE } from './circuit.js';
// SAL0MANder Dash. Five BPM-matched levels (one song per level read from public/audio/music-playlist.json),
// solo, 2 players on one screen, ghost racing (including Mr. Sam), or an online race with a 4-letter seat code.
const $ = (id) => document.getElementById(id);
const canvas = $('game');
let ctx = canvas.getContext('2d');
const track = $('track'), primary = $('primary'), two = $('two'), web = $('online');
const image = (name) => { const im = new Image(); im.src = name + '.webp'; return im; };
const pilot = image('pilot'), skies = [0, 1, 2].map((n) => image('horizon' + n));
const SEAT = ['#7cf3da', '#ff8fd1', '#ffd166', '#8fb8ff', '#b7ff8f', '#ff9f6b', '#c79bff'];
const soundKey = 'sal0mander.dash.sound', faceKey = 'sal0mander.dash.face', levelKey = 'sal0mander.dash.level';
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Faces: 0 = Mr. Sam pilot cube, 1-6 = drawn cartoon faces. Only the number is ever shared online.
const FACES = ['Mr. Sam', 'Smile', 'Shades', 'Cat', 'Robot', 'Alien', 'Star eyes'];
// Face Builder (shared across SAL0MANder games; our own art): travels online as ONE number.
const CUSTOM = 10000;
const PARTS = [
  ['Eyes', ['Dots', 'Big', 'Shades', 'Stars', 'Sleepy', 'Wink']],
  ['Mouth', ['Smile', 'Grin', 'Flat', 'Oh', 'Tongue']],
  ['Top', ['None', 'Cat ears', 'Antenna', 'Crown', 'Spikes', 'Bow']],
  ['Brows', ['None', 'Happy', 'Angry', 'Raised']],
];
const W = [1000, 100, 10, 1];
const partsOf = (v) => W.map((w) => Math.floor((v - CUSTOM) / w) % 10);
const isCustom = (v) => Number.isInteger(v) && v >= CUSTOM && v < CUSTOM + 10000 && partsOf(v).every((p, i) => p < PARTS[i][1].length);
const customCode = (p) => CUSTOM + p.reduce((s, n, i) => s + n * W[i], 0);

function face(id, c, R = 30) {
  ctx.save(); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = R * 0.16;
  const eye = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const smile = (y, w) => { ctx.beginPath(); ctx.arc(0, y, w, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); };
  const star = (x, y, s) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? s * 0.4 : s;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fill();
  };
  if (id >= CUSTOM) {
    const [e, m, t, b] = isCustom(id) ? partsOf(id) : [0, 0, 0, 0];
    const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1 * R, y1 * R); ctx.lineTo(x2 * R, y2 * R); ctx.stroke(); };
    for (const s of [-1, 1]) {
      const x = s * R * 0.35, y = -R * 0.1;
      if (e === 0) eye(x, y, R * 0.15);
      else if (e === 1) { ctx.lineWidth = R * 0.09; ctx.beginPath(); ctx.arc(x, y, R * 0.21, 0, Math.PI * 2); ctx.stroke(); eye(x, y + R * 0.04, R * 0.09); ctx.lineWidth = R * 0.16; }
      else if (e === 3) star(x, y, R * 0.24);
      else if (e === 4) { ctx.beginPath(); ctx.arc(x, y - R * 0.08, R * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      else if (e === 5) { if (s < 0) eye(x, y, R * 0.15); else L(0.22, -0.1, 0.5, -0.1); }
    }
    if (e === 2) ctx.fillRect(-R * 0.75, -R * 0.3, R * 1.5, R * 0.34);
    if (b === 1) for (const s of [-1, 1]) { ctx.lineWidth = R * 0.1; ctx.beginPath(); ctx.arc(s * R * 0.35, -R * 0.3, R * 0.2, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
    else if (b > 1) { ctx.lineWidth = R * 0.1; for (const s of [-1, 1]) { if (b === 2) L(s * 0.18, -0.38, s * 0.55, -0.5); else L(s * 0.2, -0.52, s * 0.52, -0.52); } }
    ctx.lineWidth = R * 0.16;
    if (m === 0) smile(R * 0.05, R * 0.42);
    else if (m === 1) { ctx.beginPath(); ctx.arc(0, R * 0.15, R * 0.38, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fill(); }
    else if (m === 2) L(-0.3, 0.35, 0.3, 0.35);
    else if (m === 3) { ctx.lineWidth = R * 0.1; ctx.beginPath(); ctx.arc(0, R * 0.36, R * 0.13, 0, Math.PI * 2); ctx.stroke(); }
    else { smile(R * 0.05, R * 0.42); eye(R * 0.15, R * 0.5, R * 0.11); }
    ctx.lineWidth = R * 0.16;
    if (t === 1) { ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.45); ctx.lineTo(-R * 0.62, -R * 0.95); ctx.lineTo(-R * 0.28, -R * 0.62); ctx.moveTo(R * 0.8, -R * 0.45); ctx.lineTo(R * 0.62, -R * 0.95); ctx.lineTo(R * 0.28, -R * 0.62); ctx.stroke(); }
    else if (t === 2) { L(0, -0.62, 0, -0.9); eye(0, -R * 0.97, R * 0.1); }
    else if (t === 3) { ctx.beginPath(); ctx.moveTo(-R * 0.45, -R * 0.6); ctx.lineTo(-R * 0.45, -R * 0.95); ctx.lineTo(-R * 0.22, -R * 0.75); ctx.lineTo(0, -R * 0.97); ctx.lineTo(R * 0.22, -R * 0.75); ctx.lineTo(R * 0.45, -R * 0.95); ctx.lineTo(R * 0.45, -R * 0.6); ctx.closePath(); ctx.fill(); }
    else if (t === 4) { ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(-R * 0.75 + i * R * 0.25, i % 2 ? -R * 0.95 : -R * 0.65); ctx.lineTo(R * 0.75, -R * 0.6); ctx.lineTo(-R * 0.75, -R * 0.6); ctx.closePath(); ctx.fill(); }
    else if (t === 5) { ctx.beginPath(); ctx.moveTo(R * 0.45, -R * 0.75); ctx.lineTo(R * 0.15, -R * 0.95); ctx.lineTo(R * 0.15, -R * 0.55); ctx.closePath(); ctx.moveTo(R * 0.45, -R * 0.75); ctx.lineTo(R * 0.75, -R * 0.95); ctx.lineTo(R * 0.75, -R * 0.55); ctx.closePath(); ctx.fill(); eye(R * 0.45, -R * 0.75, R * 0.09); }
    ctx.restore(); return;
  }
  if (id === 2) { ctx.fillRect(-R * 0.75, -R * 0.42, R * 1.5, R * 0.34); ctx.fillRect(-R * 0.12, -R * 0.42, R * 0.24, R * 0.2); smile(R * 0.05, R * 0.42); }
  else if (id === 3) {
    ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.35); ctx.lineTo(-R * 0.6, -R * 0.95); ctx.lineTo(-R * 0.25, -R * 0.55); ctx.moveTo(R * 0.8, -R * 0.35); ctx.lineTo(R * 0.6, -R * 0.95); ctx.lineTo(R * 0.25, -R * 0.55); ctx.stroke();
    eye(-R * 0.35, -R * 0.1, R * 0.13); eye(R * 0.35, -R * 0.1, R * 0.13);
    ctx.beginPath(); ctx.moveTo(-R * 0.15, R * 0.15); ctx.lineTo(0, R * 0.28); ctx.lineTo(R * 0.15, R * 0.15); ctx.stroke();
    ctx.lineWidth = R * 0.06;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * R * 0.3, R * 0.25); ctx.lineTo(s * R * 0.85, R * 0.15); ctx.moveTo(s * R * 0.3, R * 0.33); ctx.lineTo(s * R * 0.85, R * 0.4); ctx.stroke(); }
  } else if (id === 4) { ctx.fillRect(-R * 0.55, -R * 0.35, R * 0.32, R * 0.32); ctx.fillRect(R * 0.23, -R * 0.35, R * 0.32, R * 0.32); ctx.fillRect(-R * 0.45, R * 0.2, R * 0.9, R * 0.14); ctx.beginPath(); ctx.moveTo(0, -R * 0.65); ctx.lineTo(0, -R * 0.95); ctx.stroke(); eye(0, -R * 1.02, R * 0.1); }
  else if (id === 5) { ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.12, R * 0.24, R * 0.32, -0.5, 0, Math.PI * 2); ctx.ellipse(R * 0.35, -R * 0.12, R * 0.24, R * 0.32, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, R * 0.32, R * 0.12, 0, Math.PI * 2); ctx.stroke(); }
  else if (id === 6) { for (const s of [-1, 1]) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? R * 0.11 : R * 0.27; ctx.lineTo(s * R * 0.38 + Math.cos(a) * rr, -R * 0.12 + Math.sin(a) * rr); } ctx.fill(); } ctx.beginPath(); ctx.arc(0, R * 0.15, R * 0.38, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fill(); }
  else { eye(-R * 0.35, -R * 0.12, R * 0.15); eye(R * 0.35, -R * 0.12, R * 0.15); smile(R * 0.05, R * 0.42); }
  ctx.restore();
}

// Mr. Sam mode: ?sam=1 shows Mr. Sam's ghost race; ?coach=1 lets Samuel record a new run.
const COACH_MODE = /[?&]coach=1\b/.test(location.search);
const SAM_LINK = COACH_MODE || /[?&]sam=1\b/.test(location.search);
let samRun = null, rec = [], recFull = false, coachOutAt = 0;

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {} }

let levels = [], levelIndex = 0, playlistCfg = null, activeTrack = null;
let score = null, run = null, racers = [], kind = 'solo', checkpoint = null, mode = 'loading';
let attempt = 0, last = 0, acc = 0, noticeEnd = 0, countIn = 0, width = 0, height = 0, shownHud = '';
let net = null, ghost = null, lastRank = -1, menuAt = 0, confetti = [];
let muted = window.Sal0Music
  ? !window.Sal0Music.readEnabled('sal0mander-dash', read(soundKey) !== 'off')
  : read(soundKey) === 'off';

const currentLevel = () => levels[levelIndex] || levels[0];
const currentColors = () => (currentLevel()?.colors?.length ? currentLevel().colors : ['#70f1dd', '#ffc478', '#71caff', '#ab99ff', '#ff9281', '#a3f6ac']);
const currentTiming = () => currentLevel()?.timing || { great: 0.07, perfect: 0.035, critical: 0.025 };
const currentBpm = () => activeTrack?.bpm || currentLevel()?.fallbackBpm || 96;
const saveKeyForLevel = () => 'sal0mander-dash.half.v2.' + (currentLevel()?.id || 'level-1');
const boardKeyForLevel = () => 'sal0mander-dash.board.v2.' + (currentLevel()?.id || 'level-1');

let myFace = (() => {
  const v = Number(read(faceKey) || read('sal0mander.neon-dash.face'));
  return isCustom(v) || (Number.isInteger(v) && v >= (COACH_MODE ? 0 : 1) && v < FACES.length) ? v : (COACH_MODE ? 0 : 1);
})();
let myCustom = (() => {
  for (const k of ['sal0mander.face', faceKey + '.custom']) {
    const v = Number(read(k));
    if (isCustom(v)) return v;
  }
  return customCode([1, 0, 4, 1]);
})();

track.volume = 0.55;
track.muted = muted;
track.loop = true;

function soundUI() {
  $('sound').textContent = muted ? 'Music: Off' : 'Music: On';
  $('sound').setAttribute('aria-pressed', String(!muted));
}
soundUI();

function resolveLevelTrack(lvl) {
  if (playlistCfg?.levels) {
    const mapped = playlistCfg.levels[String(lvl.level)];
    if (mapped?.track?.src) return mapped.track;
  }
  if (playlistCfg?.tracks?.length) {
    const byId = playlistCfg.tracks.find((t) => t.id === lvl.defaultSong);
    if (byId) return byId;
    return playlistCfg.tracks[(lvl.level - 1) % playlistCfg.tracks.length];
  }
  return {
    id: lvl.defaultSong || 'midnight-rider-groove',
    title: lvl.name,
    src: new URL('../../audio/tracks/' + (lvl.defaultSong || 'midnight-rider-groove') + '.mp3', location.href).href,
    bpm: lvl.fallbackBpm || 96,
    source: 'Google Flow Music',
  };
}

function applyTrack(chosen, rebuildCourse = true) {
  if (!chosen) return;
  activeTrack = chosen;
  if (track.src !== chosen.src) {
    track.src = chosen.src;
    try { track.load(); } catch {}
  }
  track.volume = playlistCfg?.volume ?? 0.55;
  track.loop = true;
  track.muted = muted;
  const bpm = currentBpm();
  const credit = $('trackCredit');
  if (credit) credit.textContent = `${chosen.title} (${bpm} BPM) · ${chosen.source || 'Google Flow Music'}`;
  const badge = $('songBadge');
  if (badge) badge.textContent = `♪ ${chosen.title} · ${bpm} BPM · ${currentLevel()?.subtitle || ''}`;
  if (rebuildCourse && currentLevel()) {
    rebuildForLevel(false);
  }
}

let COINS = [], GOLD = new Set();
function makeCircuit() {
  return new Circuit(currentLevel(), { bpm: currentBpm() });
}

function buildCoins() {
  const L = [];
  for (const l of run.ledges || []) {
    for (const f of [0.3, 0.55, 0.8]) L.push({ x: l.x + l.w * f, h: l.h + 42 });
  }
  // Place bonus coins above elevated decks and calm stretches on the beat grid
  for (const g of run.gates) {
    if (g.kind === 'deck' && g.w >= 115) {
      L.push({ x: g.x + g.w * 0.5, h: g.h + 150 });
    }
  }
  COINS = L.sort((a, b) => a.x - b.x);
}

function loadBoard() {
  try {
    const b = JSON.parse(read(boardKeyForLevel()) || '[]');
    return Array.isArray(b) ? b.filter((e) => e && Array.isArray(e.j) && e.j.every(Number.isInteger) && Number.isFinite(e.s)).slice(0, 10) : [];
  } catch { return []; }
}

function keepRun() {
  const m = me();
  const e = { s: scoreOf(m), p: Math.floor(run.progress * 1e4) / 1e4, f: run.finished, pr: run.prisms, g: m.gold || 0, pf: m.perfect || 0, fc: myFace, j: rec.slice(), at: Date.now() };
  const b = loadBoard();
  b.push(e); b.sort((a, c) => c.s - a.s || a.at - c.at);
  const top = b.slice(0, 10);
  save(boardKeyForLevel(), JSON.stringify(top));
  return top.indexOf(e);
}

function simulate(jumps) {
  const x = { r: makeCircuit(), replay: new Set(jumps) };
  while (alive(x)) {
    if (x.replay.has(x.r.tick)) jumpFor(x);
    x.r.advance(); grabCoins(x); watchSprings(x);
  }
  return x;
}

const me = () => racers.find((x) => x.me) || racers[0];
const alive = (x) => !x.r.dead && !x.r.finished;
function focus() {
  const m = me();
  if (kind === 'solo' || alive(m)) return m;
  return [...racers].filter(alive).sort((a, b) => b.r.time - a.r.time)[0] || m;
}
function trackTimeFor(courseTime) {
  const d = Number.isFinite(track.duration) && track.duration > 1 ? track.duration : 0;
  return d ? courseTime % d : courseTime;
}
function syncTrack() {
  const f = focus();
  if (!f || mode !== 'play' || countIn > 0) return;
  if (track.readyState) { try { track.currentTime = trackTimeFor(f.r.time); } catch {} }
  if (!muted) track.play().catch(() => {});
}
track.addEventListener('loadedmetadata', syncTrack);

function racer(seat, isMe, isLocal) {
  return { r: makeCircuit(), seat, me: isMe, local: isLocal, color: SEAT[seat % SEAT.length], left: false, face: isMe ? myFace : 1 + (seat % 6) };
}
function scoreOf(x) {
  const r = x.r;
  return Math.floor(r.progress * 1000) + r.prisms * 50 + (x.pp || 0) + (x.gold || 0) * 100 + (x.sp || 0) + (r.finished ? 250 : 0);
}
function watchSprings(x) {
  const r = x.r; x.springSeen = x.springSeen || new Set();
  for (let i = r.first; i < r.gates.length; i++) {
    const g = r.gates[i]; if (g.x > r.x + 60) break;
    if (g.kind === 'pad' && g.tripped && !x.springSeen.has(i)) {
      x.springSeen.add(i);
      if (x.springOpen != null && !x.springHit) x.springStreak = 0;
      x.springOpen = r.tick; x.springHit = false;
    }
  }
  if (x.springOpen != null && !x.springHit && r.tick - x.springOpen > 12) { x.springStreak = 0; x.springOpen = null; }
}
function grabCoins(x) {
  const r = x.r; if (!alive(x) && !r.finished) return;
  x.gotGold = x.gotGold || new Set();
  for (let i = 0; i < COINS.length; i++) {
    const c = COINS[i]; if (c.x < r.x - 60) continue; if (c.x > r.x + 60) break;
    if (!x.gotGold.has(i) && Math.abs(r.x - c.x) < 49 && Math.abs(r.y + CUBE / 2 - c.h) < 52) {
      x.gotGold.add(i); x.gold = (x.gold || 0) + 1;
      if (x.local || x.replay) x.coinFlash = performance.now();
    }
  }
}
function ahead(a, b) { return scoreOf(b) - scoreOf(a); }
function jumpFor(x) {
  const r = x.r; if (!r || r.dead || r.finished) return;
  if (x.springOpen != null && !x.springHit && r.tick - x.springOpen <= 12) {
    r.spring(); x.springHit = true; x.springStreak = (x.springStreak || 0) + 1;
    x.sp = (x.sp || 0) + 75 * Math.min(x.springStreak, 4); x.springFlash = performance.now();
  }
  if (kind === 'solo' && x.me && recFull) rec.push(r.tick);
  r.jump(); x.perfect = x.perfect || 0; x.used = x.used || new Set();
  const timing = currentTiming();
  let best = null;
  for (const c of r.cues) {
    if (c > r.time + timing.great) break;
    const d = Math.abs(c - r.time);
    if (d <= timing.great && !x.used.has(c) && (!best || d < best.d)) best = { c, d };
  }
  if (best) {
    x.used.add(best.c);
    const perfect = best.d <= timing.perfect;
    x.streak = (x.streak || 0) + 1;
    const m = Math.min(x.streak, 5);
    x.pp = (x.pp || 0) + (perfect ? 20 : 10) * m;
    if (perfect) x.perfect = (x.perfect || 0) + 1; else x.great = (x.great || 0) + 1;
    x.grade = perfect ? 'PERFECT' : 'GREAT';
    if (GOLD.has(best.c) && best.d <= timing.critical) { x.pp += 100; x.crit = (x.crit || 0) + 1; x.grade = 'CRITICAL'; }
    x.flash = performance.now();
  } else x.streak = 0;
}

function standings() { return [...racers].sort(ahead); }
function place(x) { return 1 + racers.filter((y) => ahead(y, x) < 0).length; }
function short(x) { return x.coach ? 'MR.SAM' : x.ghostName ? 'GHOST' : (kind === 'online' || kind === 'coach') ? (x.me ? 'YOU' : 'R' + (x.seat + 1)) : 'P' + (x.seat + 1); }
function label(x) { return x.coach ? 'Mr. Sam' : x.ghostName ? x.ghostName : kind === 'coach' ? 'You' : kind === 'online' ? (x.me ? 'You' : 'Racer ' + (x.seat + 1)) : 'Player ' + (x.seat + 1); }

function resultText() {
  if (kind === 'coach') {
    const m = me(), c = racers.find((x) => x.replay), n = label(c), d = ahead(m, c);
    return d < 0 ? 'You beat ' + n + '!' : d === 0 ? 'Dead heat with ' + n + '!' : n + ' wins this time. Try again!';
  }
  const list = standings(), top = list[0], tie = list[1] && ahead(list[0], list[1]) === 0;
  if (kind === 'online') {
    const p = place(me()), shared = racers.some((y) => y !== me() && place(y) === p);
    return p === 1 ? (shared ? 'Tied for 1st!' : 'You win!') : 'You came ' + (shared ? 'joint ' : '') + ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][p] + ' of ' + list.length;
  }
  if (tie) return 'It’s a tie!';
  return label(top) + ' wins!';
}

function faceIcon(fc, color, p) {
  const c = document.createElement('canvas'); c.width = c.height = 56;
  const keep = ctx; ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1630'; ctx.beginPath(); ctx.arc(28, 28, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
  ctx.translate(28, 29); face(fc > 0 ? fc : 1, color, 17); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (p <= 3) medal(44, 14, 10, p);
  ctx = keep; return c;
}
const pctText = (e) => (e.f ? 'finished' : (Math.floor(e.p * 1000) / 10).toFixed(1) + '%');

function samRunMatchesLevel() {
  return samRun && (!samRun.level || samRun.level === currentLevel()?.level) && Array.isArray(samRun.jumps) && samRun.jumps.length > 0;
}

function boardList() {
  const rows = loadBoard().map((e, i) => ({ ...e, name: 'Ghost #' + (i + 1), fresh: i === lastRank }));
  if (samRunMatchesLevel()) {
    const x = simulate(samRun.jumps);
    rows.push({ s: scoreOf(x), p: x.r.progress, f: x.r.finished, pr: x.r.prisms, g: x.gold || 0, pf: x.perfect || 0, fc: 0, j: samRun.jumps, coach: true, name: 'Mr. Sam' });
  }
  rows.sort((a, b) => b.s - a.s);
  const ol = $('board'); ol.replaceChildren();
  rows.slice(0, 5).forEach((e, i) => {
    const li = document.createElement('li'), col = e.coach ? '#ffd166' : '#9ad7ff', txt = document.createElement('div'), name = document.createElement('b'), stat = document.createElement('span'), go = document.createElement('button');
    name.textContent = (i + 1) + '. ' + e.name + (e.fresh ? ' · NEW' : '');
    name.style.color = col;
    stat.textContent = e.s + ' pts · ' + pctText(e) + ' · ◆ ' + e.pr + ' · gold ' + e.g;
    txt.append(name, stat);
    go.type = 'button'; go.textContent = 'Race'; go.setAttribute('aria-label', 'Race ' + e.name);
    go.onclick = () => { if (score) startGhost(e); };
    if (e.fresh) li.className = 'mine';
    li.append(faceIcon(e.fc, col, i + 1), txt, go);
    ol.append(li);
  });
  $('boardBox').hidden = !rows.length;
}

function resultList() {
  const ol = $('ranks'); ol.replaceChildren();
  for (const x of standings()) {
    const li = document.createElement('li'), p = place(x), c = faceIcon(x.face, x.color, p);
    const name = document.createElement('b'); name.textContent = (p <= 3 ? ['', '1st', '2nd', '3rd'][p] : p + 'th') + ' · ' + label(x); name.style.color = x.color;
    const stat = document.createElement('span'); stat.textContent = scoreOf(x) + ' pts · ' + (x.r.finished ? 'finished' : (Math.floor(x.r.progress * 1000) / 10).toFixed(1) + '%') + ' · ◆ ' + x.r.prisms + ' · ★ ' + (x.perfect || 0) + ' perfect · ' + (x.great || 0) + ' great' + (x.crit ? ' · ' + x.crit + ' critical' : '') + ' · gold ' + (x.gold || 0) + (x.left ? ' · left' : '');
    if (x.me) li.className = 'mine';
    li.append(c, name, stat); ol.append(li);
  }
}
function resultDetail() {
  return standings().map((x) => place(x) + '. ' + label(x) + ' · ' + scoreOf(x) + ' pts · ' + (x.r.finished ? 'finished' : (Math.floor(x.r.progress * 1000) / 10).toFixed(1) + '%') + ' · ◆ ' + x.r.prisms + (x.left ? ' (left)' : '')).join('   ');
}

function buildLevelPicker() {
  const box = $('levels');
  if (!box) return;
  box.replaceChildren();
  levels.forEach((lvl, idx) => {
    const tr = resolveLevelTrack(lvl);
    const bpm = tr?.bpm || lvl.fallbackBpm || 96;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lvlBtn';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(idx === levelIndex));
    const shortTitle = (tr?.title || '')
      .replace(/^Midnight Rider\s*[—–-]\s*Nocturnal Groove$/i, 'Midnight Groove')
      .replace(/^Midnight Rider\s*[—–-]\s*Variant$/i, 'Midnight Variant');
    btn.innerHTML = `<strong>L${lvl.level} · ${lvl.name}</strong><small>${bpm} BPM · ${shortTitle}</small>`;
    btn.onclick = () => selectLevel(idx, true);
    box.append(btn);
  });
}

function selectLevel(idx, showTitle = false) {
  levelIndex = Math.max(0, Math.min(levels.length - 1, idx));
  save(levelKey, String(levelIndex));
  const lvl = currentLevel();
  const chosen = resolveLevelTrack(lvl);
  applyTrack(chosen, false);
  rebuildForLevel(showTitle);
  buildLevelPicker();
}

function rebuildForLevel(showTitle = false) {
  const lvl = currentLevel();
  score = lvl;
  setSolo();
  buildCoins();
  GOLD = new Set(run.goldCues);
  checkpoint = null;
  try {
    const s = JSON.parse(read(saveKeyForLevel()));
    if (run.validSave(s)) checkpoint = s;
  } catch {}
  document.title = `SAL0MANder Dash — L${lvl.level} ${lvl.name} | SAL0MANder Arcade`;
  if (showTitle || mode === 'title') menu('title');
}

function lobbyUI(show) {
  $('lobby').hidden = !show;
  $('actions').hidden = show;
  $('levelBox').hidden = show || !(mode === 'title' || mode === 'won');
  $('keys2').hidden = show || mode !== 'title';
  if (!show) return;
  const inRoom = !!net?.code;
  $('lobbyStart').hidden = inRoom; $('lobbyRoom').hidden = !inRoom;
  if (inRoom) {
    $('roomCode').textContent = net.code;
    $('roomInfo').textContent = net.count + ' racer' + (net.count === 1 ? '' : 's') + ' here · ' + net.ready + ' ready' + (net.count < 2 ? ' · share the code with a friend' : '');
    $('ready').disabled = net.iAmReady;
    $('ready').textContent = net.iAmReady ? 'Waiting for everyone…' : 'I’m ready';
  }
}

function spawnConfetti() {
  confetti = [];
  if (reducedMotion()) return;
  const cols = ['#84cc16', '#7cf3da', '#ffd166', '#ff8fd1', '#a78bfa'];
  for (let i = 0; i < 64; i++) {
    confetti.push({
      x: Math.random() * (canvas.clientWidth || 800),
      y: -10 - Math.random() * 140,
      vx: (Math.random() - 0.5) * 140,
      vy: 90 + Math.random() * 160,
      s: 6 + Math.random() * 6,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 6,
      c: cols[i % cols.length],
    });
  }
}

function menu(state) {
  mode = state; menuAt = performance.now();
  if (state !== 'title' && state !== 'lobby' && state !== 'paused') {
    const o = $('overlay'); o.classList.add('cool');
    clearTimeout(o.coolT); o.coolT = setTimeout(() => o.classList.remove('cool'), 1200);
  }
  const lvl = currentLevel();
  const bpm = currentBpm();
  $('pick').hidden = !(state === 'title' || state === 'lobby');
  track.pause();
  $('overlay').hidden = false;
  $('pause').hidden = true;
  $('hud').hidden = state === 'title' || state === 'lobby' || kind !== 'solo';

  if (state === 'lobby') {
    $('eyebrow').textContent = `RACE ONLINE · LEVEL ${lvl.level} (${bpm} BPM)`;
    $('title').innerHTML = 'SAL<span class="zero">0</span>MANder <em>Race</em>';
    $('detail').textContent = 'Same course, same beat, everyone on one track. No names, no chat, nothing saved.';
    lobbyUI(true);
    return;
  }
  lobbyUI(false);
  const again = !!checkpoint && kind === 'solo', dead = state === 'dead', paused = state === 'paused', won = state === 'won', result = state === 'result';
  $('levelBox').hidden = !(state === 'title' || won || dead);
  $('eyebrow').textContent = result
    ? (kind === 'online' ? 'ONLINE RACE' : kind === 'coach' ? 'GHOST RACE' : '2-PLAYER RACE')
    : dead ? `ATTEMPT ${attempt} · LEVEL ${lvl.level}`
    : paused ? `LEVEL ${lvl.level} · ${lvl.name.toUpperCase()}`
    : won ? `LEVEL ${lvl.level} CLEAR! · ${bpm} BPM`
    : `LEVEL ${lvl.level} · ${lvl.name.toUpperCase()}`;

  if (state === 'title') $('title').innerHTML = 'SAL<span class="zero">0</span>MANder <em>Dash</em>';
  else $('title').textContent = result ? resultText() : dead ? run.dead : paused ? 'Paused' : `${lvl.name} clear!`;

  $('ranks').hidden = !result; if (result) resultList();
  $('boardBox').hidden = true; if (state === 'title' || ((dead || won) && kind === 'solo')) boardList();
  $('title').classList.toggle('long', result);
  $('detail').hidden = result;
  $('detail').textContent = result ? resultDetail()
    : (dead || won) && lastRank === 0 ? 'New personal best! ' + scoreOf(me()) + ' pts. Saved on this device.'
    : (dead || won) && lastRank > 0 ? '#' + (lastRank + 1) + ' on your best runs · ' + scoreOf(me()) + ' pts.'
    : dead ? Math.floor(run.progress * 100) + '% of ' + lvl.name + ' · ' + run.prisms + ' / ' + run.total + ' prisms'
    : paused ? 'Resume the beat when you’re ready.'
    : won ? `${run.prisms} / ${run.total} prisms · ${scoreOf(me())} pts · Ready for the next beat?`
    : again ? 'Your halfway checkpoint is saved.'
    : 'Jump at the teal arrows on the beat. Every five prisms charge a shield. Beat all five levels or race a friend!';

  primary.textContent = paused ? 'Resume' : result ? (kind === 'online' ? 'Race again' : 'Rematch') : won ? 'Replay level' : again ? 'Continue from halfway' : dead ? 'Try again' : `Play Level ${lvl.level}`;
  primary.disabled = false;
  $('nextLevel').hidden = !(won && levelIndex < levels.length - 1);
  two.hidden = paused; two.textContent = result ? '1 Player' : '2 Players';
  web.hidden = paused || result;
  $('secondary').hidden = !again || paused || won || result;
  $('keys2').hidden = state !== 'title';
  const over = result || dead || won;
  $('coachCta').hidden = !(over && SAM_LINK);
  const canCoach = samRunMatchesLevel();
  $('coach').hidden = !canCoach || paused || (!over && state !== 'title');
  if (canCoach) $('coach').textContent = result && kind === 'coach' ? 'Race Mr. Sam again' : 'Race Mr. Sam';
  if (result && kind === 'coach') { primary.textContent = ghost?.coach ? 'Race Mr. Sam again' : 'Race ghost again'; $('coach').hidden = true; }
  $('saveRun').hidden = !(COACH_MODE && kind === 'solo' && (dead || won) && recFull);
  if (won) spawnConfetti(); else confetti = [];
}

function setSolo() { kind = 'solo'; leaveNet(); run = makeCircuit(); racers = [{ r: run, seat: 0, me: true, local: true, color: SEAT[0], face: myFace }]; }
function start(fromHalf) {
  attempt++; lastRank = -1; if (kind !== 'solo') setSolo();
  rec = []; recFull = !fromHalf; run.reset(fromHalf ? checkpoint : null);
  const m = racers[0];
  m.face = myFace; m.perfect = 0; m.great = 0; m.crit = 0; m.used = new Set(); m.pp = 0; m.streak = 0; m.gold = 0; m.gotGold = new Set(); m.sp = 0; m.springStreak = 0; m.springSeen = new Set(); m.springOpen = null;
  countIn = fromHalf ? 1.5 : 0;
  $('message').textContent = fromHalf ? 'Ready…' : ''; noticeEnd = 0; play();
}
function startCoach() { if (samRunMatchesLevel()) startGhost({ coach: true, name: 'Mr. Sam', fc: 0, j: samRun.jumps }); }
function startGhost(g) {
  ghost = g; attempt++; leaveNet(); kind = 'coach'; coachOutAt = 0;
  const gx = { r: makeCircuit(), seat: 1, me: false, local: false, coach: !!g.coach, ghostName: g.coach ? '' : g.name, replay: new Set(g.j), color: g.coach ? '#ffd166' : '#9ad7ff', face: g.fc, perfect: 0 };
  racers = [racer(0, true, true), gx]; run = racers[0].r; countIn = 1.5; $('message').textContent = ''; play();
}
function startLocal() { attempt++; leaveNet(); kind = 'local'; racers = [racer(0, true, true), racer(1, false, true)]; run = racers[0].r; countIn = 1.5; $('message').textContent = ''; play(); }
function startOnline() {
  attempt++; kind = 'online'; racers = [];
  net.seats.forEach((taken, seat) => { if (taken) racers.push(racer(seat, seat === net.you, seat === net.you)); });
  run = me().r; if (COACH_MODE && myFace === 0) me().coach = true; countIn = 2; $('message').textContent = ''; play();
}
function play() {
  mode = 'play'; acc = 0; last = performance.now(); confetti = [];
  $('overlay').hidden = true; $('hud').hidden = kind !== 'solo'; $('pause').hidden = kind === 'online';
  canvas.focus({ preventScroll: true }); syncTrack(); if (kind === 'solo') hud();
}
function activate() {
  if (!score || mode === 'play') return;
  if (mode === 'paused') return play();
  if (mode === 'result') {
    if (kind === 'coach') return ghost ? startGhost(ghost) : startCoach();
    if (kind === 'local') return startLocal();
    if (kind === 'online') { netSend({ t: 'again' }); net.iAmReady = false; return menu('lobby'); }
  }
  if (kind !== 'solo') setSolo();
  start(!!checkpoint && mode !== 'won');
}

primary.onclick = activate;
$('nextLevel').onclick = () => { if (levelIndex < levels.length - 1) { selectLevel(levelIndex + 1, false); start(false); } };
$('coach').onclick = () => { if (score && samRunMatchesLevel()) startCoach(); };
$('saveRun').onclick = () => {
  const lvl = currentLevel();
  const blob = new Blob([JSON.stringify({ v: 1, name: 'Mr. Sam', course: lvl.id, level: lvl.level, jumps: rec, progress: +run.progress.toFixed(4), finished: run.finished, prisms: run.prisms, perfect: me().perfect || 0, recordedAt: new Date().toISOString() })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sam-run.json'; a.click();
  $('saveRun').textContent = 'Saved: put sam-run.json next to game.js';
};
{
  const w = $('wipe'); let armed = -1e9;
  if (w) w.onclick = () => {
    if (performance.now() - armed > 4000) { armed = performance.now(); w.textContent = 'Tap again to delete'; return; }
    try { for (const k of Object.keys(localStorage)) if (/^(sal0mander|neon-dash)/i.test(k)) localStorage.removeItem(k); } catch {}
    location.reload();
  };
}
two.onclick = () => { if (!score) return; if (mode === 'result' && kind === 'local') { setSolo(); start(false); } else startLocal(); };
$('secondary').onclick = () => { checkpoint = null; save(saveKeyForLevel(), null); start(false); };
$('pause').onclick = () => { if (mode === 'play' && kind !== 'online') menu('paused'); };
$('sound').onclick = () => {
  muted = !muted; track.muted = muted; soundUI(); save(soundKey, muted ? 'off' : 'on');
  if (window.Sal0Music) window.Sal0Music.writeEnabled('sal0mander-dash', !muted);
  if (!muted && mode === 'play') syncTrack(); else if (muted) track.pause();
};
$('nextSong').onclick = () => {
  if (!playlistCfg?.tracks?.length) return;
  const idx = playlistCfg.tracks.findIndex((t) => t.id === activeTrack?.id);
  const next = playlistCfg.tracks[(idx + 1) % playlistCfg.tracks.length];
  const wasPlaying = mode === 'play';
  applyTrack(next, !wasPlaying);
  if (wasPlaying) syncTrack();
  else notify(`Song: ${next.title} (${next.bpm || currentBpm()} BPM)`);
};
const full = $('full'), cabinet = $('cabinet');
if (!cabinet.requestFullscreen) full.hidden = true;
full.onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await cabinet.requestFullscreen(); } catch {} };
document.addEventListener('fullscreenchange', () => { full.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && kind !== 'online') menu('paused'); });

// ---------- online ----------
function relayURL() {
  const q = new URLSearchParams(location.search).get('relay'); if (q) return q;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return 'ws://localhost:8787';
  return 'wss://race.sal0mander.com';
}
function netSend(o) { try { if (net?.ws?.readyState === 1) net.ws.send(JSON.stringify(o)); } catch {} }
function leaveNet() { if (net?.ws) { try { net.ws.close(); } catch {} } net = null; }
function openNet(first) {
  leaveNet(); $('lobbyMsg').textContent = 'Connecting…';
  let ws; try { const u = relayURL(); ws = new WebSocket(first.t === 'join' ? u + (u.includes('?') ? '&' : '?') + 'code=' + encodeURIComponent(first.code) : u); } catch { ws = null; }
  if (!ws) { $('lobbyMsg').textContent = 'Online races aren’t switched on yet.'; return; }
  net = { ws, code: '', you: 0, count: 0, ready: 0, iAmReady: false, seats: [] };
  ws.onopen = () => { $('lobbyMsg').textContent = ''; ws.send(JSON.stringify(first)); };
  ws.onerror = () => { $('lobbyMsg').textContent = 'Online races aren’t switched on yet. Try 2 Players on this screen.'; };
  ws.onclose = () => { if (net?.ws === ws) { if (mode === 'lobby') $('lobbyMsg').textContent = 'Disconnected.'; net.closed = true; } };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onNet(m); };
}
function onNet(m) {
  if (!net) return;
  if (m.t === 'err') { $('lobbyMsg').textContent = m.msg; leaveNet(); return lobbyUI(true); }
  if (m.t === 'room') { net.code = m.code; net.you = m.you; net.count = m.count; lobbyUI(true); }
  if (m.t === 'peers') { net.count = m.count; net.ready = m.ready; net.seats = m.seats || net.seats; if (mode === 'lobby') lobbyUI(true); }
  if (m.t === 'again') { net.iAmReady = false; if (mode === 'lobby') lobbyUI(true); }
  if (m.t === 'go') { net.seats = m.seats; net.iAmReady = false; startOnline(); }
  if (m.t === 'left') { const x = racers.find((x) => x.seat === m.p && !x.me); if (x) { x.left = true; if (!x.r.dead && !x.r.finished) x.r.dead = 'Left the race'; } }
  if (m.t === 's') {
    const x = racers.find((x) => x.seat === m.p && !x.me); if (!x) return; const r = x.r;
    if (Number.isFinite(m.k)) r.tick = (m.d || m.f) ? m.k : Math.max(r.tick, m.k);
    if (Number.isFinite(m.y)) r.y = m.y; if (Number.isFinite(m.a)) r.angle = m.a;
    if (Number.isInteger(m.fc)) { x.face = m.fc; x.coach = m.fc === 0; }
    if (Number.isInteger(m.pf)) x.perfect = m.pf; if (Number.isInteger(m.pp)) x.pp = m.pp;
    if (Number.isInteger(m.gd)) x.gold = m.gd; if (Number.isInteger(m.sp)) x.sp = m.sp;
    if (Number.isFinite(m.pr)) r.prisms = m.pr; r.shield = !!m.sh; if (m.d) r.dead = m.d; if (m.f) r.finished = true;
  }
}
web.onclick = () => { if (!score) return; kind = 'online'; menu('lobby'); };

function buildPicker() {
  const box = $('faces'); box.replaceChildren();
  FACES.forEach((name, id) => {
    if (id === 0 && !COACH_MODE) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'faceBtn';
    b.setAttribute('aria-label', 'Face: ' + name); b.setAttribute('aria-pressed', String(id === myFace)); b.title = name;
    const c = document.createElement('canvas'); c.width = c.height = 88; const g2 = c.getContext('2d'), keep = ctx;
    if (id === 0) {
      g2.fillStyle = '#70f1dd'; g2.fillRect(0, 0, 88, 88);
      if (pilot.complete && pilot.naturalWidth) { const s = Math.min(pilot.width, pilot.height); g2.drawImage(pilot, (pilot.width - s) / 2, (pilot.height - s) / 2, s, s, 6, 6, 76, 76); }
      else { g2.fillStyle = '#14121f'; g2.font = '800 15px sans-serif'; g2.textAlign = 'center'; g2.fillText('MR.SAM', 44, 50); }
    } else { g2.fillStyle = SEAT[0]; g2.fillRect(0, 0, 88, 88); g2.fillStyle = '#1b1630'; g2.fillRect(8, 8, 72, 72); g2.translate(44, 46); ctx = g2; face(id, SEAT[0], 30); ctx = keep; }
    b.append(c); b.onclick = () => { myFace = id; save(faceKey, String(id)); buildPicker(); }; box.append(b);
  });
  const tile = document.createElement('button'), tc = document.createElement('canvas');
  tile.type = 'button'; tile.className = 'faceBtn mine'; tile.title = 'Make your own'; tile.setAttribute('aria-label', 'Face: make your own'); tile.setAttribute('aria-pressed', String(myFace === myCustom));
  tc.width = tc.height = 88;
  { const g2 = tc.getContext('2d'), keep = ctx; g2.fillStyle = SEAT[0]; g2.fillRect(0, 0, 88, 88); g2.fillStyle = '#1b1630'; g2.fillRect(8, 8, 72, 72); g2.translate(44, 48); ctx = g2; face(myCustom, SEAT[0], 30); ctx = keep; }
  tile.append(tc); tile.onclick = () => { myFace = myCustom; save(faceKey, String(myFace)); buildPicker(); }; box.append(tile);
  let ed = $('faceEdit'); if (!ed) { ed = document.createElement('div'); ed.id = 'faceEdit'; ed.setAttribute('role', 'group'); ed.setAttribute('aria-label', 'Make your own face'); box.after(ed); }
  ed.replaceChildren(); ed.hidden = myFace !== myCustom; const parts = partsOf(myCustom);
  PARTS.forEach(([name, opts], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = name + ': ' + opts[parts[i]];
    b.onclick = () => { parts[i] = (parts[i] + 1) % opts.length; myCustom = myFace = customCode(parts); save(faceKey, String(myFace)); save(faceKey + '.custom', String(myCustom)); save('sal0mander.face', String(myCustom)); buildPicker(); };
    ed.append(b);
  });
}
pilot.addEventListener('load', () => { if (score) buildPicker(); });
$('create').onclick = () => openNet({ t: 'create' });
$('join').onclick = () => { const c = $('codeIn').value.trim(); if (c.length < 4) { $('lobbyMsg').textContent = 'Type the 4-letter code.'; return; } openNet({ t: 'join', code: c }); };
$('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('join').click(); });
$('ready').onclick = () => { net.iAmReady = true; netSend({ t: 'ready' }); lobbyUI(true); };
$('lobbyBack').onclick = () => { setSolo(); menu('title'); };

// ---------- input ----------
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return; e.preventDefault();
  if (kind !== 'local') return jumpFor(me());
  const box = canvas.getBoundingClientRect(); jumpFor(racers[e.clientX - box.left < box.width / 2 ? 0 : 1]);
});
window.addEventListener('keydown', (e) => {
  if (!score || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (kind === 'online') return;
    if (mode === 'play') menu('paused'); else if (mode === 'paused') play(); return;
  }
  if (!['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) return;
  if (e.target instanceof HTMLButtonElement && mode !== 'play') return;
  e.preventDefault();
  if (mode !== 'play') return mode === 'lobby' || performance.now() - menuAt < 1200 ? undefined : activate();
  if (kind !== 'local') return jumpFor(me());
  jumpFor(racers[['Space', 'KeyW'].includes(e.code) ? 0 : 1]);
});

function notify(msg) { $('message').textContent = msg; noticeEnd = (focus()?.r?.time || 0) + 1.6; }
let sent = 0;

function step() {
  if (kind !== 'solo') {
    for (const x of racers) {
      if (x.replay) { if (alive(x)) { if (x.replay.has(x.r.tick)) jumpFor(x); x.r.advance(); grabCoins(x); watchSprings(x); } continue; }
      if (!x.local || !alive(x)) continue;
      const r = x.r, oldShield = r.shield; r.advance(); grabCoins(x); watchSprings(x);
      if (x.me || kind === 'local') { if (!oldShield && r.shield) notify(label(x) + ': shield charged'); if (oldShield && !r.shield) notify(label(x) + ': shield absorbed the hit'); }
    }
    for (const x of racers) if (!x.local && !x.replay && alive(x)) x.r.tick++;
    if (kind === 'coach' && !alive(me())) {
      coachOutAt = coachOutAt || performance.now();
      if (performance.now() - coachOutAt > 3000) for (const c of racers) if (c.replay) while (alive(c)) { if (c.replay.has(c.r.tick)) jumpFor(c); c.r.advance(); grabCoins(c); watchSprings(c); }
    }
    if (kind === 'online') {
      const r = me().r;
      if (++sent % 4 === 0 || r.dead || r.finished) {
        if (!me().sentEnd) netSend({ t: 's', fc: myFace, pf: me().perfect || 0, pp: me().pp || 0, gd: me().gold || 0, sp: me().sp || 0, k: r.tick, y: Math.round(r.y * 10) / 10, a: Math.round(r.angle), pr: r.prisms, sh: r.shield ? 1 : 0, d: r.dead || undefined, f: r.finished || undefined });
        if (r.dead || r.finished) me().sentEnd = true;
      }
    }
    if (noticeEnd && focus().r.time > noticeEnd) { $('message').textContent = ''; noticeEnd = 0; }
    if (racers.every((x) => !alive(x))) menu('result');
    return;
  }
  const oldShield = run.shield; run.advance(); grabCoins(me()); watchSprings(me());
  if (run.tick === run.halfTick) { checkpoint = run.snapshot(); save(saveKeyForLevel(), JSON.stringify(checkpoint)); notify('Halfway checkpoint saved'); }
  if (!oldShield && run.shield) notify('Prism shield charged');
  if (oldShield && !run.shield) notify('Shield absorbed the hit');
  if (noticeEnd && run.time > noticeEnd) { $('message').textContent = ''; noticeEnd = 0; }
  if ((run.dead || run.finished) && recFull) lastRank = keepRun();
  if (run.dead) menu('dead');
  if (run.finished) { checkpoint = null; save(saveKeyForLevel(), null); menu('won'); }
}

function hud() {
  const lvl = currentLevel();
  const pct = Math.floor(run.progress * 100);
  const key = [lvl.level, pct, run.section, run.prisms, run.shield, me().perfect || 0, me().gold || 0, scoreOf(me()), run.bpm].join('/');
  if (key === shownHud) return;
  shownHud = key;
  $('sector').textContent = `L${lvl.level} · ${run.sectors[run.section] || lvl.name}`;
  $('hudBpm').textContent = `${run.bpm} BPM`;
  $('percent').textContent = pct + '%';
  $('fill').style.width = pct + '%';
  $('prisms').textContent = scoreOf(me()) + ' pts  ◆ ' + run.prisms + '/' + run.total + '  ★ ' + (me().perfect || 0) + '  gold ' + (me().gold || 0);
  $('shield').hidden = !run.shield;
}

function polygon(points, color, stroke) {
  ctx.beginPath(); points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function line(x, y, x2, y2, c, w = 2) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawRacer(x, cx, ground, isGhost, useFace, depth = 0, pip = false) {
  const k = 1 - depth * 0.09, r = x.r; cx += depth * 30; const cy = ground - depth * 17 - (r.y + CUBE / 2) * k;
  if (cx < -80 || cx > width + 80) return;
  const cols = currentColors();
  ctx.save(); ctx.globalAlpha = r.dead ? 0.3 : isGhost ? 0.72 : x.me ? 1 : 0.9;
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate((r.angle * Math.PI) / 180);
  if (x.face > 0) { rect(-42, -42, 84, 84, x.color); rect(-34, -34, 68, 68, '#1b1630'); face(x.face, x.color, 30); }
  else {
    rect(-42, -42, 84, 84, cols[r.section % cols.length]);
    if (pilot.complete && pilot.naturalWidth) { const s = Math.min(pilot.width, pilot.height); ctx.drawImage(pilot, (pilot.width - s) / 2, (pilot.height - s) / 2, s, s, -38, -38, 76, 76); }
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = r.dead ? 0.35 : isGhost ? 0.75 : 1;
  if (r.shield) { ctx.strokeStyle = '#8fffea'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 59 * k, 0, Math.PI * 2); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!pip && x.local && x.flash && performance.now() - x.flash < 600) {
    const t = (performance.now() - x.flash) / 600; ctx.save(); ctx.globalAlpha = 1 - t;
    ctx.font = '900 22px Barlow,"Arial Black",sans-serif';
    ctx.fillStyle = x.grade === 'CRITICAL' ? '#ff8fd1' : x.grade === 'PERFECT' ? '#ffd166' : '#7cf3da';
    ctx.fillText((x.grade || 'PERFECT') + (x.streak > 1 ? ' ×' + Math.min(x.streak, 5) : '!'), cx, cy - 70 - t * 30); ctx.restore();
  }
  if (!pip && x.springFlash && performance.now() - x.springFlash < 700) {
    const t = (performance.now() - x.springFlash) / 700; ctx.save(); ctx.globalAlpha = 1 - t; ctx.fillStyle = '#7cf3da';
    ctx.font = '900 22px Barlow,"Arial Black",sans-serif';
    ctx.fillText('SPRING ' + (x.springStreak > 1 ? '×' + Math.min(x.springStreak, 4) : 'BONUS') + '!', cx, cy - 130 - t * 30); ctx.restore();
  }
  if (!pip && x.coinFlash && performance.now() - x.coinFlash < 700) {
    const t = (performance.now() - x.coinFlash) / 700; ctx.save(); ctx.globalAlpha = 1 - t; ctx.fillStyle = '#ffd166';
    ctx.font = '900 22px Barlow,"Arial Black",sans-serif'; ctx.fillText('+100 GOLD', cx, cy - 100 - t * 30); ctx.restore();
  }
  if (pip || (r.dead && !x.local)) { ctx.restore(); return; }
  if (x.local) {
    const fy = ground + 34 + (kind === 'local' ? x.seat * 34 : 0) - depth * 15;
    const tag = (kind === 'online' || kind === 'coach') ? 'YOU' : 'P' + (x.seat + 1);
    ctx.fillStyle = x.color; polygon([[cx, fy - 22], [cx - 9, fy - 10], [cx + 9, fy - 10]], x.color);
    ctx.font = '800 17px Barlow,"Arial Black",sans-serif'; const w = ctx.measureText(tag).width + 22;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx - w / 2, fy - 8, w, 26, 13); else ctx.rect(cx - w / 2, fy - 8, w, 26); ctx.fill();
    ctx.fillStyle = '#14121f'; ctx.fillText(tag, cx, fy + 5); if (kind !== 'solo') medal(cx + w / 2 + 12, fy + 5, 10, place(x));
  } else {
    const by = cy - 78 * k; ctx.globalAlpha = r.dead ? 0.45 : 1; ctx.fillStyle = '#14121f'; ctx.beginPath(); ctx.arc(cx, by, 21, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = x.color; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(cx, by); face(x.face || 1, x.color, 15); ctx.restore(); medal(cx + 22, by - 12, 8, place(x));
    ctx.fillStyle = x.color; ctx.font = '800 12px Consolas,monospace'; ctx.fillText(r.dead ? 'OUT' : short(x), cx, by - 31);
  }
  ctx.restore();
}

function scene(camX, vx, vy, vw, vh, d, mini) {
  const cam = camX.r, scale = mini ? (vh * 0.5) / CUBE : Math.min(vw / 690, vh / 650), keepW = width, keepH = height;
  width = vw / scale; height = vh / scale;
  ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
  ctx.setTransform(d * scale, 0, 0, d * scale, d * vx, d * vy);
  const cols = currentColors();
  const section = cam.section, sky = skies[(levelIndex + Math.floor(section / 2)) % skies.length], col = cols[section % cols.length];
  const ground = mini ? height * 0.8 + cam.y : height * 0.73, hero = mini ? width * 0.4 : Math.min(245, width * 0.23), origin = hero - cam.x;
  rect(0, 0, width, height, '#25203a');
  if (sky.complete && sky.naturalWidth) {
    const zoom = Math.max(width / sky.width, height / sky.height), w = sky.width * zoom, h = sky.height * zoom;
    ctx.drawImage(sky, (width - w) / 2, (height - h) / 2, w, h);
  }
  // Beat-synced pulse along the ground horizon line
  const beatPhase = cam.beat > 0 ? (((cam.time - cam.beatOffset) % cam.beat) + cam.beat) % cam.beat / cam.beat : 0;
  const pulse = reducedMotion() ? 0 : Math.pow(1 - beatPhase, 4);
  rect(0, ground, width, height - ground, '#19182b');
  if (pulse > 0.05) {
    ctx.save(); ctx.globalAlpha = pulse * 0.22;
    rect(0, ground - 16, width, 16, col);
    ctx.restore();
  }
  line(0, ground, width, ground, col, 4 + pulse * 3);
  for (let x = -160 - ((cam.x * 0.35) % 130); x < width + 200; x += 130) line(x, ground, x + (x - width / 2) * 0.4, height, '#37334e');
  for (let i = 1; i <= 6; i++) { const y = ground + (height - ground) * (i / 6) ** 2; line(0, y, width, y, '#37334e', 1); }

  for (const t of cam.cues) {
    const x = origin + t * cam.speed; if (x < -12) continue; if (x > width + 12) break;
    const isGold = GOLD.has(t), ac = isGold ? '#ffd166' : '#7ffce0', w = isGold ? 5 : 3;
    line(x, ground + 7, x, ground - 18, ac, w); line(x - 7, ground - 11, x, ground - 19, ac, w); line(x, ground - 19, x + 7, ground - 11, ac, w);
  }
  for (let i = cam.first; i < cam.gates.length; i++) {
    const g = cam.gates[i], x = origin + g.x, y = ground - g.base; if (x > width + 45) break; if (x + g.w < -60) continue;
    if (g.kind === 'gap') { rect(x, ground - 2, g.w, height - ground + 2, '#090a17'); line(x, ground, x, ground + 53, col); line(x + g.w, ground, x + g.w, ground + 53, col); }
    if (g.kind === 'spike') for (let n = 0; n < g.teeth; n++) { const w = g.w / g.teeth, l = x + n * w; polygon([[l, y], [l + w / 2, y - g.h], [l + w, y]], '#71395c', '#ffd1a6'); }
    if (g.kind === 'deck') { rect(x, y - g.h, g.w, g.h, '#46375e'); rect(x, y - g.h, g.w, 4, col); }
    if (g.kind === 'saw') { const rr = g.w / 2, pts = []; for (let n = 0; n < 32; n++) { const a = (n * Math.PI) / 16 + cam.time * 4, k = n % 2 ? rr * 0.72 : rr; pts.push([x + rr + Math.cos(a) * k, y - rr + Math.sin(a) * k]); } polygon(pts, '#6b5075', '#ffd0b2'); }
    if (g.kind === 'pad') { rect(x, y - 8, g.w, 8, '#ffba8d'); for (let n = 0; n < 3; n++) polygon([[x + n * 14, y - 13], [x + 6 + n * 14, y - 21], [x + 12 + n * 14, y - 13]], '#ffbb82'); }
    if (g.prism && !g.got) { const cx = x + g.w / 2, cy = y - (g.high ? 199 : 164); polygon([[cx, cy - 13], [cx + 11, cy], [cx, cy + 13], [cx - 11, cy]], '#ffb285', '#fff4cd'); }
  }
  {
    const got = camX.gotGold || new Set();
    for (let i = 0; i < COINS.length; i++) {
      const c = COINS[i], cx = origin + c.x; if (cx < -30) continue; if (cx > width + 30) break; if (got.has(i)) continue;
      const cy = ground - c.h, s = 1 + Math.sin(cam.time * 6 + i) * 0.12;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, 1); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff4cd'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#b8860b'; ctx.font = '900 16px Barlow,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('0', 0, 1); ctx.restore();
    }
  }
  for (const l of cam.ledges || []) {
    const lx = origin + l.x; if (lx > width + 20 || lx + l.w < -20) continue;
    const ly = ground - l.h; rect(lx, ly, l.w, 12, '#3b2f63'); rect(lx, ly, l.w, 4, '#ff8fd1'); ctx.save(); ctx.globalAlpha = 0.25; rect(lx, ly + 12, l.w, 18, '#ff8fd1'); ctx.restore();
  }
  if (kind === 'solo') {
    const flag = origin + cam.halfX;
    if (flag > 0 && flag < width) { line(flag, ground, flag, ground - 124, '#89ffe2', 4); polygon([[flag, ground - 124], [flag + 60, ground - 124], [flag + 42, ground - 100], [flag, ground - 100]], '#89ffe2'); }
    const r = run, cx = hero, cy = ground - r.y - CUBE / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((r.angle * Math.PI) / 180); rect(-42, -42, 84, 84, col);
    if (myFace > 0) { rect(-34, -34, 68, 68, '#1b1630'); face(myFace, col, 30); }
    else if (pilot.complete && pilot.naturalWidth) { const s = Math.min(pilot.width, pilot.height); ctx.drawImage(pilot, (pilot.width - s) / 2, (pilot.height - s) / 2, s, s, -38, -38, 76, 76); }
    ctx.restore();
    if (r.shield) { ctx.strokeStyle = '#8fffea'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 59, 0, Math.PI * 2); ctx.stroke(); }
  } else if (mini) {
    drawRacer({ ...camX, me: true, local: true }, hero, ground, false, camX.face > 0 || !camX.me, 0, true);
  } else {
    const others = racers.filter((x) => !x.me), depthOf = new Map(others.map((x, i) => [x, i + 1]));
    const order = [...others].reverse().concat(racers.filter((x) => x.me));
    for (const x of order) drawRacer(x, hero + (x.r.x - cam.x), ground, !x.local, !x.me, depthOf.get(x) || 0);
  }
  ctx.restore(); width = keepW; height = keepH;
}

const MEDAL = ['#ffd166', '#d9dde6', '#d99a63'];
function medal(x, y, R, rank) {
  if (rank < 1 || rank > 3) return; const c = MEDAL[rank - 1]; ctx.save();
  ctx.fillStyle = rank === 1 ? '#e2574c' : rank === 2 ? '#4c7be2' : '#3aa86b';
  ctx.beginPath(); ctx.moveTo(x - R * 0.7, y - R * 0.3); ctx.lineTo(x - R * 0.95, y - R * 1.7); ctx.lineTo(x - R * 0.15, y - R * 1.7); ctx.lineTo(x, y - R * 0.6); ctx.lineTo(x + R * 0.15, y - R * 1.7); ctx.lineTo(x + R * 0.95, y - R * 1.7); ctx.lineTo(x + R * 0.7, y - R * 0.3); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#00000055'; ctx.lineWidth = Math.max(1, R * 0.14); ctx.stroke();
  ctx.fillStyle = '#2a2110'; ctx.font = '900 ' + Math.round(R * 1.15) + 'px Barlow,"Arial Black",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(rank), x, y + R * 0.06); ctx.restore();
}

function draw(dt = 0) {
  const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch || !run) return;
  const d = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(cw * d) || canvas.height !== Math.round(ch * d)) { canvas.width = Math.round(cw * d); canvas.height = Math.round(ch * d); }
  const main = focus(); scene(main, 0, 0, cw, ch, d, false);
  if (confetti.length) {
    ctx.setTransform(d, 0, 0, d, 0, 0);
    for (const p of confetti) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > ch + 20) { p.y = -15; p.x = Math.random() * cw; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); ctx.restore();
    }
  }
  if (kind === 'solo' || mode !== 'play') return;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const list = standings(); let cams = list.slice(0, 4); const mine = me(); if (!cams.includes(mine)) cams[cams.length - 1] = mine;
  cams = cams.sort((a, b) => list.indexOf(b) - list.indexOf(a));
  const small = cw < 700, n = cams.length, gap = small ? 5 : 8, head = small ? 15 : 20, rowW = Math.min(cw * (small ? 0.62 : 0.58), n * (small ? 96 : 200) + (n - 1) * gap);
  const pw = (rowW - (n - 1) * gap) / n, ph = Math.max(36, pw * 0.62), py = 8;
  cams.forEach((x, k) => {
    const target = 8 + k * (pw + gap); x.camX = x.camX == null ? target : x.camX + (target - x.camX) * 0.12;
    const px = x.camX, out = !alive(x) && !x.r.finished, rank = place(x), tied = racers.some((y) => y !== x && place(y) === rank);
    rect(px - 2, py - 2, pw + 4, ph + head + 4, rank === 1 ? '#ffd166' : x.color); rect(px, py, pw, head, '#0f1122');
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = rank === 1 ? '#ffd166' : x.color; ctx.font = (small ? '800 10px' : '800 12px') + ' Barlow,"Arial Black",sans-serif';
    ctx.fillText((tied ? '=' : '') + ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][rank] + ' ' + short(x), px + 4, py + head / 2);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e8e8f0'; ctx.font = (small ? '700 9px' : '700 11px') + ' Consolas,monospace';
    ctx.fillText((out ? 'OUT ' : x.r.finished ? 'FIN ' : '') + scoreOf(x), px + pw - 4, py + head / 2);
    scene(x, px, py + head, pw, ph, d, true); ctx.setTransform(d, 0, 0, d, 0, 0);
    medal(px + pw - (small ? 11 : 15), py + head + (small ? 13 : 18), small ? 9 : 13, rank);
    if (out) { ctx.save(); ctx.globalAlpha = 0.55; rect(px, py + head, pw, ph, '#0b0c18'); ctx.restore(); ctx.fillStyle = '#ffffff'; ctx.font = (small ? '800 12px' : '800 16px') + ' Barlow,"Arial Black",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OUT', px + pw / 2, py + head + ph / 2); }
  });
  ctx.textBaseline = 'middle';
  if (!alive(me()) && main !== me() && alive(main) && mode === 'play') { ctx.fillStyle = '#ffffff'; ctx.font = (small ? '800 13px' : '800 18px') + ' Barlow,"Arial Black",sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('You’re out · watching ' + short(main), 12, ch - 12); }
  else if (kind === 'local') { ctx.textAlign = 'left'; ctx.fillStyle = '#c9c9d6'; ctx.font = '700 12px Consolas,monospace'; ctx.fillText('P1: left half · Space/W    P2: right half · ↑/Enter', 12, ph + head + 28); }
  if (mode === 'play' && countIn > 0) { ctx.fillStyle = '#ffffff'; ctx.font = '800 40px Barlow,"Arial Black",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Ready · ' + Math.ceil(countIn * 2), cw / 2, ch * 0.45); }
}

function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  if (mode === 'play') {
    if (countIn > 0) {
      countIn = Math.max(0, countIn - dt);
      if (kind === 'solo') $('message').textContent = countIn ? 'Ready · ' + Math.ceil(countIn * 2) : '';
      if (!countIn) syncTrack();
    } else acc += dt;
    while (acc >= STEP && mode === 'play') { step(); acc -= STEP; }
    const f = focus().r;
    const expectedTime = trackTimeFor(f.time);
    if (!track.paused && track.readyState >= 3 && Math.abs(track.currentTime - expectedTime) > 0.22) track.currentTime = expectedTime;
    if (kind === 'solo') hud();
  }
  last = now; draw(dt); requestAnimationFrame(frame);
}

async function loadPlaylistConfig() {
  if (!window.Sal0Music) return null;
  try {
    const siteRoot = new URL('../../', location.href).href;
    const playlist = await window.Sal0Music.loadPlaylist(new URL('audio/music-playlist.json', siteRoot).href);
    return (
      window.Sal0Music.resolveGameConfig(playlist, 'sal0mander-dash', siteRoot) ||
      window.Sal0Music.resolveGameConfig(playlist, 'neon-dash', siteRoot)
    );
  } catch { return null; }
}

async function boot() {
  const [cfg, courseResp] = await Promise.all([loadPlaylistConfig(), fetch('courses.json')]);
  playlistCfg = cfg;
  if (!courseResp.ok) throw Error('courses');
  const data = await courseResp.json();
  levels = Array.isArray(data.levels) && data.levels.length ? data.levels : [];
  if (!levels.length) throw Error('empty-levels');

  // Allow ?level=1..5 query parameter or remember last played level
  const qLvl = Number(new URLSearchParams(location.search).get('level'));
  const savedLvl = Number(read(levelKey));
  levelIndex = Number.isInteger(qLvl) && qLvl >= 1 && qLvl <= levels.length
    ? qLvl - 1
    : (Number.isInteger(savedLvl) && savedLvl >= 0 && savedLvl < levels.length ? savedLvl : 0);

  if (SAM_LINK) {
    try {
      const s = await (await fetch('sam-run.json', { cache: 'no-cache' })).json();
      if (s && Array.isArray(s.jumps) && s.jumps.every(Number.isInteger)) samRun = s;
    } catch {}
  }

  selectLevel(levelIndex, true);
  buildPicker();
  last = performance.now();
  requestAnimationFrame(frame);
}

boot().catch(() => { $('detail').textContent = 'The courses could not load. Refresh to try again.'; });
