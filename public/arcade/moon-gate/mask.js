"use strict";
/* Moon Gate Mask Maker (Claude4, Nov 23 2026). Each fighter can wear the classic mask, a Face Builder face, or
   (offline modes only, with a parent's OK) a picture chosen from this device. Pictures stay in this browser,
   are never uploaded or sent, and never appear in online matches: online, everyone wears the classic mask.
   Mask settings live outside the fight state, so online snapshots never carry them. */
(() => {
 const $ = id => document.getElementById(id), FB = window.FaceBuilder;
 if (!FB) return;
 const KEY = 'sal0mander.moon-gate.masks', OK_KEY = 'sal0mander.moon-gate.photo-ok', PHOTO = i => 'sal0mander.moon-gate.photo' + i;
 const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
 const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch { return false; } };
 const masks = (() => { try { const m = JSON.parse(get(KEY) || 'null'); if (Array.isArray(m) && m.length === 2) return m.map(x => ({ mode: ['classic', 'face', 'photo'].includes(x?.mode) ? x.mode : 'classic', code: FB.isFace(x?.code) ? x.code : FB.random() })); } catch { /* fresh */ } return [{ mode: 'face', code: FB.load() }, { mode: 'face', code: FB.random() }]; })();
 if (!get(KEY)) set(KEY, JSON.stringify(masks)); // keep Red's random face stable between visits
 const photos = [null, null];
 const photoOK = () => get(OK_KEY) === '1';
 const loadPhoto = i => { const d = photoOK() && get(PHOTO(i)); if (d && /^data:image\/(png|jpeg|webp);base64,/.test(d)) { const im = new Image(); im.src = d; photos[i] = im; } else photos[i] = null; };
 loadPhoto(0); loadPhoto(1);
 const persist = () => set(KEY, JSON.stringify(masks));
 const override = [null, null]; // tournament CPU faces, never saved
 const onlineNow = () => !!window.MoonGateOnline?.state()?.on;
 const lookFor = i => { if (onlineNow()) return null; const o = override[i] || masks[i]; if (o.mode === 'photo') return photos[i]?.complete && photos[i].naturalWidth ? o : (o.code ? { mode: 'face', code: o.code } : null); return o.mode === 'face' ? o : null; };

 // Plate drawn on the fighter's head (called from fighter.js). (head, up, cross) are the head point and its axes.
 function plate(ctx, look, i, r) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#f7ead2'; ctx.fill();
  if (look.mode === 'photo') {
   const im = photos[i], s = Math.min(im.naturalWidth, im.naturalHeight);
   ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
   ctx.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, -r, -r, 2 * r, 2 * r); ctx.restore();
  } else FB.draw(ctx, look.code, '#2a1d1a', r * 0.86);
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = i ? '#c8433a' : '#1c1a22'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
 }
 window.MaskHook = (ctx, f, head, up, cross) => {
  const look = lookFor(f.id); if (!look) return;
  ctx.save(); ctx.translate(head[0] + cross[0] * 3, head[1] + cross[1] * 3); ctx.rotate(Math.atan2(up[1], up[0]) + Math.PI / 2);
  plate(ctx, look, f.id, 13.5); ctx.restore();
 };

 // ---------- Mask Maker panel ----------
 const css = document.createElement('style');
 css.textContent = '#maskBtn{margin-top:.6rem}#maskBox{position:absolute;inset:0;z-index:31;display:flex;align-items:flex-start;justify-content:center;background:rgba(10,8,14,.9);padding:10px;overflow:auto}' +
  '#maskBox[hidden]{display:none}#maskBox .card{margin:auto;width:min(100%,720px);background:#1a1420;border:2px solid #c9a25d;border-radius:14px;padding:12px 14px;color:#f4ead8}' +
  '#maskBox h2{margin:0 0 .2rem;font-size:1.3rem}#maskBox .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}#maskBox .seat{border:1px solid #5a4636;border-radius:10px;padding:8px}' +
  '#maskBox .seat h3{margin:0 0 6px;font-size:.9rem;letter-spacing:.08em}#maskBox canvas{position:static;width:84px;height:84px;display:block;margin:0 auto 6px;opacity:1}' +
  '#maskBox .row{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}#maskBox button{min-height:40px;padding:.25rem .6rem;font-size:.85rem}#maskBox button[aria-pressed=true]{outline:2px solid #ffd166}' +
  '#maskBox small{display:block;opacity:.8;font-size:.78rem;margin-top:4px}#maskBox label{font-size:.85rem}@media(max-width:560px){#maskBox .two{grid-template-columns:1fr}}';
 document.head.append(css);
 const cover = document.querySelector('.coverCopy');
 const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'maskBtn'; btn.className = 'secondary'; btn.textContent = 'Mask Maker';
 cover.append(btn);
 const box = document.createElement('div'); box.id = 'maskBox'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Mask Maker');
 $('stage').append(box);
 const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.hidden = true; document.body.append(file);
 let pickFor = 0;
 file.onchange = () => {
  const f = file.files?.[0]; file.value = ''; if (!f || !photoOK()) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => { // shrink to 128 px so it stays small, then keep it only in this browser
   const c = document.createElement('canvas'); c.width = c.height = 128; const s = Math.min(im.width, im.height);
   c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128); URL.revokeObjectURL(url);
   const d = c.toDataURL('image/jpeg', 0.85); if (set(PHOTO(pickFor), d)) { masks[pickFor].mode = 'photo'; persist(); loadPhoto(pickFor); setTimeout(render, 50); }
  };
  im.src = url;
 };
 function preview(i) {
  const c = document.createElement('canvas'); c.width = c.height = 168; const g = c.getContext('2d'); g.translate(84, 84);
  const look = masks[i].mode === 'classic' ? null : (masks[i].mode === 'photo' && !(photos[i]?.naturalWidth) ? { mode: 'face', code: masks[i].code } : masks[i]);
  if (!look) { g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.fillStyle = '#1c1a22'; g.fill(); g.fillStyle = i ? '#c8433a' : '#5b5560'; g.fillRect(-72, -16, 144, 22); g.fillStyle = '#f2f2f2'; g.fillRect(14, -10, 30, 7); }
  else { g.scale(5, 5); plate(g, look, i, 13.5); }
  return c;
 }
 function render() {
  const ok = photoOK();
  box.innerHTML = '<div class="card"><h2>Mask Maker</h2><p style="margin:0 0 8px;opacity:.85">Build a face for each fighter. Online matches always use the classic mask.</p><div class="two"></div>' +
   '<div class="row" style="margin-top:10px"><label><input type="checkbox" id="photoOk"' + (ok ? ' checked' : '') + '> Parent: allow a picture face on this device (offline play only, never uploaded)</label></div>' +
   '<div class="row"><button type="button" class="primary" id="maskDone">Done</button></div></div>';
  const two = box.querySelector('.two');
  [0, 1].forEach(i => {
   const s = document.createElement('div'); s.className = 'seat'; s.innerHTML = '<h3 style="color:' + (i ? '#ff8b7d' : '#e9e4ea') + '">' + (i ? 'RED' : 'BLACK') + '</h3>';
   s.append(preview(i));
   const modes = document.createElement('div'); modes.className = 'row';
   [['classic', 'Classic'], ['face', 'Face'], ...(ok ? [['photo', 'Picture']] : [])].forEach(([m, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(masks[i].mode === m));
    b.onclick = () => { if (m === 'photo' && !photos[i]) { pickFor = i; file.click(); return; } masks[i].mode = m; persist(); render(); }; modes.append(b);
   });
   s.append(modes);
   if (masks[i].mode === 'face') {
    const parts = FB.parts(masks[i].code), row = document.createElement('div'); row.className = 'row';
    FB.PARTS.forEach(([name, opts], k) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = name + ': ' + opts[parts[k]];
     b.onclick = () => { parts[k] = (parts[k] + 1) % opts.length; masks[i].code = FB.code(parts); if (i === 0) FB.save(masks[i].code); persist(); render(); }; row.append(b); });
    s.append(row);
   }
   if (masks[i].mode === 'photo' && ok) {
    const row = document.createElement('div'); row.className = 'row';
    const ch = document.createElement('button'); ch.type = 'button'; ch.textContent = 'Choose picture'; ch.onclick = () => { pickFor = i; file.click(); };
    const rm = document.createElement('button'); rm.type = 'button'; rm.textContent = 'Remove picture'; rm.onclick = () => { set(PHOTO(i), null); photos[i] = null; masks[i].mode = 'face'; persist(); render(); };
    row.append(ch, rm); s.append(row); const n = document.createElement('small'); n.textContent = 'Saved only in this browser. Never uploaded, never shown online.'; s.append(n);
   }
   two.append(s);
  });
  box.querySelector('#photoOk').onchange = e => {
   if (e.target.checked) set(OK_KEY, '1');
   else { set(OK_KEY, null); [0, 1].forEach(i => { set(PHOTO(i), null); photos[i] = null; if (masks[i].mode === 'photo') masks[i].mode = 'face'; }); persist(); }
   render();
  };
  box.querySelector('#maskDone').onclick = () => { box.hidden = true; btn.focus(); };
 }
 btn.onclick = () => { render(); box.hidden = false; box.scrollTop = 0; };
 window.MoonMask = { setOverride(i, code) { override[i] = code == null ? null : { mode: 'face', code }; }, random: FB.random, masks: () => masks.map(m => ({ ...m })) };
})();
