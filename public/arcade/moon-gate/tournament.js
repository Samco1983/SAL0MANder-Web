"use strict";
/* Moon Gate tournament (Claude4, Nov 23 2026): an 8-fighter knockout bracket on one device.
   1 or 2 real players; CPU fighters fill the other seats. Quarterfinals, semifinals, final.
   Your fights are played; CPU-vs-CPU fights are decided at once. CPU fighters get tougher each round.
   Uses the existing fight engine (startMatch / names / match) without changing it. Nothing is saved or sent. */
(() => {
 const $ = id => document.getElementById(id);
 const CPU_NAMES = ['Iron Wok', 'Panda Bun', 'Steam Fox', 'Jade Ladle', 'Lotus Kick', 'Night Noodle', 'Moon Rabbit', 'Sesame Ace', 'Tofu Tiger', 'Red Pepper'];
 const ROUND_NAMES = ['Quarterfinals', 'Semifinals', 'Final'];
 let T = null; // {players, seats:[entrant], rounds:[[{a,b,w}]], r, i, active, current}

 // ---------- CPU strength: each round adds steps to the CPU's reaction odds (the engine scales them by round) ----------
 const proto = MoonCombat.Match.prototype, baseCpu = proto.cpu;
 proto.cpu = function (dt) { const r = this.round; this.round = r + (this.tier || 0); try { return baseCpu.call(this, dt); } finally { this.round = r; } };

 // ---------- styles + UI ----------
 const css = document.createElement('style');
 css.textContent = '#tourSetup{margin:.8rem 0 0}#tourSetup p{margin:.2rem 0 .5rem}#tourSetup .row{display:flex;gap:8px;flex-wrap:wrap}' +
  '#bracket{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-start;justify-content:center;background:rgba(10,8,14,.88);padding:10px;overflow:auto}' +
  '#bracket[hidden]{display:none}#bracket .card{margin:auto;width:min(100%,760px);background:#1a1420;border:2px solid #c9a25d;border-radius:14px;padding:14px 16px;color:#f4ead8}' +
  '#bracket h2{margin:.1rem 0 .2rem;font-size:1.5rem}#bracket .sub{margin:0 0 .6rem;opacity:.85}' +
  '#bracket .cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:center}' +
  '#bracket .col{display:flex;flex-direction:column;gap:8px;justify-content:space-around;min-height:100%}#bracket .col h3{margin:0;font-size:.72rem;letter-spacing:.08em;opacity:.75;text-transform:uppercase}' +
  '#bracket .bout{border:1px solid #5a4636;border-radius:8px;padding:4px 6px;background:#241b26;font-size:.82rem;line-height:1.35}' +
  '#bracket .bout.now{border-color:#ffd166;box-shadow:0 0 0 2px #ffd16655}#bracket .win{color:#ffd166;font-weight:700}#bracket .lose{opacity:.45;text-decoration:line-through}' +
  '#bracket .you{color:#7affdb}#bracket .champ{font-size:1rem;font-weight:800;color:#ffd166;text-align:center}' +
  '#bracket .acts{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}#bracket button{min-height:44px}' +
  '@media(max-height:460px){#bracket h2{font-size:1.1rem}#bracket .sub{margin:0 0 .3rem;font-size:.85rem}#bracket .bout{padding:2px 6px}#bracket .acts{margin:0 0 6px}}@media(max-width:560px){#bracket .cols{grid-template-columns:repeat(2,minmax(0,1fr))}#bracket .bout{font-size:.78rem}}';
 document.head.append(css);

 const modeBox = $('mode'), cover = document.querySelector('.coverCopy');
 const tourBtn = document.createElement('button'); tourBtn.type = 'button'; tourBtn.id = 'tour'; tourBtn.textContent = 'Tournament'; tourBtn.setAttribute('aria-pressed', 'false');
 modeBox.append(tourBtn);
 const setup = document.createElement('div'); setup.id = 'tourSetup'; setup.hidden = true;
 setup.innerHTML = '<p>8 fighters, knockout bracket. Win 3 fights to take the Golden Dumpling.</p><div class="row">' +
  '<button type="button" class="primary" data-n="1">1 player</button><button type="button" data-n="2">2 players</button></div>';
 cover.insertBefore(setup, $('start'));
 const showSetup = on => {
  setup.hidden = !on; $('start').hidden = on; tourBtn.setAttribute('aria-pressed', String(on));
  if (on) { for (const id of ['solo', 'versus', 'online']) $(id)?.setAttribute('aria-pressed', 'false'); const lobby = $('mgLobby'); if (lobby) lobby.hidden = true; }
 };
 tourBtn.onclick = () => showSetup(true);
 for (const id of ['solo', 'versus', 'online']) $(id)?.addEventListener('click', () => showSetup(false));
 setup.querySelectorAll('button[data-n]').forEach(b => { b.onclick = () => newTournament(+b.dataset.n); });

 const bracket = document.createElement('div'); bracket.id = 'bracket'; bracket.hidden = true; bracket.setAttribute('role', 'dialog'); bracket.setAttribute('aria-label', 'Tournament bracket');
 $('stage').append(bracket);

 // ---------- tournament state ----------
 function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
 function newTournament(players) {
  const cpus = shuffle([...CPU_NAMES]).slice(0, 8 - players).map((name, k) => ({ name, human: null, rating: 40 + Math.random() * 40 + k }));
  const seats = new Array(8).fill(null);
  seats[0] = { name: players === 2 ? 'Player 1' : 'You', human: 0 };
  if (players === 2) seats[4] = { name: 'Player 2', human: 1 }; // opposite halves: they can only meet in the final
  for (let s = 0; s < 8; s++) if (!seats[s]) seats[s] = cpus.pop();
  T = { players, active: true, r: 0, rounds: [[0, 1, 2, 3].map(k => ({ a: seats[2 * k], b: seats[2 * k + 1], w: null }))] };
  showSetup(false); $('cover').hidden = true; $('stage').classList.add('menu');
  advance();
 }
 const bout = () => T.rounds[T.r].find(m => !m.w);
 function decideCpu(m) { const pa = m.a.rating, pb = m.b.rating; m.w = Math.random() < pa / (pa + pb) ? m.a : m.b; m.auto = true; }
 function advance() {
  // Settle CPU-vs-CPU bouts instantly, build the next round when one finishes.
  for (;;) {
   const m = bout();
   if (!m) {
    if (T.r === 2) return showBracket(true);
    const w = T.rounds[T.r].map(x => x.w); T.r++;
    T.rounds[T.r] = []; for (let k = 0; k < w.length; k += 2) T.rounds[T.r].push({ a: w[k], b: w[k + 1], w: null });
    continue;
   }
   if (m.a.human == null && m.b.human == null) { decideCpu(m); continue; }
   return showBracket(false, m);
  }
 }
 function label(e) { return e.human != null ? '<span class="you">' + e.name + '</span>' : e.name; }
 function showBracket(done, next) {
  const cols = [0, 1, 2].map(r => {
   const list = T.rounds[r] || new Array(4 >> r).fill(null);
   return '<div class="col"><h3>' + ROUND_NAMES[r] + '</h3>' + list.map(m => {
    if (!m) return '<div class="bout">—<br>—</div>';
    const cls = e => m.w ? (m.w === e ? 'win' : 'lose') : '';
    return '<div class="bout' + (m === next ? ' now' : '') + '"><span class="' + cls(m.a) + '">' + label(m.a) + '</span><br><span class="' + cls(m.b) + '">' + label(m.b) + '</span></div>';
   }).join('') + '</div>';
  }).join('');
  const champ = done ? T.rounds[2][0].w : null;
  let title, sub, actions;
  if (done) {
   title = champ.human != null ? champ.name + (champ.name === 'You' ? ' win' : ' wins') + ' the Golden Dumpling!' : champ.name + ' wins the Golden Dumpling';
   sub = champ.human != null ? 'Champion of the Moon Gate tournament.' : 'Train up and take the bracket next time.';
   actions = '<button type="button" class="primary" data-a="again">New tournament</button><button type="button" class="secondary" data-a="quit">Title screen</button>';
  } else {
   const who = [next.a, next.b].filter(e => e.human != null);
   title = ROUND_NAMES[T.r] + ': ' + next.a.name + ' vs ' + next.b.name;
   sub = who.length === 2 ? 'Player 1 is BLACK, Player 2 is RED.' : who[0].human === 1 && T.players === 2 ? 'Player 2, take the BLACK controls.' : 'You fight as BLACK. Win 3 rounds to go through.';
   actions = '<button type="button" class="primary" data-a="fight">Fight!</button><button type="button" class="secondary" data-a="quit">Quit tournament</button>';
  }
  bracket.innerHTML = '<div class="card"><h2>' + title + '</h2><p class="sub">' + sub + '</p><div class="acts">' + actions + '</div><div class="cols">' + cols +
   '<div class="col"><h3>Champion</h3><div class="champ">' + (champ ? label(champ) : '?') + '</div></div></div></div>';
  bracket.hidden = false; T.current = next || null;
  bracket.querySelector('[data-a="fight"]')?.addEventListener('click', fight);
  bracket.querySelector('[data-a="again"]')?.addEventListener('click', () => { bracket.hidden = true; newTournament(T.players); });
  bracket.querySelector('[data-a="quit"]')?.addEventListener('click', quit);
  bracket.querySelector('.primary')?.focus({ preventScroll: true }); bracket.scrollTop = 0;
 }
 // ---------- playing a bout with the real engine ----------
 const hudNames = () => document.querySelectorAll('.fighterHUD .name b');
 function fight() {
  const m = T.current, humans = [m.a, m.b].filter(e => e.human != null);
  const black = humans.length === 2 ? (m.a.human === 0 ? m.a : m.b) : humans[0], red = black === m.a ? m.b : m.a;
  T.seats = [black, red];
  bracket.hidden = true;
  setMode(humans.length === 2 ? 'versus' : 'solo');
  startMatch();
  match.tier = humans.length === 2 ? 0 : T.r * 2; // CPU reads more and waits less each round
  names[0] = black.name; names[1] = red.name;
  const b = hudNames(); if (b[0]) b[0].textContent = black.name.toUpperCase(); if (b[1]) b[1].textContent = red.name.toUpperCase();
 }
 function restoreNames() { names[0] = 'Black'; names[1] = 'Red'; const b = hudNames(); if (b[0]) b[0].textContent = 'BLACK'; if (b[1]) b[1].textContent = 'RED'; }
 function finishBout() {
  const m = T.current; m.w = T.seats[match.roundWinner]; restoreNames();
  toMenu(); $('cover').hidden = true; $('stage').classList.add('menu');
  advance();
 }
 function quit() { T = null; bracket.hidden = true; restoreNames(); toMenu(); setMode('solo'); }

 // When a tournament bout ends, the result button returns to the bracket instead of a rematch.
 const again = $('again'), home = $('home'), againFn = again.onclick, homeFn = home.onclick;
 again.onclick = e => { if (T?.active && T.current && match?.phase === 'won') return finishBout(); return againFn?.call(again, e); };
 home.onclick = e => { if (T?.active) return quit(); return homeFn?.call(home, e); };
 new MutationObserver(() => {
  if (T?.active && T.current && match?.phase === 'won' && !$('result').hidden) { again.textContent = 'Back to bracket'; home.textContent = 'Quit tournament'; }
  else if ($('result').hidden && home.textContent !== 'Title screen' && !T?.current) home.textContent = 'Title screen';
 }).observe($('result'), { attributes: true, attributeFilter: ['hidden'] });
 window.MoonGateTournament = { state: () => T && { r: T.r, current: T.current && [T.current.a.name, T.current.b.name], rounds: T.rounds.map(r => r.map(m => [m.a.name, m.b.name, m.w && m.w.name])) } };
})();
