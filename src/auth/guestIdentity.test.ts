import { describe, expect, it } from 'vitest'
import {
  GUEST_TOKEN_KEY,
  clearGuestIdentity,
  getGuestIdentity,
  getOrCreateGuestToken,
  setGuestDisplayName,
} from './guestIdentity'

describe('guest identity', () => {
  it('mints a token on first use and reuses it thereafter', () => {
    const first = getOrCreateGuestToken()
    expect(first.length).toBeGreaterThanOrEqual(8)
    expect(getOrCreateGuestToken()).toBe(first)
  })

  it('produces a playable identity with no display name required', () => {
    clearGuestIdentity()
    const identity = getGuestIdentity()
    expect(identity.kind).toBe('guest')
    expect(identity.displayName).toBeUndefined()
  })

  it('treats a display name as optional and cosmetic', () => {
    setGuestDisplayName('Sam')
    expect(getGuestIdentity().displayName).toBe('Sam')
  })

  it('truncates an over-long display name rather than rejecting the student', () => {
    setGuestDisplayName('x'.repeat(200))
    expect(getGuestIdentity().displayName).toHaveLength(40)
  })

  it('clears device state on request', () => {
    getOrCreateGuestToken()
    clearGuestIdentity()
    expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBeNull()
  })
})
