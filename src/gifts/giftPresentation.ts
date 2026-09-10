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
] as const
export const GiftPresentationSchema = z.strictObject({
  occasion: z.enum(['just-because', 'birthday', 'thank-you', 'valentine']),
  wrapper: z.enum(['box', 'envelope']),
  celebration: z.enum(['confetti', 'hearts', 'balloons']),
})
export type GiftPresentation = z.infer<typeof GiftPresentationSchema>
export const DEFAULT_GIFT_PRESENTATION: GiftPresentation = {
  occasion: 'just-because',
  wrapper: 'box',
  celebration: 'confetti',
}

export function giftPresentation(gift: {
  occasion?: GiftPresentation['occasion']
  wrapper?: GiftPresentation['wrapper']
  celebration?: GiftPresentation['celebration']
}): GiftPresentation {
  return {
    occasion: gift.occasion ?? DEFAULT_GIFT_PRESENTATION.occasion,
    wrapper: gift.wrapper ?? DEFAULT_GIFT_PRESENTATION.wrapper,
    celebration: gift.celebration ?? DEFAULT_GIFT_PRESENTATION.celebration,
  }
}
