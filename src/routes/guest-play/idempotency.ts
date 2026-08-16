/**
 * Idempotency keys for session writes.
 *
 * The keys are **derived, never random**, because the failure that actually
 * happens in a classroom defeats a random key entirely: a student submits, the
 * wifi stalls, the student reloads, the page mints a fresh random key, and the
 * retry is now a distinct write. The completion is counted twice — exactly what
 * D-007 exists to prevent. Rejecting mismatched bodies does not help either,
 * because the bodies are identical; only the keys differ.
 *
 * A derived key survives a reload, a process death, and a student resuming on
 * the same device.
 */

const START_KEY_PREFIX = 'sal0mander.session.startKey.'

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* non-fatal: the key simply won't survive a reload */
  }
}

/**
 * The key for starting a session on a given activity version.
 *
 * Held in `sessionStorage`, not `localStorage`, on purpose. Reloading a tab
 * should **resume** the same session rather than fragment one student into
 * several rows in the teacher's report. Deliberately starting again — a new tab,
 * or "play again" via {@link clearStartKey} — should be a genuinely new session.
 * `sessionStorage` draws that line exactly where a student would expect it.
 *
 * Falls back to a fresh key when storage is blocked (private mode, embedded
 * frame). Guests must still be able to play, so a lost key degrades to "this
 * reload starts a new session" rather than to an error.
 */
export function startKeyFor(activityVersionId: string, mint: () => string): string {
  const storageKey = START_KEY_PREFIX + activityVersionId
  const existing = safeGet(storageKey)
  if (existing) return existing

  const minted = mint()
  safeSet(storageKey, minted)
  return minted
}

/** Ends the current attempt's identity, so the next start is a new session. */
export function clearStartKey(activityVersionId: string): void {
  try {
    sessionStorage.removeItem(START_KEY_PREFIX + activityVersionId)
  } catch {
    /* non-fatal */
  }
}

/**
 * The key for submitting a session's result.
 *
 * A pure function of the session, because a session has exactly one result.
 * Nothing to store, nothing to lose: any client, at any time, retrying that
 * submission derives the same key.
 */
export function resultKeyFor(sessionId: string): string {
  return `${sessionId}:result`
}
