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
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const COORDINATION_DIR = join(ROOT, 'docs', 'coordination')
const RUNS_DIR = join(COORDINATION_DIR, 'runs')
const LEDGER_FILE = join(RUNS_DIR, 'ledger.jsonl')
const PROBE_FILE = join(COORDINATION_DIR, 'PROBE.md')
const CURRENT_STATE_FILE = join(COORDINATION_DIR, 'CURRENT_STATE.md')
const ROLES_FILE = join(COORDINATION_DIR, 'AGENT_ROLES.json')
const SESSION_FAILSAFES_FILE = join(COORDINATION_DIR, 'SESSION-FAILSAFES.md')
const LOCK_FILE = join(COORDINATION_DIR, '.mission-control.lock')
const RECENT_COMMIT_COUNT = Number(process.env.SAL0_COUNCIL_COMMITS || '10')
const CLAUDE_BIN = process.env.SAL0_CLAUDE_BIN || 'claude'
const AGENT_TIMEOUT_MS = Number(process.env.SAL0_COUNCIL_AGENT_TIMEOUT_MS || '120000')

const args = new Set(process.argv.slice(2))
const runAgents = args.has('--run-agents')
const dryRun = args.has('--dry-run') || !runAgents
const runMode = runAgents ? 'agent-claude-position' : 'dry-run'
const validateSchemas = args.has('--validate-schemas')
const printPacket = args.has('--print-packet')
const allowExternalClaude = args.has('--allow-external-claude')
const showHelp = args.has('--help') || args.has('-h')

if (showHelp) {
  console.log(`SAL0MANder council supervisor v0

Usage:
  node scripts/sal0-council-supervisor.mjs --dry-run
  node scripts/sal0-council-supervisor.mjs --print-packet
  node scripts/sal0-council-supervisor.mjs --run-agents
  node scripts/sal0-council-supervisor.mjs --validate-schemas

Dry-run builds the packet, hashes it, writes runs/<timestamp>-<hash8>/, and
records skips in docs/coordination/runs/ledger.jsonl.

--print-packet writes the exact packet to stdout for review.

--run-agents currently runs Claude POSITION only, then validates and records raw
+ parsed output. It requires --allow-external-claude because it sends packet
content to Claude. Gemini and OpenAI remain disabled until Claude output is
proven stable.

Warning:
  --run-agents sends the assembled packet to Claude. Use only when that external
  model handoff is approved for the current packet, and pass
  --allow-external-claude explicitly.

Environment:
  SAL0_CLAUDE_BIN                  Claude CLI path, default claude
  SAL0_COUNCIL_AGENT_TIMEOUT_MS    Per-agent timeout, default 120000
`)
  process.exit(0)
}

const stateSchema = z.enum([
  'WORKING',
  'DONE - NEED NEW TASK',
  'BLOCKED - NEED OWNER',
  'WRONG LANE - REASSIGN',
  'UNKNOWN/UNREACHABLE',
  'REVIEW READY',
])

const laneSchema = z.enum([
  'Unity/Game',
  'Web',
  'Make Automation',
  'Coordination',
  'Seam',
])

const evidenceSchema = z.object({
  type: z.enum(['commit', 'test', 'run', 'file', 'issue-comment', 'screenshot', 'blocker']),
  reference: z.string().min(1),
  summary: z.string().min(1),
})

const falsifiableActionSchema = z.object({
  owner: z.string().min(1),
  action: z.string().min(1),
  successCheck: z.string().min(1),
})

const positionSchema = z
  .object({
    schemaVersion: z.literal('sal0-council-position-v0'),
    agent: z.literal('Claude'),
    state: stateSchema,
    lane: laneSchema,
    claims: z.array(
      z.object({
        id: z.string().regex(/^C\d+$/),
        claim: z.string().min(10),
        evidence: z.array(evidenceSchema).min(1),
      }),
    ).min(1),
    risks: z.array(z.string().min(1)).default([]),
    nextAction: falsifiableActionSchema,
  })
  .strict()

const critiqueSchema = z
  .object({
    schemaVersion: z.literal('sal0-council-critique-v0'),
    agent: z.literal('Gemini'),
    state: stateSchema,
    rejectedClaudeClaimId: z.string().regex(/^C\d+$/),
    rejectedClaudeClaimQuote: z.string().min(10),
    reason: z.string().min(10),
    evidence: z.array(evidenceSchema).min(1),
    nextAction: falsifiableActionSchema,
  })
  .strict()

const decisionSchema = z
  .object({
    schemaVersion: z.literal('sal0-council-decision-v0'),
    agent: z.literal('OpenAI'),
    state: stateSchema,
    rationale: z.string().min(10),
    selectedNextAction: falsifiableActionSchema,
    rejectedOptions: z.array(z.string().min(1)).default([]),
  })
  .strict()

function validatePosition(raw) {
  return positionSchema.parse(raw)
}

function validateCritique(raw, position) {
  const critique = critiqueSchema.parse(raw)
  const rejectedClaim = position.claims.find((claim) => claim.id === critique.rejectedClaudeClaimId)
  if (!rejectedClaim) {
    throw new Error(`Gemini rejected missing Claude claim ${critique.rejectedClaudeClaimId}`)
  }
  if (!rejectedClaim.claim.includes(critique.rejectedClaudeClaimQuote)) {
    throw new Error('Gemini critique quote does not match the rejected Claude claim')
  }
  return critique
}

function validateDecision(raw) {
  return decisionSchema.parse(raw)
}

function parseJsonObject(rawText) {
  const start = rawText.indexOf('{')
  const end = rawText.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Agent output did not contain a JSON object')
  }
  return JSON.parse(rawText.slice(start, end + 1))
}

function acquireRunLock() {
  let descriptor
  try {
    descriptor = openSync(LOCK_FILE, 'wx')
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`Mission Control is already running: ${LOCK_FILE}`)
    }
    throw error
  }

  writeFileSync(
    descriptor,
    `${stableJson({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      mode: runMode,
    })}\n`,
  )
  closeSync(descriptor)

  let released = false
  return () => {
    if (released) return
    released = true
    try {
      unlinkSync(LOCK_FILE)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
}

function runSchemaValidationProof() {
  const position = validatePosition({
    schemaVersion: 'sal0-council-position-v0',
    agent: 'Claude',
    state: 'REVIEW READY',
    lane: 'Coordination',
    claims: [
      {
        id: 'C1',
        claim: 'The council supervisor should validate schemas before live agent execution.',
        evidence: [
          {
            type: 'file',
            reference: 'scripts/sal0-council-supervisor.mjs',
            summary: 'Supervisor owns local packet and output validation.',
          },
        ],
      },
    ],
    risks: ['Loose prose can look like evidence when it is not machine-checkable.'],
    nextAction: {
      owner: 'Codex',
      action: 'Add schema validation before agent execution.',
      successCheck: 'A local validation command exits 0 for valid samples and throws for invalid critique references.',
    },
  })

  validateCritique(
    {
      schemaVersion: 'sal0-council-critique-v0',
      agent: 'Gemini',
      state: 'REVIEW READY',
      rejectedClaudeClaimId: 'C1',
      rejectedClaudeClaimQuote: 'validate schemas before live agent execution',
      reason: 'Schema validation alone is incomplete unless critiques are tied to exact prior claims.',
      evidence: [
        {
          type: 'file',
          reference: 'scripts/sal0-council-supervisor.mjs',
          summary: 'Critique validation checks claim id and exact quote containment.',
        },
      ],
      nextAction: {
        owner: 'Codex',
        action: 'Reject generic Gemini critique output.',
        successCheck: 'A critique without a matching Claude quote fails validation.',
      },
    },
    position,
  )

  validateDecision({
    schemaVersion: 'sal0-council-decision-v0',
    agent: 'OpenAI',
    state: 'REVIEW READY',
    rationale: 'The next council upgrade must preserve falsifiability before scheduling.',
    selectedNextAction: {
      owner: 'Codex',
      action: 'Wire validators into the dry-run evidence path before model calls.',
      successCheck: 'The dry-run result records schema validation as passing with zero model calls.',
    },
    rejectedOptions: ['Wire launchd before output validation exists.'],
  })

  try {
    validateCritique(
      {
        schemaVersion: 'sal0-council-critique-v0',
        agent: 'Gemini',
        state: 'REVIEW READY',
        rejectedClaudeClaimId: 'C9',
        rejectedClaudeClaimQuote: 'generic praise',
        reason: 'This should fail because it does not cite a real Claude claim.',
        evidence: [
          {
            type: 'blocker',
            reference: 'schema-proof',
            summary: 'Negative validation fixture.',
          },
        ],
        nextAction: {
          owner: 'Codex',
          action: 'Prove bad critique rejection.',
          successCheck: 'This fixture throws instead of passing.',
        },
      },
      position,
    )
    throw new Error('Negative critique fixture unexpectedly passed')
  } catch (error) {
    if (error.message === 'Negative critique fixture unexpectedly passed') throw error
  }

  console.log('schema validation proof passed')
}

if (validateSchemas) {
  runSchemaValidationProof()
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

function buildClaudePrompt(packet) {
  return `You are Claude in the SAL0MANder agent council.

Return JSON only. No Markdown, no prose outside JSON.

Your required schema:
{
  "schemaVersion": "sal0-council-position-v0",
  "agent": "Claude",
  "state": "WORKING | DONE - NEED NEW TASK | BLOCKED - NEED OWNER | WRONG LANE - REASSIGN | UNKNOWN/UNREACHABLE | REVIEW READY",
  "lane": "Unity/Game | Web | Make Automation | Coordination | Seam",
  "claims": [
    {
      "id": "C1",
      "claim": "Specific claim grounded in the packet.",
      "evidence": [
        {
          "type": "commit | test | run | file | issue-comment | screenshot | blocker",
          "reference": "Specific file, commit, run, or blocker.",
          "summary": "Why this evidence supports the claim."
        }
      ]
    }
  ],
  "risks": ["Specific risk, if any."],
  "nextAction": {
    "owner": "Specific owner",
    "action": "One concrete next action.",
    "successCheck": "How to falsify or verify completion."
  }
}

Rules:
- Do not claim live GitHub, Make, Unity, or Gemini state unless the packet proves it.
- Do not ask Samuel to do coordination work unless owner input is genuinely required.
- Pick one next action only.
- If evidence is missing, use state BLOCKED - NEED OWNER or UNKNOWN/UNREACHABLE.

Packet:
${stableJson(packet)}
`
}

function runClaudePosition(packet, runDir) {
  const prompt = buildClaudePrompt(packet)
  atomicWrite(join(runDir, '01-claude-prompt.txt'), prompt)

  let raw
  try {
    raw = execFileSync(CLAUDE_BIN, ['-p', prompt], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
      timeout: AGENT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const message =
      error.code === 'ENOENT'
        ? `Claude CLI not found. Set SAL0_CLAUDE_BIN or install/login Claude CLI. Tried: ${CLAUDE_BIN}`
        : `Claude POSITION failed: ${error.message}`
    throw new Error(message)
  }

  atomicWrite(join(runDir, '01-claude.raw.txt'), raw)
  const parsed = validatePosition(parseJsonObject(raw))
  atomicWrite(join(runDir, '01-claude.position.json'), `${stableJson(parsed)}\n`)
  return parsed
}

function writeFailure(runDir, error) {
  const body = `# SAL0MANder Council Failure

Status: FAILED
Reason: ${error.message}

No downstream agent stages should run from this packet.
`
  atomicWrite(join(runDir, 'ERROR.md'), body)
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
      agentRoles: {
        path: 'docs/coordination/AGENT_ROLES.json',
        body: JSON.parse(readOptional(ROLES_FILE)),
      },
      sessionFailsafes: {
        path: 'docs/coordination/SESSION-FAILSAFES.md',
        body: readOptional(SESSION_FAILSAFES_FILE),
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

  if (printPacket) {
    console.log(stableJson({ ...packet, hash }))
    return
  }

  if (runAgents && !allowExternalClaude) {
    console.error(
      'Refusing external Claude handoff. Re-run with --allow-external-claude only after approving the current packet.',
    )
    process.exitCode = 1
    return
  }

  const releaseLock = acquireRunLock()
  process.once('exit', releaseLock)

  const priorSuccess = readLedger().find(
    (entry) => entry.hash === hash && entry.runMode === runMode && entry.status === 'success',
  )

  if (priorSuccess) {
    appendLedger({
      hash,
      hash8,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'skipped-no-change',
      priorRun: priorSuccess.runDir,
      modelCalls: 0,
      runMode,
      dryRun,
    })
    console.log(`no change — packet ${hash8} already succeeded in ${priorSuccess.runDir}`)
    releaseLock()
    return
  }

  const timestamp = startedAt.replaceAll(':', '').replaceAll('.', '')
  const runDir = join(RUNS_DIR, `${timestamp}-${hash8}`)
  mkdirSync(runDir, { recursive: true })
  atomicWrite(join(runDir, 'packet.json'), `${stableJson({ ...packet, hash })}\n`)

  let modelCalls = 0

  try {
    runSchemaValidationProof()
    let claudePosition = null
    if (runAgents) {
      claudePosition = runClaudePosition(packet, runDir)
      modelCalls = 1
    }

    const result = `# SAL0MANder Council Result

Status: ${runAgents ? 'CLAUDE POSITION CAPTURED' : 'DRY RUN'}
Packet: ${hash}
Model calls: ${modelCalls}
Schema validation: PASS

This run proved packet assembly, hashing, run-folder creation, and ledger
writing. It also proved strict local schemas for Claude POSITION, Gemini
CRITIQUE, and OpenAI DECISION.

${claudePosition ? `Claude state: ${claudePosition.state}\nClaude next action: ${claudePosition.nextAction.action}\n` : 'Claude/Gemini/OpenAI calls are intentionally not wired in dry-run.\n'}
Next action: ${runAgents ? 'wire Gemini critique only after Claude output validates repeatedly.' : 'run --run-agents once Claude CLI is available to capture the first validated POSITION.'}
`

    atomicWrite(join(runDir, 'RESULT.md'), result)
    appendLedger({
      hash,
      hash8,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'success',
      runDir: relativeToRoot(runDir),
      modelCalls,
      runMode,
      claudePosition: claudePosition ? 'pass' : 'not-run',
      schemaValidation: 'pass',
      dryRun,
    })
    console.log(`wrote council ${runAgents ? 'agent run' : 'dry run'} ${runDir}`)
  } catch (error) {
    writeFailure(runDir, error)
    appendLedger({
      hash,
      hash8,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'failed',
      runDir: relativeToRoot(runDir),
      modelCalls,
      runMode,
      error: error.message,
      dryRun,
    })
    console.error(error.message)
    process.exitCode = 1
  } finally {
    releaseLock()
  }
}

run()
