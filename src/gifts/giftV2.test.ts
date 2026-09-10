import { describe, expect, it } from 'vitest'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { PreviewActivitySchema } from '@unity/previewBridge'
import {
  buildGiftLink,
  decodeGift,
  encodeGift,
  GiftSchema,
  MAX_GIFT_PAYLOAD_LENGTH,
  type GiftV2,
} from './giftLink'
import { GIFT_SURVEY, giftAnswerKey, GiftAnswerTextSchema, surveyChoices } from './giftSurvey'
import { giftToDraft } from './giftActivity'
import { DEFAULT_GIFT_PRESENTATION, giftPresentation } from './giftPresentation'

const gift: GiftV2 = {
  version: 2,
  catalogVersion: 2,
  mode: 'learning',
  imageKey: 'salamander-forest',
  answers: GIFT_SURVEY.map((item) => ({ templateId: item.id, answer: item.suggestions[0] })),
  ...DEFAULT_GIFT_PRESENTATION,
}

describe('nine typed favorites', () => {
  it.each([
    'a'.repeat(40),
    '"'.repeat(40),
    '\\'.repeat(40),
    'é'.repeat(32),
    '🌲'.repeat(16),
    '界'.repeat(21),
  ])(
    'round-trips nine worst-bound answers, all modes and pictures without a late length failure: %s',
    (answer) => {
      expect(GiftAnswerTextSchema.safeParse(answer).success).toBe(true)
      for (const mode of ['learning', 'mystery', 'classic'] as const)
        for (const picture of PUZZLE_LIBRARY) {
          const value = {
            ...gift,
            mode,
            imageKey: picture.key,
            answers: mode === 'classic' ? [] : gift.answers.map((item) => ({ ...item, answer })),
          }
          const link = buildGiftLink(value, 'https://example.com', '/' + 'p'.repeat(256))
          expect(link.length).toBeLessThan(3000)
          expect(new URL(link).hash.length - 6).toBeLessThan(MAX_GIFT_PAYLOAD_LENGTH)
          expect(decodeGift(new URL(link).hash, link.length)).toEqual(value)
        }
    },
  )
  it.each([
    '',
    '  ',
    'x'.repeat(41),
    'é'.repeat(33),
    '🌲'.repeat(17),
    '<b>blue</b>',
    '＜b＞blue',
    'A\nB',
    'A\tB',
    '\u0000',
    '\u202eBlue',
    '\ud800',
  ])('rejects invalid text early: %j', (answer) => {
    expect(GiftAnswerTextSchema.safeParse(answer).success).toBe(false)
    expect(() =>
      encodeGift({ ...gift, answers: gift.answers.map((item) => ({ ...item, answer })) }),
    ).toThrow()
  })
  it('normalizes display text without changing capitalization or meaningful Unicode', () => {
    const value = {
      ...gift,
      answers: gift.answers.map((item) => ({ ...item, answer: '  Café   ＢＬＵＥ  ' })),
    }
    const parsed = decodeGift(encodeGift(value))
    expect(parsed).toMatchObject({
      answers: [
        { templateId: 'color', answer: 'Café BLUE' },
        ...gift.answers.slice(1).map((item) => ({ ...item, answer: 'Café BLUE' })),
      ],
    })
    expect(giftAnswerKey('  ＢＬＵＥ ')).toBe('blue')
  })
  it('keeps one distinct correct answer even when typed text matches a suggestion after normalization', () => {
    for (const template of GIFT_SURVEY) {
      const choices = surveyChoices(template.id, ` ${template.suggestions[0].toUpperCase()} `)
      expect(choices).toHaveLength(4)
      expect(choices.filter((choice) => choice.isCorrect)).toHaveLength(1)
      expect(new Set(choices.map((choice) => giftAnswerKey(choice.text))).size).toBe(4)
    }
    expect(surveyChoices('ice-cream', 'Pistachio')[1]).toMatchObject({
      text: 'Pistachio',
      isCorrect: true,
    })
  })
  it.each([
    { ...gift, answers: gift.answers.slice(1) },
    { ...gift, answers: [...gift.answers.slice(1), gift.answers[1]] },
    { ...gift, answers: [{ templateId: 'injected', answer: 'yes' }, ...gift.answers.slice(1)] },
    { ...gift, answers: [{ ...gift.answers[0], prompt: 'custom' }, ...gift.answers.slice(1)] },
    { ...gift, occasion: 'wedding' },
    { ...gift, wrapper: 'bag' },
    { ...gift, celebration: 'fireworks' },
    { ...gift, mode: 'classic' },
    { ...gift, catalogVersion: 3 },
  ])('rejects malformed v2 rather than silently dropping fields: %j', (value) => {
    expect(GiftSchema.safeParse(value).success).toBe(false)
  })
  it('adapts nine answers in stable question order; Classic has no survey data', () => {
    for (const mode of ['learning', 'mystery', 'classic'] as const) {
      const draft = giftToDraft(
        { ...gift, mode, answers: mode === 'classic' ? [] : [...gift.answers].reverse() },
        'gift_test',
      )
      expect(PreviewActivitySchema.safeParse(draft).success).toBe(true)
      expect(draft.config.pieceCountPreset).toBe(9)
      expect(draft.questions.map((item) => item.id)).toEqual(
        mode === 'classic' ? [] : GIFT_SURVEY.map((item) => `gift_${item.id}`),
      )
    }
  })
  it('retains old links and their explicit presentation defaults', () => {
    const old = {
      version: 1,
      catalogVersion: 1,
      mode: 'classic',
      imageKey: 'salamander-forest',
      selections: [],
    } as const
    const value = { ...old, selections: [] }
    const originalWire =
      '#gift=' +
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(encodeGift(value)).toBe(originalWire)
    expect(decodeGift(originalWire)).toEqual(value)
    expect(giftPresentation(decodeGift(originalWire))).toEqual(DEFAULT_GIFT_PRESENTATION)
    expect(giftToDraft(value, 'gift_old').config.pieceCountPreset).toBe(4)
    expect(() => decodeGift(originalWire, 2001)).toThrow()
    expect(() => decodeGift(encodeGift(gift), 3001)).toThrow()
  })
})
