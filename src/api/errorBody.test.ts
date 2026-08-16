import { describe, expect, it } from 'vitest'
import { apiErrorFromResponse } from './errors'

/**
 * The error parser must survive the envelope decision landing either way.
 *
 * The envelope is review-ready, not frozen. Reading only the flat shape lost
 * requestId, message and details on every enveloped error — silently, because
 * the schema's `.catch()`/`.default()` made the failed parse look successful.
 */

function res(status: number, body: unknown, statusText = `HTTP ${status}`): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => body,
  } as unknown as Response
}

const FLAT = {
  code: 'conflict',
  message: 'key reused with a different body',
  requestId: 'req_01j5a89',
  details: { key: 'k1' },
}

const ENVELOPED = {
  contractVersion: '1.0.0',
  success: false,
  error: {
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'The provided Idempotency-Key was previously used with a different request payload.',
    retryable: false,
    details: { key: 'k1' },
  },
  meta: { requestId: 'req_01j5a89', timestampUtc: '2026-08-16T02:30:00Z' },
}

describe('flat error bodies', () => {
  it('reads every field', async () => {
    const error = await apiErrorFromResponse(res(409, FLAT))
    expect(error.code).toBe('conflict')
    expect(error.message).toBe('key reused with a different body')
    expect(error.requestId).toBe('req_01j5a89')
    expect(error.details).toEqual({ key: 'k1' })
  })
})

describe('enveloped error bodies', () => {
  it('reads the fields out of error.* and meta.* instead of losing them', async () => {
    const error = await apiErrorFromResponse(res(409, ENVELOPED))

    // The regression: this was previously the HTTP status text.
    expect(error.message).toContain('Idempotency-Key')
    // The support-ticket identifier, previously dropped on every error.
    expect(error.requestId).toBe('req_01j5a89')
    expect(error.details).toEqual({ key: 'k1' })
  })

  it('preserves a server code that has no member in our enum', async () => {
    const error = await apiErrorFromResponse(res(409, ENVELOPED))
    // Collapses to a generic conflict for branching...
    expect(error.code).toBe('conflict')
    // ...but the specific signal survives for logging.
    expect(error.serverCode).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('matches shared codes despite SCREAMING_SNAKE casing', async () => {
    // The status must disagree with the code, or the status fallback returns
    // the right answer by accident and the test proves nothing about casing.
    // codeFromStatus(400) is 'bad_request'; only normalization yields 'conflict'.
    const error = await apiErrorFromResponse(
      res(400, { success: false, error: { code: 'CONFLICT', message: 'already published' } }),
    )
    expect(error.code).toBe('conflict')
    expect(error.serverCode).toBe('CONFLICT')
  })

  it('honours the server retryability verdict over the derived table', async () => {
    // A permanent 500 the server knows is not worth retrying.
    const error = await apiErrorFromResponse(
      res(500, { success: false, error: { code: 'SERVER_ERROR', message: 'x', retryable: false } }),
    )
    expect(error.code).toBe('server_error')
    expect(error.retryable).toBe(false)
  })

  it('falls back to the derived table when no verdict is sent', async () => {
    const error = await apiErrorFromResponse(res(503, {}))
    expect(error.retryable).toBe(true)
  })
})

describe('degenerate bodies', () => {
  it('falls back to the status mapping for an empty body', async () => {
    const error = await apiErrorFromResponse(res(404, {}, 'Not Found'))
    expect(error.code).toBe('not_found')
    expect(error.message).toBe('Not Found')
    expect(error.serverCode).toBeUndefined()
  })

  it('survives a body that is not an object', async () => {
    for (const body of [null, 'a string', 42, []]) {
      const error = await apiErrorFromResponse(res(500, body))
      expect(error.code).toBe('server_error')
    }
  })

  it('survives an unparseable body', async () => {
    const broken = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('not json')
      },
    } as unknown as Response
    const error = await apiErrorFromResponse(broken)
    expect(error.code).toBe('server_error')
    expect(error.message).toBe('Bad Gateway')
  })

  it('never leaks a server message into user-facing copy', async () => {
    const error = await apiErrorFromResponse(
      res(404, { success: false, error: { code: 'NOT_FOUND', message: 'pg: no such row' } }),
    )
    expect(error.message).toContain('pg:')
    expect(error.userMessage).not.toContain('pg:')
  })
})
