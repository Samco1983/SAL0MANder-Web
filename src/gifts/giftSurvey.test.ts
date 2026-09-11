import { expect, it } from 'vitest'
import {
  GIFT_SURVEY,
  GIFT_SURVEY_IDEAS,
  GiftAnswerTextSchema,
  giftAnswerKey,
  surveyChoices,
} from './giftSurvey'

it('turns every composer-only idea into one correct choice and three distinct stable alternatives', () => {
  for (const item of GIFT_SURVEY) {
    const suggestions = [...item.suggestions, ...GIFT_SURVEY_IDEAS[item.id].extra]
    expect(new Set(suggestions.map(giftAnswerKey)).size).toBe(suggestions.length)
    for (const answer of suggestions) {
      expect(GiftAnswerTextSchema.parse(answer)).toBe(answer)
      const choices = surveyChoices(item.id, answer)
      expect(choices).toHaveLength(4)
      expect(new Set(choices.map((choice) => giftAnswerKey(choice.text))).size).toBe(4)
      expect(choices.filter((choice) => choice.isCorrect)).toEqual([
        { id: 'favorite', text: answer, isCorrect: true },
      ])
    }
  }
})

it('preserves known existing gift alternatives while new ideas remain composer-only', () => {
  expect(surveyChoices('color', 'Blue').map((choice) => choice.text)).toEqual([
    'Blue',
    'Green',
    'Purple',
    'Red',
  ])
  expect(surveyChoices('movie', 'Back to the Future').map((choice) => choice.text)).toEqual([
    'Toy Story',
    'Frozen',
    'Back to the Future',
    'The Lion King',
  ])
  expect(surveyChoices('ice-cream', 'Pistachio').map((choice) => choice.text)).toEqual([
    'Chocolate',
    'Pistachio',
    'Vanilla',
    'Strawberry',
  ])
})
