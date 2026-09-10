import { expect, it } from 'vitest'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { buildGiftLink, decodeGift, GiftSchema, GiftSlideSchema } from './giftLink'
import { DEFAULT_GIFT_PRESENTATION } from './giftPresentation'
import { giftToDraft } from './giftActivity'

const gift = GiftSlideSchema.parse({
  version: 3,
  catalogVersion: 2,
  mode: 'sliding',
  imageKey: 'coral-reef',
  answers: [],
  ...DEFAULT_GIFT_PRESENTATION,
})
it('round-trips each built-in picture as a bounded zero-question sliding gift', () => {
  for (const image of PUZZLE_LIBRARY) {
    const value = { ...gift, imageKey: image.key }
    const link = buildGiftLink(value, 'https://example.com', '/SAL0MANder-Web')
    expect(decodeGift(new URL(link).hash, link.length)).toEqual(value)
    expect(link.length).toBeLessThan(1000)
    expect(() => giftToDraft(value, 'test')).toThrow(/separate sliding/)
  }
})
it.each([
  { ...gift, version: 2 },
  { ...gift, version: 1 },
  { ...gift, mode: 'classic' },
  { ...gift, answers: [{ templateId: 'color', answer: 'Blue' }] },
  { ...gift, questions: [] },
  { ...gift, imageKey: 'https://other.example/image.png' },
  { ...gift, gridSize: 4 },
])('rejects ambiguous versions, questions or unsupported sliding variants', (value) => {
  expect(GiftSchema.safeParse(value).success).toBe(false)
})
