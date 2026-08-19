import { writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const repo = '/Users/samuel_saldivar/Desktop/SAL0MANder-Web'
const outPath = join(repo, 'docs/coordination/ops/MAKE-PAYLOAD-LATEST.json')
const allowedButtons = new Set([
  'nudge-agents',
  'done-need-new-task',
  'blocker-status',
  'open-control-room',
])

function usage() {
  console.log(`Usage:
  node scripts/sal0-make-payload.mjs nudge-agents [reason]
  node scripts/sal0-make-payload.mjs done-need-new-task [reason]
  node scripts/sal0-make-payload.mjs blocker-status [reason]
  node scripts/sal0-make-payload.mjs open-control-room [reason]
`)
}

function utcMinuteWindow(date = new Date()) {
  const iso = date.toISOString()
  return iso.slice(0, 16).replace(/[-:T]/g, '')
}

function shortHash(input) {
  return createHash('sha256').update(input).digest('hex').slice(0, 12)
}

function buildPayload(button, reason) {
  const requestedAtUtc = new Date().toISOString()
  const window = utcMinuteWindow()
  const base = {
    schemaVersion: 1,
    source: 'make-button',
    requestedBy: 'Samuel',
    requestedAtUtc,
    button,
    reason,
    repo: 'Samco1983/SAL0MANder-Web',
    branch: 'council/2026-08-18',
    idempotencyKey: `make-${button}-${window}`,
    safety: {
      noSecrets: true,
      noLiveMakeMutationFromLocalScript: true,
      noCrossLaneMutation: true,
      githubIsLedger: true,
    },
  }

  if (button === 'nudge-agents') {
    return {
      ...base,
      lanes: ['Web', 'Unity', 'Gemini', 'Make', 'Coordination'],
      target: {
        kind: 'github-issue-comment',
        repo: 'Samco1983/Sal0mander-Jigsaw-Puzzle',
        issueNumber: 1,
        marker: '<!-- sal0-agent-nudge-dashboard v1 -->',
      },
      requiredResponseState: [
        'WORKING',
        'DONE - NEED NEW TASK',
        'BLOCKED - NEED OWNER',
        'WRONG LANE - REASSIGN',
        'UNKNOWN/UNREACHABLE',
      ],
    }
  }

  if (button === 'done-need-new-task') {
    return {
      ...base,
      target: {
        kind: 'github-issue-search',
        repo: 'Samco1983/SAL0MANder-Web',
        query: 'is:issue is:open [WEB]',
      },
      expectedAction: 'Find the next unclaimed Web issue and write it to CURRENT-TASK.md.',
    }
  }

  if (button === 'blocker-status') {
    return {
      ...base,
      target: {
        kind: 'local-command-report',
        command: 'npm run mission:blockers',
      },
      expectedAction: 'Report open blockers and whether a human relay is still required.',
    }
  }

  return {
    ...base,
    target: {
      kind: 'local-command-report',
      command: 'npm run mission:control-room',
    },
    expectedAction: 'Show the current Mission Control status surface.',
  }
}

function atomicWrite(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${shortHash(data)}`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}

const button = process.argv[2] || 'nudge-agents'
if (!allowedButtons.has(button)) {
  usage()
  process.exit(2)
}

const reason = process.argv.slice(3).join(' ') || 'manual-button'
const payload = buildPayload(button, reason)
const body = `${JSON.stringify(payload, null, 2)}\n`
atomicWrite(outPath, body)

console.log(`wrote ${outPath}`)
console.log(`button ${button}`)
console.log(`idempotencyKey ${payload.idempotencyKey}`)

