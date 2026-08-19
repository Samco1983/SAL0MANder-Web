#!/usr/bin/env node
/**
 * SAL0MANder check-in monitor v1.
 *
 * This is the safe first piece of the dispatcher:
 * - reads GitHub Issue #1 comments
 * - finds the oldest unprocessed check-in request
 * - prints the exact request and a local Codex command to run manually
 * - optionally marks that comment as seen in local state
 *
 * It does not execute Codex automatically. That keeps untrusted GitHub comments
 * from becoming terminal commands.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { oldestPending, parseEnvelope, trustedAuthors } from './lib/sal0-checkin-select.mjs'

const HUB_REPO = process.env.SAL0_HUB_REPO || 'Samco1983/Sal0mander-Jigsaw-Puzzle'
const HUB_ISSUE = Number(process.env.SAL0_HUB_ISSUE || '1')
const CODEX_BIN =
  process.env.SAL0_CODEX_BIN || '/Applications/ChatGPT.app/Contents/Resources/codex'
const UNITY_REPO =
  process.env.SAL0_UNITY_REPO || '/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype'
const WEB_REPO = process.env.SAL0_WEB_REPO || '/Users/samuel_saldivar/Desktop/SAL0MANder-Web'
const STATE_FILE =
  process.env.SAL0_CHECKIN_MONITOR_STATE ||
  new URL('../docs/coordination/.checkin-monitor-state.json', import.meta.url).pathname
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const TRUSTED_AUTHORS = trustedAuthors()

const args = new Set(process.argv.slice(2))
const accept = args.has('--accept')
const override = args.has('--override')
const showHelp = args.has('--help') || args.has('-h')

if (showHelp) {
  console.log(`SAL0MANder check-in monitor v1

Usage:
  node scripts/sal0-checkin-monitor.mjs
  node scripts/sal0-checkin-monitor.mjs --accept
  node scripts/sal0-checkin-monitor.mjs --override

Environment:
  SAL0_HUB_REPO                    Hub repo, default ${HUB_REPO}
  SAL0_HUB_ISSUE                   Hub issue number, default ${HUB_ISSUE}
  SAL0_CODEX_BIN                   Codex binary path
  SAL0_UNITY_REPO                  Local Unity/game repo path
  SAL0_WEB_REPO                    Local web repo path
  SAL0_CHECKIN_MONITOR_STATE       Local state file path

Auth:
  Public repos can be read without a token.
  Private repos need GITHUB_TOKEN or GH_TOKEN in the environment.
`)
  process.exit(0)
}

function readState() {
  if (!existsSync(STATE_FILE)) return { seenCommentIds: [], lastCheckedAt: null }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

function writeState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
}

async function fetchIssueComments() {
  const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sal0-checkin-monitor-v1',
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    }

  const comments = []
  let page = 1

  while (true) {
    const url = `https://api.github.com/repos/${HUB_REPO}/issues/${HUB_ISSUE}/comments?per_page=100&page=${page}`
    const response = await fetch(url, { headers })

    if (!response.ok) {
      if (response.status === 404 && !GITHUB_TOKEN) {
        throw new Error(
          `GitHub read failed: 404 Not Found. If ${HUB_REPO} is private, rerun with GITHUB_TOKEN or GH_TOKEN set.`,
        )
      }
      throw new Error(`GitHub read failed: ${response.status} ${response.statusText}`)
    }

    const pageComments = await response.json()
    comments.push(...pageComments)
    if (pageComments.length < 100) return comments
    page += 1
  }
}

function printManualCommand(comment) {
  const envelope = parseEnvelope(comment.body)
  const prompt = `CHECK_IN_REQUEST from ${comment.html_url}

CONSULT_ONLY unless the request explicitly asks for a code change.
Use evidence labels: Verified, Relayed, Inferred.
Read GitHub/project files before claiming status.
Do not cross web/game repo boundaries without saying so.
Envelope status: ${envelope.isStructured ? 'structured' : 'manual-review'}
${envelope.problems.length ? `Envelope problems: ${envelope.problems.join('; ')}` : ''}

Request:
${comment.body}`

  const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
  const command = [
    CODEX_BIN,
    'exec',
    '-C',
    UNITY_REPO,
    '--add-dir',
    WEB_REPO,
    '-s',
    'read-only',
    prompt,
  ]

  console.log('\nManual Codex command:')
  console.log(command.map(shellQuote).join(' '))
}

function printOverridePacket(comment) {
  const envelope = parseEnvelope(comment.body)
  const lane = envelope.lane || 'Coordination'
  const request = envelope.request || comment.body
  const evidence = envelope.expectedEvidence || 'commit, test output, GitHub comment, Make run, or explicit blocker'

  console.log('\nManual override packet:')
  console.log(`COPY/PASTE THIS INTO ANY QUIET OR UNPRODUCTIVE AGENT

SAL0MANder Manual Override

You are being checked because the coordination system needs evidence, not vague status.

Lane: ${lane}
Source: ${comment.html_url}
Request:
${request}

Expected evidence:
${evidence}

Rules:
- Reply with ACK first.
- State the exact folder/repo you are using.
- Run a read-only status check before editing.
- Do not cross repo boundaries.
- Do not touch secrets, auth files, tokens, or unrelated projects.
- If you are not the right agent for this lane, say so immediately.
- If blocked, state the exact blocker immediately.
- Do not say "in progress" unless you have real evidence.

Required response format:
ACK
Lane:
Folder:
Current branch:
Latest commit:
Git status:
What I changed or verified:
Evidence:
Blocked:
Next action:
What I will not touch:`)
}

async function main() {
  const state = readState()
  const comments = await fetchIssueComments()
  const pending = oldestPending(comments, state, { trustedAuthors: TRUSTED_AUTHORS })

  state.lastCheckedAt = new Date().toISOString()

  if (!pending) {
    writeState(state)
    console.log(`${state.lastCheckedAt} — no pending check-in request`)
    return
  }

  console.log(`${state.lastCheckedAt} — oldest pending check-in request`)
  console.log(`Comment id: ${pending.id}`)
  console.log(`Author: ${pending.user?.login || 'unknown'}`)
  console.log(`Created: ${pending.created_at}`)
  console.log(`URL: ${pending.html_url}`)
  const envelope = parseEnvelope(pending.body)
  console.log(`Envelope: ${envelope.isStructured ? 'structured' : 'manual-review'}`)
  if (envelope.problems.length) console.log(`Envelope notes: ${envelope.problems.join('; ')}`)
  console.log('\nRequest body:\n')
  console.log(pending.body)
  if (override) {
    printOverridePacket(pending)
  } else {
    printManualCommand(pending)
  }

  if (accept) {
    state.seenCommentIds = [...new Set([...state.seenCommentIds, pending.id])]
    console.log('\nMarked this request as seen locally.')
  } else {
    console.log('\nRun with --accept only after the request has been handled.')
  }

  writeState(state)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
