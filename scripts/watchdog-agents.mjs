#!/usr/bin/env node
/**
 * Is each agent lane alive? Judged on its RUN RECORD, never on a claim.
 *
 * The number that motivated this: over one 100-run window, the Claude worker
 * was 0/35 and the Gemini reviewer was 30/30. From outside, on any dashboard we
 * had, those looked the same — both were "configured", both were "scheduled",
 * both appeared in the workflow list. One had done nothing for three days.
 *
 * A lane at 0% is not a bad day. It is a dead lane, and the only reason it
 * survived three days is that nothing ever asked this question.
 */
import { execFileSync } from 'node:child_process'

const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf-8' }))

const runs = gh([
  'run', 'list', '--limit', '100',
  '--json', 'name,conclusion,createdAt',
])

const lanes = new Map()
for (const r of runs) {
  if (!r.conclusion) continue
  const lane = r.name
  if (!lanes.has(lane)) lanes.set(lane, { ok: 0, total: 0, newest: r.createdAt })
  const s = lanes.get(lane)
  s.total += 1
  if (r.conclusion === 'success') s.ok += 1
}

let dead = 0
const lines = []
for (const [lane, s] of [...lanes].sort((a, b) => b[1].total - a[1].total)) {
  const pct = Math.round((s.ok / s.total) * 100)
  /*
   * Three is the threshold because one or two failures is noise — the deploy
   * lane has legitimately failed and recovered. A lane that has not succeeded
   * ONCE across three or more tries is making no progress at all, whatever it
   * reports about itself.
   */
  const isDead = s.ok === 0 && s.total >= 3
  if (isDead) dead += 1
  lines.push(`${isDead ? 'DEAD ' : pct === 100 ? 'ok   ' : 'weak '} ${String(s.ok).padStart(3)}/${String(s.total).padEnd(3)} ${pct
    .toString()
    .padStart(3)}%  ${lane}`)
}

console.log(lines.join('\n'))
console.log(
  dead === 0
    ? '\nevery lane has completed work recently'
    : `\n${dead} lane(s) have not succeeded once — that work is not happening, whatever the schedule says`,
)
