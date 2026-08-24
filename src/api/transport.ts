import type { z } from 'zod'
import { ApiError, apiErrorFromResponse } from './errors'

/**
 * The single seam between the app and any backend.
 *
 * Everything above this line (endpoints, hooks, UI) depends only on the
 * `Transport` interface. Swapping the mock for a real backend — or one managed
 * provider for another — means writing one new implementation, not touching
 * feature code. This is the "clean provider boundary" the architecture calls
 * for.
 */

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  /** Makes a write retry-safe: repeating the key must not repeat the effect. */
  idempotencyKey?: string
  signal?: AbortSignal
  /** Bearer-ish token; guest tokens are NOT sent here (they aren't auth). */
  authToken?: string
}

export interface Transport {
  request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T>
}

export type HttpTransportConfig = {
  baseUrl: string
  contractVersion: string
  timeoutMs: number
  /** Attempts for retryable failures, including the first. */
  maxAttempts?: number
  /** Required for a cross-origin endpoint protected by an existing browser session. */
  credentials?: RequestCredentials
}

const RETRY_BASE_DELAY_MS = 250

export function createHttpTransport(config: HttpTransportConfig): Transport {
  const maxAttempts = config.maxAttempts ?? 3

  return {
    async request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T> {
      const url = buildUrl(config.baseUrl, options.path, options.query)
      let lastError: ApiError | null = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const payload = await sendOnce(url, options, config)
          const parsed = schema.safeParse(payload)
          if (!parsed.success) {
            // A shape we don't understand is a contract problem, not a blip —
            // retrying would just fail identically.
            throw new ApiError({
              code: 'contract_mismatch',
              message: `Response did not match the ${config.contractVersion} contract for ${options.path}`,
              details: { issues: parsed.error.issues },
            })
          }
          return parsed.data
        } catch (error) {
          const apiError = toApiError(error)
          lastError = apiError
          // Only retry idempotent-safe calls: GETs, or writes carrying a key.
          const safeToRetry =
            apiError.retryable &&
            (options.method === undefined ||
              options.method === 'GET' ||
              Boolean(options.idempotencyKey))
          if (!safeToRetry || attempt === maxAttempts) throw apiError
          await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
        }
      }

      throw lastError ?? new ApiError({ code: 'unknown', message: 'Request failed' })
    },
  }
}

async function sendOnce(
  url: string,
  options: RequestOptions,
  config: HttpTransportConfig,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), config.timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-SAL0MANder-Contract': config.contractVersion,
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  if (options.authToken) headers['Authorization'] = `Bearer ${options.authToken}`

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      ...(config.credentials ? { credentials: config.credentials } : {}),
    })

    if (!response.ok) {
      throw await apiErrorFromResponse(response)
    }
    if (response.status === 204) return undefined
    return await response.json()
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (isAbort(error)) {
      throw new ApiError({ code: 'timeout', message: 'The request timed out' })
    }
    throw new ApiError({
      code: 'network_error',
      message: error instanceof Error ? error.message : 'Network request failed',
    })
  } finally {
    clearTimeout(timer)
  }
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError({
    code: 'unknown',
    message: error instanceof Error ? error.message : String(error),
  })
}

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, String(value))
  }
  const qs = search.toString()
  return `${base}${suffix}${qs ? `?${qs}` : ''}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
