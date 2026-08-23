import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createMockTransport } from './mockTransport'
import { ApiError } from './errors'
import { IDEMPOTENCY_VECTORS } from '@contracts/v1'

/**
 * The web half of the shared idempotency contract.
 *
 * These vectors were written to describe a defect in Unity's bridge, which
 * consumes an eventId before semantic validation so a corrected retry is
 * silently discarded.
 *
 * Writing them exposed a RELATED — not identical — defect here, and the
 * difference matters enough that it was ruled on explicitly. Unity's is an
 * invalid REQUEST consuming its id on the way IN. The web's was an invalid
 * RESPONSE being cached under a key on the way OUT, then replayed forever
 * because the retry matched the stored fingerprint. Same family, opposite
 * directions, different fixes. Calling them the same bug was my error.
 *
 * 733 tests passed with that bug in place. Every one of them asserted what this
 * code did rather than what the contract required, which is exactly the failure
 * the vectors exist to break.
 *
 * IDEMPOTENCY_VECTORS is deliberately shared with Unity rather than duplicated:
 * the whole point is that both sides answer the same questions, and a private
 * copy on each side is how the two implementations diverged unnoticed.
 */
describe('the idempotency contract, web side', () => {
  it('exposes vectors for Unity to run against the same cases', () => {
    // Guards the fixture itself. A vector list that silently empties would make
    // every test below vacuously pass — a green suite proving nothing.
    expect(IDEMPOTENCY_VECTORS.length).toBeGreaterThanOrEqual(5)
    for (const v of IDEMPOTENCY_VECTORS) {
      expect(v.steps.length).toBeGreaterThan(0)
      expect(v.why, `vector "${v.name}" must say what it prevents`).toBeTruthy()
    }
  })

  it('rejects a reused key carrying a different request — vector 2', async () => {
    const t = createMockTransport()
    const schema = z.object({ id: z.string() }).passthrough()
    const opts = (activityId: string) => ({
      method: 'POST' as const,
      path: '/sessions',
      body: { activityId },
      idempotencyKey: 'shared-key',
    })

    await t.request(opts('demo-activity'), schema)
    // Same key, different body. Replaying the first would hand back a record
    // the caller never asked for; the contract says say so instead.
    await expect(t.request(opts('a-different-activity'), schema)).rejects.toBeInstanceOf(ApiError)
  })

  it('replays an identical repeat without a second effect — vector 1', async () => {
    const t = createMockTransport()
    const schema = z.object({ id: z.string() }).passthrough()
    const opts = {
      method: 'POST' as const,
      path: '/sessions',
      body: { activityId: 'demo-activity' },
      idempotencyKey: 'replay-key',
    }
    const first = await t.request(opts, schema)
    const second = await t.request(opts, schema)
    // Same session id means no second session was created.
    expect(second.id).toBe(first.id)
  })

  it.fails('vector 4 is NOT reachable through this surface — recorded, not proven', async () => {
    /*
     * HONEST FAILURE, marked so it cannot masquerade as coverage.
     *
     * Vector 4 is about an invalid REQUEST not consuming its event id. The web
     * fixed a NEIGHBOURING defect — an invalid response being cached — which is
     * a defensive improvement and explicitly NOT proof of vector 4. Neither is
     * provable through this surface, and I would rather say so than ship a
     * green line that means nothing.
     *
     * Why it is unreachable: making the SCHEMA impossible does not make the
     * RESPONSE invalid. route() always produces a well-formed object, so the
     * stored response replays successfully on retry and the test passes with
     * the bug in place. Mutation-checked: reintroducing the original ordering
     * left this suite fully green.
     *
     * Reaching it needs a route that returns something failing its own schema,
     * which the mock has no way to express today. Recorded as a real gap rather
     * than papered over — a test that cannot fail is exactly the pattern these
     * vectors exist to break, and I reproduced it while writing them.
     *
     * Unity CAN test this: its bridge takes raw JSON and validates after
     * consuming the id, so an invalid payload is trivially constructible there.
     * Vector 4 is Unity's to prove, and the web's to keep honest.
     */
    expect(true).toBe(false)
  })

  it('never records a key for a request that carried none — vector 5', async () => {
    // Nothing can be deduplicated against a key that was never supplied, and
    // recording a placeholder would poison the next real one.
    const t = createMockTransport()
    const schema = z.object({ id: z.string() }).passthrough()
    const a = await t.request(
      { method: 'POST', path: '/sessions', body: { activityId: 'demo-activity' } },
      schema,
    )
    const b = await t.request(
      { method: 'POST', path: '/sessions', body: { activityId: 'demo-activity' } },
      schema,
    )
    expect(b.id).not.toBe(a.id)
  })
})
