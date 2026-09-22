import { env } from '@config/env'
import { paths, readBasePath } from '@config/routes'
import { createGiftStore, GiftIdSchema } from './giftStore'
import { restoreGiftLink } from './giftLink'

export function configuredGiftStore() {
  return env.gifts.apiBaseUrl ? createGiftStore(env.gifts.apiBaseUrl) : null
}
export function savedGiftId(search: string): string | null {
  const params = new URLSearchParams(search)
  if (!params.has('g')) return null
  if (params.getAll('g').length !== 1) throw new Error('This saved gift link is incomplete.')
  const result = GiftIdSchema.safeParse(params.get('g'))
  if (!result.success) throw new Error('This saved gift link is incomplete.')
  return result.data
}
export function buildSavedGiftLink(id: string, origin: string, basePath = readBasePath()) {
  GiftIdSchema.parse(id)
  const source = new URL(origin)
  if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password)
    throw new Error('Use this website to create the gift link.')
  return `${source.origin}${basePath.replace(/\/+$/, '')}${paths.giftPlay}?g=${id}`
}
/** Read an opaque ID only. Never follow the supplied host or use it as an API endpoint. */
export function restoreSharedGiftLink(input: string, origin: string, basePath = readBasePath()) {
  if (input.length > 3000 || /[\p{Cc}\p{Cf}]/u.test(input.replace(/[\t\r\n]/g, '')))
    throw new Error('Paste one complete gift link or backup code.')
  const tokens = input
    .trim()
    .split(/\s+/u)
    .filter((s) => /(?:[a-z][a-z\d+.-]*:\/\/|SAL0-(?:SAVED|GIFT):|#gift=)/iu.test(s))
  if (tokens.length !== 1) throw new Error('Paste one complete gift link or backup code.')
  const token = tokens[0]!
  if (token.startsWith('SAL0-SAVED:'))
    return buildSavedGiftLink(
      GiftIdSchema.parse(token.slice('SAL0-SAVED:'.length)),
      origin,
      basePath,
    )
  if (/^https?:\/\//i.test(token)) {
    const source = new URL(token)
    if (source.searchParams.has('g')) {
      if (
        source.username ||
        source.password ||
        source.hash ||
        !/\/gifts\/play\/?$/.test(source.pathname)
      )
        throw new Error('Paste one complete saved gift link.')
      return buildSavedGiftLink(savedGiftId(source.search)!, origin, basePath)
    }
  }
  return restoreGiftLink(input, origin, basePath)
}
