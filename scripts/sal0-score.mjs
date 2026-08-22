#!/usr/bin/env node
/**
 * The scoreboard runner.
 *
 * One rule: no agent may write a checkmark. Green comes from the exit code of a
 * command that was written before the work started. Everything tonight that
 * turned out to be fake survived prose and died the moment something executed —
 * a fabricated issue link, a commit that claimed fifteen files and contained
 * one, "verify passed" announced while lint was failing, and eight consecutive
 * scheduled runs that reported nothing wrong while reaching no model at all.
 *
 * THE RULE FOR WRITING A CHECK: it must touch something this repo's agents do
 * not control — a deployed URL, a receipt file, a GitHub API result. `npm test`
 * is a weak check: a broker test asserted its own argv contained a flag and
 * stayed green for the entire life of an adapter that had never once reached a
 * model. A check that only reads our own output is a mirror, not a referee.
 *
 * Three outcomes, never two:
 *   [x] PASSED   the command exited 0
 *   [ ] FAILED   the command ran and exited non-zero
 *   [?] UNKNOWN  the command could not run here (missing tool, wrong host)
 *
 * UNKNOWN exists because a check that cannot run must never be silently green
 * OR silently red. A local receipt check is meaningless on a CI runner, and
 * scoring it as a failure would train everyone to ignore red.
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BOARD = resolve(ROOT, 'SCOREBOARD.md')
const HISTORY = resolve(ROOT, 'docs/coordination/ops/score-history.jsonl')
const TIMEOUT_MS = 60_000

/** `[x] objective  ::  CHECK: command` — prefix the command with NET: if it needs the internet. */
const LINE = /^(\s*)\[( |x|\?)\]\s+(.+?)\s+::\s+CHECK:\s+(.+?)\s*$/

/**
 * Can this host judge a network check at all?
 *
 * Found the hard way on the first run of this file. A sandboxed shell here sits
 * behind an interception proxy that answers EVERY request with a synthetic
 * `HTTP/1.1 200 OK … Content-Length: 0`. A check that asked for a status code
 * got one and turned green — for a Unity loader that does not exist in the repo
 * at all. The site's own homepage returns zero bytes the same way.
 *
 * So: probe a URL that must have content. If it comes back empty, this host
 * cannot distinguish "reachable" from "intercepted", and every network check is
 * marked UNKNOWN rather than lying in either direction. On a CI runner the
 * canary returns bytes and the same checks judge normally.
 *
 * The lesson generalises past the proxy: assert on CONTENT, never on status.
 */
const CANARY = 'https://samco1983.github.io/SAL0MANder-Web/'
function networkIsJudgeable() {
  try {
    const bytes = execSync(`curl -sf --max-time 15 "${CANARY}" | wc -c`, {
      timeout: 30_000, encoding: 'utf8', shell: '/bin/bash',
    })
    return Number(bytes.trim()) > 200
  } catch {
    return false
  }
}

function runCheck(command) {
  const started = Date.now()
  try {
    const stdout = execSync(command, {
      cwd: ROOT,
      timeout: TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: '/bin/bash',
    })
    return { state: 'x', ms: Date.now() - started, detail: lastLine(stdout) }
  } catch (error) {
    const ms = Date.now() - started
    const stderr = String(error.stderr ?? '')
    // "Could not run here" is not "failed". A missing binary or an unset
    // credential means this host cannot judge the line, and pretending
    // otherwise is how a board full of red stops being read.
    if (/command not found|not recognized|No such file or directory: '?(gh|curl|jq)/i.test(stderr)) {
      return { state: '?', ms, detail: 'check cannot run on this host' }
    }
    if (error.signal === 'SIGTERM') return { state: '?', ms, detail: `timed out after ${TIMEOUT_MS}ms` }
    return { state: ' ', ms, detail: lastLine(stderr) || `exit ${error.status ?? '?'}` }
  }
}

const lastLine = (s) =>
  String(s).trim().split('\n').filter(Boolean).pop()?.slice(0, 160) ?? ''

/**
 * Same failure twice in a row stops being information and becomes noise. Eight
 * identical OIDC failures fired hourly on 2026-08-22 and nothing escalated;
 * that is the failure this guard exists for.
 */
function repeatedFailureCount(objective, detail) {
  if (!existsSync(HISTORY)) return 0
  const rows = readFileSync(HISTORY, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  let streak = 0
  for (const row of rows.reverse()) {
    if (row.objective !== objective) continue
    if (row.state === ' ' && row.detail === detail) streak += 1
    else break
  }
  return streak
}

const NET_OK = networkIsJudgeable()
if (!NET_OK) console.log('NOTE: network checks marked UNKNOWN — this host answers every request with an empty 200.\n')

const board = readFileSync(BOARD, 'utf8').split('\n')
const results = []
const stampedAt = new Date().toISOString()

const scored = board.map((line) => {
  const m = LINE.exec(line)
  if (!m) return line
  const [, indent, , objective, command] = m
  const needsNet = command.startsWith('NET:')
  const actual = needsNet ? command.slice(4).trim() : command
  const { state, ms, detail } =
    needsNet && !NET_OK
      ? { state: '?', ms: 0, detail: 'this host cannot judge network checks (empty-200 proxy)' }
      : runCheck(actual)
  const streak = state === ' ' ? repeatedFailureCount(objective, detail) : 0
  results.push({ objective, command, state, ms, detail, streak: streak + (state === ' ' ? 1 : 0), at: stampedAt })
  // The line stays PRISTINE. An earlier version appended a "⚠ SAME FAILURE
  // REPEATING" note here, and the next run's regex swallowed that note as part
  // of the command and tried to execute it — the board corrupted its own checks
  // after one failure. Streaks are reported in the output and the history file,
  // never written back into the command.
  return `${indent}[${state}] ${objective}  ::  CHECK: ${command}`
})

writeFileSync(BOARD, scored.join('\n'))
mkdirSync(dirname(HISTORY), { recursive: true })
for (const r of results) appendFileSync(HISTORY, JSON.stringify(r) + '\n')

const passed = results.filter((r) => r.state === 'x').length
const failed = results.filter((r) => r.state === ' ').length
const unknown = results.filter((r) => r.state === '?').length
const stuck = results.filter((r) => r.state === ' ' && r.streak >= 2)

console.log(`SCORE  ${passed} passed  ${failed} failed  ${unknown} unknown`)
for (const r of results) {
  const mark = { x: 'PASS', ' ': 'FAIL', '?': 'UNKN' }[r.state]
  console.log(`  ${mark}  ${r.objective}${r.detail ? `  — ${r.detail}` : ''}`)
}
if (stuck.length) {
  console.log('\nSTUCK — same failure repeating, stop retrying and change the approach:')
  for (const r of stuck) console.log(`  x${r.streak}  ${r.objective}  — ${r.detail}`)
}

// Non-zero only when something is genuinely stuck. A red line is normal work;
// a red line failing the identical way three times is a design problem.
process.exit(stuck.length ? 1 : 0)
