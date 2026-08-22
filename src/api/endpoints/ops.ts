import {
  OpsRequestSchema,
  OpsResultSchema,
  type OpsAction,
  type OpsResult,
} from '@contracts/v1'
import type { Transport } from '../transport'

/**
 * Operator actions.
 *
 * The browser talks only to our own edge endpoint. It never learns the Make
 * webhook URL, and it is never trusted: the allowlist and bounds asserted here
 * are a courtesy that keeps obvious mistakes out of the network, not a control.
 * The edge endpoint re-validates everything, because anything shipped to a
 * browser can be edited in a browser.
 */

/**
 * Derived, never random.
 *
 * A random key defeats idempotency on the exact failure it exists for: the
 * caller fires, the response is lost in transit, the caller retries, mints a
 * fresh key, and the retry lands as a second distinct write. Deriving the key
 * from (action, reason, minute) means an honest retry within the same minute
 * collapses onto the first write, while a genuinely new intent gets its own.
 *
 * The minute bucket is the deliberate trade: two identical nudges a minute
 * apart are treated as two events, which is almost always what a human meant.
 */
export function opsIdempotencyKey(
  action: OpsAction,
  reason: string,
  now: Date = new Date(),
): string {
  const minute = now.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
  const normalized = reason.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${action}:${minute}:${fnv1a(normalized)}`
}

/** Small, dependency-free, and stable across runtimes — the key must match on both sides. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function opsApi(transport: Transport) {
  return {
    /**
     * Ask the council to pick up work. Returns the server's outcome — a
     * `duplicate` is a success, not an error: it means idempotency did its job.
     */
    send(action: OpsAction, reason: string, signal?: AbortSignal): Promise<OpsResult> {
      // Throws before any network call if the caller built something invalid.
      const body = OpsRequestSchema.parse({ action, reason })
      return transport.request(
        {
          method: 'POST',
          path: '/ops/actions',
          body,
          idempotencyKey: opsIdempotencyKey(body.action, body.reason),
          ...(signal ? { signal } : {}),
        },
        OpsResultSchema,
      )
    },
  }
}
