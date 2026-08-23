import { z } from 'zod'

/**
 * Operator actions — the website's control surface for the agent council.
 *
 * The webhook that ultimately receives these lives behind an edge endpoint, not
 * in this bundle. Every `VITE_`-prefixed value ships to the browser, so a Make
 * hook URL placed here would be readable by anyone who opened devtools, and a
 * stranger firing it would not merely waste operations — it would write junk
 * into the GitHub queue the council treats as its source of truth. Polluted
 * evidence is a worse failure than a wasted operation, so the browser only ever
 * learns the address of our own endpoint.
 */

/**
 * The complete set of actions the edge endpoint will forward. Anything else is
 * rejected before it reaches Make. This is an allowlist on purpose: a new
 * capability must be added here deliberately, never by shaping a payload.
 */
export const OPS_ACTIONS = ['nudge', 'status'] as const

export const OpsActionSchema = z.enum(OPS_ACTIONS)
export type OpsAction = z.infer<typeof OpsActionSchema>

export const OpsRequestSchema = z.object({
  action: OpsActionSchema,
  /**
   * Free-text context for a human reading the resulting GitHub item. Bounded
   * because it is echoed into an issue body: unbounded text from a public page
   * is a defacement vector even when the action itself is harmless.
   */
  reason: z.string().trim().min(1).max(280),
})
export type OpsRequest = z.infer<typeof OpsRequestSchema>

export const OpsResultSchema = z.object({
  /** Server's decision, not the browser's. `duplicate` is a success. */
  outcome: z.enum(['queued', 'duplicate', 'rate_limited']),
  action: OpsActionSchema,
  /** Echoed so a caller can correlate a retry with its original write. */
  idempotencyKey: z.string().min(1),
  /** Present once Make has written the durable record. */
  issueUrl: z.string().url().optional(),
  receivedAtUtc: z.string().datetime(),
})
export type OpsResult = z.infer<typeof OpsResultSchema>
