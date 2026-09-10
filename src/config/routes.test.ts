import { describe, expect, it } from 'vitest'
import { buildPath, buildShareLink, paths } from './routes'

describe('share links', () => {
  it('keeps gifts separate from existing classroom links', () => {
    expect(paths.gifts).toBe('/gifts')
    expect(paths.giftPlay).toBe('/gifts/play')
    expect(paths.guestPlay).toBe('/play/:activityId')
  })
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

  it('includes the deploy base in absolute share links exactly once', () => {
    expect(buildShareLink('abc123', 'https://play.example.com/', '/SAL0MANder-Web/')).toBe(
      'https://play.example.com/SAL0MANder-Web/play/abc123',
    )
  })

  it('keeps route paths root-relative because the router owns the basename', () => {
    const shareLink = buildShareLink('abc123', 'https://play.example.com', '/SAL0MANder-Web/')

    expect(buildPath.guestPlay('abc123')).toBe('/play/abc123')
    expect(shareLink).not.toContain('/SAL0MANder-Web/SAL0MANder-Web/')
  })
})
