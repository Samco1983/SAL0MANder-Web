import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createHttpTransport } from './transport'
import { ApiError } from './errors'

/**
 * Retry behavior for the real HTTP transport.
 *
 * This is the code that decides whether a write is sent twice. A student's
 * completion being double-counted is the exact failure D-007 exists to prevent,
 * and the guard lives here rather than in the contract — so it is tested here.
 */

const OkSchema = z.object({ ok: z.boolean() })

type FakeResponse = {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
}

function respond(status: number, body: unknown = {}): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => body,
  }
}

/** Replays a scripted sequence of responses, one per call. */
function stubFetch(...script: Array<FakeResponse | Error>) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = script.shift()
    if (next === undefined) throw new Error('fetch called more times than scripted')
    if (next instanceof Error) throw next
    return next as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

type FetchMock = ReturnType<typeof stubFetch>

/** Reads one recorded call, failing loudly rather than asserting on undefined. */
function callArgs(fetchMock: FetchMock, index = 0) {
  const call = fetchMock.mock.calls[index]
  if (!call) throw new Error(`fetch was not called ${index + 1} time(s)`)
  const [url, init] = call
  return { url, init, headers: (init?.headers ?? {}) as Record<string, string> }
}

const transport = (maxAttempts = 3) =>
  createHttpTransport({
    baseUrl: 'https://api.example.com',
    contractVersion: 'v1',
    timeoutMs: 5_000,
    maxAttempts,
  })

/**
 * Backoff sleeps on real timers, so retry tests drive fake ones. Awaiting the
 * request promise and advancing the clock must interleave, hence
 * `advanceTimersByTimeAsync`.
 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const raced = promise.catch((error: unknown) => ({ __error: error }) as never)
  await vi.advanceTimersByTimeAsync(10_000)
  const value = (await raced) as T & { __error?: unknown }
  if (value && typeof value === 'object' && '__error' in value) throw value.__error
  return value
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('retrying reads', () => {
  it('retries a GET through a transient failure', async () => {
    const fetchMock = stubFetch(respond(503), respond(200, { ok: true }))
    const result = await settle(transport().request({ path: '/x' }, OkSchema))

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after maxAttempts and surfaces the last error', async () => {
    const fetchMock = stubFetch(respond(503), respond(503), respond(503))
    await expect(settle(transport(3).request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'server_error',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a terminal failure', async () => {
    const fetchMock = stubFetch(respond(404))
    await expect(settle(transport().request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'not_found',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('backs off exponentially rather than hammering a struggling server', async () => {
    // Real timers here on purpose. Under fake timers `settle` advances the
    // clock by a fixed amount, so a Date.now() delta measures the advance
    // rather than the backoff and passes even with the delay set to zero.
    vi.useRealTimers()
    stubFetch(respond(503), respond(503), respond(200, { ok: true }))

    const started = performance.now()
    await transport(3).request({ path: '/x' }, OkSchema)
    const elapsed = performance.now() - started

    // 250ms then 500ms, with slack for timer imprecision.
    expect(elapsed).toBeGreaterThanOrEqual(700)
    expect(elapsed).toBeLessThan(3_000)
  })
})

describe('authenticated browser boundary', () => {
  it('includes an existing access session only when the transport asks for it', async () => {
    const fetchMock = stubFetch(respond(200, { ok: true }))
    const protectedTransport = createHttpTransport({
      baseUrl: 'https://ops.example.com',
      contractVersion: 'v1',
      timeoutMs: 5_000,
      credentials: 'include',
    })

    await protectedTransport.request({ path: '/ops/missions' }, OkSchema)
    expect(callArgs(fetchMock).init?.credentials).toBe('include')
  })
})

describe('retrying writes — the double-write guard', () => {
  it('never retries a POST without an idempotency key', async () => {
    // Retrying here could complete a student's session twice.
    const fetchMock = stubFetch(respond(503), respond(200, { ok: true }))
    await expect(
      settle(transport().request({ method: 'POST', path: '/sessions', body: {} }, OkSchema)),
    ).rejects.toMatchObject({ code: 'server_error' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a POST that carries an idempotency key', async () => {
    const fetchMock = stubFetch(respond(503), respond(200, { ok: true }))
    const result = await settle(
      transport().request(
        { method: 'POST', path: '/sessions', body: {}, idempotencyKey: 'key-1' },
        OkSchema,
      ),
    )
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reuses the same key on every attempt, so the server can dedupe', async () => {
    const fetchMock = stubFetch(respond(503), respond(200, { ok: true }))
    await settle(
      transport().request(
        { method: 'POST', path: '/sessions', body: {}, idempotencyKey: 'key-1' },
        OkSchema,
      ),
    )
    const keys = [callArgs(fetchMock, 0), callArgs(fetchMock, 1)].map(
      ({ headers }) => headers['Idempotency-Key'],
    )
    expect(keys).toEqual(['key-1', 'key-1'])
  })
})

describe('contract enforcement', () => {
  it('raises contract_mismatch for an unparseable payload', async () => {
    stubFetch(respond(200, { totallyDifferent: 1 }))
    await expect(settle(transport().request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'contract_mismatch',
    })
  })

  it('does not retry a contract mismatch — a retry would fail identically', async () => {
    const fetchMock = stubFetch(respond(200, { nope: 1 }), respond(200, { ok: true }))
    await expect(settle(transport().request({ path: '/x' }, OkSchema))).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats 204 as an empty body rather than a parse failure', async () => {
    stubFetch({ ...respond(204), json: async () => throwIfCalled() })
    const EmptySchema = z.undefined()
    await expect(settle(transport().request({ path: '/x' }, EmptySchema))).resolves.toBeUndefined()
  })
})

function throwIfCalled(): never {
  throw new Error('json() must not be read on a 204')
}

describe('request shape', () => {
  it('sends the contract version so the server can detect drift', async () => {
    const fetchMock = stubFetch(respond(200, { ok: true }))
    await settle(transport().request({ path: '/x' }, OkSchema))

    const { url, headers } = callArgs(fetchMock)
    expect(url).toBe('https://api.example.com/x')
    expect(headers['X-SAL0MANder-Contract']).toBe('v1')
    expect(headers['Accept']).toBe('application/json')
    // No body, so no Content-Type.
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('sets Content-Type and serializes only when there is a body', async () => {
    const fetchMock = stubFetch(respond(200, { ok: true }))
    await settle(
      transport().request({ method: 'POST', path: '/x', body: { a: 1 }, idempotencyKey: 'k' }, OkSchema),
    )
    const { headers, init } = callArgs(fetchMock)
    expect(headers['Content-Type']).toBe('application/json')
    expect(init?.body).toBe('{"a":1}')
  })

  it('sends an auth token as a bearer credential when one is supplied', async () => {
    const fetchMock = stubFetch(respond(200, { ok: true }))
    await settle(transport().request({ path: '/x', authToken: 'tok' }, OkSchema))
    expect(callArgs(fetchMock).headers['Authorization']).toBe('Bearer tok')
  })

  it('omits Authorization entirely for an anonymous guest read', async () => {
    // Guest tokens are not authentication and must never travel as one.
    const fetchMock = stubFetch(respond(200, { ok: true }))
    await settle(transport().request({ path: '/guest/activities/abc' }, OkSchema))
    expect(callArgs(fetchMock).headers['Authorization']).toBeUndefined()
  })

  it('appends query parameters', async () => {
    const fetchMock = stubFetch(respond(200, { ok: true }))
    await settle(transport().request({ path: '/x', query: { cursor: 'c1', limit: 20 } }, OkSchema))
    expect(callArgs(fetchMock).url).toBe('https://api.example.com/x?cursor=c1&limit=20')
  })
})

describe('cancellation', () => {
  /**
   * `getGuestBundle` accepts a caller `signal` so a route can cancel an
   * in-flight read on unmount/re-navigation. These assert the transport
   * actually wires that external signal into the request it sends, not just
   * that it accepts the option.
   */

  // Deliberately NOT routed through settle(): its 10s timer advance would also
  // trip the transport's own 5s internal deadline, which would reject these
  // requests for an unrelated reason and hide a broken external-signal wiring.
  // Every path here resolves off the abort event alone (a microtask chain),
  // so plain `await` — with fake timers left untouched — is what actually
  // isolates the behavior under test.

  it('rejects immediately when the caller signal is already aborted before the request starts', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
      return respond(200, { ok: true }) as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    controller.abort()

    await expect(
      transport(1).request({ path: '/x', signal: controller.signal }, OkSchema),
    ).rejects.toMatchObject({ code: 'timeout' })
  })

  it('aborts the in-flight request when the caller signal aborts mid-flight', async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const promise = transport(1).request({ path: '/x', signal: controller.signal }, OkSchema)
    controller.abort()

    await expect(promise).rejects.toMatchObject({ code: 'timeout' })
  })

  it('reports a hung request as a timeout once the internal deadline elapses, with no caller signal', async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = createHttpTransport({
      baseUrl: 'https://api.example.com',
      contractVersion: 'v1',
      timeoutMs: 1_000,
      maxAttempts: 1,
    }).request({ path: '/x' }, OkSchema)

    await expect(settle(result)).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('exhausting attempts with none configured', () => {
  it('fails closed rather than hanging when maxAttempts is 0', async () => {
    const fetchMock = stubFetch()
    await expect(settle(transport(0).request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'unknown',
      message: 'Request failed',
    })
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})

describe('the boundary never lets a raw error escape', () => {
  it('wraps a failure from outside sendOnce\'s own try/catch as a typed ApiError too', async () => {
    // A caller-supplied signal-like object whose addEventListener itself
    // throws — reached before sendOnce's try block, so its own network_error
    // handling never sees it. This exercises the outer request() loop's own
    // catch-all, proving the ApiError boundary holds even there.
    const brokenSignal = {
      aborted: false,
      addEventListener: () => {
        throw new Error('boom')
      },
    } as unknown as AbortSignal

    await expect(
      settle(transport(1).request({ path: '/x', signal: brokenSignal }, OkSchema)),
    ).rejects.toMatchObject({ code: 'unknown', message: 'boom' })
  })

  it('still produces readable copy when something throws a non-Error value', async () => {
    // A hostile or malformed fetch polyfill can reject with anything, not
    // just an Error — `error.message` would be undefined, not a crash, but
    // the fallback string is what keeps the ApiError's `message` a string.
    const brokenSignal = {
      aborted: false,
      addEventListener: () => {
        throw { reason: 'boom' }
      },
    } as unknown as AbortSignal

    await expect(
      settle(transport(1).request({ path: '/x', signal: brokenSignal }, OkSchema)),
    ).rejects.toMatchObject({ code: 'unknown', message: '[object Object]' })
  })

  it('falls back to a generic message when fetch itself rejects with a non-Error value', async () => {
    const fetchMock = vi.fn(async () => {
      throw { reason: 'boom' }
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(settle(transport(1).request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'network_error',
      message: 'Network request failed',
    })
  })
})

describe('failure translation', () => {
  it('reports a network failure as network_error, not unknown', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    await expect(settle(transport(1).request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'network_error',
    })
  })

  it('prefers the server error code over the status fallback', async () => {
    stubFetch(respond(400, { code: 'conflict', message: 'already claimed' }))
    await expect(settle(transport().request({ path: '/x' }, OkSchema))).rejects.toMatchObject({
      code: 'conflict',
    })
  })

  it('keeps the server message out of user-facing copy', async () => {
    stubFetch(respond(404, { code: 'not_found', message: 'pg: no such row in activities' }))

    let error: ApiError | undefined
    try {
      await settle(transport().request({ path: '/x' }, OkSchema))
    } catch (caught) {
      error = caught as ApiError
    }

    expect(error).toBeInstanceOf(ApiError)
    // The developer-facing string is preserved...
    expect(error?.message).toContain('pg:')
    // ...but a student never sees the database internals.
    expect(error?.userMessage).not.toContain('pg:')
  })
})
