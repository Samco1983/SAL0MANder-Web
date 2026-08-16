import {
  PlaySessionSchema,
  type PlayerIdentity,
  type PlaySession,
  type SessionResult,
} from '@contracts/v1'
import type { Transport } from '../transport'

/**
 * Play-session writes.
 *
 * Two writes per session (start, finish) — no per-move traffic. Both carry an
 * idempotency key because classroom networks drop requests and a retried
 * completion must not count twice.
 */
export function sessionsApi(transport: Transport) {
  return {
    start(
      input: { activityId: string; activityVersionId: string; identity: PlayerIdentity },
      idempotencyKey: string,
    ): Promise<PlaySession> {
      return transport.request(
        { method: 'POST', path: '/sessions', body: input, idempotencyKey },
        PlaySessionSchema,
      )
    },

    submitResult(
      sessionId: string,
      result: SessionResult,
      idempotencyKey: string,
    ): Promise<PlaySession> {
      return transport.request(
        {
          method: 'POST',
          path: `/sessions/${encodeURIComponent(sessionId)}/result`,
          body: { idempotencyKey, result },
          idempotencyKey,
        },
        PlaySessionSchema,
      )
    },
  }
}
