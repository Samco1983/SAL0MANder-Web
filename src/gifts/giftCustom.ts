import { z } from 'zod'
import { GiftPresentationSchema } from './giftPresentation'
import { GiftAnswerTextSchema, GIFT_SURVEY, surveyTemplate } from './giftSurvey'

/** Custom photos are saved server-side. A V4 gift is never embedded in a URL fragment. */
export const GiftCustomSchema = z
  .strictObject({
    version: z.literal(4),
    catalogVersion: z.literal(2),
    mode: z.enum(['learning', 'mystery', 'classic', 'sliding']),
    imageKey: z.literal('custom'),
    image: z.strictObject({
      id: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
      width: z.number().int().min(1).max(1024),
      height: z.number().int().min(1).max(1024),
      contentType: z.literal('image/png'),
    }),
    answers: z
      .array(
        z.strictObject({
          templateId: z
            .string()
            .min(1)
            .max(40)
            .regex(/^[a-z0-9-]+$/),
          answer: GiftAnswerTextSchema,
        }),
      )
      .max(9),
    ...GiftPresentationSchema.shape,
  })
  .superRefine((gift, ctx) => {
    const needed = gift.mode === 'classic' || gift.mode === 'sliding' ? 0 : GIFT_SURVEY.length
    if (
      gift.answers.length !== needed ||
      new Set(gift.answers.map((answer) => answer.templateId)).size !== needed ||
      gift.answers.some((answer) => !surveyTemplate(answer.templateId))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['answers'],
        message: needed ? 'Answer all nine favorites once.' : 'This mode has no questions.',
      })
    }
  })
export type CustomGift = z.infer<typeof GiftCustomSchema>
