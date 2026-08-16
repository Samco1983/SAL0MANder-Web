import { ApiErrorBodySchema, codeFromStatus, type ApiErrorCode, isRetryable } from '@contracts/v1'

/** Single error type crossing the API boundary, so callers catch one thing. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null
  readonly requestId: string | undefined
  readonly details: Record<string, unknown> | undefined
  /**
   * The raw `code` string the server sent, before it was mapped onto our enum.
   *
   * Preserved because the server's vocabulary is wider than ours and still
   * being negotiated: `IDEMPOTENCY_CONFLICT` has no member here yet and would
   * otherwise collapse into a generic `conflict`, making a client-side key
   * reuse bug indistinguishable from a domain conflict. Keeping the original
   * costs nothing and keeps the signal available for logging until the shared
   * vocabulary is settled.
   */
  readonly serverCode: string | undefined
  /** Server's own retryability verdict, when it sent one. */
  private readonly serverRetryable: boolean | undefined

  constructor(init: {
    code: ApiErrorCode
    message: string
    status?: number | null
    requestId?: string
    details?: Record<string, unknown>
    serverCode?: string
    retryable?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status ?? null
    this.requestId = init.requestId
    this.details = init.details
    this.serverCode = init.serverCode
    this.serverRetryable = init.retryable
  }

  /**
   * The server's verdict wins when it sent one — only it knows whether a given
   * 500 is permanent. The derived table is the fallback, and the only source
   * for client-synthesized failures (network, timeout) that never had a
   * response.
   *
   * This does NOT decide whether a write is re-sent. `transport.ts` gates that
   * separately on method and idempotency key, so a server claiming `retryable`
   * can never cause an unkeyed POST to be repeated and double-count a
   * student's completion.
   */
  get retryable(): boolean {
    return this.serverRetryable ?? isRetryable(this.code)
  }

  /**
   * User-facing copy is chosen from the stable `code`, never from the server's
   * `message` — server strings are developer-oriented and may leak internals.
   */
  get userMessage(): string {
    switch (this.code) {
      case 'not_found':
        return "We couldn't find that activity. The link may be old or the teacher may have unpublished it."
      case 'unauthorized':
      case 'forbidden':
        return "You don't have access to this yet."
      case 'rate_limited':
        return 'A lot of people are playing right now. Give it a moment and try again.'
      case 'network_error':
      case 'timeout':
        return 'We had trouble reaching SAL0MANder. Check your connection and try again.'
      case 'contract_mismatch':
        return 'This version of SAL0MANder needs to be refreshed.'
      default:
        return 'Something went wrong on our side. Please try again.'
    }
  }
}

/**
 * The fields we care about, wherever the server chose to put them.
 *
 * Two shapes are in play and the envelope is not frozen: today's flat body
 * (`{ code, message, requestId, details }`) and the proposed enveloped one
 * (`{ contractVersion, success: false, error: {...}, meta: { requestId } }`).
 *
 * Reading only the flat shape was a silent-data-loss bug waiting to ship: under
 * the envelope every field misses, and because `code` has `.catch()` and
 * `message` has `.default('')` the parse still "succeeds". Measured against the
 * proposed body, `message` became the HTTP status text and `requestId` and
 * `details` became undefined — losing the identifier a teacher would quote to
 * support, on every error, with no signal that anything was wrong.
 *
 * Accepting both is deliberately NOT a decision about which envelope wins. It
 * is tolerance, so the client cannot be broken by that decision landing.
 */
type ErrorFields = {
  code: string | undefined
  message: string | undefined
  requestId: string | undefined
  details: Record<string, unknown> | undefined
  retryable: boolean | undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const asString = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const asRecord = (v: unknown) => (isRecord(v) ? v : undefined)

function extractErrorFields(body: unknown): ErrorFields {
  const root = asRecord(body) ?? {}
  // Enveloped errors nest under `error`; flat ones live at the root.
  const source = asRecord(root.error) ?? root
  const meta = asRecord(root.meta) ?? {}

  return {
    code: asString(source.code),
    message: asString(source.message),
    // `meta.requestId` (enveloped) or a sibling of `code` (flat).
    requestId: asString(meta.requestId) ?? asString(source.requestId) ?? asString(root.requestId),
    details: asRecord(source.details),
    retryable: typeof source.retryable === 'boolean' ? source.retryable : undefined,
  }
}

/**
 * Maps a server code string onto our enum, tolerating case.
 *
 * The wire vocabulary is SCREAMING_SNAKE in the current proposals while ours is
 * lowercase; that casing question is still open. Normalizing here means the
 * codes we *do* share resolve correctly either way, and the ones we don't fall
 * through to the status mapping rather than being mistaken for something else.
 */
function toContractCode(raw: string | undefined): ApiErrorCode | undefined {
  if (!raw) return undefined
  const parsed = ApiErrorBodySchema.shape.code.safeParse(raw.toLowerCase())
  if (!parsed.success || parsed.data === 'unknown') return undefined
  return parsed.data
}

export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  const fields = extractErrorFields(body)
  // The contract owns this mapping; a second copy here would drift from it.
  const fallbackCode = codeFromStatus(response.status)

  return new ApiError({
    code: toContractCode(fields.code) ?? fallbackCode,
    message: fields.message ?? response.statusText,
    status: response.status,
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    ...(fields.details ? { details: fields.details } : {}),
    ...(fields.code ? { serverCode: fields.code } : {}),
    ...(fields.retryable !== undefined ? { retryable: fields.retryable } : {}),
  })
}
