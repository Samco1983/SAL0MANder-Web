import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@api/index'
import type { PlayerIdentity, PlaySession, SessionResult } from '@contracts/v1'
import { clearStartKey, resultKeyFor } from './idempotency'

export type PlaySessionState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'active'; session: PlaySession }
  | { status: 'submitting'; session: PlaySession }
  | { status: 'finished'; session: PlaySession }
  | {
      status: 'result-undeliverable'
      attemptId: string
      result: Omit<SessionResult, 'sessionId'>
      error: ApiError
    }
  | { status: 'error'; error: ApiError }

export type PlaySessionApi = PlaySessionState & {
  submit: (result: Omit<SessionResult, 'sessionId'>) => Promise<void>
  reset: () => void
}

type Input = {
  activityId: string | undefined
  activityVersionId: string | undefined
  identity: PlayerIdentity
  /**
   * The mode this attempt is pinned to.
   *
   * For a single-mode activity the caller knows it immediately. For Student
   * Choice it arrives from Unity over the bridge, and until then it is
   * `undefined` and **no session opens**. Starting early with a guess would pin
   * the attempt to a mode the student never chose, and the value is immutable
   * once pinned — so the mode breakdown in a teacher's report would be quietly
   * wrong with no way to tell.
   */
  selectedPlayMode: string | undefined
  /**
   * The attempt identity, created before boot. Supplied rather than minted
   * here so `boot`, the session body and the idempotency key all carry the
   * same value.
   */
  clientAttemptId: string | undefined
  /**
   * Mints a fresh attempt identity. The id is owned above this hook now, so
   * "play again" has to ask for a new one — clearing storage here would not be
   * enough, and reusing the finished attempt's id would have the server
   * deduplicate the new session away.
   */
  onRenewAttempt?: () => void
  /** Sessions only start once there is something to play. */
  enabled: boolean
}

type PendingResult = {
  attemptId: string
  result: Omit<SessionResult, 'sessionId'>
}

/**
 * Owns the play session against the mock backend.
 *
 * Two writes per session — start and result — matching the contract's coarse
 * model. No per-move traffic.
 *
 * **A failure here must never stop a student playing.** The session exists so a
 * teacher can see a result; the game is Unity's and runs regardless. Every
 * error path leaves the stage untouched, and the caller is expected to keep
 * rendering it.
 */
export function usePlaySession({
  activityId,
  activityVersionId,
  identity,
  selectedPlayMode,
  clientAttemptId,
  onRenewAttempt,
  enabled,
}: Input): PlaySessionApi {
  const [state, setState] = useState<PlaySessionState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)

  // Read inside the effect without making it a dependency: a new guest-identity
  // object each render must not restart the session.
  const identityRef = useRef(identity)
  identityRef.current = identity

  /** A result that arrived before the session did. Held with its attempt id. */
  const pendingResultRef = useRef<PendingResult | undefined>(undefined)

  useEffect(() => {
    // No mode, no session. See the field docs above.
    if (!enabled || !activityId || !activityVersionId || !selectedPlayMode) return
    if (!clientAttemptId) return

    const controller = new AbortController()
    let active = true
    setState({ status: 'starting' })

    // One value: the attempt identity IS the idempotency key.
    const idempotencyKey = clientAttemptId

    api.sessions
      .start(
        {
          activityId,
          activityVersionId,
          identity: identityRef.current,
          selectedPlayMode,
          clientAttemptId: idempotencyKey,
        },
        idempotencyKey,
      )
      .then((session) => {
        if (active) setState({ status: 'active', session })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        const held = pendingResultRef.current
        if (held?.attemptId === idempotencyKey) {
          pendingResultRef.current = undefined
          setState({
            status: 'result-undeliverable',
            attemptId: held.attemptId,
            result: held.result,
            error: toApiError(error),
          })
          return
        }
        setState({ status: 'error', error: toApiError(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [activityId, activityVersionId, selectedPlayMode, clientAttemptId, enabled, attempt])

  const submit = useCallback(
    async (result: Omit<SessionResult, 'sessionId'>) => {
      /**
       * A result that lands before the session exists is **buffered, not
       * dropped** (Codex ruling, 2026-08-15).
       *
       * The race is real and favours short activities: a four-piece puzzle on a
       * fast device can finish before `POST /sessions` returns over classroom
       * wifi. Returning early here — which is what this used to do — threw away
       * a child's completed work with no error anywhere.
       *
       * One slot, deliberately. A session has exactly one result, so a second
       * arrival is a duplicate rather than something to queue.
       */
      if (state.status === 'idle' || state.status === 'starting') {
        if (clientAttemptId) {
          pendingResultRef.current ??= { attemptId: clientAttemptId, result }
        }
        return
      }

      // Any other non-active state would invent a session id or double-submit.
      if (state.status !== 'active') return
      const { session } = state

      setState({ status: 'submitting', session })
      try {
        const updated = await api.sessions.submitResult(
          session.id,
          { ...result, sessionId: session.id },
          // Pure function of the session: the same retry, from any client, at
          // any time, derives the same key.
          resultKeyFor(session.id),
        )
        setState({ status: 'finished', session: updated })
        // The attempt is over; a subsequent start should be a new session.
        clearStartKey(session.activityVersionId)
      } catch (error) {
        setState({ status: 'error', error: toApiError(error) })
      }
    },
    [state, clientAttemptId],
  )

  /**
   * Flush a buffered result as soon as the session exists.
   *
   * Runs after `submit` is defined so it uses the same path a live result
   * takes — same derived key, same state transitions — rather than a parallel
   * one that could drift.
   */
  useEffect(() => {
    if (state.status !== 'active' || !pendingResultRef.current) return
    const buffered = pendingResultRef.current
    if (buffered.attemptId !== clientAttemptId) {
      pendingResultRef.current = undefined
      setState({
        status: 'result-undeliverable',
        attemptId: buffered.attemptId,
        result: buffered.result,
        error: new ApiError({
          code: 'conflict',
          message: 'A completed result belonged to a previous play attempt.',
        }),
      })
      return
    }
    pendingResultRef.current = undefined
    void submit(buffered.result)
  }, [state.status, submit, clientAttemptId])

  /** Start a fresh attempt — "play again", not a reload. */
  const reset = useCallback(() => {
    onRenewAttempt?.()
    setAttempt((n) => n + 1)
  }, [onRenewAttempt])

  return { ...state, submit, reset }
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ code: 'unknown', message: String(error) })
}
