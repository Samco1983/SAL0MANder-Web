import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildUrl } from './transport'
import { createMockTransport, MOCK_DEMO_ACTIVITY_ID } from './mockTransport'
import { ApiError } from './errors'
import { GuestActivityBundleSchema, PlaySessionSchema } from '@contracts/v1'

describe('buildUrl', () => {
  it('joins base and path without doubling slashes', () => {
    expect(buildUrl('https://api.example.com/', '/guest/activities/abc')).toBe(
      'https://api.example.com/guest/activities/abc',
    )
    expect(buildUrl('https://api.example.com', 'guest/activities/abc')).toBe(
      'https://api.example.com/guest/activities/abc',
    )
  })

  it('omits undefined query values', () => {
    expect(buildUrl('https://api.example.com', '/x', { a: 1, b: undefined })).toBe(
      'https://api.example.com/x?a=1',
    )
  })
})

describe('mock transport', () => {
  it('serves the demo guest bundle against the real contract', async () => {
    const transport = createMockTransport()
    const bundle = await transport.request(
      { path: `/guest/activities/${MOCK_DEMO_ACTIVITY_ID}` },
      GuestActivityBundleSchema,
    )
    expect(bundle.summary.id).toBe(MOCK_DEMO_ACTIVITY_ID)
  })

  it('raises a not_found ApiError for an unknown activity', async () => {
    const transport = createMockTransport()
    await expect(
      transport.request({ path: '/guest/activities/nope' }, GuestActivityBundleSchema),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('replays the first response for a repeated idempotency key', async () => {
    const transport = createMockTransport()
    const body = {
      activityId: MOCK_DEMO_ACTIVITY_ID,
      activityVersionId: 'demo-version-1',
      identity: { kind: 'guest', guestToken: 'guest-token-1' },
    }
    const first = await transport.request(
      { method: 'POST', path: '/sessions', body, idempotencyKey: 'key-1' },
      PlaySessionSchema,
    )
    const second = await transport.request(
      { method: 'POST', path: '/sessions', body, idempotencyKey: 'key-1' },
      PlaySessionSchema,
    )
    // A retried start must resume the same session, not create a second one.
    expect(second.id).toBe(first.id)
  })

  it('reports a contract mismatch rather than returning an unparsed payload', async () => {
    const transport = createMockTransport()
    await expect(
      transport.request(
        { path: `/guest/activities/${MOCK_DEMO_ACTIVITY_ID}` },
        z.object({ totallyDifferent: z.string() }),
      ),
    ).rejects.toMatchObject({ code: 'contract_mismatch' })
  })
})

describe('ApiError', () => {
  it('derives user copy from the code, never the server message', () => {
    const error = new ApiError({
      code: 'not_found',
      message: 'pg: relation "activities" does not exist',
    })
    expect(error.userMessage).not.toContain('relation')
    expect(error.userMessage).toContain("couldn't find")
  })
})
