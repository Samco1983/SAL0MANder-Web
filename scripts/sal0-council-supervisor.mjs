#!/usr/bin/env node
/**
 * SAL0MANder council supervisor v0.
 *
 * Backend-free scaffold for the agent-council loop:
 * - assembles one deterministic packet from coordination files + recent commits
 * - hashes the packet
 * - skips model calls when the same packet already succeeded
 * - writes an auditable run folder and ledger entry
 *
 * This version is intentionally dry-run first. It proves packet/state handling
 * before wiring Claude, Gemini, or OpenAI model calls.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const COORDINATION_DIR = join(ROOT, 'docs', 'coordination')
const RUNS_DIR = join(COORDINATION_DIR, 'runs')
const LEDGER_FILE = join(RUNS_DIR, 'ledger.jsonl')
const PROBE_FILE = join(COORDINATION_DIR, 'PROBE.md')
const CURRENT_STATE_FILE = join(COORDINATION_DIR, 'CURRENT_STATE.md')
const RECENT_COMMIT_COUNT = Number(process.env.SAL0_COUNCIL_COMMITS || '10')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run') || !args.has('--run-agents')
const showHelp = args.has('--help') || args.has('-h')

if (showHelp) {
  console.log(`SAL0MANder council supervisor v0

Usage:
  node scripts/sal0-council-supervisor.mjs --dry-run

This v0 intentionally does not call models unless a future --run-agents mode is
implemented. It builds the packet, hashes it, writes runs/<timestamp>-<hash8>/,
and records skips in docs/coordination/runs/ledger.jsonl.
`)
  process.exit(0)
}

function readOptional(path) {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8').trim()
}

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function recentProductCommits() {
  return productCommitRows()
    .map(({ subject }) => subject)
    .slice(0, RECENT_COMMIT_COUNT)
    .join('\n')
}

function latestProductHead() {
  return productCommitRows()[0]?.hash || git(['rev-parse', 'HEAD'])
}

function productCommitRows() {
  return git(['log', '-25', '--format=%H%x00%s'])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('\0')
      return { hash, subject }
    })
    .filter(({ subject }) => !subject.startsWith('council:'))
}

function stableJson(value) {
  return JSON.stringify(sortKeys(value), null, 2)
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortKeys(item)]),
  )
}

function packetHash(packet) {
  return createHash('sha256').update(stableJson(packet)).digest('hex')
}

function readLedger() {
  if (!existsSync(LEDGER_FILE)) return []
  return readFileSync(LEDGER_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true })
  const tempPath = `${path}.tmp-${process.pid}`
  writeFileSync(tempPath, contents)
  renameSync(tempPath, path)
}

function appendLedger(entry) {
  mkdirSync(dirname(LEDGER_FILE), { recursive: true })
  const prior = existsSync(LEDGER_FILE) ? readFileSync(LEDGER_FILE, 'utf8') : ''
  atomicWrite(LEDGER_FILE, `${prior}${JSON.stringify(entry)}\n`)
}

function relativeToRoot(path) {
  return path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path
}

function buildPacket() {
  return {
    version: 'sal0-council-packet-v0',
    createdAt: new Date().toISOString(),
    repo: {
      root: ROOT,
      branch: git(['branch', '--show-current']),
      productHead: latestProductHead(),
      status: git([
        'status',
        '--short',
        '--',
        '.',
        ':(exclude)docs/coordination/runs',
      ]),
    },
    sources: {
      probe: {
        path: 'docs/coordination/PROBE.md',
        body: readOptional(PROBE_FILE),
      },
      currentState: {
        path: 'docs/coordination/CURRENT_STATE.md',
        body: readOptional(CURRENT_STATE_FILE),
      },
      recentCommits: recentProductCommits(),
    },
  }
}

function run() {
  const startedAt = new Date().toISOString()
  const packet = buildPacket()
  const hash = packetHash({ ...packet, createdAt: undefined })
  const hash8 = hash.slice(0, 8)
  const priorSuccess = readLedger().find((entry) => entry.hash === hash && entry.status === 'success')

  if (priorSuccess) {
    appendLedger({
      hash,
      hash8,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'skipped-no-change',
      priorRun: priorSuccess.runDir,
      modelCalls: 0,
      dryRun,
    })
    console.log(`no change — packet ${hash8} already succeeded in ${priorSuccess.runDir}`)
    return
  }

  const timestamp = startedAt.replaceAll(':', '').replaceAll('.', '')
  const runDir = join(RUNS_DIR, `${timestamp}-${hash8}`)
  mkdirSync(runDir, { recursive: true })
  atomicWrite(join(runDir, 'packet.json'), `${stableJson({ ...packet, hash })}\n`)

  const result = `# SAL0MANder Council Result

Status: DRY RUN
Packet: ${hash}
Model calls: 0

This run proved packet assembly, hashing, run-folder creation, and ledger
writing. Claude/Gemini/OpenAI calls are intentionally not wired yet.

Next action: implement strict JSON schema validation for Claude POSITION,
Gemini CRITIQUE, and OpenAI DECISION before enabling agent execution.
`

  atomicWrite(join(runDir, 'RESULT.md'), result)
  appendLedger({
    hash,
    hash8,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: 'success',
    runDir: relativeToRoot(runDir),
    modelCalls: 0,
    dryRun,
  })
  console.log(`wrote council dry run ${runDir}`)
}

run()
