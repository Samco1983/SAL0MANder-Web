import { z } from 'zod'

/**
 * One canonical error shape for the whole API.
 *
 * `code` is a stable machine-readable token the UI branches on; `message` is
 * for developers and may change freely. User-facing copy is chosen by the UI
 * from `code` — never by echoing a server string into a student's screen.
 */
export const ApiErrorCodeSchema = z.enum([
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'contract_mismatch',
  'server_error',
  'network_error',
  'timeout',
  'unknown',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorBodySchema = z.object({
  code: ApiErrorCodeSchema.catch('unknown'),
  message: z.string().default(''),
  requestId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>

/** Maps transport status codes onto the canonical vocabulary. */
export function codeFromStatus(status: number): ApiErrorCode {
  if (status === 400) return 'bad_request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server_error'
  return 'unknown'
}

/** Transient failures worth retrying with backoff; the rest are terminal. */
export function isRetryable(code: ApiErrorCode): boolean {
  return (
    code === 'network_error' ||
    code === 'timeout' ||
    code === 'rate_limited' ||
    code === 'server_error'
  )
}
