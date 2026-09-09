import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_EDGE_PX, optimizeImage, optimizeImages } from './optimizeImages'
import type { MediaStorage, UploadInput } from './provider'

/**
 * The defect these protect against, with a number on it.
 *
 * Unity's WebGL picker accepts any image up to 12 MB and does nothing else to
 * it. The art run on 2026-09-02 measured 13.9 MB of source images coming out at
 * 932 KB — 10.3% — with no visible loss at render size. The cost of skipping
 * this is not storage, which is cheap. It is thirty students opening the same
 * activity at once on school wifi.
 */

const original = {
  createImageBitmap: globalThis.createImageBitmap,
  createElement: document.createElement.bind(document),
}

afterEach(() => {
  globalThis.createImageBitmap = original.createImageBitmap
  vi.restoreAllMocks()
})

/** Pretends the browser can decode and re-encode, so the sizing logic is testable. */
function stubBrowser(source: { width: number; height: number }, encodedBytes: number) {
  const drawn: { w: number; h: number }[] = []

  globalThis.createImageBitmap = vi.fn(async () => ({
    width: source.width,
    height: source.height,
    close: vi.fn(),
  })) as unknown as typeof createImageBitmap

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return original.createElement(tag)
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => drawn.push({ w: canvas.width, h: canvas.height }),
      }),
      toBlob: (cb: (b: Blob | null) => void) =>
        cb(new Blob([new Uint8Array(encodedBytes)], { type: 'image/webp' })),
    }
    return canvas as unknown as HTMLElement
  })

  return drawn
}

const blob = (bytes: number, type = 'image/jpeg') =>
  new Blob([new Uint8Array(bytes)], { type })

describe('optimizing an uploaded image', () => {
  it('shrinks an oversized photo to the longest-edge limit', async () => {
    const drawn = stubBrowser({ width: 4032, height: 3024 }, 400_000)
    await optimizeImage(blob(8_000_000))

    expect(drawn).toHaveLength(1)
    expect(Math.max(drawn[0]!.w, drawn[0]!.h)).toBe(MAX_EDGE_PX)
  })

  it('keeps the aspect ratio', async () => {
    const drawn = stubBrowser({ width: 4000, height: 2000 }, 300_000)
    await optimizeImage(blob(6_000_000))

    expect(drawn[0]!.w / drawn[0]!.h).toBeCloseTo(2, 2)
  })

  it('does not enlarge an image that is already smaller than the limit', async () => {
    const drawn = stubBrowser({ width: 800, height: 600 }, 50_000)
    await optimizeImage(blob(200_000))

    expect(drawn[0]).toEqual({ w: 800, h: 600 })
  })

  it('returns the smaller of the two, so it can never make a file worse', async () => {
    // Re-encoding an already-optimised WebP can produce a LARGER file. Without
    // this the wrapper would occasionally inflate exactly the files that were
    // already fine.
    stubBrowser({ width: 640, height: 640 }, 900_000)
    const input = blob(100_000, 'image/webp')

    expect(await optimizeImage(input)).toBe(input)
  })

  /**
   * SVG is vector — rasterising makes it bigger and worse. GIF may be animated,
   * and re-encoding to a still frame destroys it silently. Mangling a file is
   * worse than leaving it alone.
   */
  it.each(['image/svg+xml', 'image/gif'])('passes %s through untouched', async (type) => {
    stubBrowser({ width: 4000, height: 4000 }, 10)
    const input = blob(500_000, type)

    expect(await optimizeImage(input)).toBe(input)
  })

  it('passes the original through when the browser cannot process images', async () => {
    // Failing open is right: the upload still works, it is simply not
    // optimised, and MEDIA_LIMITS still applies.
    globalThis.createImageBitmap = undefined as unknown as typeof createImageBitmap
    const input = blob(3_000_000)

    expect(await optimizeImage(input)).toBe(input)
  })

  it('passes the original through when the file is not decodable as an image', async () => {
    globalThis.createImageBitmap = vi.fn(async () => {
      throw new Error('not an image')
    }) as unknown as typeof createImageBitmap
    const input = blob(1000, 'image/jpeg')

    expect(await optimizeImage(input)).toBe(input)
  })
})

describe('the wrapper', () => {
  function fakeStorage() {
    const seen: UploadInput[] = []
    const storage: MediaStorage = {
      name: 'fake',
      async upload(input) {
        seen.push(input)
        return { mediaId: 'm1', kind: input.kind } as never
      },
      resolveUrl: () => 'about:blank',
      remove: async () => {},
    }
    return { storage, seen }
  }

  it('hands the provider the optimised bytes, not the original', async () => {
    stubBrowser({ width: 4032, height: 3024 }, 400_000)
    const { storage, seen } = fakeStorage()

    await optimizeImages(storage).upload({ file: blob(8_000_000), kind: 'image' as never })

    expect(seen).toHaveLength(1)
    expect(seen[0]!.file.size).toBe(400_000)
  })

  it('preserves everything else about the upload', async () => {
    stubBrowser({ width: 4032, height: 3024 }, 400_000)
    const { storage, seen } = fakeStorage()
    const onProgress = vi.fn()

    await optimizeImages(storage).upload({
      file: blob(8_000_000),
      kind: 'image' as never,
      fileName: 'reef.jpg',
      onProgress,
    })

    expect(seen[0]!.fileName).toBe('reef.jpg')
    expect(seen[0]!.onProgress).toBe(onProgress)
  })

  it('keeps the provider name, so callers cannot tell it was wrapped', () => {
    const { storage } = fakeStorage()
    expect(optimizeImages(storage).name).toBe('fake')
  })
})
