import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@api/index'
import { newId, type PlayerIdentity, type PlaySession, type SessionResult } from '@contracts/v1'
import { clearStartKey, resultKeyFor, startKeyFor } from './idempotency'

export type PlaySessionState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'active'; session: PlaySession }
  | { status: 'submitting'; session: PlaySession }
  | { status: 'finished'; session: PlaySession }
  | { status: 'error'; error: ApiError }

export type PlaySessionApi = PlaySessionState & {
  submit: (result: Omit<SessionResult, 'sessionId'>) => Promise<void>
  reset: () => void
}

type Input = {
  activityId: string | undefined
  activityVersionId: string | undefined
  identity: PlayerIdentity
  /** Sessions only start once there is something to play. */
  enabled: boolean
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
  enabled,
}: Input): PlaySessionApi {
  const [state, setState] = useState<PlaySessionState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)

  // Read inside the effect without making it a dependency: a new guest-identity
  // object each render must not restart the session.
  const identityRef = useRef(identity)
  identityRef.current = identity

  useEffect(() => {
    if (!enabled || !activityId || !activityVersionId) return

    const controller = new AbortController()
    let active = true
    setState({ status: 'starting' })

    // Derived, so a reload resumes this session instead of creating a second.
    const idempotencyKey = startKeyFor(activityVersionId, newId)

    api.sessions
      .start({ activityId, activityVersionId, identity: identityRef.current }, idempotencyKey)
      .then((session) => {
        if (active) setState({ status: 'active', session })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        setState({ status: 'error', error: toApiError(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [activityId, activityVersionId, enabled, attempt])

  const submit = useCallback(
    async (result: Omit<SessionResult, 'sessionId'>) => {
      // Only an active session can produce a result. Submitting from any other
      // state would either invent a session id or double-submit.
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
    [state],
  )

  /** Start a fresh attempt — "play again", not a reload. */
  const reset = useCallback(() => {
    if (activityVersionId) clearStartKey(activityVersionId)
    setAttempt((n) => n + 1)
  }, [activityVersionId])

  return { ...state, submit, reset }
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ code: 'unknown', message: String(error) })
}
