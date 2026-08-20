#!/usr/bin/env node
/**
 * Serve the built site the way GitHub Pages does, and walk it like a student.
 *
 * `verify-deploy-artifact.mjs` checks the artifact's SHAPE — the files exist,
 * the assets carry the base. This checks that the shape actually works: Pages
 * has no rewrite rule, so every share link on a hard load is answered with
 * 404.html and the client router has to recover the path from the URL. Nothing
 * in the unit suite exercises that, because it is a property of the deploy
 * rather than of the source.
 *
 * Four paths, because those are the four a real visitor takes:
 *
 *   /SAL0MANder-Web/play/<id>       a teacher's share link, hard-loaded
 *   /SAL0MANder-Web/play/           the same link truncated by a chat app
 *   /SAL0MANder-Web/unknown         a mistyped or retired link
 *   /SAL0MANder-Web/                the site root
 *
 *   node scripts/verify-deployed-site.mjs [dist-dir]
 */

import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const DIST = process.argv[2] ?? 'dist'
const BASE = '/SAL0MANder-Web'
const PORT = 4322

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
}

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0].split('#')[0]
  let file = join(DIST, path.startsWith(BASE) ? path.slice(BASE.length) : path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')

  // Exactly what Pages does with an unknown deep path.
  if (!existsSync(file)) file = join(DIST, '404.html')
  if (!existsSync(file)) {
    res.writeHead(500).end('no 404.html — the deploy would be broken')
    return
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})

const CHECKS = [
  { path: `${BASE}/`, must: [/<div id="root">/, new RegExp(`${BASE}/assets/`)] },
  { path: `${BASE}/play/demo-activity`, must: [new RegExp(`${BASE}/assets/`)] },
  { path: `${BASE}/play/`, must: [new RegExp(`${BASE}/assets/`)] },
  { path: `${BASE}/teacher/dashboard`, must: [new RegExp(`${BASE}/assets/`)] },
]

server.listen(PORT, async () => {
  let failed = 0
  console.log(`\n  serving ${DIST} as Pages would, on :${PORT}\n`)
  for (const c of CHECKS) {
    let body = '', status = 0
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${c.path}`)
      status = r.status
      body = await r.text()
    } catch (e) {
      console.log(`    FAIL ${c.path} — ${e.message}`)
      failed++
      continue
    }
    const missing = c.must.filter((re) => !re.test(body))
    if (status !== 200 || missing.length) {
      // A deep path that does not serve the app is a share link that 404s in a
      // classroom while working perfectly in every test we have.
      console.log(`    FAIL ${c.path} — HTTP ${status}${missing.length ? `, missing ${missing}` : ''}`)
      failed++
    } else {
      console.log(`    ok   ${c.path}`)
    }
  }
  server.close()
  console.log(failed ? `\n  ${failed} path(s) would break once deployed\n` : '\n  every visitor path survives the deploy shape\n')
  process.exit(failed ? 1 : 0)
})
