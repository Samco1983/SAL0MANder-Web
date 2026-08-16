import { ApiErrorBodySchema, type ApiErrorCode, isRetryable } from '@contracts/v1'

/** Single error type crossing the API boundary, so callers catch one thing. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null
  readonly requestId: string | undefined
  readonly details: Record<string, unknown> | undefined

  constructor(init: {
    code: ApiErrorCode
    message: string
    status?: number | null
    requestId?: string
    details?: Record<string, unknown>
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status ?? null
    this.requestId = init.requestId
    this.details = init.details
  }

  get retryable(): boolean {
    return isRetryable(this.code)
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

export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = {}
  }
  const parsed = ApiErrorBodySchema.safeParse(body)
  const fallbackCode = statusToCode(response.status)
  return new ApiError({
    code: parsed.success && parsed.data.code !== 'unknown' ? parsed.data.code : fallbackCode,
    message: parsed.success && parsed.data.message ? parsed.data.message : response.statusText,
    status: response.status,
    ...(parsed.success && parsed.data.requestId ? { requestId: parsed.data.requestId } : {}),
    ...(parsed.success && parsed.data.details ? { details: parsed.data.details } : {}),
  })
}

function statusToCode(status: number): ApiErrorCode {
  if (status === 400) return 'bad_request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server_error'
  return 'unknown'
}
