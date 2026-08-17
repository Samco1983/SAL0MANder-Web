/**
 * Deciding which play mode an attempt is pinned to.
 *
 * The mode is chosen in Unity and arrives over the bridge, which means it is
 * untrusted input on the path to an **immutable** field: once a session is
 * created with a `selectedPlayMode`, that value never changes. So a wrong mode
 * here is not a glitch — it silently mis-files the attempt in a teacher's
 * report, with nothing to reveal it afterwards.
 *
 * Three rules, in order:
 *
 *   1. It must be one the activity actually allows. A build sending
 *      `hard-mode` for an activity offering only `classic-puzzle` is a version
 *      skew, and pinning it would attribute play to a mode that does not exist.
 *   2. First valid choice wins. A student picks once.
 *   3. A later *identical* message is a duplicate and is ignored; a later
 *      *different* one is a conflict and is rejected. Neither may open a
 *      second session — and note that "ignore" and "reject" produce the same
 *      state but mean different things, which is why they are separate
 *      verdicts rather than one boolean.
 */
export type ModeVerdict =
  /** First valid mode; the attempt is now pinned to it. */
  | { outcome: 'accepted'; mode: string }
  /** Same mode arriving again — redelivery, or Unity re-announcing. Harmless. */
  | { outcome: 'ignored-duplicate'; mode: string }
  /** A different mode after one was pinned. Refused; the pin stands. */
  | { outcome: 'rejected-conflict'; mode: string; pinned: string }
  /** Not among `allowedPlayModes`. Refused. */
  | { outcome: 'rejected-not-allowed'; mode: string; allowed: readonly string[] }

export function resolveSelectedMode(
  incoming: string,
  pinned: string | undefined,
  allowedPlayModes: readonly string[] | undefined,
): ModeVerdict {
  // No allow-list means the bundle has not resolved yet. Refusing is right:
  // accepting now would pin a mode nothing has authorised.
  const allowed = allowedPlayModes ?? []
  if (!allowed.includes(incoming)) {
    return { outcome: 'rejected-not-allowed', mode: incoming, allowed }
  }
  if (pinned === undefined) return { outcome: 'accepted', mode: incoming }
  if (pinned === incoming) return { outcome: 'ignored-duplicate', mode: incoming }
  return { outcome: 'rejected-conflict', mode: incoming, pinned }
}

/** Only an `accepted` verdict changes anything. */
export function isModeChange(verdict: ModeVerdict): verdict is { outcome: 'accepted'; mode: string } {
  return verdict.outcome === 'accepted'
}
