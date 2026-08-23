#!/usr/bin/env node
/**
 * The rails, enforced. One command, run in CI on every PR.
 *
 * The audit that produced this: of seven rails, only two were enforced by a
 * machine. The other five depended on an agent choosing to remember them — and
 * the agent that wrote "the owner is not the relay" broke it three times in the
 * same session. A rail you can forget is a wish with a command printed next to
 * it.
 *
 * So this does not add rules. It moves the ones that can be checked out of
 * memory and into a job that fails.
 *
 * Rails that CANNOT be checked stay in the document as practices and are named
 * as such here, rather than being quietly counted as enforced.
 */
import { execFileSync } from 'node:child_process'

const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

const base = process.env.RAILS_BASE ?? 'origin/main'
const results = []
const record = (rail, ok, detail) => results.push({ rail, ok, detail })

const subjects = sh('git', ['log', `${base}..HEAD`, '--format=%s']).split('\n').filter(Boolean)
const bodies = sh('git', ['log', `${base}..HEAD`, '--format=%B'])

/* R3 — a production break ships alone.
 * Only judged when the branch SAYS it fixes a live break, because most PRs are
 * not that and this must not fire on ordinary work. */
const claimsLiveFix = /\b(outage|blank site|production break|hotfix|is down|broken for users)\b/i.test(bodies)
if (claimsLiveFix) {
  const cats = new Set(subjects.map((s) => s.split(':')[0].trim().toLowerCase()))
  record(
    'R3 production break ships alone',
    cats.size === 1,
    cats.size === 1
      ? `one category (${[...cats][0]})`
      : `${cats.size} categories bundled: ${[...cats].join(', ')} — a live fix must not wait behind optional work`,
  )
} else {
  record('R3 production break ships alone', true, 'not a live-break PR, rail does not apply')
}

/* R1 — the builder never certifies the build.
 * Checkable only in the weak direction: a branch must not claim its own work is
 * VERIFIED. Whether a DIFFERENT agent actually looked cannot be proven from git
 * alone, and pretending otherwise would be the exact self-certification this
 * forbids. */
const selfCert = subjects.filter((s) => /\b(VERIFIED|DONE|PASS)\b/.test(s))
record(
  'R1 builder does not self-certify',
  selfCert.length === 0,
  selfCert.length === 0
    ? 'no commit in this branch declares its own work verified'
    : `commits declare their own outcome: ${selfCert.slice(0, 2).join(' | ')}`,
)

/* R6 — the owner is not the relay.
 * A handoff must name a file or endpoint both agents can read. A block of text
 * addressed to a human IS the violation, because it makes the owner carry it. */
const relay = /(paste this|copy.paste|pass this to|give this to|send this to)/i.test(bodies)
record(
  'R6 owner is not the relay',
  !relay,
  relay ? 'a commit asks the owner to carry a message between agents' : 'no relay-through-owner in this branch',
)

/* R7 — no new framework while production is broken.
 * The only rail whose check reaches outside the repo, which is why it is the
 * one that can fail for a reason we cannot see. */
const touchesProtocol = sh('git', ['diff', '--name-only', `${base}..HEAD`])
  .split('\n')
  .some((f) => /docs\/coordination\/.*(PROTOCOL|GUARDRAIL|DOCTRINE|BBALL|PLAYBOOK)/i.test(f))
if (touchesProtocol && process.env.RAILS_SITE_URL) {
  const ok = (() => {
    try {
      execFileSync('node', ['scripts/verify-live-site.mjs', process.env.RAILS_SITE_URL], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()
  record(
    'R7 no framework while production is broken',
    ok,
    ok ? 'live site serves a lesson' : 'this branch changes protocol while the published site is broken',
  )
} else {
  record('R7 no framework while production is broken', true, touchesProtocol ? 'no site URL given to check against' : 'no protocol change in this branch')
}

const width = Math.max(...results.map((r) => r.rail.length))
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.rail.padEnd(width)}  ${r.detail}`)

console.log('\nNOT ENFORCED HERE, and not counted as enforced:')
console.log('  R2  verified by verify-deploy-artifact / verify-live-site in the deploy job')
console.log('  R4  verified hourly by the watchdog, not per-PR')
console.log('  R5  three-methods-then-reroute — no check exists; it is a practice, not a rail')
console.log('\nKNOWN BLIND SPOT: R6 reads commit bodies only. Every actual relay-through-')
console.log('the-owner in this project happened in CHAT, which git cannot see. This rail')
console.log('passing is weak evidence, not proof.')

const failed = results.filter((r) => !r.ok)
process.exit(failed.length === 0 ? 0 : 1)
