#!/usr/bin/env node
/**
 * A bridge to Codex built out of the access we already have.
 *
 * There is no channel between the web session and Codex: no authenticated
 * GitHub here, no shared process, no message bus. But the permissions that DO
 * exist are enough for a one-way feed —
 *
 *   - the web session may READ the Unity repo's docs/ (owner-granted)
 *   - Codex may WRITE there, because it is their repo
 *
 * So Codex writing a doc is a message, and this notices it. Run it on a
 * schedule and "I have no channel" becomes "I see Codex's changes within the
 * hour". The reverse direction already works: Codex reads docs/coordination/
 * in this repo.
 *
 * Read-only against the Unity repo. The only thing written is a manifest
 * inside this repo. Nothing here can modify Codex's work.
 *
 *   node scripts/check-upstream.mjs           # report changes
 *   node scripts/check-upstream.mjs --accept  # report, then mark as seen
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const UPSTREAM = '/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype/docs'
const MANIFEST = new URL('../docs/coordination/.upstream-manifest.json', import.meta.url).pathname
const accept = process.argv.includes('--accept')

/** Every markdown file under the upstream docs tree, with a content hash. */
function scan(dir, out = {}) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) scan(full, out)
    else if (entry.endsWith('.md')) {
      const body = readFileSync(full, 'utf8')
      out[relative(UPSTREAM, full)] = {
        hash: createHash('sha256').update(body).digest('hex').slice(0, 12),
        lines: body.split('\n').length,
      }
    }
  }
  return out
}

/** First heading or bolded status line — enough to see what a change is about. */
function gist(path) {
  const body = readFileSync(join(UPSTREAM, path), 'utf8')
  const status = body.match(/^Status:\s*(.+)$/m)?.[1]
  const heading = body.match(/^#\s+(.+)$/m)?.[1]
  return [heading, status].filter(Boolean).join(' — ') || '(no heading)'
}

if (!existsSync(UPSTREAM)) {
  console.error(`upstream docs not found at ${UPSTREAM}`)
  console.error('Nothing to do — this is not an error, just no Unity repo here.')
  process.exit(0)
}

const current = scan(UPSTREAM)
const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')).files : null

if (!previous) {
  console.log(`Baseline: ${Object.keys(current).length} upstream docs recorded. No history yet.`)
} else {
  const added = Object.keys(current).filter((f) => !previous[f])
  const removed = Object.keys(previous).filter((f) => !current[f])
  const changed = Object.keys(current).filter((f) => previous[f] && previous[f].hash !== current[f].hash)

  if (!added.length && !removed.length && !changed.length) {
    console.log('No upstream changes since last check.')
  } else {
    console.log('UPSTREAM CHANGES FROM CODEX\n')
    for (const f of added) console.log(`  NEW      ${f}\n           ${gist(f)}`)
    for (const f of changed) {
      const delta = current[f].lines - previous[f].lines
      const sign = delta > 0 ? `+${delta}` : String(delta)
      console.log(`  CHANGED  ${f}  (${sign} lines)\n           ${gist(f)}`)
    }
    for (const f of removed) console.log(`  REMOVED  ${f}`)
    console.log('\nRead the changed files before acting on them.')
  }
}

if (accept) {
  writeFileSync(
    MANIFEST,
    `${JSON.stringify({ checkedAt: new Date().toISOString(), files: current }, null, 2)}\n`,
  )
  console.log(`\nMarked as seen (${Object.keys(current).length} files).`)
} else if (previous) {
  console.log('\nRun with --accept to mark these as seen.')
}
