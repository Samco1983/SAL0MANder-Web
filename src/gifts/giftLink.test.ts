import { describe, expect, it, vi } from 'vitest'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { GIFT_TEMPLATES } from './giftCatalog'
import {
  buildGiftLink,
  decodeGift,
  encodeGift,
  giftEmailDraft,
  GiftSchema,
  MAX_GIFT_URL_LENGTH,
  shareGift,
  type Gift,
} from './giftLink'

const gift: Gift = {
  version: 1,
  catalogVersion: 1,
  mode: 'learning',
  imageKey: 'salamander-forest',
  selections: [
    { templateId: 'color', answerId: 'purple' },
    { templateId: 'animal', answerId: 'panda' },
    { templateId: 'ice-cream', answerId: 'mint-chip' },
    { templateId: 'movie', answerId: 'toy-story' },
  ],
}
function rawLink(value: unknown) {
  return (
    '#gift=' +
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  )
}

describe('bounded recipient links', () => {
  it('round-trips all supported modes and pictures, with room below the URL cap', () => {
    for (const mode of ['learning', 'mystery', 'classic'] as const)
      for (const picture of PUZZLE_LIBRARY) {
        const input = {
          ...gift,
          mode,
          imageKey: picture.key,
          selections: mode === 'classic' ? [] : gift.selections,
        }
        const link = buildGiftLink(input, 'https://example.com', '/SAL0MANder-Web/')
        expect(decodeGift(new URL(link).hash, link.length)).toEqual(input)
        expect(link.length).toBeLessThan(MAX_GIFT_URL_LENGTH)
        expect(new URL(link).pathname).toBe('/SAL0MANder-Web/gifts/play')
      }
  })
  it('respects a prefixed base URL exactly once and preserves localhost', () => {
    expect(
      buildGiftLink(gift, 'https://example.com/SAL0MANder-Web/', '/SAL0MANder-Web/'),
    ).toContain('https://example.com/SAL0MANder-Web/gifts/play#gift=')
    expect(buildGiftLink(gift, 'http://127.0.0.1:5184', '/')).toContain(
      'http://127.0.0.1:5184/gifts/play#gift=',
    )
  })
  it.each([
    { ...gift, version: 2 },
    { ...gift, catalogVersion: 2 },
    { ...gift, mode: 'sliding' },
    { ...gift, imageKey: 'https://evil.example/picture.png' },
    { ...gift, imageKey: 'retired-image' },
    { ...gift, html: '<script>no</script>' },
    { ...gift, selections: gift.selections.slice(1) },
    { ...gift, selections: [...gift.selections, gift.selections[0]] },
    { ...gift, selections: [gift.selections[0], gift.selections[0], ...gift.selections.slice(2)] },
    {
      ...gift,
      selections: [{ templateId: 'unknown', answerId: 'a' }, ...gift.selections.slice(1)],
    },
    {
      ...gift,
      selections: [{ templateId: 'color', answerId: 'panda' }, ...gift.selections.slice(1)],
    },
    {
      ...gift,
      selections: [{ ...gift.selections[0], text: 'injected' }, ...gift.selections.slice(1)],
    },
    { ...gift, mode: 'classic' },
  ])('rejects unsupported or inconsistent data before it can reach gameplay: %j', (input) => {
    expect(() => decodeGift(rawLink(input))).toThrow(/incomplete or unsupported/)
  })
  it.each([
    '',
    '#gift=',
    '#gift=%%%bad',
    '#gift=Zm9v',
    '#gift=eyJ2ZXJzaW9uIjox',
    '#gift=AA==',
    '#gift=' + 'a'.repeat(1601),
  ])('rejects malformed, truncated or overlong encoding', (hash) => {
    expect(() => decodeGift(hash)).toThrow(/incomplete or unsupported/)
  })
  it('bounds the complete inbound and outbound URL', () => {
    expect(() => decodeGift(encodeGift(gift), 2001)).toThrow()
    expect(() => buildGiftLink(gift, 'https://example.com', '/' + 'a'.repeat(2000))).toThrow(
      /too long/,
    )
    expect(() => buildGiftLink(gift, 'javascript:alert(1)')).toThrow()
  })
  it('keeps exactly six immutable choices-only templates including ice cream and movies', () => {
    expect(GIFT_TEMPLATES).toHaveLength(6)
    expect(GIFT_TEMPLATES.map((template) => template.id)).toEqual(
      expect.arrayContaining(['ice-cream', 'movie']),
    )
    expect(new Set(GIFT_TEMPLATES.map((template) => template.id)).size).toBe(6)
    for (const template of GIFT_TEMPLATES) {
      expect(template.choices).toHaveLength(4)
      expect(new Set(template.choices.map((choice) => choice.id)).size).toBe(4)
    }
    expect(GiftSchema.safeParse({ ...gift, mode: 'classic', selections: [] }).success).toBe(true)
  })
})

describe('draft-only sharing', () => {
  it('opens a recipient-free email draft preserving the complete fragment', () => {
    const link = buildGiftLink(gift, 'https://example.com')
    const draft = new URL(giftEmailDraft(link))
    expect(draft.protocol).toBe('mailto:')
    expect(draft.pathname).toBe('')
    expect(draft.searchParams.get('body')).toContain(link)
    expect([...draft.searchParams.keys()]).toEqual(['subject', 'body'])
  })
  it('hands the exact URL to the native chooser without claiming delivery', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(await shareGift('https://example.com/gifts/play#gift=abc', { share })).toBe('opened')
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/gifts/play#gift=abc' }),
    )
  })
  it('treats cancellation quietly and offers fallback for absence/failure', async () => {
    expect(
      await shareGift('https://example.com', { share: undefined as unknown as Navigator['share'] }),
    ).toBe('unavailable')
    expect(
      await shareGift('https://example.com', {
        share: vi.fn().mockRejectedValue(new DOMException('Closed', 'AbortError')),
      }),
    ).toBe('cancelled')
    expect(
      await shareGift('https://example.com', {
        share: vi.fn().mockRejectedValue(new Error('No target')),
      }),
    ).toBe('unavailable')
  })
})
