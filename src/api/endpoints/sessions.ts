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
    /**
     * `selectedPlayMode` and `clientAttemptId` are contract fields
     * (`API_CONTRACT.md` §POST /v1/sessions). Both optional here while the
     * shape is draft, so a caller that cannot yet supply them still compiles.
     *
     * `clientAttemptId` is deliberately the *same value* as the idempotency
     * key: both are "a stable id for this attempt that survives a reload," and
     * minting two would guarantee they eventually disagree.
     */
    start(
      input: {
        activityId: string
        activityVersionId: string
        identity: PlayerIdentity
        selectedPlayMode?: string
        clientAttemptId?: string
      },
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
