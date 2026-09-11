import { expect, it } from 'vitest'
import { buildGiftLink, decodeGift, giftBackupCode, restoreGiftLink, type Gift } from './giftLink'
import { DEFAULT_GIFT_PRESENTATION, OccasionTextSchema } from './giftPresentation'
import { GIFT_SURVEY } from './giftSurvey'

it('preserves a custom occasion through a shared link and backup recovery', () => {
  const gift: Gift = {
    version: 3,
    catalogVersion: 2,
    mode: 'sliding',
    imageKey: 'red-panda',
    answers: [],
    ...DEFAULT_GIFT_PRESENTATION,
    occasionText: 'Happy 10th birthday, Maya!',
  }
  const link = buildGiftLink(gift, 'https://example.com')
  expect(decodeGift(new URL(link).hash)).toEqual(gift)
  const restored = restoreGiftLink(giftBackupCode(gift), 'https://other.example')
  expect(decodeGift(new URL(restored).hash)).toEqual(gift)
})

it.each(['<img>', 'A\nB', 'A\tB', '\u202eText', '\ud800', 'x'.repeat(49), '🌲'.repeat(21)])(
  'rejects invalid occasion text: %j',
  (occasion) => {
    expect(OccasionTextSchema.safeParse(occasion).success).toBe(false)
  },
)

it.each(['"'.repeat(48), '\\'.repeat(48), 'é'.repeat(40), '🌲'.repeat(20)])(
  'fits a full survey and worst-case custom message within the shared-link limits',
  (occasionText) => {
    const gift: Gift = {
      version: 2,
      catalogVersion: 2,
      mode: 'mystery',
      imageKey: 'mountain-steam-train',
      answers: GIFT_SURVEY.map((item) => ({ templateId: item.id, answer: '"'.repeat(40) })),
      ...DEFAULT_GIFT_PRESENTATION,
      occasionText,
    }
    const link = buildGiftLink(gift, 'https://example.com', '/' + 'p'.repeat(256))
    expect(link.length).toBeLessThanOrEqual(3000)
    expect(decodeGift(new URL(link).hash, link.length)).toEqual(gift)
  },
)
