"use strict";
/* Moon Gate online versus (Claude4, Nov 23 2026).
   Lockstep: both devices run the same deterministic fight engine and only step fight frame F once they hold
   BOTH players' inputs for F. Each device sends its own input DELAY frames ahead, so both players feel the
   same small delay (fair). Player 1 (BLACK, the room creator) is the referee: twice a second it sends a state
   snapshot; the other device loads it and silently replays the frames since then from its stored inputs.
   That removes any tiny floating-point drift between phone browsers.
   Kid-safe: room codes only, no names, no chat, nothing stored. Uses the shared SAL0MANder race relay. */
(() => {
 const START_DELAY = 4, MAX_DELAY = 15, SNAP_EVERY = 30, DEBUG = /mgdebug/.test(location.search), $ = id => document.getElementById(id);
 const PRESS = ['jump','low','jab','kick','guard','parry','finish','grab','grabChord','left','right','alternateGuard'];
 const IDLE = {m: 0, b: 0};
 let net = null; // {ws,code,you,count,ready,iAmReady,game,on,...}
 const relayURL = () => {
  const q = new URLSearchParams(location.search).get('relay'); if (q) return q;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return 'ws://localhost:8787';
  return 'wss://race.sal0mander.com';
 };
 const encode = (s, press) => { let b = (s.low ? 1 : 0) | (s.guard ? 2 : 0); PRESS.forEach((k, i) => { if (press[k]) b |= 4 << i; }); return {m: s.move | 0, b}; };
 const decode = e => { const press = {}; PRESS.forEach((k, i) => { if (e.b & (4 << i)) press[k] = true; }); return {move: e.m, low: !!(e.b & 1), guard: !!(e.b & 2), press}; };
 const send = o => { try { if (net?.ws?.readyState === 1) net.ws.send(JSON.stringify(o)); } catch {} };

 // ---------- lobby UI (inside the title card) ----------
 const modeBox = $('mode'), cover = document.querySelector('.coverCopy');
 const onlineBtn = document.createElement('button'); onlineBtn.type = 'button'; onlineBtn.id = 'online'; onlineBtn.textContent = 'Online'; onlineBtn.setAttribute('aria-pressed', 'false');
 modeBox.append(onlineBtn);
 const lobby = document.createElement('div'); lobby.id = 'mgLobby'; lobby.hidden = true;
 lobby.innerHTML = '<div id="mgStart"><button type="button" id="mgCreate" class="primary">Create a match</button>' +
  '<span class="mgJoin"><input id="mgCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Match code">' +
  '<button type="button" id="mgJoinBtn">Join</button></span></div>' +
  '<div id="mgRoom" hidden><span>Match code</span><b id="mgRoomCode">----</b><small id="mgInfo"></small><button type="button" id="mgReady" class="primary">I’m ready</button></div>' +
  '<p id="mgMsg" role="status"></p>';
 cover.insertBefore(lobby, $('start'));
 const showLobby = on => { lobby.hidden = !on; $('start').hidden = on; onlineBtn.setAttribute('aria-pressed', String(on)); if (on) { $('solo').setAttribute('aria-pressed', 'false'); $('versus').setAttribute('aria-pressed', 'false'); } };
 const lobbyUI = () => {
  const inRoom = !!net?.code; $('mgStart').hidden = inRoom; $('mgRoom').hidden = !inRoom;
  if (inRoom) { $('mgRoomCode').textContent = net.code; $('mgInfo').textContent = net.count < 2 ? 'Share the code with a friend' : (net.ready + ' of 2 ready'); $('mgReady').disabled = net.iAmReady || net.count < 2; $('mgReady').textContent = net.iAmReady ? 'Waiting…' : 'I’m ready'; }
 };
 const leave = () => { if (net?.ws) try { net.ws.close(); } catch {} net = null; };
 onlineBtn.onclick = () => { showLobby(true); lobbyUI(); };
 for (const id of ['solo', 'versus']) $(id).addEventListener('click', () => { showLobby(false); leave(); });
 const open = first => {
  leave(); $('mgMsg').textContent = 'Connecting…';
  let ws; try { const u = relayURL(), q = first.t === 'join' ? 'code=' + encodeURIComponent(first.code) : 'max=2'; ws = new WebSocket(u + (u.includes('?') ? '&' : '?') + q); } catch { ws = null; }
  if (!ws) { $('mgMsg').textContent = 'Online matches aren’t switched on yet.'; return; }
  net = {ws, code: '', you: 0, count: 0, ready: 0, iAmReady: false, game: 0, on: false};
  ws.onopen = () => { $('mgMsg').textContent = ''; ws.send(JSON.stringify(first)); };
  ws.onerror = () => { $('mgMsg').textContent = 'Online matches aren’t switched on yet. Try Local versus on one screen.'; };
  ws.onclose = () => { if (net?.ws === ws) { if (net.on) { notice('Your friend’s connection dropped', 3); } else $('mgMsg').textContent = 'Disconnected.'; net.closed = true; } };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
 };
 $('mgCreate').onclick = () => open({t: 'create', max: 2});
 $('mgJoinBtn').onclick = () => { const c = $('mgCode').value.trim(); if (c.length < 4) { $('mgMsg').textContent = 'Type the 4-letter code.'; return; } open({t: 'join', code: c}); };
 $('mgReady').onclick = () => { net.iAmReady = true; send({t: 'ready'}); lobbyUI(); };

 // ---------- messages ----------
 function onMsg(m) {
  if (!net) return;
  if (m.t === 'err') { $('mgMsg').textContent = m.msg; leave(); return lobbyUI(); }
  if (m.t === 'room') { if (m.you > 1) { $('mgMsg').textContent = 'That match is full.'; leave(); return lobbyUI(); } net.code = m.code; net.you = m.you; net.count = m.count; lobbyUI(); }
  if (m.t === 'peers') { net.count = m.count; net.ready = m.ready; if (!net.on) lobbyUI(); }
  if (m.t === 'again') { net.iAmReady = false; lobbyUI(); }
  if (m.t === 'left') { if (net.on) notice('Your friend left the match', 3); net.count = 1; net.ready = 0; lobbyUI(); }
  if (m.t === 'go') begin();
  if (m.t === 'i' && net.on) net.remote.set(m.r + ':' + m.f, {m: m.m | 0, b: m.b | 0});
  if (m.t === 'h' && net.on && net.you !== 0) onSnapshot(m);
 }

 // ---------- the lockstep match ----------
 function begin() {
  net.game++; net.on = true; net.iAmReady = false; net.remote = new Map(); net.round = -1; net.stalls = 0; net.resyncs = 0; net.fp = new Map();
  showLobby(false); setMode('versus'); onlineBtn.setAttribute('aria-pressed', 'true'); $('versus').setAttribute('aria-pressed', 'false');
  startMatch();
  // One touch pad only: this device controls its own fighter with the BLACK controls.
  $('touch2').hidden = true; document.querySelector('.cabinet').classList.remove('duoTouch');
  const real = match.tick.bind(match); match._realTick = real;
  match.tick = (dt, inputs) => netTick(match, real, dt, inputs[0]);
  setTimeout(() => notice(net.you === 0 ? 'Online: you are BLACK' : 'Online: you are RED', 3), 300);
 }
 const key = (r, f) => r + ':' + f;
 function resetRound(m) {
  net.round = m.round; net.frame = 0; net.sent = -1; net.local = new Map(); net.delay = net.delay || START_DELAY; net.window = 0; net.windowStalls = 0; net.calm = 0; net.hist = new Map(); net.pending = {}; net.carry = [{}, {}]; net.snaps = new Map();
  for (const k of [...net.remote.keys()]) if (+k.split(':')[0] < net.game * 10 + m.round) net.remote.delete(k);
 }
 function netTick(m, real, dt, localSample) {
  if (m.round !== net.round) resetRound(m);
  const R = net.game * 10 + m.round;
  for (const k in localSample.press || {}) if (localSample.press[k]) net.pending[k] = true;
  // Send my inputs up to frame (frame + delay). Frames I haven't pressed anything in yet go out as idle, so the
  // other device never has to guess. Each device picks its own delay; only the frame numbers have to match.
  while (net.sent < net.frame + net.delay) {
   net.sent++; const e = net.sent < net.frame + net.delay ? IDLE : encode(localSample, net.pending); if (e !== IDLE) net.pending = {};
   net.local.set(net.sent, e); send({t: 'i', r: R, f: net.sent, m: e.m, b: e.b});
  }
  const mine = net.local.get(net.frame), theirs = net.remote.get(key(R, net.frame));
  if (!mine || !theirs) { net.stalls++; net.windowStalls++; return; } // wait for the other device
  // Adaptive delay: if we keep waiting, add a frame of delay; after 5 calm seconds, take one away.
  if (++net.window >= 60) { if (net.windowStalls > 3 && net.delay < MAX_DELAY) net.delay++; else if (!net.windowStalls && ++net.calm >= 5 && net.delay > START_DELAY) { net.delay--; net.calm = 0; } if (net.windowStalls) net.calm = 0; net.window = 0; net.windowStalls = 0; }
  const seats = net.you === 0 ? [mine, theirs] : [theirs, mine], take = m.phase === 'fight' && m.hitstop <= 0;
  const inputs = seats.map((e, i) => { const d = decode(e); if (!take) { Object.assign(net.carry[i], d.press); d.press = {}; } else { d.press = Object.assign(net.carry[i], d.press); net.carry[i] = {}; } return d; });
  net.hist.set(net.frame, inputs.map(d => ({...d, press: {...d.press}})));
  real(dt, inputs); net.frame++;
  if (DEBUG) net.fp.set(R + ':' + net.frame, m.f.map(f => [Math.round(f.x * 100), Math.round(f.y * 100), f.state, f.points, Math.round(f.guard)]).join('|') + '|' + m.phase);
  if (net.you === 0 && net.frame % SNAP_EVERY === 0) send({t: 'h', r: R, f: net.frame, s: snapshot(m)});
  const due = net.snaps.get(net.frame); if (due) { net.snaps.delete(net.frame); apply(m, due); }
 }
 const snapshot = m => JSON.stringify(m, (k, v) => typeof v === 'function' || k === '_realTick' ? undefined : v);
 function apply(m, s) { const o = JSON.parse(s); const fs = o.f; delete o.f; Object.assign(m, o); fs.forEach((f, i) => Object.assign(m.f[i], f)); }
 function onSnapshot(h) {
  const m = match; if (!m || !net.on || h.r !== net.game * 10 + m.round || !(m.phase === 'fight' || m.phase === 'ringReset')) return;
  if (h.f > net.frame) { net.snaps.set(h.f, h.s); return; } // not there yet: load it when we arrive
  // Load the referee's state for frame h.f, then quietly replay the frames we already ran since then.
  const emit = m.emit; m.emit = () => {};
  try { apply(m, h.s); for (let f = h.f; f < net.frame; f++) { const ins = net.hist.get(f); if (ins) m._realTick(1 / 60, ins.map(d => ({...d, press: {...d.press}}))); } }
  finally { m.emit = emit; }
  net.resyncs++;
 }
 // Leaving a match returns to the lobby; a rematch needs both players ready again.
 const home = $('home'), again = $('again'), homeFn = home.onclick, againFn = again.onclick;
 home.onclick = () => { if (net?.on) { net.on = false; send({t: 'again'}); } homeFn(); if (net && !net.closed) { showLobby(true); lobbyUI(); } };
 again.onclick = () => { if (net?.on && match?.phase === 'won') { net.on = false; send({t: 'again'}); toMenu(); showLobby(true); lobbyUI(); return; } againFn(); };
 window.MoonGateOnline = {state: () => net && {on: net.on, you: net.you, frame: net.frame, delay: net.delay, round: match?.round, phase: match?.phase, wins: match?.wins, stalls: net.stalls, resyncs: net.resyncs, code: net.code}, fingerprints: () => net ? Object.fromEntries(net.fp) : {}};
})();
