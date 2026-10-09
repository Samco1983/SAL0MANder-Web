'use strict';
const canvas = document.querySelector('#unity-canvas'), loading = document.querySelector('#loading');
const progress = document.querySelector('#progress'), percent = document.querySelector('#percent');
const errorBox = document.querySelector('#error'), startedAt = performance.now();
let instance = null, failed = false;
if (window === window.top) {
  const link = document.createElement('a'); link.href = '../'; link.textContent = 'Back to lobby';
  document.querySelector('#cancel-note').replaceChildren(link);
}
function fail(detail) {
  if (failed) return;
  failed = true; loading.hidden = true; canvas.hidden = true; errorBox.hidden = false;
  document.querySelector('#error-message').textContent = detail; document.querySelector('#retry').focus();
}
document.querySelector('#retry').addEventListener('click', () => location.reload());
const definition = window.MYSTERY_PLAYER;
if (!definition || !window.WebAssembly) {
  fail('This browser could not load the player. Try a current browser, or return to the lobby.');
} else {
  const config = {
    ...definition.config,
    // The Unity display bridge keeps controls in CSS pixels while rendering crisp high-density text.
    devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
    showBanner(message, type) {
      if (type === 'error') { console.error(message); fail('The player stopped while loading. Try again or return to the lobby.'); }
      else console.warn(message);
    },
  };
  const script = document.createElement('script'); script.src = definition.loader;
  script.onerror = () => fail('The download was interrupted. Check your connection, then try again.');
  script.onload = () => {
    if (typeof createUnityInstance !== 'function') { fail('The player download was incomplete. Please try again.'); return; }
    createUnityInstance(canvas, config, (value) => {
      progress.value = value;
      percent.textContent = value >= .9 ? 'Starting game…' : Math.round(value * 100) + '% downloaded';
    }).then((loaded) => {
      if (failed) { loaded.Quit?.(); return; }
      instance = loaded; loading.hidden = true; canvas.focus();
      // Local console diagnostics only. No telemetry endpoint or personal data.
      const resources = performance.getEntriesByType('resource').filter((r) => r.name.includes('/Build/'));
      console.info('MYSTERY_REVEAL_STARTUP ' + JSON.stringify({ readyMs: Math.round(performance.now() - startedAt), viewport: [canvas.clientWidth, canvas.clientHeight], resources: resources.map((r) => ({ file: r.name.split('/').pop(), transferBytes: r.transferSize, encodedBytes: r.encodedBodySize, decodedBytes: r.decodedBodySize })) }));
    }).catch((error) => { console.error(error); fail('The game could not finish starting. Try again or return to the lobby.'); });
  };
  document.body.appendChild(script);
}
window.addEventListener('pagehide', () => {
  if (instance) { const stopping = instance.Quit?.(); stopping?.catch?.(() => {}); instance = null; }
}, { once: true });

// Release charging even when the pointer leaves the canvas; cancellation never fires.
window.addEventListener('pointerup',()=>instance?.SendMessage('Mystery Reveal','ReleaseBattlePointer'));
window.addEventListener('pointercancel',()=>instance?.SendMessage('Mystery Reveal','CancelBattlePointer'));
window.addEventListener('blur',()=>instance?.SendMessage('Mystery Reveal','CancelBattlePointer'));
