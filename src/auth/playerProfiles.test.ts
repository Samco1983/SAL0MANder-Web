import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUEST_NAME_KEY, GUEST_TOKEN_KEY, getGuestDisplayName } from './guestIdentity'
import {
  ACTIVE_PROFILE_KEY,
  MAX_PROFILES,
  PRESET_HANDLES,
  PROFILES_KEY,
  createProfile,
  getActiveProfile,
  listProfiles,
  renameProfile,
  setActiveProfile,
  suggestHandle,
} from './playerProfiles'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('player profiles', () => {
  it('starts with nobody chosen, which is a working state not an error', () => {
    expect(listProfiles()).toEqual([])
    expect(getActiveProfile()).toBeUndefined()
  })

  it('creates a player and makes them active', () => {
    const result = createProfile('Player 1')
    expect(result.ok).toBe(true)
    expect(getActiveProfile()?.handle).toBe('Player 1')
  })

  it('gives each player their own token, so progress does not merge', () => {
    createProfile('Player 1')
    createProfile('Player 2')
    const [one, two] = listProfiles()
    expect(one?.token).not.toBe(two?.token)
  })

  /**
   * The regression that would have silently destroyed progress.
   *
   * Anyone already playing has a guest token. If the first profile minted a new
   * one, their sessions would correlate to the old token and their progress
   * would be unreachable — looking, to them, exactly like it had been deleted.
   */
  it('adopts an existing guest token rather than orphaning progress', () => {
    localStorage.setItem(GUEST_TOKEN_KEY, 'existing-token-abcdef')
    // Adoption happens on read, so the player is already there to be picked —
    // they never have to create themselves.
    expect(listProfiles()[0]?.token).toBe('existing-token-abcdef')
  })

  it('does not hand the adopted token to a second, different player', () => {
    localStorage.setItem(GUEST_TOKEN_KEY, 'existing-token-abcdef')
    const second = createProfile('Player 2')
    expect(second.ok && second.profile.token).not.toBe('existing-token-abcdef')
    expect(listProfiles()[0]?.token).toBe('existing-token-abcdef')
  })

  it('adopts a player already mid-game as the first profile, keeping their name', () => {
    localStorage.setItem(GUEST_TOKEN_KEY, 'existing-token-abcdef')
    localStorage.setItem(GUEST_NAME_KEY, 'Rocket')
    expect(listProfiles()).toEqual([{ token: 'existing-token-abcdef', handle: 'Rocket' }])
  })

  it('falls back to a preset when a legacy guest had no name', () => {
    localStorage.setItem(GUEST_TOKEN_KEY, 'existing-token-abcdef')
    expect(listProfiles()[0]?.handle).toBe(PRESET_HANDLES[0])
  })

  it('refuses a duplicate handle, so two players cannot both be Player 2', () => {
    createProfile('Player 2')
    const second = createProfile('  player 2  ')
    expect(second).toEqual({ ok: false, reason: 'taken' })
  })

  it('refuses a blank handle instead of storing whitespace as a name', () => {
    expect(createProfile('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('suggests the first preset nobody has taken', () => {
    expect(suggestHandle()).toBe('Player 1')
    createProfile('Player 1')
    expect(suggestHandle()).toBe('Player 2')
  })

  it('caps the list so a shared tablet never becomes a class roster', () => {
    for (let i = 0; i < MAX_PROFILES; i++) createProfile(`Kid ${i}`)
    expect(createProfile('One more')).toEqual({ ok: false, reason: 'full' })
    expect(listProfiles()).toHaveLength(MAX_PROFILES)
  })

  it('switches players and tells the rest of the app who is playing', () => {
    createProfile('Player 1')
    const two = createProfile('Player 2')
    expect(two.ok).toBe(true)

    const first = listProfiles()[0]!
    setActiveProfile(first.token)
    expect(getActiveProfile()?.handle).toBe('Player 1')
    // Anything still reading the legacy single-name key sees the live player.
    expect(getGuestDisplayName()).toBe('Player 1')
  })

  it('keeps the token when renaming, so progress is not orphaned', () => {
    const created = createProfile('Playr 1')
    expect(created.ok).toBe(true)
    const token = created.ok ? created.profile.token : ''

    const renamed = renameProfile(token, 'Player 1')
    expect(renamed.ok && renamed.profile.token).toBe(token)
    expect(getActiveProfile()?.handle).toBe('Player 1')
  })

  it('lets a player keep their own name when renaming', () => {
    const created = createProfile('Player 1')
    const token = created.ok ? created.profile.token : ''
    expect(renameProfile(token, 'Player 1').ok).toBe(true)
  })

  /**
   * localStorage is shared with other tabs and extensions and can be
   * half-written. A corrupt store must cost saved handles, never the ability to
   * play.
   */
  it('treats a corrupt store as empty rather than throwing', () => {
    localStorage.setItem(PROFILES_KEY, '{not json')
    expect(listProfiles()).toEqual([])
    expect(getActiveProfile()).toBeUndefined()
  })

  it('drops malformed entries but keeps the good ones', () => {
    localStorage.setItem(
      PROFILES_KEY,
      JSON.stringify([{ token: 'good-token-abcdef', handle: 'Player 1' }, { token: 'x' }, null]),
    )
    expect(listProfiles()).toEqual([{ token: 'good-token-abcdef', handle: 'Player 1' }])
  })

  it('ignores an active pointer at a player who no longer exists', () => {
    createProfile('Player 1')
    localStorage.setItem(ACTIVE_PROFILE_KEY, 'not-a-real-token')
    expect(getActiveProfile()).toBeUndefined()
  })

  /**
   * The non-negotiable: Guest Play is never gated. A device that cannot store
   * anything must still play, so every path degrades instead of throwing.
   */
  it('still works when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => listProfiles()).not.toThrow()
    expect(() => createProfile('Player 1')).not.toThrow()
    expect(() => getActiveProfile()).not.toThrow()
  })
})
