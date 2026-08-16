import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@api/index'
import { ShareCodeSchema, type GuestActivityBundle } from '@contracts/v1'
import { toGuestActivityBundle } from './playBundleAdapter'

/**
 * Resolve whatever is in the URL, by whichever path fits it.
 *
 * Both are live on purpose. P-002 (`shareCode` distinct from `activityId`) is
 * still *Proposed*, so the new resolver runs alongside the existing one rather
 * than replacing it — a link already in the wild must not stop working because
 * a contract moved. Which one is used is decided by the shape of the value, so
 * flipping to shareCode-only later is a deletion, not a migration.
 */
async function resolve(code: string, signal: AbortSignal): Promise<GuestActivityBundle> {
  if (ShareCodeSchema.safeParse(code).success) {
    return toGuestActivityBundle(await api.play.resolve(code, signal))
  }
  return api.activities.getGuestBundle(code, signal)
}

export type GuestActivityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; bundle: GuestActivityBundle }
  | { status: 'error'; error: ApiError }

export type GuestActivity = GuestActivityState & {
  /**
   * Re-runs the fetch. The transport already retries transient failures with
   * backoff, so by the time this state is visible those are exhausted — this is
   * the student's own second attempt, typically after the classroom wifi comes
   * back. Without it the only recovery is reloading the page, which on a share
   * link means retyping or re-scanning it.
   */
  retry: () => void
}

/**
 * Loads the activity behind a share link.
 *
 * No auth, no profile, no prompt — a student following a teacher's link must
 * reach playable content in one step. Fetch is abortable so navigating away
 * mid-load doesn't leave a request (or a setState) hanging.
 */
export function useGuestActivity(activityId: string | undefined): GuestActivity {
  const [state, setState] = useState<GuestActivityState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!activityId) {
      setState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    resolve(activityId, controller.signal)
      .then((bundle) => {
        if (active) setState({ status: 'ready', bundle })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        setState({
          status: 'error',
          error:
            error instanceof ApiError
              ? error
              : new ApiError({ code: 'unknown', message: String(error) }),
        })
      })

    return () => {
      active = false
      controller.abort()
    }
    // `attempt` is the retry trigger: bumping it re-runs the fetch.
  }, [activityId, attempt])

  return { ...state, retry }
}
