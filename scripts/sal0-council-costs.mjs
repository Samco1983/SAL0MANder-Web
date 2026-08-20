#!/usr/bin/env node
/**
 * Report recorded council spend from the run ledger.
 *
 * Scope, stated up front because it is easy to over-read: this covers runs the
 * SAL0MANder supervisor made. It does not see Codex's heartbeat automations or
 * anything run from a desktop app — those bill through surfaces that write no
 * entry here.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { summariseCost } from './lib/sal0-cost.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LEDGER = join(ROOT, 'docs', 'coordination', 'runs', 'ledger.jsonl')

if (!existsSync(LEDGER)) {
  console.error(`No ledger at ${LEDGER} — nothing has run yet.`)
  process.exit(1)
}

const entries = readFileSync(LEDGER, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  })
  .filter(Boolean)

const summary = summariseCost(entries)

console.log(`Council spend — ${entries.length} ledger entries`)
console.log(`  total: $${summary.totalUsd.toFixed(4)} across ${summary.runsWithCost} run(s) with a reported cost`)
for (const [mode, bucket] of Object.entries(summary.byMode)) {
  console.log(`  ${mode}: $${bucket.costUsd.toFixed(4)} over ${bucket.runs} run(s)`)
}
if (summary.modelRunsMissingCost > 0) {
  console.log(
    `  NOTE: ${summary.modelRunsMissingCost} run(s) called a model but reported no cost — the total above is a floor.`,
  )
}
console.log('  Figures are vendor client-side estimates; compare runs, do not reconcile a bill.')
console.log('  Excludes Codex heartbeat automations and any desktop-app work — they write no ledger entry.')
