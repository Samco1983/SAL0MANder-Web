import { z } from 'zod'

export const GIFT_OCCASIONS = [
  {
    id: 'just-because',
    name: 'Just because',
    message: 'A little surprise, just for you.',
    suggested: 'confetti',
  },
  {
    id: 'birthday',
    name: 'Birthday',
    message: 'Happy birthday! Here’s to a wonderful year.',
    suggested: 'balloons',
  },
  {
    id: 'thank-you',
    name: 'Thank you',
    message: 'Thank you. You’re appreciated!',
    suggested: 'confetti',
  },
  {
    id: 'valentine',
    name: 'Valentine',
    message: 'Happy Valentine’s Day! Sending a little love.',
    suggested: 'hearts',
  },
  {
    id: 'graduation',
    name: 'Graduation',
    message: 'You did it! Here’s to your next adventure.',
    suggested: 'confetti',
  },
  {
    id: 'anniversary',
    name: 'Anniversary',
    message: 'Happy anniversary! Here’s to more memories together.',
    suggested: 'hearts',
  },
  {
    id: 'cheer-up',
    name: 'A little encouragement',
    message: 'You’ve got this. I’m cheering you on!',
    suggested: 'balloons',
  },
] as const

export const MAX_OCCASION_CHARACTERS = 48
export const OccasionTextSchema = z
  .string()
  .max(192)
  .refine(
    (value) => !/[<>\p{Cc}\p{Cf}\p{Cs}]/u.test(value.normalize('NFKC')),
    'Use plain text without markup or line breaks.',
  )
  .transform((value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' '))
  .refine((value) => [...value].length > 0, 'Add your occasion or leave the field empty.')
  .refine(
    (value) =>
      [...value].length <= MAX_OCCASION_CHARACTERS &&
      new TextEncoder().encode(value).byteLength <= 80,
    'Keep your message to 48 characters (shorter for some symbols).',
  )

export const GiftPresentationSchema = z.strictObject({
  occasion: z.enum([
    'just-because',
    'birthday',
    'thank-you',
    'valentine',
    'graduation',
    'anniversary',
    'cheer-up',
  ]),
  occasionText: OccasionTextSchema.optional(),
  wrapper: z.enum(['box', 'envelope']),
  celebration: z.enum(['confetti', 'hearts', 'balloons']),
})
export type GiftPresentation = z.infer<typeof GiftPresentationSchema>
export const DEFAULT_GIFT_PRESENTATION: GiftPresentation = {
  occasion: 'just-because',
  wrapper: 'box',
  celebration: 'confetti',
}

export function giftPresentation(gift: Partial<GiftPresentation>): GiftPresentation {
  return {
    occasion: gift.occasion ?? DEFAULT_GIFT_PRESENTATION.occasion,
    wrapper: gift.wrapper ?? DEFAULT_GIFT_PRESENTATION.wrapper,
    celebration: gift.celebration ?? DEFAULT_GIFT_PRESENTATION.celebration,
    ...(gift.occasionText ? { occasionText: gift.occasionText } : {}),
  }
}

export function giftGreeting(presentation: GiftPresentation): string {
  return (
    presentation.occasionText ??
    GIFT_OCCASIONS.find((item) => item.id === presentation.occasion)!.message
  )
}
