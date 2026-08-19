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
      /**
       * The session the result belongs to, when one was ever opened.
       *
       * Absent when `POST /sessions` itself failed — there is no session to
       * submit against, and {@link PlaySessionApi.retryDelivery} re-opens one
       * instead of resubmitting.
       */
      session?: PlaySession
    }
  | { status: 'error'; error: ApiError }

export type PlaySessionApi = PlaySessionState & {
  submit: (result: Omit<SessionResult, 'sessionId'>) => Promise<void>
  /**
   * Deliver a held result, by whichever route is missing.
   *
   * Safe by construction rather than by convention, on both routes:
   *
   * - the submission failed → resend against the same session, keyed on
   *   `resultKeyFor(session.id)`, a pure function of the session, so the server
   *   sees one write;
   * - the session never opened → re-run `POST /sessions` under the *same*
   *   `clientAttemptId`, which is the idempotency key, so a start that in fact
   *   succeeded server-side returns that session rather than a second one. The
   *   held result goes back into the buffer and takes the ordinary flush path.
   *
   * A no-op from any state with nothing deliverable held, and from a held
   * result whose attempt the app has already moved past — see {@link canRetry}.
   */
  retryDelivery: () => Promise<void>
  /**
   * Whether {@link retryDelivery} would actually do something.
   *
   * Offering a button that silently does nothing is its own version of the
   * defect this state exists to fix, so the surface asks rather than guesses.
   */
  canRetry: boolean
  /**
   * A completed result exists and the backend has not taken it yet.
   *
   * Distinct from `status === 'result-undeliverable'`, which is a momentary
   * state: a retry passes through `submitting`, and on the start-failure route
   * through `starting` and `active` as well, before landing back here or on
   * `finished`. A surface that watched the status alone would therefore take
   * itself down and put itself back up on every failed retry.
   *
   * This stays true from the first held result until one is actually
   * delivered, so "there is something the student needs to see" is answerable
   * without knowing which leg of the retry the session is on.
   */
  resultHeld: boolean
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

  /**
   * The attempt id the *open* session was started under.
   *
   * Not the same as the current `clientAttemptId`, which can already have been
   * renewed by the time a submission fails. A held result must be labelled with
   * the attempt that produced it, or the record is worse than useless.
   */
  const startedAttemptRef = useRef<string | undefined>(undefined)

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
        if (!active) return
        startedAttemptRef.current = idempotencyKey
        setState({ status: 'active', session })
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

  /**
   * Send a completed result to the backend, once — the single path every
   * submission takes, live, buffered or retried.
   *
   * **A failure here is not an error, it is a held result.** The student has
   * already finished; the numbers exist and nothing else in the system has
   * them. Collapsing that into `{ status: 'error', error }` threw the result,
   * the attempt id and the ability to retry away in one assignment, which is
   * the same silence W-10 forbade — arriving on the more likely path, since
   * this call happens at the *end* of a session rather than the start.
   */
  const deliver = useCallback(
    async (session: PlaySession, result: Omit<SessionResult, 'sessionId'>, attemptId: string) => {
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
        // Only on success — ending the attempt identity while a result is still
        // undelivered would let a reload orphan it.
        clearStartKey(session.activityVersionId)
      } catch (error) {
        setState({
          status: 'result-undeliverable',
          attemptId,
          result,
          error: toApiError(error),
          session,
        })
      }
    },
    [],
  )

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

      await deliver(
        state.session,
        result,
        startedAttemptRef.current ?? clientAttemptId ?? state.session.id,
      )
    },
    [state, clientAttemptId, deliver],
  )

  /**
   * True when a held result has a route to the backend. See
   * {@link PlaySessionApi.retryDelivery} for the two routes.
   */
  const canRetry =
    state.status === 'result-undeliverable' &&
    (Boolean(state.session) || state.attemptId === clientAttemptId)

  /** Deliver a held result. See {@link PlaySessionApi.retryDelivery}. */
  const retryDelivery = useCallback(async () => {
    if (state.status !== 'result-undeliverable') return

    if (state.session) {
      await deliver(state.session, state.result, state.attemptId)
      return
    }

    // No session ever opened. Re-running the start is only correct while the
    // app is still on that attempt — under a renewed attempt id the start would
    // open a session the held result does not belong to.
    if (state.attemptId !== clientAttemptId) return
    pendingResultRef.current = { attemptId: state.attemptId, result: state.result }
    setAttempt((n) => n + 1)
  }, [state, deliver, clientAttemptId])

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

  /**
   * Held from the first failure until a result is delivered. See
   * {@link PlaySessionApi.resultHeld} for why the status alone will not do.
   *
   * Only `finished` lowers it. Not `idle`, not `starting` — the start-failure
   * retry route goes through both on its way to delivering the held result,
   * and lowering it there is precisely the flicker this exists to prevent.
   */
  const [resultHeld, setResultHeld] = useState(false)
  useEffect(() => {
    if (state.status === 'result-undeliverable') setResultHeld(true)
    else if (state.status === 'finished') setResultHeld(false)

  }, [state.status])

  /** Start a fresh attempt — "play again", not a reload. */
  const reset = useCallback(() => {
    onRenewAttempt?.()
    setAttempt((n) => n + 1)
  }, [onRenewAttempt])

  return { ...state, submit, retryDelivery, canRetry, resultHeld, reset }
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ code: 'unknown', message: String(error) })
}
