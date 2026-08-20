/**
 * Free preflight — everything checkable before spending a billable model call.
 *
 * Deliberately non-billable. Testing an agent by asking it a question costs
 * money on every wake, forever, and tells you less than an exit code does.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

/** Outside the repo on purpose: git must not be able to remove the brake. */
export const DEFAULT_PAUSE_FILE = join(homedir(), '.sal0mander', 'PAUSE')

export function readPauseSwitch(pauseFile = process.env.SAL0_PAUSE_FILE || DEFAULT_PAUSE_FILE) {
  if (!existsSync(pauseFile)) return { paused: false, pauseFile }
  let reason = ''
  try {
    reason = readFileSync(pauseFile, 'utf8').trim()
  } catch {
    reason = ''
  }
  return { paused: true, pauseFile, reason: reason || 'no reason given' }
}

function probe(bin, argv = ['--version']) {
  const result = spawnSync(bin, argv, { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.error?.code === 'ENOENT') return { present: false, version: null }
  const version = String(result.stdout || result.stderr || '').trim().split('\n')[0] || null
  // A binary that runs but does not understand --version is still present.
  return { present: true, version: version || 'unknown' }
}

function freeDiskBytes(dir) {
  const result = spawnSync('df', ['-k', dir], { encoding: 'utf8', timeout: 10000 })
  if (result.status !== 0) return null
  const line = String(result.stdout).trim().split('\n').pop() || ''
  const available = Number(line.split(/\s+/)[3])
  return Number.isFinite(available) ? available * 1024 : null
}

/**
 * @returns {{ok: boolean, blocking: string[], warnings: string[], checks: object}}
 */
export function collectPreflight({
  root,
  expectedBranch = null,
  requiredBins = [],
  minFreeBytes = 2 * 1024 * 1024 * 1024,
} = {}) {
  const blocking = []
  const warnings = []
  const checks = {}

  const topLevel = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  })
  const resolvedTop = String(topLevel.stdout || '').trim()
  checks.workspace = { expected: root.replace(/\/$/, ''), actual: resolvedTop }
  if (topLevel.status !== 0) {
    blocking.push('not inside a git repository')
  } else if (resolvedTop && resolvedTop !== root.replace(/\/$/, '')) {
    // An agent invoked from the wrong tree writes real files to the wrong repo.
    blocking.push(`workspace mismatch: expected ${root.replace(/\/$/, '')}, got ${resolvedTop}`)
  }

  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  })
  checks.branch = String(branch.stdout || '').trim() || null
  if (expectedBranch && checks.branch !== expectedBranch) {
    blocking.push(`branch mismatch: expected ${expectedBranch}, on ${checks.branch}`)
  }

  checks.bins = {}
  for (const bin of requiredBins) {
    const info = probe(bin)
    checks.bins[bin] = info
    if (!info.present) blocking.push(`required CLI not found: ${bin}`)
  }

  checks.versions = {
    node: process.version,
    supervisor: 'sal0-council-packet-v0',
  }

  const free = freeDiskBytes(root)
  checks.freeDiskBytes = free
  if (free === null) {
    warnings.push('could not read free disk space')
  } else if (free < minFreeBytes) {
    blocking.push(`low disk: ${(free / 1e9).toFixed(1)}GB free, need ${(minFreeBytes / 1e9).toFixed(1)}GB`)
  }

  return { ok: blocking.length === 0, blocking, warnings, checks }
}

export function statOrNull(path) {
  try {
    return statSync(path)
  } catch {
    return null
  }
}
