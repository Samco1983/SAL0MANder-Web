import { describe, expect, it } from 'vitest'
import { buildSavedGiftLink, savedGiftId, restoreSharedGiftLink } from './savedGiftLink'
import { buildGiftLink, giftBackupCode, type Gift } from './giftLink'
const id = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_'
describe('opaque saved-gift links', () => {
  it('creates a short query link at the actual site base', () => {
    const link = buildSavedGiftLink(id, 'https://school.example', '/puzzles/')
    expect(link).toBe(`https://school.example/puzzles/gifts/play?g=${id}`)
    expect(savedGiftId(new URL(link).search)).toBe(id)
    expect(new URL(link).hash).toBe('')
  })
  it.each(['?g=', '?g=short', `?g=${id}&g=${id}`, '?g=../admin', '?g=https://evil.example'])(
    'rejects malformed or competing IDs %s',
    (query) => {
      expect(() => savedGiftId(query)).toThrow()
    },
  )
  it('keeps query-free links on the legacy path', () => expect(savedGiftId('?utm=gift')).toBeNull())
  it.each([`SAL0-SAVED:${id}`, `I made you a gift! https://other.example/gifts/play?g=${id}`])(
    'restores only the ID to our own origin: %s',
    (input) => {
      expect(restoreSharedGiftLink(input, 'https://school.example', '/puzzles')).toBe(
        `https://school.example/puzzles/gifts/play?g=${id}`,
      )
    },
  )
  it.each([
    `https://bad.example/login?g=${id}`,
    `https://user:password@bad.example/gifts/play?g=${id}`,
    `https://x.example/gifts/play?g=${id}#gift=x`,
    `SAL0-SAVED:${id} SAL0-SAVED:${id}`,
    `SAL0-SAVED:${id}\u200b`,
    'x'.repeat(3001),
  ])('rejects ambiguous or malformed pasted data', (input) => {
    expect(() => restoreSharedGiftLink(input, 'https://school.example')).toThrow()
  })
  it('still restores old self-contained gift codes', () => {
    const gift: Gift = {
      version: 1,
      catalogVersion: 1,
      mode: 'classic',
      imageKey: 'saturn',
      selections: [],
    }
    expect(restoreSharedGiftLink(giftBackupCode(gift), 'https://school.example', '')).toBe(
      buildGiftLink(gift, 'https://school.example', ''),
    )
  })
})
