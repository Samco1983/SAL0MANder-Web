/**
 * The muscle. Mission Control already produces exactly one `nextAction` per
 * run and then does nothing with it — this is the part that does it.
 *
 * Design constraints, in order of importance:
 *
 * 1. It works or it stops. There is no "partially applied" outcome: either
 *    verify passes and the work is committed, or the tree is left dirty and the
 *    run is BLOCKED with the diff attached for a human.
 * 2. It never repairs itself into looking healthy. No retry loop, no revert, no
 *    stash. A failed run leaves exactly what it did, visible.
 * 3. It refuses out-of-lane work rather than reassigning it. Unity is Codex's.
 */

/** Lanes this executor is allowed to act in. Everything else is refused. */
const WEB_LANE_OWNERS = new Set(['SAL0-04', 'claude', 'claude cli', 'web', 'claude code'])

/** Paths this repo must never touch, regardless of what an agent decided. */
const FORBIDDEN_PATH_PATTERNS = [
  /SAL0MANDER-Puzzle-Prototype/i,
  /^\.git\//,
  /(^|\/)\.env($|\.)/,
  /(^|\/)auth\.json$/,
]

export const EXECUTE_OUTCOME = {
  COMMITTED: 'COMMITTED',
  NOTHING_CHANGED: 'NOTHING CHANGED',
  BLOCKED: 'BLOCKED - NEED OWNER',
  WRONG_LANE: 'WRONG LANE - REASSIGN',
  REFUSED: 'REFUSED',
}

export function isWebLane(owner) {
  if (!owner) return false
  return WEB_LANE_OWNERS.has(String(owner).trim().toLowerCase()) ||
    WEB_LANE_OWNERS.has(String(owner).trim())
}

export function touchesForbiddenPath(files) {
  return files.filter((file) => FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(file)))
}

/**
 * Decide whether an action may be executed at all. Pure, so the refusal rules
 * are testable without running anything.
 */
export function screenAction(nextAction) {
  if (!nextAction || typeof nextAction !== 'object') {
    return { allowed: false, outcome: EXECUTE_OUTCOME.REFUSED, reason: 'no nextAction in position' }
  }
  const { owner, action, successCheck } = nextAction

  if (!isWebLane(owner)) {
    return {
      allowed: false,
      outcome: EXECUTE_OUTCOME.WRONG_LANE,
      reason: `owner "${owner}" is not the web lane — reassign, do not execute`,
    }
  }
  if (!action || String(action).trim().length < 8) {
    return { allowed: false, outcome: EXECUTE_OUTCOME.REFUSED, reason: 'action is empty or too vague to execute' }
  }
  // An action nobody can falsify is an action nobody can check afterwards.
  if (!successCheck || String(successCheck).trim().length < 8) {
    return {
      allowed: false,
      outcome: EXECUTE_OUTCOME.REFUSED,
      reason: 'action has no falsifiable successCheck',
    }
  }
  return { allowed: true, outcome: null, reason: 'in lane, concrete, falsifiable' }
}

/**
 * Build the prompt handed to the worker. Deliberately narrow: one action, the
 * repo's own rules, and an explicit ban on scope creep. A worker given a vague
 * brief writes a document; a worker given one action writes a diff.
 */
export function buildExecutePrompt(nextAction, packetSummary) {
  return `You are the SAL0MANder web worker (SAL0-04). Do ONE thing and stop.

THE ACTION:
${nextAction.action}

HOW WE WILL KNOW IT WORKED:
${nextAction.successCheck}

RULES:
- Work only in this repo. Never touch /Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype.
- Read CLAUDE.md and docs/CHARTER-WEB-POINT-PERSON.md first. They bind you.
- Change code. Do not write a proposal, a review, or a plan document.
- Do not expand scope. One action. If you finish early, stop.
- Run \`npm run verify\` when you are done. It must pass. Check the exit code,
  not the words in the output.
- Do not commit. The supervisor commits if and only if verify passes.
- If you cannot do it, say exactly what blocked you and name the command that
  would unblock it. Do not substitute an easier task.

CONTEXT:
${packetSummary}
`
}

/**
 * Turn a completed execution into the one line that cannot be faked.
 */
export function describeOutcome({ outcome, filesChanged = [], commit = null, reason = '' }) {
  switch (outcome) {
    case EXECUTE_OUTCOME.COMMITTED:
      return `COMMITTED ${commit?.slice(0, 8) ?? '?'} — ${filesChanged.length} file(s): ${filesChanged.slice(0, 5).join(', ')}`
    case EXECUTE_OUTCOME.NOTHING_CHANGED:
      return 'NOTHING CHANGED — the worker ran and produced no diff'
    case EXECUTE_OUTCOME.BLOCKED:
      return `BLOCKED - NEED OWNER — ${reason}. Working tree left dirty on purpose; read the diff.`
    case EXECUTE_OUTCOME.WRONG_LANE:
      return `WRONG LANE - REASSIGN — ${reason}`
    default:
      return `REFUSED — ${reason}`
  }
}
