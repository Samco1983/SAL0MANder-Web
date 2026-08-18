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
const REQUEST_MARKERS = ['CHECK_IN_REQUEST', 'ACTION REQUIRED']
const PROCESSED_MARKERS = ['CHECK_IN_PROCESSED']

const args = new Set(process.argv.slice(2))
const accept = args.has('--accept')
const showHelp = args.has('--help') || args.has('-h')

if (showHelp) {
  console.log(`SAL0MANder check-in monitor v1

Usage:
  node scripts/sal0-checkin-monitor.mjs
  node scripts/sal0-checkin-monitor.mjs --accept

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

function oldestPending(comments, state) {
  const seen = new Set(state.seenCommentIds)
  return comments
    .filter((comment) => REQUEST_MARKERS.some((marker) => comment.body?.includes(marker)))
    .filter((comment) => !PROCESSED_MARKERS.some((marker) => comment.body?.includes(marker)))
    .filter((comment) => !seen.has(comment.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
}

function printManualCommand(comment) {
  const prompt = `CHECK_IN_REQUEST from ${comment.html_url}

CONSULT_ONLY unless the request explicitly asks for a code change.
Use evidence labels: Verified, Relayed, Inferred.
Read GitHub/project files before claiming status.
Do not cross web/game repo boundaries without saying so.

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

async function main() {
  const state = readState()
  const comments = await fetchIssueComments()
  const pending = oldestPending(comments, state)

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
  console.log('\nRequest body:\n')
  console.log(pending.body)
  printManualCommand(pending)

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
