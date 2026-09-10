import { z } from 'zod'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { paths, readBasePath } from '@config/routes'
import { GIFT_CATALOG_VERSION, giftTemplate } from './giftCatalog'
import { GiftAnswerTextSchema, GIFT_SURVEY, surveyTemplate } from './giftSurvey'
import { GiftPresentationSchema } from './giftPresentation'

export const MAX_GIFT_URL_LENGTH = 3000
export const MAX_GIFT_PAYLOAD_LENGTH = 2400
const V1_URL_LIMIT = 2000
const V1_PAYLOAD_LIMIT = 1600
const PREFIX = '#gift='
export const GIFT_BACKUP_PREFIX = 'SAL0-GIFT:'
const catalogId = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/)
const GiftV1Schema = z
  .strictObject({
    version: z.literal(1),
    catalogVersion: z.literal(GIFT_CATALOG_VERSION),
    mode: z.enum(['learning', 'mystery', 'classic']),
    imageKey: catalogId.refine((key) => PUZZLE_LIBRARY.some((picture) => picture.key === key)),
    selections: z.array(z.strictObject({ templateId: catalogId, answerId: catalogId })).max(4),
    occasion: GiftPresentationSchema.shape.occasion.optional(),
    wrapper: GiftPresentationSchema.shape.wrapper.optional(),
    celebration: GiftPresentationSchema.shape.celebration.optional(),
  })
  .superRefine((gift, ctx) => {
    const needed = gift.mode === 'classic' ? 0 : 4
    if (gift.selections.length !== needed)
      ctx.addIssue({ code: 'custom', path: ['selections'], message: `Choose ${needed} questions` })
    if (
      new Set(gift.selections.map((selection) => selection.templateId)).size !==
      gift.selections.length
    ) {
      ctx.addIssue({ code: 'custom', path: ['selections'], message: 'Choose different questions' })
    }
    for (const selection of gift.selections) {
      const template = giftTemplate(selection.templateId)
      if (!template?.choices.some((choice) => choice.id === selection.answerId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['selections'],
          message: 'Unknown question or answer',
        })
      }
    }
  })
export const GiftV2Schema = z
  .strictObject({
    version: z.literal(2),
    catalogVersion: z.literal(2),
    mode: z.enum(['learning', 'mystery', 'classic']),
    imageKey: catalogId.refine((key) => PUZZLE_LIBRARY.some((picture) => picture.key === key)),
    answers: z
      .array(z.strictObject({ templateId: catalogId, answer: GiftAnswerTextSchema }))
      .max(9),
    ...GiftPresentationSchema.shape,
  })
  .superRefine((gift, ctx) => {
    const needed = gift.mode === 'classic' ? 0 : GIFT_SURVEY.length
    if (
      gift.answers.length !== needed ||
      new Set(gift.answers.map((item) => item.templateId)).size !== needed ||
      gift.answers.some((item) => !surveyTemplate(item.templateId))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['answers'],
        message:
          gift.mode === 'classic'
            ? 'Classic gifts have no questions.'
            : 'Answer all nine favorites once.',
      })
    }
  })
export const GiftSlideSchema = z.strictObject({
  version: z.literal(3),
  catalogVersion: z.literal(2),
  mode: z.literal('sliding'),
  imageKey: catalogId.refine((key) => PUZZLE_LIBRARY.some((picture) => picture.key === key)),
  answers: z.array(z.never()).length(0),
  ...GiftPresentationSchema.shape,
})
export const GiftSchema = z.discriminatedUnion('version', [
  GiftV1Schema,
  GiftV2Schema,
  GiftSlideSchema,
])
export type Gift = z.infer<typeof GiftSchema>
export type GiftMode = Gift['mode']
export type GiftSelection = z.infer<typeof GiftV1Schema>['selections'][number]
export type GiftV2 = z.infer<typeof GiftV2Schema>

function base64url(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function encodeGift(gift: Gift): string {
  const encoded = base64url(JSON.stringify(GiftSchema.parse(gift)))
  if (encoded.length > (gift.version === 1 ? V1_PAYLOAD_LIMIT : MAX_GIFT_PAYLOAD_LENGTH))
    throw new Error('This gift link is too long.')
  return PREFIX + encoded
}

export function decodeGift(hash: string, fullUrlLength = hash.length): Gift {
  try {
    if (fullUrlLength > MAX_GIFT_URL_LENGTH || !hash.startsWith(PREFIX)) throw new Error()
    const encoded = hash.slice(PREFIX.length)
    if (!encoded || encoded.length > MAX_GIFT_PAYLOAD_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded))
      throw new Error()
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
      char.charCodeAt(0),
    )
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (base64url(raw) !== encoded) throw new Error()
    const gift = GiftSchema.parse(JSON.parse(raw) as unknown)
    if (gift.version === 1 && (fullUrlLength > V1_URL_LIMIT || encoded.length > V1_PAYLOAD_LIMIT))
      throw new Error()
    return gift
  } catch {
    throw new Error(
      'This gift link is incomplete or unsupported. Ask the sender to copy the full link again.',
    )
  }
}

export function buildGiftLink(gift: Gift, origin: string, basePath = readBasePath()): string {
  const source = new URL(origin)
  if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password)
    throw new Error('Use this website to create the gift link.')
  const prefix = basePath.replace(/\/+$/, '')
  const root = origin.replace(/\/+$/, '')
  const link = `${root}${prefix && !root.endsWith(prefix) ? prefix : ''}${paths.giftPlay}${encodeGift(gift)}`
  if (link.length > (gift.version === 1 ? V1_URL_LIMIT : MAX_GIFT_URL_LENGTH))
    throw new Error('This gift link is too long to share.')
  return link
}

export function giftEmailDraft(url: string): string {
  const draft = new URL('mailto:')
  draft.search = `subject=${encodeURIComponent('A puzzle gift for you')}&body=${encodeURIComponent(`I made you a puzzle gift. Open it here:\n\n${url}\n\nIf clicking does not work, visit the main game, choose Open a gift, and paste this full link. The game website still needs to be reachable.\n\nNo sign-in needed. Progress is temporary.`)}`
  return draft.href
}

export function giftBackupCode(gift: Gift): string {
  return GIFT_BACKUP_PREFIX + encodeGift(gift).slice(PREFIX.length)
}

/** Validate pasted data locally; never visit or reuse a supplied origin. */
export function restoreGiftLink(input: string, origin: string, basePath = readBasePath()): string {
  try {
    if (input.length > MAX_GIFT_URL_LENGTH || /[\p{Cc}\p{Cf}]/u.test(input)) throw new Error()
    const text = input.trim()
    let hash: string
    if (text.startsWith(PREFIX)) hash = text
    else if (text.startsWith(GIFT_BACKUP_PREFIX))
      hash = PREFIX + text.slice(GIFT_BACKUP_PREFIX.length)
    else {
      const source = new URL(text)
      if (
        !['http:', 'https:'].includes(source.protocol) ||
        source.username ||
        source.password ||
        !/\/gifts\/play\/?$/.test(source.pathname)
      )
        throw new Error()
      hash = source.hash
    }
    const gift = decodeGift(hash, text.length)
    return buildGiftLink(gift, origin, basePath)
  } catch {
    throw new Error(
      'Paste the complete gift link or SAL0-GIFT: backup code from the sender. It must fit this website’s link limit.',
    )
  }
}

/** A chooser opening is not proof a message was sent. */
export async function shareGift(
  url: string,
  device: Pick<Navigator, 'share'> = navigator,
): Promise<'opened' | 'cancelled' | 'unavailable'> {
  if (typeof device.share !== 'function') return 'unavailable'
  try {
    await device.share({
      title: 'A puzzle gift for you',
      text: 'I made you a puzzle gift. No sign-in needed.',
      url,
    })
    return 'opened'
  } catch (error) {
    return typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError'
      ? 'cancelled'
      : 'unavailable'
  }
}
