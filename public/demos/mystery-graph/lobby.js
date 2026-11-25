'use strict';
const play = document.querySelector('#play'), lobby = document.querySelector('#lobby');
const stage = document.querySelector('#stage'), mount = document.querySelector('#mount');
const back = document.querySelector('#back'), fullscreen = document.querySelector('#fullscreen');
const musicToggle = document.querySelector('#music-toggle');
const status = document.querySelector('#screen-status');
let frame = null;
const siteRoot = new URL('../../', location.href).href;
const music = window.Sal0Music
  ? window.Sal0Music.createAudioController({
      gameId: 'mystery-graph',
      playlistUrl: new URL('audio/music-playlist.json', siteRoot).href,
      siteRootUrl: siteRoot,
      perGameEnabled: true,
      autoStart: false,
      onChange({ enabled, track }) {
        if (!musicToggle) return;
        musicToggle.textContent = enabled ? 'Music: On' : 'Music: Off';
        musicToggle.setAttribute('aria-pressed', String(enabled));
        musicToggle.title = track
          ? (enabled ? 'Now playing: ' + track.title + ' (' + track.source + ')' : 'Optional Flow track: ' + track.title)
          : 'Optional Flow soundtrack';
      },
    })
  : null;
if (musicToggle && music) {
  musicToggle.addEventListener('click', () => {
    music.toggle();
  });
}
// No iframe, loader, prefetch or game request exists before this explicit action.
play.addEventListener('click', () => {
  if (frame) return;
  lobby.hidden = true; stage.hidden = false; document.body.style.overflow = 'hidden';
  if (music) music.start();
  frame = document.createElement('iframe');
  frame.title = 'Mystery Graph playable game'; frame.allow = 'fullscreen; autoplay';
  frame.src = 'player/index.html';
  frame.addEventListener('load', () => { if (frame) frame.focus(); }, { once: true });
  mount.replaceChildren(frame); back.focus();
});
back.addEventListener('click', () => {
  if (music) music.stop();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  // Destroy the context even if its download is still in progress. Replay is fresh.
  if (frame) frame.src = 'about:blank';
  mount.replaceChildren(); frame = null;
  stage.hidden = true; lobby.hidden = false; document.body.style.overflow = '';
  status.textContent = ''; play.focus();
});
if (typeof stage.requestFullscreen === 'function') fullscreen.hidden = false;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
    status.textContent = '';
  } catch { status.textContent = 'Full screen is unavailable here. The game still works on this page.'; }
});
document.addEventListener('fullscreenchange', () => {
  fullscreen.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
  // Full-screen resize clears the WebGL surface while the toolbar owns focus.
  // Restore rendering/input after layout without restarting or unpausing the game.
  const activeFrame = frame;
  requestAnimationFrame(() => {
    if (!activeFrame || frame !== activeFrame || stage.hidden || !activeFrame.isConnected) return;
    activeFrame.contentWindow?.focus();
    activeFrame.contentDocument?.querySelector('#unity-canvas')?.focus({ preventScroll: true });
  });
});
