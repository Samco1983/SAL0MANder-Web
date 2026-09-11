import { z } from 'zod'

/** Version 2 stems and suggestions are stable so a shared favorite stays meaningful. */
export const GIFT_SURVEY = [
  {
    id: 'color',
    label: 'Favorite color',
    ask: 'What color always catches your eye?',
    prompt: 'What color always catches my eye?',
    suggestions: ['Blue', 'Green', 'Purple', 'Red'],
  },
  {
    id: 'ice-cream',
    label: 'Favorite ice cream',
    ask: 'What’s your go-to ice cream flavor?',
    prompt: 'What is my go-to ice cream flavor?',
    suggestions: ['Chocolate', 'Vanilla', 'Strawberry', 'Mint chocolate chip'],
  },
  {
    id: 'movie',
    label: 'Favorite movie',
    ask: 'Which movie could you watch again?',
    prompt: 'Which movie could I watch again?',
    suggestions: ['Toy Story', 'Frozen', 'The Lion King', 'Moana'],
  },
  {
    id: 'animal',
    label: 'Favorite animal',
    ask: 'Which animal is your favorite?',
    prompt: 'Which animal is my favorite?',
    suggestions: ['Dog', 'Cat', 'Panda', 'Dolphin'],
  },
  {
    id: 'season',
    label: 'Favorite season',
    ask: 'Which season do you look forward to most?',
    prompt: 'Which season do I look forward to most?',
    suggestions: ['Spring', 'Summer', 'Autumn', 'Winter'],
  },
  {
    id: 'snack',
    label: 'Favorite snack',
    ask: 'What snack would you pick for movie night?',
    prompt: 'What snack would I pick for movie night?',
    suggestions: ['Popcorn', 'Pretzels', 'Cookies', 'Fruit'],
  },
  {
    id: 'drink',
    label: 'Favorite drink',
    ask: 'What’s your favorite drink?',
    prompt: 'What is my favorite drink?',
    suggestions: ['Water', 'Lemonade', 'Tea', 'Hot chocolate'],
  },
  {
    id: 'music',
    label: 'Favorite music style',
    ask: 'What kind of music puts you in a good mood?',
    prompt: 'What kind of music puts me in a good mood?',
    suggestions: ['Pop', 'Rock', 'Jazz', 'Classical'],
  },
  {
    id: 'weekend',
    label: 'Favorite weekend activity',
    ask: 'What’s your favorite way to spend a free afternoon?',
    prompt: 'What is my favorite way to spend a free afternoon?',
    suggestions: ['Reading', 'Hiking', 'Gaming', 'Cooking'],
  },
] as const

/** Composer-only ideas. Keep these separate from the stable puzzle alternatives above. */
export const GIFT_SURVEY_IDEAS = {
  color: { icon: '🎨', shortLabel: 'Color', extra: ['Teal', 'Gold'] },
  'ice-cream': { icon: '🍦', shortLabel: 'Ice cream', extra: ['Cookie dough', 'Salted caramel'] },
  movie: { icon: '🎬', shortLabel: 'Movie', extra: ['Back to the Future', 'Spirited Away'] },
  animal: { icon: '🐾', shortLabel: 'Animal', extra: ['Fox', 'Otter'] },
  season: { icon: '🍂', shortLabel: 'Season', extra: [] },
  snack: { icon: '🍿', shortLabel: 'Snack', extra: ['Chips', 'Cheese and crackers'] },
  drink: { icon: '🥤', shortLabel: 'Drink', extra: ['Coffee', 'Sparkling water'] },
  music: { icon: '🎵', shortLabel: 'Music', extra: ['R&B', 'Hip-hop'] },
  weekend: { icon: '🌻', shortLabel: 'Free time', extra: ['Painting', 'Beach day'] },
} as const satisfies Record<
  (typeof GIFT_SURVEY)[number]['id'],
  { icon: string; shortLabel: string; extra: readonly string[] }
>

export const MAX_GIFT_ANSWER_CHARACTERS = 40
export const MAX_GIFT_ANSWER_BYTES = 64
export function normalizeGiftAnswer(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}
export function giftAnswerKey(value: string): string {
  return normalizeGiftAnswer(value).toLowerCase()
}

const unsafeText = /[<>\p{Cc}\p{Cf}\p{Cs}]/u
export const GiftAnswerTextSchema = z
  .string()
  .max(256)
  // Check before collapsing whitespace: newlines/tabs must not disappear into accepted input.
  .refine(
    (value) => !unsafeText.test(value.normalize('NFKC')),
    'Use plain text without markup or control characters.',
  )
  .transform(normalizeGiftAnswer)
  .refine((value) => [...value].length > 0, 'Add a short answer.')
  .refine(
    (value) =>
      [...value].length <= MAX_GIFT_ANSWER_CHARACTERS &&
      new TextEncoder().encode(value).byteLength <= MAX_GIFT_ANSWER_BYTES,
    'Please use a shorter answer (up to 40 characters).',
  )

export function surveyTemplate(id: string) {
  return GIFT_SURVEY.find((template) => template.id === id)
}

/** The sender's answer is correct; three distinct catalog suggestions are the alternatives. */
export function surveyChoices(templateId: string, answer: string) {
  const template = surveyTemplate(templateId)
  if (!template) throw new Error('Unknown gift question')
  const text = GiftAnswerTextSchema.parse(answer)
  const used = new Set([giftAnswerKey(text)])
  const alternatives = template.suggestions
    .filter((suggestion) => {
      const key = giftAnswerKey(suggestion)
      if (used.has(key)) return false
      used.add(key)
      return true
    })
    .slice(0, 3)
    .map((suggestion, index) => ({
      id: `other_${index}`,
      text: String(suggestion),
      isCorrect: false,
    }))
  const position = GIFT_SURVEY.findIndex((item) => item.id === templateId) % 4
  alternatives.splice(position, 0, { id: 'favorite', text, isCorrect: true })
  return alternatives
}
