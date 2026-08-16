import { describe, expect, it } from 'vitest'
import { buildPath, buildShareLink } from './routes'

describe('share links', () => {
  it('builds the canonical guest play path', () => {
    expect(buildPath.guestPlay('abc123')).toBe('/play/abc123')
  })

  it('escapes ids so a malformed id cannot break the URL', () => {
    expect(buildPath.guestPlay('a b/c')).toBe('/play/a%20b%2Fc')
  })

  it('produces an absolute link a teacher can paste into an LMS or QR code', () => {
    expect(buildShareLink('abc123', 'https://play.example.com/')).toBe(
      'https://play.example.com/play/abc123',
    )
  })
})
