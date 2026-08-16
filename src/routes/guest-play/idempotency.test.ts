import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearStartKey, resultKeyFor, startKeyFor } from './idempotency'

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('result key', () => {
  it('is a pure function of the session', () => {
    // Nothing stored, nothing to lose: any client retrying that submission at
    // any time derives the same key.
    expect(resultKeyFor('ses_1')).toBe(resultKeyFor('ses_1'))
    expect(resultKeyFor('ses_1')).not.toBe(resultKeyFor('ses_2'))
  })
})

describe('start key', () => {
  it('survives a reload, so a retry resumes instead of double-counting', () => {
    // The regression this exists to prevent: student submits, wifi stalls,
    // student reloads, a random key would make the retry a distinct write.
    const first = startKeyFor('av_1', () => 'minted-1')
    const afterReload = startKeyFor('av_1', () => 'minted-2')
    expect(afterReload).toBe(first)
  })

  it('keeps separate keys per activity version', () => {
    expect(startKeyFor('av_1', () => 'a')).not.toBe(startKeyFor('av_2', () => 'b'))
  })

  it('mints a new key after an explicit play-again', () => {
    const first = startKeyFor('av_1', () => 'minted-1')
    clearStartKey('av_1')
    expect(startKeyFor('av_1', () => 'minted-2')).not.toBe(first)
  })

  it('uses sessionStorage, so a new tab is a new attempt', () => {
    startKeyFor('av_1', () => 'minted-1')
    expect(sessionStorage.getItem('sal0mander.session.startKey.av_1')).toBe('minted-1')
    expect(localStorage.getItem('sal0mander.session.startKey.av_1')).toBeNull()
  })
})

describe('when storage is blocked', () => {
  function blockStorage() {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
  }

  it('still returns a usable key rather than throwing', () => {
    // Private mode or an embedded frame. A guest must still be able to play,
    // so a lost key degrades to "this reload starts a new session".
    blockStorage()
    expect(startKeyFor('av_1', () => 'minted-1')).toBe('minted-1')
  })

  it('does not throw on clear either', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => clearStartKey('av_1')).not.toThrow()
  })
})
