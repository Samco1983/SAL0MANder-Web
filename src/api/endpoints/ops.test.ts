import { describe, expect, it } from 'vitest'

import { opsIdempotencyKey } from './ops'
import { deriveKey } from '../../../edge/ops-endpoint/worker.js'
import { OPS_ACTIONS, OpsRequestSchema } from '@contracts/v1'

/**
 * The idempotency key exists in two places on purpose — the browser computes it
 * so a retry can be recognised, and the edge worker recomputes it so a caller
 * cannot force two writes by sending a fresh key. The worker deploys to
 * Cloudflare separately and cannot import from this source tree, so the two
 * implementations are genuine copies.
 *
 * Copies drift. That is the whole failure this file guards: nothing about a
 * silent drift is visible at runtime — the browser thinks it retried, the
 * worker thinks it received something new, and one intent becomes two records
 * in the queue the council treats as evidence.
 *
 * The same shape already bit this repo once. A broker test asserted the argv
 * contained "workspace-write" and stayed green for the entire life of an
 * adapter that had never once reached a model, because it checked our own
 * output rather than agreement with the other side.
 */
describe('the ops idempotency key', () => {
  const CASES: Array<[(typeof OPS_ACTIONS)[number], string]> = [
    ['nudge', 'Nudge from the website'],
    ['status', 'status check'],
    ['nudge', '  leading and trailing whitespace  '],
    ['nudge', 'Mixed CASE and   collapsed    spacing'],
    ['status', 'punctuation: commas, dashes — and a quote "x"'],
    ['nudge', 'a'],
    ['nudge', 'x'.repeat(280)],
    ['nudge', 'émoji and ünicode ✓'],
  ]

  it.each(CASES)('client and worker agree for (%s, %j)', async (action, reason) => {
    const fromClient = opsIdempotencyKey(action, reason)
    const fromWorker = await deriveKey(action, reason.trim())
    expect(fromWorker).toBe(fromClient)
  })

  it('covers every allowed action, so a new one cannot be added untested', async () => {
    // If OPS_ACTIONS grows and nobody adds a case above, this fails rather than
    // letting the new action ship with an unverified key.
    const tested = new Set(CASES.map(([action]) => action))
    expect([...tested].sort()).toEqual([...OPS_ACTIONS].sort())
  })

  it('is derived, not random: the same intent repeats to the same key', () => {
    const a = opsIdempotencyKey('nudge', 'same intent')
    const b = opsIdempotencyKey('nudge', 'same intent')
    expect(a).toBe(b)
  })

  it('separates different intents inside the same minute', () => {
    const at = new Date('2026-08-22T14:30:00.000Z')
    expect(opsIdempotencyKey('nudge', 'one', at)).not.toBe(
      opsIdempotencyKey('nudge', 'two', at),
    )
    expect(opsIdempotencyKey('nudge', 'one', at)).not.toBe(
      opsIdempotencyKey('status', 'one', at),
    )
  })

  it('treats a later minute as a new intent, not a retry', () => {
    const first = new Date('2026-08-22T14:30:59.000Z')
    const next = new Date('2026-08-22T14:31:00.000Z')
    expect(opsIdempotencyKey('nudge', 'same', first)).not.toBe(
      opsIdempotencyKey('nudge', 'same', next),
    )
  })

  it('normalises whitespace and case, so a cosmetic edit is still a retry', () => {
    const at = new Date('2026-08-22T14:30:00.000Z')
    expect(opsIdempotencyKey('nudge', 'Check  The   Queue', at)).toBe(
      opsIdempotencyKey('nudge', 'check the queue', at),
    )
  })
})

describe('the ops request contract', () => {
  it('rejects an action outside the allowlist', () => {
    expect(() => OpsRequestSchema.parse({ action: 'deploy', reason: 'x' })).toThrow()
  })

  it('rejects an empty or whitespace-only reason', () => {
    expect(() => OpsRequestSchema.parse({ action: 'nudge', reason: '   ' })).toThrow()
  })

  it('rejects a reason past the bound, which is echoed into an issue body', () => {
    expect(() =>
      OpsRequestSchema.parse({ action: 'nudge', reason: 'x'.repeat(281) }),
    ).toThrow()
  })
})
