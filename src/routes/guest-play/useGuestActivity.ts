import { useEffect, useState } from 'react'
import { api, ApiError } from '@api/index'
import type { GuestActivityBundle } from '@contracts/v1'

export type GuestActivityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; bundle: GuestActivityBundle }
  | { status: 'error'; error: ApiError }

/**
 * Loads the activity behind a share link.
 *
 * No auth, no profile, no prompt — a student following a teacher's link must
 * reach playable content in one step. Fetch is abortable so navigating away
 * mid-load doesn't leave a request (or a setState) hanging.
 */
export function useGuestActivity(activityId: string | undefined): GuestActivityState {
  const [state, setState] = useState<GuestActivityState>({ status: 'idle' })

  useEffect(() => {
    if (!activityId) {
      setState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    api.activities
      .getGuestBundle(activityId, controller.signal)
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
  }, [activityId])

  return state
}
