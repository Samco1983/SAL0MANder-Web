#!/usr/bin/env node
/**
 * Generate a status page that ships with the site.
 *
 * The owner has spent a night asking "is anything blocked", "are you moving",
 * "what needs me". Every tool that answered those lived in a terminal, so the
 * answer was only available by asking. This puts it on the live site: one URL,
 * readable from a phone, no terminal, no agent awake.
 *
 * Built at deploy time from real evidence, so it is a snapshot of the commit it
 * shipped from — and it says so. A status page that looks live while being
 * stale is worse than none, because it gets trusted.
 *
 * Public by construction. It carries only what is already in a public repo:
 * counts, conditions, commit subjects. No paths, no tokens, no environment.
 *
 *   node scripts/build-status-page.mjs dist
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'dist'

const sh = (cmd, fallback = '') => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return fallback
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

const commit = sh('git rev-parse --short HEAD', 'unknown')
const builtAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
const recent = sh('git log -8 --format=%h|%s|%cr').split('\n').filter(Boolean).map((l) => {
  const [h, s, when] = l.split('|')
  return { h, s: (s || '').slice(0, 72), when }
})

// Championship, if the scorer can run here. Never fabricated: if it cannot be
// read, the page says so rather than showing a comforting number.
// Read a PRE-COMPUTED scoreboard rather than running it here. The scorer
// rebuilds and re-verifies, which from inside a build is both recursive and
// slow — the first version silently produced "unreadable" for exactly that
// reason. The deploy computes it once and passes the file.
let champ = null
try {
  const path = process.argv[3]
  if (path && existsSync(path)) champ = JSON.parse(readFileSync(path, 'utf8'))
} catch { champ = null }

const groups = champ?.groups ?? {}
const ownerBlockers = Object.entries(groups).flatMap(([g, checks]) =>
  (checks || []).filter((c) => !c.ok).map((c) => ({ group: g, ...c })),
)

const row = (c) =>
  `<li class="${c.ok ? 'won' : 'not'}"><span class="mark">${c.ok ? '✓' : '○'}</span>
     <span class="name">${esc(c.name)}</span>
     ${c.ok ? '' : `<span class="why">${esc(c.blocker)}</span>`}</li>`

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SAL0MANder — status</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#141414; --muted:#5c5c5c;
          --line:#e3e3e3; --won:#1f7a3d; --not:#a1471a; --card:#fafafa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#111; --fg:#ededed; --muted:#9a9a9a; --line:#2a2a2a;
            --won:#4ec27a; --not:#e08a5a; --card:#181818; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:16px/1.55 ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif;
         padding:24px 18px 64px; }
  main { max-width: 46rem; margin: 0 auto; }
  h1 { font-size:1.4rem; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:.85rem; margin-bottom:28px; }
  h2 { font-size:.78rem; text-transform:uppercase; letter-spacing:.08em;
       color:var(--muted); margin:32px 0 10px; font-weight:600; }
  .score { font-size:2.6rem; font-weight:700; line-height:1; }
  .score small { font-size:1rem; font-weight:400; color:var(--muted); }
  ul { list-style:none; padding:0; margin:0; }
  li { display:grid; grid-template-columns:1.4rem 1fr; gap:2px 8px;
       padding:9px 0; border-bottom:1px solid var(--line); align-items:start; }
  .mark { font-weight:700; }
  .won .mark { color:var(--won); } .not .mark { color:var(--not); }
  .why { grid-column:2; color:var(--not); font-size:.83rem; }
  .card { background:var(--card); border:1px solid var(--line);
          border-radius:10px; padding:14px 16px; }
  .commits li { grid-template-columns:1fr; border:0; padding:4px 0;
                font-size:.85rem; color:var(--muted); }
  .commits b { color:var(--fg); font-weight:500; }
  footer { margin-top:36px; color:var(--muted); font-size:.78rem; }
  a { color:inherit; }
</style>
</head><body><main>

<h1>SAL0MANder — status</h1>
<div class="sub">Built from commit <code>${esc(commit)}</code> at ${esc(builtAt)}.
This is a snapshot of that build, not a live feed.</div>

${champ ? `
<h2>Championship</h2>
<div class="card">
  <div class="score">${champ.won}<small> / ${champ.total}</small></div>
  <div class="sub" style="margin:6px 0 0">website done · game done · everything operational</div>
</div>

${Object.entries(groups).map(([g, checks]) => `
<h2>${esc(g)}</h2>
<ul>${(checks || []).map(row).join('')}</ul>`).join('')}

<h2>${ownerBlockers.length ? 'Not done yet' : 'Nothing outstanding'}</h2>
<div class="card">${
  ownerBlockers.length
    ? `<ul>${ownerBlockers.map((b) => `<li class="not"><span class="mark">○</span><span class="name">${esc(b.name)}</span><span class="why">${esc(b.blocker)}</span></li>`).join('')}</ul>`
    : 'Every condition is met.'
}</div>
` : `
<h2>Championship</h2>
<div class="card">Could not be measured at build time. Rather than show a
number that might be wrong, this says nothing — an unreadable scoreboard is not
a clean one.</div>
`}

<h2>Last commits</h2>
<div class="card"><ul class="commits">
${recent.map((c) => `<li><b>${esc(c.h)}</b> ${esc(c.s)} <span>· ${esc(c.when)}</span></li>`).join('')}
</ul></div>

<footer>
  Regenerated on every deploy. Counts and conditions only — this page carries
  nothing that is not already in the public repository.
</footer>
</main></body></html>
`

if (!existsSync(OUT)) {
  console.error(`  ${OUT} does not exist — build first`)
  process.exit(1)
}
writeFileSync(join(OUT, 'status.html'), html)
console.log(`  wrote ${OUT}/status.html  (commit ${commit}${champ ? `, championship ${champ.won}/${champ.total}` : ', championship unreadable'})`)
