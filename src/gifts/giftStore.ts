import { z } from 'zod'
import { encodeGift, GiftSchema } from './giftLink'
import { GiftCustomSchema } from './giftCustom'

export const GIFT_LIFETIME_SECONDS = 30 * 24 * 60 * 60
export const MAX_STORED_GIFT_BYTES = 8192
export const GiftIdSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/)
export const StoredGiftSchema = z.union([GiftSchema, GiftCustomSchema]).refine((gift) => {
  try {
    if (new TextEncoder().encode(JSON.stringify(gift)).length > MAX_STORED_GIFT_BYTES) return false
    if (gift.version !== 4) encodeGift(gift)
    return true
  } catch {
    return false
  }
}, 'The gift exceeds its version limit.')
export type StoredGift = z.infer<typeof StoredGiftSchema>
export const SaveGiftBodySchema = z.strictObject({ gift: StoredGiftSchema })
export const GiftReceiptSchema = z.strictObject({
  id: GiftIdSchema,
  expiresAt: z.iso.datetime(),
})
export type GiftReceipt = z.infer<typeof GiftReceiptSchema>
export const LoadedGiftSchema = GiftReceiptSchema.extend({ gift: StoredGiftSchema })
export type LoadedGift = z.infer<typeof LoadedGiftSchema>
export const ImageReceiptSchema = GiftReceiptSchema.extend({
  width: z.number().int().min(1).max(1024),
  height: z.number().int().min(1).max(1024),
  contentType: z.literal('image/png'),
})
export type ImageReceipt = z.infer<typeof ImageReceiptSchema>

export class GiftStoreError extends Error {
  readonly status: number
  constructor(status: number, photoReviewUnavailable = false) {
    super(
      photoReviewUnavailable
        ? 'Photo gifts cannot be opened or shared until an image review process is connected. Choose a library-picture gift.'
        : status === 404
          ? 'This saved gift is missing or expired.'
          : status === 429
            ? 'Please wait a minute before trying again.'
            : status === 400 || status === 413 || status === 415
              ? 'This gift or photo could not be saved. Check its format and size.'
              : 'Saved gifts are unavailable right now. Please try again later.',
    )
    this.name = 'GiftStoreError'
    this.status = status
  }
}

/** Explicit API configuration only. No SDK, credentials, storage, retries or UI side effects. */
export function createGiftStore(apiBase: string, fetcher: typeof fetch = globalThis.fetch) {
  const base = new URL(apiBase)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (
    (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('Use a configured HTTPS gift service URL.')
  const root = base.href.replace(/\/+$/, '')
  async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetcher(root + path, {
        ...init,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
    } catch (error) {
      if (init.signal?.aborted) throw error
      throw new GiftStoreError(503)
    }
    // Bound response reads as well as requests; never surface an upstream body in an error.
    const reader = response.body?.getReader()
    if (!reader) throw new GiftStoreError(response.ok ? 502 : response.status)
    const chunks: Uint8Array[] = []
    let count = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        count += value.length
        if (count > MAX_STORED_GIFT_BYTES + 1024) throw new GiftStoreError(502)
        chunks.push(value)
      }
      const bytes = new Uint8Array(count)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!response.ok) {
        const photoReviewUnavailable =
          response.status === 403 &&
          value !== null &&
          typeof value === 'object' &&
          'error' in value &&
          value.error === 'custom_photos_unavailable'
        throw new GiftStoreError(response.status, photoReviewUnavailable)
      }
      return schema.parse(value)
    } catch (error) {
      if (init.signal?.aborted) throw error
      if (error instanceof GiftStoreError) throw error
      if (!response.ok) throw new GiftStoreError(response.status)
      throw new GiftStoreError(502)
    } finally {
      await reader.cancel().catch(() => undefined)
    }
  }
  return {
    async save(gift: StoredGift, signal?: AbortSignal): Promise<GiftReceipt> {
      const body = JSON.stringify(SaveGiftBodySchema.parse({ gift }))
      if (new TextEncoder().encode(body).length > MAX_STORED_GIFT_BYTES)
        throw new GiftStoreError(413)
      return request('/api/gifts', GiftReceiptSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal,
      })
    },
    async load(id: string, signal?: AbortSignal): Promise<LoadedGift> {
      GiftIdSchema.parse(id)
      const result = await request(`/api/gifts/${id}`, LoadedGiftSchema, { method: 'GET', signal })
      if (result.id !== id || Date.parse(result.expiresAt) <= Date.now())
        throw new GiftStoreError(404)
      return result
    },
    async uploadImage(png: Blob, signal?: AbortSignal): Promise<ImageReceipt> {
      if (png.type !== 'image/png' || png.size === 0 || png.size > 2 * 1024 * 1024)
        throw new GiftStoreError(400)
      return request('/api/gift-images', ImageReceiptSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: png,
        signal,
      })
    },
    imageUrl(id: string): string {
      return `${root}/api/gift-images/${GiftIdSchema.parse(id)}`
    },
  }
}
export type GiftStore = ReturnType<typeof createGiftStore>
