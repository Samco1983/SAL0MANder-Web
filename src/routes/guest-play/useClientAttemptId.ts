import { useCallback, useMemo, useState } from 'react'
import { newId } from '@contracts/v1'
import { clearStartKey, startKeyFor } from './idempotency'

/**
 * The stable identity of one play attempt, available *before* Unity boots.
 *
 * It used to be minted inside the session-start effect, which was too late:
 * `boot` fires as soon as the bundle and the Unity instance exist, and for a
 * Student Choice activity that is well before any session is created. Unity
 * therefore booted with no attempt identity and could not correlate anything
 * it emitted until `session-started` arrived.
 *
 * Created here instead, so one value is available to `boot`, to
 * `POST /v1/sessions` as `clientAttemptId`, and as the start idempotency key.
 * They are the same concept — "this attempt, surviving a reload" — and minting
 * them separately guarantees they eventually disagree.
 *
 * Undefined until the version is known: an attempt id that predates the pinned
 * version would outlive it on a republish.
 */
export function useClientAttemptId(activityVersionId: string | undefined) {
  /**
   * Bumped by `renewAttempt`. Without it, moving the id out of the session
   * effect silently broke "play again": clearing the stored key no longer
   * caused a new one to be read, so a fresh attempt reused the finished
   * attempt's identity and the server deduplicated it away.
   */
  const [epoch, setEpoch] = useState(0)

  const clientAttemptId = useMemo(() => {
    if (!activityVersionId) return undefined
    // `epoch` is read so the dependency is real rather than merely declared:
    // `renewAttempt` clears storage and bumps it, and this recomputation is
    // what turns that into a new id.
    void epoch
    // Reads the stored value first, so a reload resumes the same attempt.
    return startKeyFor(activityVersionId, newId)
  }, [activityVersionId, epoch])

  /** Ends this attempt's identity and mints the next. */
  const renewAttempt = useCallback(() => {
    if (activityVersionId) clearStartKey(activityVersionId)
    setEpoch((n) => n + 1)
  }, [activityVersionId])

  return { clientAttemptId, renewAttempt }
}
