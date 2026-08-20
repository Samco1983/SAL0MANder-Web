#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const REPO = 'Samco1983/SAL0MANder-Web'

function asArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value.nodes)) return value.nodes
  return []
}

function checkName(check) {
  return check.name ?? check.context ?? check.workflowName ?? check.__typename ?? 'unnamed check'
}

export function normalizeChecks(statusCheckRollup) {
  return asArray(statusCheckRollup).map((check) => {
    const conclusion = check.conclusion ?? check.state ?? null
    const status = check.status ?? null
    return {
      name: checkName(check),
      status,
      conclusion,
      url: check.detailsUrl ?? check.targetUrl ?? check.url ?? null,
    }
  })
}

function classifyCheck(check) {
  const conclusion = String(check.conclusion ?? '').toUpperCase()
  const status = String(check.status ?? '').toUpperCase()

  if (['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(conclusion)) return 'passing'
  if (['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(conclusion)) {
    return 'failing'
  }
  if (status && status !== 'COMPLETED') return 'pending'
  return 'pending'
}

export function evaluatePrGate(pr) {
  if (!pr || typeof pr !== 'object') {
    return { ok: false, code: 'BAD_INPUT', summary: 'PR gate received no PR payload.' }
  }

  if (pr.state && pr.state !== 'OPEN') {
    return {
      ok: false,
      code: 'PR_NOT_OPEN',
      summary: `PR #${pr.number ?? '?'} is ${pr.state}; only open PRs can reach main.`,
    }
  }

  if (['CONFLICTING'].includes(pr.mergeable) || ['DIRTY', 'BLOCKED'].includes(pr.mergeStateStatus)) {
    return {
      ok: false,
      code: 'MERGE_BLOCKED',
      summary: `PR #${pr.number ?? '?'} is not merge-ready (${pr.mergeable ?? pr.mergeStateStatus}).`,
    }
  }

  const checks = normalizeChecks(pr.statusCheckRollup)
  const counts = { total: checks.length, passing: 0, pending: 0, failing: 0 }
  const failing = []
  const pending = []

  for (const check of checks) {
    const kind = classifyCheck(check)
    counts[kind] += 1
    if (kind === 'failing') failing.push(check)
    if (kind === 'pending') pending.push(check)
  }

  if (checks.length === 0) {
    return {
      ok: false,
      code: 'NO_CHECKS',
      summary: `PR #${pr.number ?? '?'} has no status checks; council cannot reach main on chat confidence alone.`,
      checks: counts,
      failing,
      pending,
    }
  }

  if (failing.length > 0) {
    return {
      ok: false,
      code: 'FAILED_CHECKS',
      summary: `PR #${pr.number ?? '?'} has ${failing.length} failed check(s).`,
      checks: counts,
      failing,
      pending,
    }
  }

  if (pending.length > 0) {
    return {
      ok: false,
      code: 'PENDING_CHECKS',
      summary: `PR #${pr.number ?? '?'} has ${pending.length} pending check(s).`,
      checks: counts,
      failing,
      pending,
    }
  }

  return {
    ok: true,
    code: 'PR_GATE_GREEN',
    summary: `PR #${pr.number ?? '?'} has ${checks.length} passing check(s); council can proceed.`,
    checks: counts,
    failing,
    pending,
  }
}

function parseArgs(argv) {
  const args = { json: false, pr: null, fixture: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') args.json = true
    else if (arg === '--pr') args.pr = argv[++i]
    else if (arg.startsWith('--pr=')) args.pr = arg.slice('--pr='.length)
    else if (arg === '--fixture') args.fixture = argv[++i]
    else if (arg.startsWith('--fixture=')) args.fixture = arg.slice('--fixture='.length)
  }
  return args
}

function loadPr(args) {
  if (args.fixture) return JSON.parse(readFileSync(args.fixture, 'utf8'))

  const pr = args.pr ?? process.env.PR_NUMBER
  if (!pr) throw new Error('Provide --pr <number> or PR_NUMBER.')

  const result = spawnSync(
    'gh',
    [
      'pr',
      'view',
      String(pr),
      '--repo',
      REPO,
      '--json',
      'number,title,state,mergeable,mergeStateStatus,statusCheckRollup,url',
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `gh exited ${result.status}`).trim())
  }
  return JSON.parse(result.stdout)
}

function printText(result) {
  const icon = result.ok ? 'OK' : 'BLOCKED'
  console.log(`${icon} ${result.code}: ${result.summary}`)
  if (result.checks) {
    console.log(
      `checks: ${result.checks.passing} passing, ${result.checks.pending} pending, ` +
        `${result.checks.failing} failing, ${result.checks.total} total`,
    )
  }
  for (const check of [...(result.failing ?? []), ...(result.pending ?? [])]) {
    console.log(`- ${check.name}: ${check.conclusion ?? check.status ?? 'unknown'}`)
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('sal0-pr-gate.mjs')
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  try {
    const result = evaluatePrGate(loadPr(args))
    if (args.json) console.log(JSON.stringify(result, null, 2))
    else printText(result)
    process.exit(result.ok ? 0 : 1)
  } catch (error) {
    const result = { ok: false, code: 'PR_GATE_ERROR', summary: error.message }
    if (args.json) console.log(JSON.stringify(result, null, 2))
    else printText(result)
    process.exit(1)
  }
}
