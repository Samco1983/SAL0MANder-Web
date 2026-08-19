import { describe, expect, it, vi } from 'vitest'

import {
  clearGuestIdentity,
  getGuestDisplayName,
  getGuestIdentity,
  getOrCreateGuestToken,
  GUEST_NAME_KEY,
  GUEST_TOKEN_KEY,
} from '@auth/guestIdentity'

/**
 * The no-account invariant, guarded at the identity layer.
 *
 * CLAUDE.md non-negotiable #3: no account, email, password, or name prompt on
 * the path from a share link to playable content. The route and page surfaces
 * already assert this for the screens that exist today. What had no cover is
 * the layer underneath — the one a future feature would quietly lean on.
 *
 * `guestIdentity` can hold a display name. That capability is fine; the risk is
 * something starting to *require* it. A student on a school Chromebook with a
 * wiped profile, or in a private window, arrives with nothing in storage, and
 * every one of these must still hold.
 */

describe('a first-ever visitor with completely empty storage', () => {
  it('gets a usable identity without supplying anything', () => {
    localStorage.clear()
    const identity = getGuestIdentity()
    expect(identity.guestToken).toBeTruthy()
    expect(identity.guestToken.length).toBeGreaterThanOrEqual(8)
  })

  it('has no display name, and that is a valid state, not an error', () => {
    localStorage.clear()
    expect(getGuestDisplayName()).toBeUndefined()
    expect(() => getGuestIdentity()).not.toThrow()
  })

  it('mints a token that is stable across calls, so a session is not restarted', () => {
    localStorage.clear()
    const first = getOrCreateGuestToken()
    expect(getOrCreateGuestToken()).toBe(first)
  })
})

describe('the guest token is not an account', () => {
  it('carries nothing that identifies a person', () => {
    localStorage.clear()
    const token = getOrCreateGuestToken()
    // It is a minted id, not derived from anything about the student. If this
    // ever starts containing an email or a name, it has stopped being a guest
    // token and become an account under a different word.
    expect(token).not.toMatch(/@/)
    expect(token).not.toMatch(/\s/)
    expect(token.toLowerCase()).not.toMatch(/name|email|user|student/)
  })

  it('is replaced, not reused, once cleared', () => {
    localStorage.clear()
    const first = getOrCreateGuestToken()
    clearGuestIdentity()
    const second = getOrCreateGuestToken()
    expect(second).not.toBe(first)
    expect(second.length).toBeGreaterThanOrEqual(8)
  })

  it('clears the display name too, leaving nothing behind on a shared device', () => {
    localStorage.setItem(GUEST_NAME_KEY, 'Sam')
    clearGuestIdentity()
    expect(localStorage.getItem(GUEST_NAME_KEY)).toBeNull()
    expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBeNull()
  })
})

describe('storage being unavailable never blocks play', () => {
  // Private windows and locked-down school profiles throw on localStorage
  // access. Play must survive it — a student cannot fix their browser policy.
  it('still returns an identity when reads throw', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    try {
      expect(() => getGuestIdentity()).not.toThrow()
      expect(getGuestIdentity().guestToken).toBeTruthy()
    } finally {
      getItem.mockRestore()
    }
  })

  it('still returns an identity when writes throw', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      const token = getOrCreateGuestToken()
      expect(token).toBeTruthy()
      expect(token.length).toBeGreaterThanOrEqual(8)
    } finally {
      setItem.mockRestore()
    }
  })

  it('does not throw while clearing on a locked-down profile', () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    try {
      expect(() => clearGuestIdentity()).not.toThrow()
    } finally {
      removeItem.mockRestore()
    }
  })
})

describe('a display name is optional, never a gate', () => {
  it('an identity without a name is complete', () => {
    localStorage.clear()
    const identity = getGuestIdentity()
    expect(identity.guestToken).toBeTruthy()
    expect(identity.displayName).toBeUndefined()
  })

  it('an empty or whitespace name is treated as absent, not as a value', () => {
    // Otherwise a blank submitted field becomes a "name" that downstream code
    // renders, and the student is labelled with nothing.
    localStorage.setItem(GUEST_NAME_KEY, '   ')
    expect(getGuestDisplayName()).toBeUndefined()
  })
})
