// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGiftStore, GiftStoreError } from './giftStore'
import type { Gift } from './giftLink'
import { DEFAULT_GIFT_PRESENTATION } from './giftPresentation'
import type { CustomGift } from './giftCustom'

const gift: Gift = {
  version: 2,
  catalogVersion: 2,
  mode: 'classic',
  imageKey: 'salamander-forest',
  answers: [],
  ...DEFAULT_GIFT_PRESENTATION,
}
const id = 'A'.repeat(32)
const receipt = { id, expiresAt: '2099-01-01T00:00:00.000Z' }
afterEach(() => vi.restoreAllMocks())

describe('saved gift transport', () => {
  it('explains a server photo-review block without promising a retry or exposing server details', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: 'custom_photos_unavailable', detail: 'private provider text' },
          { status: 403 },
        ),
      )
    await expect(createGiftStore('https://example.test', fetcher).load(id)).rejects.toMatchObject({
      status: 403,
      message:
        'Photo gifts cannot be opened or shared until an image review process is connected. Choose a library-picture gift.',
    })
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('saves V4 with the shared custom-photo schema, without fragment encoding or external image URLs', async () => {
    const custom: CustomGift = {
      version: 4,
      catalogVersion: 2,
      mode: 'sliding',
      imageKey: 'custom',
      image: { id, width: 100, height: 80, contentType: 'image/png' },
      answers: [],
      ...DEFAULT_GIFT_PRESENTATION,
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt, { status: 201 }))
    expect(await createGiftStore('https://example.test', fetcher).save(custom)).toEqual(receipt)
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ gift: custom }))
  })
  it('uses explicit service base and omits credentials/referrer/cache/redirects', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(receipt, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ...receipt, gift }))
    const store = createGiftStore('https://service.example/base/', fetcher)
    expect(await store.save(gift)).toEqual(receipt)
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://service.example/base/api/gifts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ gift }),
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      }),
    )
    expect(await store.load(id)).toEqual({ ...receipt, gift })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `https://service.example/base/api/gifts/${id}`,
      expect.objectContaining({ method: 'GET' }),
    )
  })
  it.each([
    'http://public.example',
    'https://user:pass@example.test',
    'https://example.test/?token=bad',
    'https://example.test/#bad',
    'javascript:alert(1)',
  ])('rejects unsafe configuration %s', (base) => {
    expect(() => createGiftStore(base)).toThrow()
  })
  it('allows explicit loopback development and validates IDs/data before fetching', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const store = createGiftStore('http://127.0.0.1:8787', fetcher)
    expect(store.imageUrl(id)).toBe(`http://127.0.0.1:8787/api/gift-images/${id}`)
    await expect(store.load('../other')).rejects.toThrow()
    await expect(store.save({ ...gift, unexpected: true } as Gift)).rejects.toThrow()
    await expect(
      store.uploadImage(new Blob(['x'], { type: 'image/svg+xml' })),
    ).rejects.toMatchObject({ status: 400 })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([400, 404, 413, 415, 429, 503])(
    'maps status %s without exposing server response',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('sensitive provider details', { status }))
      await expect(createGiftStore('https://example.test', fetcher).load(id)).rejects.toMatchObject(
        { status },
      )
    },
  )
  it('rejects mismatched identity, expired, unexpected and oversized responses', async () => {
    for (const body of [
      { ...receipt, id: 'B'.repeat(32), gift },
      { ...receipt, expiresAt: '2000-01-01T00:00:00.000Z', gift },
      { ...receipt, gift: { ...gift, imageKey: 'unknown' } },
      { ...receipt, gift, extra: true },
    ]) {
      await expect(
        createGiftStore('https://example.test', async () => Response.json(body)).load(id),
      ).rejects.toBeInstanceOf(GiftStoreError)
    }
    await expect(
      createGiftStore('https://example.test', async () => new Response(' '.repeat(9217))).load(id),
    ).rejects.toMatchObject({ status: 502 })
  })
  it('passes the caller abort signal and does not retry uploads or saves', async () => {
    const controller = new AbortController()
    const error = new DOMException('Aborted', 'AbortError')
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort()
      throw error
    })
    await expect(
      createGiftStore('https://example.test', fetcher).save(gift, controller.signal),
    ).rejects.toBe(error)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
  it('uploads only the provided PNG blob and returns validated dimensions/capability', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ...receipt, width: 100, height: 80, contentType: 'image/png' }),
      )
    const photo = new Blob(['prepared test bytes'], { type: 'image/png' })
    expect(await createGiftStore('https://example.test', fetcher).uploadImage(photo)).toMatchObject(
      { id, width: 100, height: 80 },
    )
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/api/gift-images',
      expect.objectContaining({
        method: 'POST',
        body: photo,
        headers: { 'Content-Type': 'image/png' },
      }),
    )
  })
})
