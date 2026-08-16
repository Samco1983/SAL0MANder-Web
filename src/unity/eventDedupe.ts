/**
 * `eventId` deduplication, required by `API_CONTRACT.md` §WebGL bridge:
 * "Receivers must deduplicate `eventId` and treat unknown messages safely."
 *
 * It matters most for the message that costs money to double-handle:
 * `session-finished`. A redelivered finish — Unity retrying, a listener
 * re-attaching across a re-render, a WebGL runtime replaying a queued call —
 * would otherwise submit a student's result twice. The derived idempotency key
 * makes the *write* safe; this stops the duplicate before it becomes a request.
 *
 * Bounded on purpose. An unbounded set is a leak in a page a class leaves open
 * all lesson, and the messages here are coarse and few, so a small window is
 * ample. Eviction is oldest-first, which is safe: a redelivery arriving after
 * hundreds of newer events is not a retry.
 */
export const DEFAULT_DEDUPE_WINDOW = 256

export type EventDeduper = {
  /** True the first time an id is seen; false for every repeat. */
  accept: (eventId: string | undefined) => boolean
  readonly size: number
}

export function createEventDeduper(windowSize = DEFAULT_DEDUPE_WINDOW): EventDeduper {
  // Insertion-ordered, so the oldest key is always the first one out.
  const seen = new Set<string>()

  return {
    accept(eventId) {
      // A message with no id cannot be deduplicated, and dropping it would be
      // worse than handling it twice: correlation fields are optional during
      // the bridge rollout, so an id-less message is expected, not malformed.
      if (eventId === undefined) return true

      if (seen.has(eventId)) return false
      seen.add(eventId)

      if (seen.size > windowSize) {
        const oldest = seen.values().next()
        if (!oldest.done) seen.delete(oldest.value)
      }
      return true
    },
    get size() {
      return seen.size
    },
  }
}
