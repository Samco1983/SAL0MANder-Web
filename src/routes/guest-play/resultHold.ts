import { z } from 'zod'
import { SessionIdSchema, SessionResultSchema } from '@contracts/v1'

/**
 * Persists the one held-but-undelivered result across a reload (W-16).
 *
 * `startKeyFor` (see `idempotency.ts`) made the attempt *identity* durable, but
 * not the result itself: `result-undeliverable` lived in React state and a ref,
 * both gone on reload. A student who finished, watched a save fail, and did the
 * ordinary thing — reloaded — got an ordinary, healthy, ready-to-play screen and
 * lost the numbers with no signal anywhere.
 *
 * Scoped to `sessionStorage`, not `localStorage`, for the same reason
 * `startKeyFor` chose it: a reload should resume this attempt; a new tab must
 * not inherit a stranger's result. Data minimal on purpose — the result's own
 * metrics plus, when a session already exists, only its `id` — no identity, no
 * status, no timestamps beyond what the result already carries.
 */

const HELD_RESULT_KEY_PREFIX = 'sal0mander.session.heldResult.'
const SCHEMA_VERSION = 1

const HeldResultRecordSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  attemptId: z.string().min(1),
  result: SessionResultSchema.omit({ sessionId: true }),
  /** Present only on the submit-failure route, where a session already exists. */
  session: z.object({ id: SessionIdSchema }).optional(),
})

export type HeldResultRecord = z.infer<typeof HeldResultRecordSchema>

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
    /* non-fatal: the record simply won't survive a reload */
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* non-fatal */
  }
}

/** Saves the held result for the live attempt on a given activity version. */
export function saveHeldResult(
  activityVersionId: string,
  record: Omit<HeldResultRecord, 'version'>,
): void {
  safeSet(
    HELD_RESULT_KEY_PREFIX + activityVersionId,
    JSON.stringify({ version: SCHEMA_VERSION, ...record }),
  )
}

/**
 * Reads back a held result, or `undefined` for anything that isn't exactly
 * today's schema.
 *
 * Fails closed on purpose: a missing key, a JSON parse failure, a schema
 * version bump, or a shape that doesn't match all read the same as "nothing
 * held". Trusting a malformed record would render a notice, or retry a write,
 * built from data this build doesn't understand.
 */
export function loadHeldResult(activityVersionId: string): HeldResultRecord | undefined {
  const raw = safeGet(HELD_RESULT_KEY_PREFIX + activityVersionId)
  if (!raw) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }

  const outcome = HeldResultRecordSchema.safeParse(parsed)
  return outcome.success ? outcome.data : undefined
}

/** Clears the held result once it is delivered, or the attempt is discarded. */
export function clearHeldResult(activityVersionId: string): void {
  safeRemove(HELD_RESULT_KEY_PREFIX + activityVersionId)
}
