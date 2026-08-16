import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { newId, SessionIdSchema, type PlayerIdentity, type SessionResult } from '@contracts/v1'
import type { RequestOptions, Transport } from '../transport'
import { sessionsApi } from './sessions'

/**
 * Session writes are the only place a student's work reaches the backend, and
 * both carry an idempotency key. What matters here is that the key is actually
 * attached — a retry of a keyless write double-counts a completion.
 */

// Parsed rather than cast, so the id also satisfies the branded contract type.
const SESSION_ID = SessionIdSchema.parse(newId())

function recordingTransport() {
  const calls: RequestOptions[] = []
  const transport: Transport = {
    async request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T> {
      calls.push(options)
      return schema.parse({
        id: SESSION_ID,
        activityId: newId(),
        activityVersionId: newId(),
        identity: { kind: 'guest', guestToken: 'guest-token-1' },
        status: 'in-progress',
        startedAt: new Date().toISOString(),
        completedAt: null,
      })
    },
  }
  return { transport, calls }
}

const identity: PlayerIdentity = { kind: 'guest', guestToken: 'guest-token-1' }

const result: SessionResult = {
  sessionId: SESSION_ID,
  status: 'completed',
  durationMs: 90_000,
  questionsAnswered: 5,
  questionsCorrect: 4,
  piecesPlaced: 12,
  piecesTotal: 12,
  completedAt: new Date().toISOString(),
}

describe('starting a session', () => {
  it('POSTs the activity, version and identity', async () => {
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).start(
      { activityId: 'act-1', activityVersionId: 'ver-1', identity },
      'start-key-1',
    )

    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('/sessions')
    expect(calls[0]?.body).toEqual({
      activityId: 'act-1',
      activityVersionId: 'ver-1',
      identity,
    })
  })

  it('carries an idempotency key, so a retry resumes rather than duplicates', async () => {
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).start(
      { activityId: 'act-1', activityVersionId: 'ver-1', identity },
      'start-key-1',
    )
    expect(calls[0]?.idempotencyKey).toBe('start-key-1')
  })

  it('sends the guest token in the body, never as an auth credential', async () => {
    // A guest token is a correlation hint, not authentication (D-005).
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).start(
      { activityId: 'act-1', activityVersionId: 'ver-1', identity },
      'start-key-1',
    )
    expect(calls[0]?.authToken).toBeUndefined()
  })

  it('validates the response against the session contract', async () => {
    const transport: Transport = {
      async request<T>(_o: RequestOptions, schema: z.ZodType<T>): Promise<T> {
        return schema.parse({ id: 'nope' })
      },
    }
    await expect(
      sessionsApi(transport).start(
        { activityId: 'a', activityVersionId: 'v', identity },
        'start-key-1',
      ),
    ).rejects.toThrow()
  })
})

describe('submitting a result', () => {
  it('POSTs to the session result path', async () => {
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).submitResult(SESSION_ID, result, 'result-key-1')

    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`/sessions/${SESSION_ID}/result`)
  })

  it('carries the key both as a header hint and in the body', async () => {
    // The transport only retries writes that carry a key; the body copy is what
    // the server dedupes on.
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).submitResult(SESSION_ID, result, 'result-key-1')

    expect(calls[0]?.idempotencyKey).toBe('result-key-1')
    expect(calls[0]?.body).toEqual({ idempotencyKey: 'result-key-1', result })
  })

  it('encodes a session id that would otherwise break the path', async () => {
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).submitResult('a/b?c', result, 'result-key-1')
    expect(calls[0]?.path).toBe('/sessions/a%2Fb%3Fc/result')
  })

  it('passes the result through unmodified', async () => {
    // The web layer records outcomes; it must never adjust a student's numbers.
    const { transport, calls } = recordingTransport()
    await sessionsApi(transport).submitResult(SESSION_ID, result, 'result-key-1')

    const body = calls[0]?.body as { result: SessionResult }
    expect(body.result).toBe(result)
  })
})
