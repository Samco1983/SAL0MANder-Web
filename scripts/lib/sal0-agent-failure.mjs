/**
 * Attribution of agent failures.
 *
 * The rule this file exists to enforce: an infrastructure failure must never be
 * recorded as an agent's judgment. A CLI that is logged out, timed out, or
 * blocked by a tool policy produces output that reads like a hesitant or
 * refusing model. If the supervisor records that as a POSITION or a CRITIQUE,
 * the council has laundered a broken machine into an opinion.
 *
 * Gemini makes this concrete: in non-interactive mode its policy engine treats
 * `ask_user` as `deny`, so a headless run silently loses every tool whose rule
 * would have prompted, and answers as if it simply chose not to look.
 */
export const ATTRIBUTION = {
  INFRASTRUCTURE: 'infrastructure',
  MODEL: 'model',
}

export const FAILURE = {
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_AUTH: 'AGENT_AUTH',
  TOOL_POLICY_DENIED: 'TOOL_POLICY_DENIED',
  AGENT_INVALID_INPUT: 'AGENT_INVALID_INPUT',
  AGENT_TURN_LIMIT: 'AGENT_TURN_LIMIT',
  AGENT_EXIT_NONZERO: 'AGENT_EXIT_NONZERO',
  OUTPUT_EMPTY: 'OUTPUT_EMPTY',
  OUTPUT_UNPARSEABLE: 'OUTPUT_UNPARSEABLE',
  OUTPUT_SCHEMA_INVALID: 'OUTPUT_SCHEMA_INVALID',
}

/**
 * Only these three mean "the model produced something and it was wrong".
 * Everything else means the machine failed before the model's judgment counted.
 */
const MODEL_ATTRIBUTABLE = new Set([
  FAILURE.OUTPUT_EMPTY,
  FAILURE.OUTPUT_UNPARSEABLE,
  FAILURE.OUTPUT_SCHEMA_INVALID,
])

export function isModelAttributable(failureClass) {
  return MODEL_ATTRIBUTABLE.has(failureClass)
}

export function attributionOf(failureClass) {
  return isModelAttributable(failureClass) ? ATTRIBUTION.MODEL : ATTRIBUTION.INFRASTRUCTURE
}

const AUTH_PATTERNS = [
  /not logged in/i,
  /please (?:run )?login/i,
  /unauthori[sz]ed/i,
  /authentication (?:failed|required)/i,
  /invalid api key/i,
  /expired (?:token|credential)/i,
  /\b401\b/,
]

const POLICY_PATTERNS = [
  /denied by policy/i,
  /policy (?:engine )?deni(?:ed|es)/i,
  /tool .*(?:is )?(?:not allowed|blocked|denied)/i,
  /permission denied by (?:the )?policy/i,
]

/**
 * Documented Gemini CLI headless exit codes. Verified against upstream
 * docs/cli/headless.md on 2026-08-18: 0 success, 1 general error, 42 invalid
 * input, 53 turn limit exceeded.
 */
const EXIT_CODE_CLASSES = {
  42: FAILURE.AGENT_INVALID_INPUT,
  53: FAILURE.AGENT_TURN_LIMIT,
}

/**
 * Classify a failed CLI invocation. Never returns a model attribution — by
 * construction, a process-level failure is always infrastructure.
 *
 * @param {object} result { error, status, signal, stderr, timedOut }
 */
export function classifyAgentFailure({ error, status, signal, stderr = '', timedOut = false } = {}) {
  const detail = String(stderr || '').trim()

  if (error?.code === 'ENOENT') {
    return build(FAILURE.AGENT_NOT_FOUND, 'CLI binary not found on PATH', detail)
  }
  if (timedOut || error?.code === 'ETIMEDOUT') {
    return build(FAILURE.AGENT_TIMEOUT, 'CLI exceeded its timeout', detail)
  }
  if (POLICY_PATTERNS.some((pattern) => pattern.test(detail))) {
    return build(FAILURE.TOOL_POLICY_DENIED, 'a tool call was blocked by policy, not by the model', detail)
  }
  if (AUTH_PATTERNS.some((pattern) => pattern.test(detail))) {
    return build(FAILURE.AGENT_AUTH, 'CLI is not authenticated', detail)
  }
  if (Number.isInteger(status) && EXIT_CODE_CLASSES[status]) {
    return build(EXIT_CODE_CLASSES[status], `CLI exited ${status}`, detail)
  }
  if (signal) {
    return build(FAILURE.AGENT_EXIT_NONZERO, `CLI killed by ${signal}`, detail)
  }

  return build(
    FAILURE.AGENT_EXIT_NONZERO,
    `CLI exited ${Number.isInteger(status) ? status : 'abnormally'}`,
    detail || error?.message || '',
  )
}

/**
 * Some CLIs report an in-run failure as their *result on stdout* rather than on
 * stderr with a non-zero exit — Claude Code documents exactly this for missing
 * authentication. Without this check, an unauthenticated CLI produces prose on
 * stdout, fails to parse, and gets filed as the model's judgment. Scan stdout
 * for the same infrastructure signals before attributing anything to a model.
 */
export function detectInfrastructureInOutput(raw) {
  const text = String(raw || '')
  if (!text.trim()) return null
  if (POLICY_PATTERNS.some((pattern) => pattern.test(text))) {
    return build(FAILURE.TOOL_POLICY_DENIED, 'stdout reports a policy block, not a model answer', text.slice(0, 400))
  }
  if (AUTH_PATTERNS.some((pattern) => pattern.test(text))) {
    return build(FAILURE.AGENT_AUTH, 'stdout reports an auth failure, not a model answer', text.slice(0, 400))
  }
  return null
}

/** Classify output that the model did produce. These are model-attributable. */
export function classifyOutputFailure(raw, { schemaError } = {}) {
  if (!raw || !String(raw).trim()) {
    return build(FAILURE.OUTPUT_EMPTY, 'agent returned no output', '')
  }

  // Infrastructure masquerading as an answer wins over any model attribution.
  const masked = detectInfrastructureInOutput(raw)
  if (masked) return masked

  if (schemaError) {
    return build(FAILURE.OUTPUT_SCHEMA_INVALID, 'output parsed but failed its schema', String(schemaError))
  }
  return build(FAILURE.OUTPUT_UNPARSEABLE, 'output contained no JSON object', String(raw).slice(0, 400))
}

function build(failureClass, summary, detail) {
  return {
    failureClass,
    attribution: attributionOf(failureClass),
    summary,
    detail,
  }
}
