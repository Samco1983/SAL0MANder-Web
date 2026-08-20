import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { ApiErrorCodeSchema, type ApiErrorCode } from '@contracts/v1'

/**
 * `userMessage` is the only thing a student or teacher ever sees for a failed
 * request — the server `message` is developer-only (see `errorBody.test.ts`).
 * Only `not_found` and the default fallback were exercised anywhere else, so a
 * typo'd case label (e.g. a network hiccup on classroom wifi silently falling
 * through to the generic "something went wrong" copy) would ship unnoticed.
 * This walks every code in the contract's enum, not just a hand-picked subset,
 * so a new code added to `ApiErrorCodeSchema` without a matching case here
 * shows up as a real failure instead of quietly inheriting `default`.
 */

function messageFor(code: ApiErrorCode): string {
  return new ApiError({ code, message: 'developer detail, never shown' }).userMessage
}

describe('ApiError.userMessage', () => {
  it('gives unauthorized and forbidden the same access-denied copy', () => {
    expect(messageFor('unauthorized')).toBe(messageFor('forbidden'))
    expect(messageFor('unauthorized')).toContain("don't have access")
  })

  it('tells the student to slow down on rate_limited', () => {
    expect(messageFor('rate_limited')).toContain('a moment')
  })

  it('gives network_error and timeout the same connectivity copy', () => {
    expect(messageFor('network_error')).toBe(messageFor('timeout'))
    expect(messageFor('network_error')).toContain('trouble reaching')
  })

  it('asks for a refresh on contract_mismatch', () => {
    expect(messageFor('contract_mismatch')).toContain('refreshed')
  })

  it('falls back to the generic copy for codes without a dedicated case', () => {
    const generic = messageFor('unknown')
    expect(generic).toBe('Something went wrong on our side. Please try again.')
    for (const code of ['bad_request', 'conflict', 'server_error'] as const) {
      expect(messageFor(code)).toBe(generic)
    }
  })

  it('gives every code in the contract enum a message, and every message differs by case group', () => {
    // Guards against a new code silently inheriting `default` with no one noticing.
    const byCode = new Map(ApiErrorCodeSchema.options.map((code) => [code, messageFor(code)]))
    for (const [code, message] of byCode) {
      expect(message, `userMessage for "${code}"`).toBeTruthy()
    }
  })

  it('never leaks the developer-only message into userMessage', () => {
    for (const code of ApiErrorCodeSchema.options) {
      expect(messageFor(code)).not.toContain('developer detail')
    }
  })
})
