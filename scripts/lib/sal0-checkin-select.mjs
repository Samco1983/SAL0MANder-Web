/**
 * Which hub comment is a check-in request, and what does it say.
 *
 * Split out of `sal0-checkin-monitor.mjs` because selection and parsing are the
 * part that decides what a human — or under `--override`, another agent — is
 * handed. Three defects found in the 2026-08-19 review of `f5f55c9` all lived
 * here, and none was reachable by a test while the logic sat inside a script
 * that ran `main()` on import.
 *
 * The rules, and why each is a rule:
 *
 * - Selection is on `CHECK_IN_REQUEST` alone. `ACTION REQUIRED` is a *status*
 *   word that every supervisor post carries; including it matched 46 of 175 hub
 *   comments, 38 of them false, and buried the first genuine request at queue
 *   position 25.
 * - Field boundaries come from a closed vocabulary, not a generic `\w+:` shape.
 *   A bare URL line (`https://…`) matches the generic shape and silently ate
 *   the rest of the request.
 * - The author must be trusted. Only the repo being private kept arbitrary text
 *   out of this queue, and an ACL is not a property of the tool.
 */

/** The one marker that means "this is dispatcher-ready work". */
export const REQUEST_MARKER = 'CHECK_IN_REQUEST'

/** The one marker that means "already handled", independent of local state. */
export const PROCESSED_MARKER = 'CHECK_IN_PROCESSED'

/**
 * The complete envelope vocabulary, from `CHECKIN-MONITOR.md`. A line only ends
 * the preceding field if it starts with one of these. Anything else — prose,
 * URLs, markdown, a pasted log — belongs to the field it appears in.
 */
export const ENVELOPE_FIELDS = ['Lane', 'Request', 'Expected evidence']

/**
 * The same trusted-author rule the Unity lane's selector already applies
 * (`author:Samco1983` in `OVERNIGHT_SHIFT.md`). Every agent posts to the hub
 * through this account, so the filter costs nothing and closes the queue.
 */
export const DEFAULT_TRUSTED_AUTHORS = ['Samco1983']

export const VALID_LANES = new Set(['Game', 'Unity', 'Web', 'Website', 'Seam', 'Coordination'])

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const FIELD_BOUNDARY = new RegExp(
  `^(?:${ENVELOPE_FIELDS.map(escapeRegExp).join('|')}):\\s*`,
  'im',
)

/**
 * Read the allowlist from the environment, falling back to the default.
 *
 * An empty or whitespace-only `SAL0_TRUSTED_AUTHORS` falls back rather than
 * emptying the list. "No authors configured" must never read as "trust anyone".
 */
export function trustedAuthors(env = process.env) {
  const parsed = String(env.SAL0_TRUSTED_AUTHORS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return parsed.length ? parsed : DEFAULT_TRUSTED_AUTHORS
}

/** A comment with no resolvable author is not trusted. */
export function isTrustedAuthor(comment, authors = DEFAULT_TRUSTED_AUTHORS) {
  const login = comment?.user?.login
  if (!login) return false
  return authors.some((author) => author.toLowerCase() === login.toLowerCase())
}

/**
 * The oldest request that is trusted, marked, unprocessed and unseen.
 * Returns `undefined` when the queue is empty.
 */
export function oldestPending(comments, state = {}, options = {}) {
  const seen = new Set(state.seenCommentIds || [])
  const authors = options.trustedAuthors || DEFAULT_TRUSTED_AUTHORS

  return comments
    .filter((comment) => isTrustedAuthor(comment, authors))
    .filter((comment) => comment.body?.includes(REQUEST_MARKER))
    .filter((comment) => !comment.body?.includes(PROCESSED_MARKER))
    .filter((comment) => !seen.has(comment.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
}

/**
 * Read one envelope field, from its label to the next known label or the end of
 * the body — whichever comes first.
 */
export function readField(body, fieldName) {
  const fieldStart = new RegExp(`^${escapeRegExp(fieldName)}:\\s*(.*)$`, 'im')
  const match = String(body || '').match(fieldStart)
  if (!match || match.index === undefined) return ''

  const firstLine = match[1]?.trim() || ''
  const afterField = String(body).slice(match.index + match[0].length)
  const nextField = afterField.search(FIELD_BOUNDARY)
  const rest = nextField >= 0 ? afterField.slice(0, nextField) : afterField
  return [firstLine, rest.trim()].filter(Boolean).join('\n').trim()
}

export function parseEnvelope(body) {
  const marker = String(body || '').includes(REQUEST_MARKER) ? REQUEST_MARKER : ''
  const lane = readField(body, 'Lane')
  const request = readField(body, 'Request')
  const expectedEvidence = readField(body, 'Expected evidence')

  const problems = []
  if (marker !== REQUEST_MARKER) {
    problems.push('use CHECK_IN_REQUEST for dispatcher-ready work')
  }
  if (!VALID_LANES.has(lane)) {
    problems.push(`Lane must be one of: ${[...VALID_LANES].join(', ')}`)
  }
  if (!request) {
    problems.push('Request field is required')
  }

  return {
    marker,
    lane,
    request,
    expectedEvidence,
    isStructured: problems.length === 0,
    problems,
  }
}
