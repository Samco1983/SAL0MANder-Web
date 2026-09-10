import { describe, expect, it } from 'vitest'
import { PreviewActivitySchema, previewProblems } from '@unity/previewBridge'
import { giftToDraft } from './giftActivity'
import type { Gift } from './giftLink'

const gift: Gift = {
  version: 1,
  catalogVersion: 1,
  mode: 'learning',
  imageKey: 'dragon-castle',
  selections: [
    { templateId: 'color', answerId: 'green' },
    { templateId: 'season', answerId: 'summer' },
    { templateId: 'ice-cream', answerId: 'chocolate' },
    { templateId: 'movie', answerId: 'frozen' },
  ],
}

describe('gift to existing Unity preview', () => {
  it.each([
    ['learning', 'Learning', false],
    ['mystery', 'MysteryReveal', true],
  ] as const)(
    'maps %s without changing the guest contract',
    (mode, activityType, autoPlaceCorrectPieces) => {
      const draft = giftToDraft({ ...gift, mode }, 'gift_test')
      expect(draft.config).toMatchObject({
        activityType,
        autoPlaceCorrectPieces,
        pieceCountPreset: 4,
        boardShape: 'Portrait',
        allowResumeLater: false,
        showBoardGuide: false,
      })
      expect(previewProblems(draft)).toEqual([])
      expect(PreviewActivitySchema.safeParse(draft).success).toBe(true)
      expect(draft.questions).toHaveLength(4)
      expect(
        draft.questions.map(
          (question) => question.choices.find((choice) => choice.isCorrect)?.text,
        ),
      ).toEqual(['Green', 'Summer', 'Chocolate', 'Frozen'])
      for (const question of draft.questions) {
        expect(question.choices).toHaveLength(4)
        expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1)
      }
    },
  )
  it('maps Classic to zero questions and never smuggles selected answers into it', () => {
    const draft = giftToDraft({ ...gift, mode: 'classic', selections: [] }, 'gift_classic')
    expect(draft.config).toMatchObject({
      activityType: 'Classic',
      autoPlaceCorrectPieces: false,
      allowResumeLater: false,
    })
    expect(draft.questions).toEqual([])
    expect(previewProblems(draft)).toEqual([])
    expect(() => giftToDraft({ ...gift, mode: 'classic' }, 'gift_invalid')).toThrow()
  })
  it('rejects unvalidated incoming objects rather than trusting a cast', () => {
    expect(() => giftToDraft({ ...gift, imageKey: 'unknown' }, 'gift_invalid')).toThrow()
    expect(() =>
      giftToDraft({ ...gift, mode: 'sliding' } as unknown as Gift, 'gift_invalid'),
    ).toThrow()
  })
})
