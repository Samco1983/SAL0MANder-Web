/**
 * Machine-filled run evidence.
 *
 * The design rule: a field the supervisor can read from git, the filesystem, or
 * a process exit code is filled BY the supervisor. A field the agent types is a
 * field the agent can get wrong or invent. Only judgement is left to the agent.
 *
 * The failure this addresses happened twice in one session: an agent read
 * command output as text, saw reassuring words, and reported a pass that had
 * not happened. Exit codes do not have that failure mode.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

/**
 * How much a claim is actually worth. These are NOT interchangeable, and the
 * gap between the first and the last is where unattended systems die.
 */
export const VERIFICATION_LEVEL = {
  /** A human typed the command in an interactive shell. Proves the code works. */
  MANUAL: 'manually-verified',
  /** Ran from a scheduler, but a human was around. Proves the schedule fires. */
  SCHEDULED: 'scheduled-verified',
  /** Ran from a scheduler with nobody present. The only one that proves the system. */
  UNATTENDED: 'unattended-verified',
  /** We could not tell. Claims nothing. Must never be read as any of the above. */
  UNKNOWN: 'context-unknown',
}

/**
 * Detect how this run was started. `launchd` and CI both start jobs with no
 * controlling terminal, which is the signal we can actually observe.
 */
export function detectScheduleContext(env = process.env, isTTY = process.stdout.isTTY) {
  if (env.SAL0_SCHEDULE_CONTEXT) return env.SAL0_SCHEDULE_CONTEXT
  if (env.GITHUB_ACTIONS === 'true') return 'github-actions'
  if (env.CI === 'true') return 'ci'
  if (!isTTY) return 'no-tty'
  return 'manual'
}

/**
 * Degrade, never upgrade. Absence of a TTY is not proof of a scheduler — a
 * human piping a command has no TTY either. When we cannot tell, we say so,
 * because a run that claims more than it proved is the failure this whole file
 * exists to prevent.
 */
const KNOWN_SCHEDULERS = new Set(['launchd', 'github-actions', 'ci', 'cron', 'make'])

export function detectVerificationLevel(scheduleContext, { humanPresent = null } = {}) {
  if (scheduleContext === 'manual') return VERIFICATION_LEVEL.MANUAL
  if (!KNOWN_SCHEDULERS.has(scheduleContext)) return VERIFICATION_LEVEL.UNKNOWN
  if (humanPresent === false) return VERIFICATION_LEVEL.UNATTENDED
  // A scheduled run cannot prove nobody was watching, so it must not claim to.
  return VERIFICATION_LEVEL.SCHEDULED
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 15000 }).trim()
  } catch {
    return null
  }
}

/**
 * Collect everything provable without asking the agent anything.
 */
export function collectRunEvidence({ root, runDir, startCommit, agentsInvoked = [], commands = [] }) {
  const headCommit = git(['rev-parse', 'HEAD'], root)
  const filesChanged = startCommit && headCommit && startCommit !== headCommit
    ? (git(['diff', '--name-only', `${startCommit}..${headCommit}`], root) || '').split('\n').filter(Boolean)
    : []
  const commitsCreated = startCommit && headCommit && startCommit !== headCommit
    ? (git(['log', '--format=%H', `${startCommit}..${headCommit}`], root) || '').split('\n').filter(Boolean)
    : []

  let artifacts = []
  try {
    artifacts = readdirSync(runDir).sort()
  } catch {
    artifacts = []
  }

  const scheduleContext = detectScheduleContext()

  return {
    scheduleContext,
    verificationLevel: detectVerificationLevel(scheduleContext),
    startCommit,
    headCommit,
    // Empty arrays are the point: a run that changed nothing must say so in a
    // shape that cannot be mistaken for a run that did something.
    filesChanged,
    commitsCreated,
    artifacts,
    agentsInvoked,
    // Raw commands and their exit codes — the claim and its proof together.
    commands: commands.map((entry) => ({
      command: entry.command,
      exitCode: entry.exitCode,
      signal: entry.signal ?? null,
    })),
    dirtyTree: git(['status', '--porcelain'], root) !== '',
  }
}

/**
 * The two fields a machine cannot fill. An automated run that cannot answer the
 * first one produced nothing, however healthy its log looks.
 */
export function summariseChange(evidence) {
  const parts = []
  if (evidence.commitsCreated.length) parts.push(`${evidence.commitsCreated.length} commit(s)`)
  if (evidence.filesChanged.length) parts.push(`${evidence.filesChanged.length} file(s) changed`)
  if (evidence.artifacts.length) parts.push(`${evidence.artifacts.length} artifact(s) written`)
  return parts.length ? parts.join(', ') : 'NOTHING CHANGED'
}
