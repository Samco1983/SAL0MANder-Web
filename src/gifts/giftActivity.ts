import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { newDraft, type ActivityDraft } from '@studio/activityDraft'
import { GiftSchema, type Gift } from './giftLink'
import { GIFT_MODES, giftTemplate } from './giftCatalog'
import { surveyTemplate, surveyChoices, GIFT_SURVEY } from './giftSurvey'

/** Pure in-memory adaptation. Never reads or writes Teacher Studio/student storage. */
export function giftToDraft(input: Gift, activityId: string): ActivityDraft {
  const gift = GiftSchema.parse(input)
  if (gift.mode === 'sliding')
    throw new Error('Slide & Solve requires the separate sliding game launch.')
  const picture = PUZZLE_LIBRARY.find((entry) => entry.key === gift.imageKey)!
  const draft = newDraft(activityId, '2026-01-01T00:00:00.000Z')
  const title = `${picture.name} · ${GIFT_MODES.find((mode) => mode.id === gift.mode)!.name}`
  return {
    config: {
      ...draft.config,
      title,
      activityType:
        gift.mode === 'classic'
          ? 'Classic'
          : gift.mode === 'mystery'
            ? 'MysteryReveal'
            : 'Learning',
      pieceCountPreset: gift.version === 1 ? 4 : 9,
      boardShape: picture.shape,
      autoPlaceCorrectPieces: gift.mode === 'mystery',
      allowResumeLater: false,
    },
    meta: { ...draft.meta, imageKey: picture.key, optionsReviewed: true },
    questions:
      gift.version === 2
        ? GIFT_SURVEY.flatMap((template) => {
            const answer = gift.answers.find((item) => item.templateId === template.id)
            return answer
              ? [
                  {
                    id: `gift_${template.id}`,
                    questionText: surveyTemplate(answer.templateId)!.prompt,
                    hintText: 'Pick the sender’s favorite. You can try again.',
                    choices: surveyChoices(answer.templateId, answer.answer),
                  },
                ]
              : []
          })
        : gift.selections.map((selection) => {
            const template = giftTemplate(selection.templateId)!
            return {
              id: `gift_${template.id}`,
              questionText: template.prompt,
              hintText: 'The right answer is the one the sender picked. You can try again.',
              choices: template.choices.map((choice) => ({
                id: choice.id,
                text: choice.text,
                isCorrect: choice.id === selection.answerId,
              })),
            }
          }),
  }
}
