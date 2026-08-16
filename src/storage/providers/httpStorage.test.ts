import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { newId } from '@contracts/v1'
import type { RequestOptions, Transport } from '@api/transport'
import { MediaValidationError } from '../provider'
import { createHttpStorage } from './httpStorage'

/**
 * The signed-URL upload flow: intent → direct PUT to object storage → finalize.
 *
 * The property worth protecting is that bytes never travel through our API.
 * A regression that routed the file through `transport` would still pass a
 * naive "upload resolves" test, so the PUT target is asserted explicitly.
 */

const MEDIA_ID = newId()

type Recorded = { options: RequestOptions }

function fakeTransport(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: Recorded[] = []
  const transport: Transport = {
    async request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T> {
      calls.push({ options })

      if (options.path === '/media/upload-intent') {
        return schema.parse({
          mediaId: MEDIA_ID,
          uploadUrl: 'https://uploads.example.com/signed/abc?sig=xyz',
          method: 'PUT',
          headers: { 'x-goog-meta-kind': 'puzzle-image' },
          expiresAt: new Date().toISOString(),
          ...(overrides.intent as object | undefined),
        })
      }
      if (options.path.endsWith('/finalize')) {
        return schema.parse({
          id: MEDIA_ID,
          kind: 'puzzle-image',
          url: 'https://cdn.example.com/media/abc.png',
          contentType: 'image/png',
          byteSize: 2048,
          createdAt: new Date().toISOString(),
        })
      }
      return schema.parse(undefined)
    },
  }
  return { transport, calls }
}

function stubPut(status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    return { ok: status >= 200 && status < 300, status } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const png = (bytes = 2048) => ({ size: bytes, type: 'image/png' }) as Blob

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('httpStorage upload flow', () => {
  it('sends bytes straight to object storage, never through the API', async () => {
    const { transport, calls } = fakeTransport()
    const fetchMock = stubPut()

    await createHttpStorage(transport, '').upload({ file: png(), kind: 'puzzle-image' })

    const [putUrl, putInit] = fetchMock.mock.calls[0] ?? []
    expect(putUrl).toBe('https://uploads.example.com/signed/abc?sig=xyz')
    expect(putInit?.method).toBe('PUT')
    // Two API calls only — intent and finalize. The bytes are not among them.
    expect(calls.map((c) => c.options.path)).toEqual([
      '/media/upload-intent',
      `/media/${MEDIA_ID}/finalize`,
    ])
    expect(calls.every((c) => c.options.body === undefined || !(c.options.body instanceof Blob))).toBe(
      true,
    )
  })

  it('forwards the signed headers the intent supplied', async () => {
    const { transport } = fakeTransport()
    const fetchMock = stubPut()

    await createHttpStorage(transport, '').upload({ file: png(), kind: 'puzzle-image' })

    const headers = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>
    expect(headers['x-goog-meta-kind']).toBe('puzzle-image')
    expect(headers['Content-Type']).toBe('image/png')
  })

  it('describes the file to the intent endpoint without sending it', async () => {
    const { transport, calls } = fakeTransport()
    stubPut()

    await createHttpStorage(transport, '').upload({ file: png(4096), kind: 'thumbnail' })

    expect(calls[0]?.options.body).toEqual({
      kind: 'thumbnail',
      contentType: 'image/png',
      byteSize: 4096,
    })
  })

  it('finalizes with a deterministic idempotency key derived from the media id', async () => {
    // Derived rather than random, so a retry after a reload targets the same
    // write instead of creating a second media record.
    const { transport, calls } = fakeTransport()
    stubPut()

    await createHttpStorage(transport, '').upload({ file: png(), kind: 'puzzle-image' })

    expect(calls[1]?.options.idempotencyKey).toBe(MEDIA_ID)
  })

  it('enforces the upload guard before asking for a signed URL', async () => {
    const { transport, calls } = fakeTransport()
    const fetchMock = stubPut()

    await expect(
      createHttpStorage(transport, '').upload({
        file: { size: 99e6, type: 'image/png' } as Blob,
        kind: 'puzzle-image',
      }),
    ).rejects.toBeInstanceOf(MediaValidationError)

    // No signed URL is minted for a file that was never going to be accepted.
    expect(calls).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not finalize when the PUT fails', async () => {
    const { transport, calls } = fakeTransport()
    stubPut(403)

    await expect(
      createHttpStorage(transport, '').upload({ file: png(), kind: 'puzzle-image' }),
    ).rejects.toThrow(/403/)

    // A finalize after a failed PUT would register media whose bytes are absent.
    expect(calls.map((c) => c.options.path)).toEqual(['/media/upload-intent'])
  })

  it('propagates an abort signal to both the API and the byte upload', async () => {
    const { transport, calls } = fakeTransport()
    const fetchMock = stubPut()
    const controller = new AbortController()

    await createHttpStorage(transport, '').upload({
      file: png(),
      kind: 'puzzle-image',
      signal: controller.signal,
    })

    expect(calls[0]?.options.signal).toBe(controller.signal)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})

describe('httpStorage remove', () => {
  it('deletes through the API and tolerates an empty response', async () => {
    const { transport, calls } = fakeTransport()
    await createHttpStorage(transport, '').remove(MEDIA_ID)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.options.method).toBe('DELETE')
    expect(calls[0]?.options.path).toBe(`/media/${MEDIA_ID}`)
  })

  it('encodes an id that would otherwise break the path', async () => {
    const { transport, calls } = fakeTransport()
    await createHttpStorage(transport, '').remove('a/b?c')
    expect(calls[0]?.options.path).toBe('/media/a%2Fb%3Fc')
  })
})

describe('httpStorage resolveUrl', () => {
  const descriptor = (url: string) =>
    ({ url }) as Parameters<ReturnType<typeof createHttpStorage>['resolveUrl']>[0]

  it('returns an absolute URL untouched', () => {
    const storage = createHttpStorage(fakeTransport().transport, 'https://cdn.example.com')
    expect(storage.resolveUrl(descriptor('https://other.example.com/a.png'))).toBe(
      'https://other.example.com/a.png',
    )
  })

  it('joins a relative path onto the CDN base', () => {
    const storage = createHttpStorage(fakeTransport().transport, 'https://cdn.example.com')
    expect(storage.resolveUrl(descriptor('media/a.png'))).toBe('https://cdn.example.com/media/a.png')
  })

  it('never produces a doubled slash', () => {
    const storage = createHttpStorage(fakeTransport().transport, 'https://cdn.example.com//')
    expect(storage.resolveUrl(descriptor('/media/a.png'))).toBe('https://cdn.example.com/media/a.png')
  })

  it('falls back to the stored url when no CDN base is configured', () => {
    const storage = createHttpStorage(fakeTransport().transport, '')
    expect(storage.resolveUrl(descriptor('/media/a.png'))).toBe('/media/a.png')
  })
})
