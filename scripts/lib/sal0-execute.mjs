/**
 * Execute-stage screening for Mission Control.
 *
 * Mission Control produces exactly one `nextAction` per run. This module decides
 * whether that action may be carried out at all, and reports the outcome in a
 * vocabulary that cannot flatter itself.
 *
 * It does not execute anything. Screening is pure and testable on purpose;
 * wiring it to a live worker is a separate, deliberately separate, decision.
 *
 * Design constraints, in order of importance:
 *
 * 1. Refuse by default. Every gate below must pass, and a gate that cannot
 *    decide refuses rather than allows.
 * 2. Never repair into looking healthy. There is no retry, revert or stash
 *    anywhere in this design — a failed run leaves exactly what it did.
 * 3. Refuse out-of-lane work rather than reassigning it. Unity is Codex's.
 */

/**
 * The only role permitted to execute. SAL0-05 is also the Web lane but lives on
 * a browser chat surface, which cannot be driven by a supervisor — so it is
 * deliberately absent.
 */
const EXECUTOR_ROLE = 'SAL0-04'

/** Aliases seen in real position output for that one role. */
const WEB_LANE_OWNERS = new Set([
  'sal0-04',
  'sal0 04',
  'claude',
  'claude cli',
  'claude code',
  'web',
  'builder',
])

/**
 * Paths this executor must never modify, whatever an agent decided.
 * Secrets are listed by shape, not by name, because the next credential file
 * will have a name nobody predicted.
 */
const FORBIDDEN_PATH_PATTERNS = [
  // Another agent's repo.
  /SAL0MANDER-Puzzle-Prototype/i,
  // Git internals — history rewriting hides its own evidence.
  /(^|\/)\.git(\/|$)/,
  // Environment and credential files.
  /(^|\/)\.env($|\.)/,
  /(^|\/)auth\.json$/,
  /(^|\/)credentials?(\.|$)/i,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.netrc$/,
  /(^|\/)\.aws(\/|$)/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)id_(rsa|ed25519|ecdsa)/,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  // Anything under a home-level agent state directory.
  /(^|\/)\.(codex|claude|gemini)(\/|$)/,
  // CI configuration — a workflow edit is a permission change in disguise.
  /(^|\/)\.github\/workflows(\/|$)/,
]

/**
 * Command shapes that destroy work or change the machine's security posture.
 * Matched against the ACTION TEXT, so an action that merely describes doing
 * one of these is refused before a worker ever sees it.
 */
const DESTRUCTIVE_PATTERNS = [
  { pattern: /\brm\s+-[a-z]*[rf]/i, why: 'recursive or forced delete' },
  { pattern: /\bgit\s+reset\s+--hard/i, why: 'git reset --hard discards uncommitted work' },
  { pattern: /\bgit\s+clean\s+-[a-z]*[fd]/i, why: 'git clean deletes untracked files' },
  { pattern: /\bgit\s+checkout\s+(-f|--force)/i, why: 'forced checkout discards local changes' },
  { pattern: /\bgit\s+push\s+.*(--force|-f)\b/i, why: 'force push rewrites shared history' },
  { pattern: /\bgit\s+(rebase|filter-branch|reflog\s+expire)/i, why: 'history rewriting' },
  { pattern: /\bgit\s+remote\s+(add|set-url)/i, why: 'changing the remote redirects where work is pushed' },
  { pattern: /\bdrop\s+(table|database)\b/i, why: 'destructive database operation' },
  { pattern: /\bchmod\s+(777|a\+rwx)/i, why: 'world-writable permissions' },
  { pattern: /\bsudo\b/i, why: 'privilege escalation' },
  { pattern: /\bcurl\b[^\n]*\|\s*(ba)?sh/i, why: 'piping a download into a shell' },
  { pattern: /\bnpm\s+publish\b/i, why: 'publishing a package is outward-facing' },
  { pattern: /\blaunchctl\s+(load|unload|bootstrap)/i, why: 'changing scheduled system jobs' },
]

/** Actions that would move, print, or rotate credentials. */
const SECRET_PATTERNS = [
  { pattern: /\brotate\s+(the\s+)?(credential|key|token|secret)/i, why: 'credential rotation' },
  { pattern: /\b(print|echo|cat|log|expose|paste)\b[^\n]{0,40}\b(secret|token|api[_\s-]?key|password|credential)/i, why: 'printing a secret' },
  // No \b before the alternation: a word boundary cannot exist between a space
  // and a dot, so `\b\.env` never matches " .env" — which is how it is written
  // in every real sentence.
  { pattern: /\b(commit|add|check\s+in)\b[^\n]{0,40}(\.env\b|\bsecrets?\b|\btokens?\b|\bapi[_\s-]?keys?\b|\bcredentials?\b)/i, why: 'committing a secret' },
  { pattern: /\b(ANTHROPIC|OPENAI|GOOGLE|GITHUB)_[A-Z_]*(KEY|TOKEN|SECRET)\b/, why: 'naming a live credential variable' },
]

/** Minimum lengths below which a field cannot describe anything checkable. */
const MIN_ACTION_LENGTH = 12
const MIN_SUCCESS_CHECK_LENGTH = 12

/**
 * Phrases that look like a success check but cannot fail. A check that cannot
 * fail is not a check.
 */
const UNFALSIFIABLE_CHECKS = [
  /^it works$/i,
  /^done$/i,
  /^looks good$/i,
  /^no errors?$/i,
  /^(it )?should work$/i,
  /^complete[d]?$/i,
  /^success(ful)?$/i,
  /^verified$/i,
]

export const EXECUTE_OUTCOME = {
  COMMITTED: 'COMMITTED',
  NOTHING_CHANGED: 'NOTHING CHANGED',
  BLOCKED: 'BLOCKED - NEED OWNER',
  WRONG_LANE: 'WRONG LANE - REASSIGN',
  REFUSED: 'REFUSED',
}

export function isWebLane(owner) {
  if (owner === null || owner === undefined) return false
  return WEB_LANE_OWNERS.has(String(owner).trim().toLowerCase())
}

/** Paths the executor must not modify. Returns the offending subset. */
export function touchesForbiddenPath(files = []) {
  return files.filter((file) =>
    FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(String(file))),
  )
}

/** Destructive command shapes found in text. Returns every reason, not just the first. */
export function findDestructiveIntent(text) {
  const subject = String(text ?? '')
  return DESTRUCTIVE_PATTERNS.filter(({ pattern }) => pattern.test(subject)).map(({ why }) => why)
}

/** Credential handling found in text. */
export function findSecretIntent(text) {
  const subject = String(text ?? '')
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(subject)).map(({ why }) => why)
}

function isUnfalsifiable(check) {
  const trimmed = String(check ?? '').trim()
  return UNFALSIFIABLE_CHECKS.some((pattern) => pattern.test(trimmed))
}

/**
 * Decide whether an action may be executed. Pure, so every refusal rule is
 * testable without running anything.
 *
 * Gates run cheapest-and-most-absolute first: a wrong-lane action is never
 * examined for destructiveness, because it is not ours to examine.
 *
 * @returns {{allowed: boolean, outcome: string|null, reason: string}}
 */
export function screenAction(nextAction) {
  if (!nextAction || typeof nextAction !== 'object' || Array.isArray(nextAction)) {
    return refuse(EXECUTE_OUTCOME.REFUSED, 'no nextAction in position')
  }

  const { owner, action, successCheck } = nextAction

  // 1. Lane. Refuse, never reassign — reassigning is how work crosses a boundary
  //    nobody agreed to.
  if (!isWebLane(owner)) {
    return refuse(
      EXECUTE_OUTCOME.WRONG_LANE,
      `owner "${owner ?? 'unset'}" is not the ${EXECUTOR_ROLE} web lane — reassign, do not execute`,
    )
  }

  // 2. Concreteness. A vague action produces a document, not a diff.
  const actionText = String(action ?? '').trim()
  if (actionText.length < MIN_ACTION_LENGTH) {
    return refuse(EXECUTE_OUTCOME.REFUSED, 'action is empty or too vague to execute')
  }

  // 3. Falsifiability. Without a check that can fail, nobody can tell afterwards
  //    whether the run did anything.
  const checkText = String(successCheck ?? '').trim()
  // Ordered before the length gate: "it works" and "done" are short AND
  // unfalsifiable, and the specific reason is the more useful one to report.
  if (isUnfalsifiable(checkText)) {
    return refuse(
      EXECUTE_OUTCOME.REFUSED,
      `successCheck "${checkText}" cannot fail, so it is not a check`,
    )
  }
  if (checkText.length < MIN_SUCCESS_CHECK_LENGTH) {
    return refuse(EXECUTE_OUTCOME.REFUSED, 'action has no falsifiable successCheck')
  }

  // 4. Destructive intent, in either field.
  const destructive = [...findDestructiveIntent(actionText), ...findDestructiveIntent(checkText)]
  if (destructive.length > 0) {
    return refuse(
      EXECUTE_OUTCOME.REFUSED,
      `destructive action refused (${[...new Set(destructive)].join('; ')}) — owner decision, not an automated one`,
    )
  }

  // 5. Credentials. Never, under any framing.
  const secrets = [...findSecretIntent(actionText), ...findSecretIntent(checkText)]
  if (secrets.length > 0) {
    return refuse(
      EXECUTE_OUTCOME.REFUSED,
      `credential handling refused (${[...new Set(secrets)].join('; ')})`,
    )
  }

  // 6. Paths named in the action itself, before a worker is ever started.
  const namedForbidden = touchesForbiddenPath([actionText])
  if (namedForbidden.length > 0) {
    return refuse(EXECUTE_OUTCOME.REFUSED, 'action names a forbidden path (other repo, secrets, git internals, or CI config)')
  }

  return { allowed: true, outcome: null, reason: 'in lane, concrete, falsifiable, non-destructive' }
}

function refuse(outcome, reason) {
  return { allowed: false, outcome, reason }
}

/**
 * The prompt handed to a worker, if one is ever wired. Deliberately narrow: one
 * action, the repo's own rules, and an explicit ban on scope creep. A worker
 * given a vague brief writes a document; a worker given one action writes a diff.
 */
export function buildExecutePrompt(nextAction, packetSummary) {
  return `You are the SAL0MANder web worker (${EXECUTOR_ROLE}). Do ONE thing and stop.

THE ACTION:
${nextAction.action}

HOW WE WILL KNOW IT WORKED:
${nextAction.successCheck}

RULES:
- Work only in this repo. Never touch /Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype.
- Read CLAUDE.md and docs/CHARTER-WEB-POINT-PERSON.md first. They bind you.
- Change code. Do not write a proposal, a review, or a plan document.
- Do not expand scope. One action. If you finish early, stop.
- Never read, print, move, or commit secrets, tokens, .env files, or auth files.
- Never run destructive git commands: no reset --hard, clean -fd, checkout -f,
  rebase, force push, or remote changes.
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
 * One line describing what happened, in a shape that cannot be misread as
 * success when it was not.
 */
export function describeOutcome({ outcome, filesChanged = [], commit = null, reason = '' } = {}) {
  const fileList = filesChanged.slice(0, 5).join(', ')
  const more = filesChanged.length > 5 ? ` (+${filesChanged.length - 5} more)` : ''

  switch (outcome) {
    case EXECUTE_OUTCOME.COMMITTED:
      return `COMMITTED ${commit ? commit.slice(0, 8) : 'unknown'} — verify passed, ${filesChanged.length} file(s): ${fileList}${more}`
    case EXECUTE_OUTCOME.NOTHING_CHANGED:
      return 'NOTHING CHANGED — the worker ran and produced no diff. Nothing was committed.'
    case EXECUTE_OUTCOME.BLOCKED:
      return `BLOCKED - NEED OWNER — ${reason}. Nothing committed; the working tree is left as-is on purpose so you can read the diff.`
    case EXECUTE_OUTCOME.WRONG_LANE:
      return `WRONG LANE - REASSIGN — ${reason}. Not executed, not reassigned.`
    case EXECUTE_OUTCOME.REFUSED:
      return `REFUSED — ${reason}. No worker was started.`
    default:
      return `REFUSED — unrecognised outcome "${outcome}". Treated as a refusal.`
  }
}
