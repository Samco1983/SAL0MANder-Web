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
  | { status: 'error'; error: ApiError }

/**
 * A game the student finished that could not be recorded.
 *
 * Kept **beside** the session state rather than as a status of it. As a status
 * it was mutually exclusive with `active`, so an orphaned result from attempt 1
 * overwrote attempt 2's live session and attempt 2's own completion was then
 * dropped — the failure W-12 set out to remove, one attempt further along.
 * Held here, a lost result and a healthy session coexist, which is what
 * actually happens.
 *
 * One entry per attempt, never overwritten: a second lost result is a second
 * child's work, not an update to the first.
 */
export type UndeliveredResult = {
  /**
   * The attempt this result was produced under — what makes it re-deliverable
   * and what stops it being flushed into somebody else's session.
   *
   * `undefined` only if a completion arrived with no attempt identity at all,
   * which boot should make impossible. Recorded rather than dropped, because an
   * untagged result is still a child's finished game.
   */
  attemptId: string | undefined
  result: Omit<SessionResult, 'sessionId'>
  reason: ApiError
}

export type PlaySessionApi = PlaySessionState & {
  /** Completed games that were never recorded. Surfaced, never silent (W-10). */
  undelivered: readonly UndeliveredResult[]
  /** True when one of them belongs to the current attempt and can be re-sent. */
  canRetryDelivery: boolean
  submit: (result: Omit<SessionResult, 'sessionId'>) => Promise<void>
  /**
   * Re-send the current attempt's undelivered result. Safe by construction:
   * the start carries the same `clientAttemptId` — which *is* the idempotency
   * key — and the result key is a pure function of the session id, so a retry
   * resolves to the same session and the same single result.
   */
  retryDelivery: () => void
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
  const [undelivered, setUndelivered] = useState<readonly UndeliveredResult[]>([])

  /**
   * Record a completion that could not be delivered.
   *
   * Append-only, and idempotent per attempt: an attempt has exactly one result,
   * so a repeat is the same loss being reported twice, not a new one.
   */
  const hold = useCallback((entry: UndeliveredResult) => {
    setUndelivered((current) =>
      entry.attemptId !== undefined && current.some((held) => held.attemptId === entry.attemptId)
        ? current
        : [...current, entry],
    )
  }, [])

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
        const apiError = toApiError(error)
        const held = pendingResultRef.current
        if (held?.attemptId === idempotencyKey) {
          pendingResultRef.current = undefined
          hold({ attemptId: held.attemptId, result: held.result, reason: apiError })
        }
        setState({ status: 'error', error: apiError })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [activityId, activityVersionId, selectedPlayMode, clientAttemptId, enabled, attempt, hold])

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

      /**
       * The mirror image of the buffer, and the ordering it never covered.
       *
       * The buffer assumes the failure arrives *after* the completion. On a
       * classroom network the common case is the opposite: `POST /sessions`
       * fails fast against a dead connection, then the student plays for three
       * minutes — because a failure here must never stop a student playing —
       * and finishes into a state that had already given up. There is nothing
       * buffered to rescue at that point, so the completion has to be caught
       * here or it is gone.
       */
      if (state.status === 'error') {
        hold({ attemptId: clientAttemptId, result, reason: state.error })
        return
      }

      // `submitting` and `finished` both mean this session's one result is
      // already accounted for; a further arrival is a duplicate, not a loss.
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
        // The game is over and the write failed. Dropping the result into a
        // bare error state would lose the one thing the session existed to
        // carry — and this is the likeliest failure of all, since the student
        // has just spent the whole activity on a connection that may have died
        // meanwhile.
        const apiError = toApiError(error)
        hold({ attemptId: clientAttemptId, result, reason: apiError })
        setState({ status: 'error', error: apiError })
      }
    },
    [state, clientAttemptId, hold],
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
    pendingResultRef.current = undefined

    // Belt and braces behind `reset`, which drains the buffer itself: an
    // attempt id can also change without a reset, when a new activity version
    // is pinned. Either way the live session is left alone — recording the
    // orphan must not cost the student the attempt they are actually playing.
    if (buffered.attemptId !== clientAttemptId) {
      hold({
        attemptId: buffered.attemptId,
        result: buffered.result,
        reason: new ApiError({
          code: 'conflict',
          message: 'A completed result belonged to a previous play attempt.',
        }),
      })
      return
    }
    void submit(buffered.result)
  }, [state.status, submit, clientAttemptId, hold])

  /** The undelivered result the current attempt could still re-send, if any. */
  const retryable = undelivered.find(
    (held) => held.attemptId !== undefined && held.attemptId === clientAttemptId,
  )

  const retryDelivery = useCallback(() => {
    if (!retryable?.attemptId) return
    // Put it back where a first-time early result waits, then re-run the start
    // under the same attempt identity. The existing flush path does the rest,
    // so a retry takes exactly the route a normal result takes.
    pendingResultRef.current = { attemptId: retryable.attemptId, result: retryable.result }
    setUndelivered((current) => current.filter((held) => held !== retryable))
    setAttempt((n) => n + 1)
  }, [retryable])

  /** Start a fresh attempt — "play again", not a reload. */
  const reset = useCallback(() => {
    // Drain the buffer *into the record* rather than clearing it. Clearing
    // first would destroy the same completed game silently, which is the thing
    // the buffer exists to prevent.
    const buffered = pendingResultRef.current
    if (buffered) {
      pendingResultRef.current = undefined
      hold({
        attemptId: buffered.attemptId,
        result: buffered.result,
        reason: new ApiError({
          code: 'conflict',
          message: 'A new attempt started before this result could be recorded.',
        }),
      })
    }
    onRenewAttempt?.()
    setAttempt((n) => n + 1)
  }, [onRenewAttempt, hold])

  return {
    ...state,
    undelivered,
    canRetryDelivery: Boolean(retryable),
    submit,
    retryDelivery,
    reset,
  }
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ code: 'unknown', message: String(error) })
}
