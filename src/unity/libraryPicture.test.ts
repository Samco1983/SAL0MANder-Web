import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_LIBRARY_IMAGE_BYTES, prepareLibraryPicture } from './libraryPicture'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function fixture(width = 1024, height = 1024, decode = async () => {}) {
  const images: { src: string }[] = []
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      naturalWidth = width
      naturalHeight = height
      constructor() {
        images.push(this)
      }
      decode = decode
    },
  )
  const blob = new Blob([new Uint8Array(150_000)], { type: 'image/webp' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, blob: async () => blob })),
  )
  const revoke = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:library-picture')
      static revokeObjectURL = revoke
    },
  )
  const draw = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D)
  const encodedSizes: [number, number][] = []
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    encodedSizes.push([this.width, this.height])
    return 'data:image/png;base64,aGVsbG8='
  })
  return {
    blob, images, revoke, draw, encode, encodedSizes,
    canvas: () => encode.mock.contexts[0] as HTMLCanvasElement | undefined,
  }
}

const pngOfBytes = (bytes: number) =>
  'data:image/png;base64,' + Buffer.alloc(bytes).toString('base64')

describe('library image PNG bridge budget', () => {
  it.each([
    [1024, 1024],
    [1024, 683],
    [683, 1024],
  ])(
    'rescales a small compressed WebP whose decoded PNG exceeds the cap (%dx%d)',
    async (width, height) => {
      const f = fixture(width, height)
      const sizes: [number, number][] = []
      f.encode.mockImplementation(function (this: HTMLCanvasElement) {
        sizes.push([this.width, this.height])
        // Model an incompressible RGBA PNG, despite the small downloaded WebP.
        return pngOfBytes(this.width * this.height * 4)
      })
      const result = await prepareLibraryPicture('ai-lion-savanna-v1', new AbortController().signal)
      expect(f.blob.size).toBeLessThan(MAX_LIBRARY_IMAGE_BYTES)
      expect(Buffer.from(result.pngBase64, 'base64').length).toBeLessThanOrEqual(
        MAX_LIBRARY_IMAGE_BYTES,
      )
      expect(result.key).toBe('ai-lion-savanna-v1')
      expect(sizes[0]).toEqual([width, height])
      expect(sizes.length).toBeGreaterThan(1)
      expect(sizes.length).toBeLessThanOrEqual(6)
      for (let i = 0; i < sizes.length; i++) {
        const [w, h] = sizes[i]!
        expect(w).toBe(Math.round(width * 0.75 ** i))
        expect(h).toBe(Math.round(height * 0.75 ** i))
        // At most one output pixel of rounding; no forced square or crop.
        expect(Math.abs(h - (w * height) / width)).toBeLessThanOrEqual(1)
        expect(f.draw.mock.calls[i]).toEqual([f.images[0], 0, 0, w, h])
      }
      expect(f.images[0]!.src).toBe('')
      expect(f.revoke).toHaveBeenCalledExactlyOnceWith('blob:library-picture')
    },
  )

  it('retains original resolution and exact base64 when the first PNG already fits', async () => {
    const f = fixture(640, 480)
    const result = await prepareLibraryPicture('coral-reef', new AbortController().signal)
    expect(result.pngBase64).toBe('aGVsbG8=')
    expect(f.encodedSizes).toEqual([[640, 480]])
    expect(f.encode).toHaveBeenCalledOnce()
    expect([f.canvas()!.width, f.canvas()!.height]).toEqual([1, 1])
    expect(f.revoke).toHaveBeenCalledOnce()
  })

  it('honors the exact byte cap including base64 padding', async () => {
    const f = fixture()
    const tooLarge = pngOfBytes(MAX_LIBRARY_IMAGE_BYTES + 1)
    // MAX+1 has the same encoded length as MAX: checking string length alone misses it.
    expect(tooLarge.length).toBe(pngOfBytes(MAX_LIBRARY_IMAGE_BYTES).length)
    f.encode.mockReturnValueOnce(tooLarge).mockReturnValueOnce(pngOfBytes(MAX_LIBRARY_IMAGE_BYTES))
    const result = await prepareLibraryPicture('coral-reef', new AbortController().signal)
    expect(f.encode).toHaveBeenCalledTimes(2)
    expect(Buffer.from(result.pngBase64, 'base64').length).toBe(MAX_LIBRARY_IMAGE_BYTES)
  })

  it('bounds failed encodes and releases resources when no candidate fits', async () => {
    const f = fixture()
    f.encode.mockReturnValue(pngOfBytes(MAX_LIBRARY_IMAGE_BYTES + 100))
    await expect(prepareLibraryPicture('coral-reef', new AbortController().signal)).rejects.toThrow(
      'too large',
    )
    expect(f.encode).toHaveBeenCalledTimes(6)
    expect(f.images[0]!.src).toBe('')
    expect(f.revoke).toHaveBeenCalledOnce()
  })

  it('stops between retry passes when aborted and releases its temporary URL', async () => {
    const f = fixture()
    const controller = new AbortController()
    f.encode.mockImplementation(() => {
      setTimeout(() => controller.abort(), 0)
      return pngOfBytes(MAX_LIBRARY_IMAGE_BYTES + 100)
    })
    await expect(prepareLibraryPicture('coral-reef', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(f.encode).toHaveBeenCalledOnce()
    expect(f.images[0]!.src).toBe('')
    expect(f.revoke).toHaveBeenCalledOnce()
  })

  it.each([0, 1025])('keeps the decoded dimension restriction (%d)', async (width) => {
    const f = fixture(width, 1024)
    await expect(prepareLibraryPicture('coral-reef', new AbortController().signal)).rejects.toThrow(
      'unsupported dimensions',
    )
    expect(f.encode).not.toHaveBeenCalled()
    expect(f.revoke).toHaveBeenCalledOnce()
  })

  it('keeps the downloaded blob cap before allocating an image URL', async () => {
    fixture()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array(MAX_LIBRARY_IMAGE_BYTES + 1)]),
      })),
    )
    await expect(prepareLibraryPicture('coral-reef', new AbortController().signal)).rejects.toThrow(
      'too large',
    )
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('cleans up after a decode error without trying to draw', async () => {
    const f = fixture(640, 640, async () => {
      throw new Error('Decode failed')
    })
    await expect(prepareLibraryPicture('coral-reef', new AbortController().signal)).rejects.toThrow(
      'Decode failed',
    )
    expect(f.draw).not.toHaveBeenCalled()
    expect(f.images[0]!.src).toBe('')
    expect(f.revoke).toHaveBeenCalledOnce()
  })
})
