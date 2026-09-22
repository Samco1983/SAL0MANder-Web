import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSavedCustomPhoto, prepareCustomPhoto } from './customPhoto'

const MiB = 1024 * 1024
const imageUrl = 'https://gifts.example/api/gift-images/' + 'a'.repeat(32)
const controller = () => new AbortController()
function png(width: number, height: number, size = 33): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  view.setUint32(12, 0x49484452)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}
function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
    0xff,
    0xd9,
  ])
}
function webp(width: number, height: number, kind = 'VP8X'): Uint8Array {
  const bytes = new Uint8Array(30),
    view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, 22, true)
  bytes.set(new TextEncoder().encode('WEBP' + kind), 8)
  view.setUint32(16, 10, true)
  if (kind === 'VP8X') {
    for (let i = 0; i < 3; i++) {
      bytes[24 + i] = (width - 1) >>> (i * 8)
      bytes[27 + i] = (height - 1) >>> (i * 8)
    }
  } else if (kind === 'VP8L') {
    bytes[20] = 0x2f
    view.setUint32(21, ((height - 1) << 14) | (width - 1), true)
  } else {
    bytes.set([0x9d, 1, 0x2a], 23)
    view.setUint16(26, width, true)
    view.setUint16(28, height, true)
  }
  return bytes
}
function file(bytes: Uint8Array, type = 'image/png'): File {
  return new NodeFile([bytes], 'my-photo', { type }) as unknown as File
}
const originalCreate = document.createElement.bind(document)
let close: ReturnType<typeof vi.fn>, draw: ReturnType<typeof vi.fn>
let canvases: HTMLCanvasElement[]
let dimensions: { width: number; height: number }
let encode: (width: number, height: number) => Blob | null
beforeEach(() => {
  close = vi.fn()
  draw = vi.fn()
  canvases = []
  dimensions = { width: 1600, height: 900 }
  encode = (width, height) =>
    new NodeBlob([png(width, height)], { type: 'image/png' }) as unknown as Blob
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ ...dimensions, close })),
  )
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = originalCreate(tag)
    if (tag === 'canvas') canvases.push(element as HTMLCanvasElement)
    return element
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
  ) {
    expect(type).toBe('image/png')
    callback(encode(this.width, this.height))
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Browser image decoding/encoding is mocked. The production parsers, scaling,
// cancellation, resource ownership and request policies execute unchanged.
describe('local custom photo preparation', () => {
  it.each(['image/svg+xml', 'image/gif', '', 'text/html'])(
    'rejects %s before decoding',
    async (type) => {
      await expect(
        prepareCustomPhoto(file(png(10, 10), type), controller().signal),
      ).rejects.toThrow('JPEG, PNG or WebP')
      expect(createImageBitmap).not.toHaveBeenCalled()
    },
  )
  it('rejects empty and oversized files before reading/decoding', async () => {
    for (const bytes of [new Uint8Array(), new Uint8Array(12 * MiB + 1)])
      await expect(prepareCustomPhoto(file(bytes), controller().signal)).rejects.toThrow('12 MiB')
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it.each([
    [10000, 5000],
    [16385, 1],
    [0, 30],
  ])('rejects header dimensions %i×%i before decode', async (w, h) => {
    await expect(prepareCustomPhoto(file(png(w, h)), controller().signal)).rejects.toThrow(
      '48 megapixels',
    )
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('rejects MIME/signature mismatch and truncated headers', async () => {
    for (const input of [file(png(10, 10), 'image/jpeg'), file(new Uint8Array([137, 80, 78]))])
      await expect(prepareCustomPhoto(input, controller().signal)).rejects.toThrow()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it.each(['VP8X', 'VP8L', 'VP8 '])(
    'accepts bounded %s WebP headers and decodes the file',
    async (kind) => {
      const input = file(webp(1600, 900, kind), 'image/webp')
      const result = await prepareCustomPhoto(input, controller().signal)
      expect(createImageBitmap).toHaveBeenCalledWith(input, { imageOrientation: 'from-image' })
      expect([result.width, result.height]).toEqual([1024, 576])
    },
  )
  it('retains an entire landscape JPEG in a fresh PNG, with no crop or source metadata reuse', async () => {
    const input = file(jpeg(1600, 900), 'image/jpeg')
    const result = await prepareCustomPhoto(input, controller().signal)
    expect([result.width, result.height]).toEqual([1024, 576])
    expect(draw).toHaveBeenCalledWith(expect.any(Object), 0, 0, 1024, 576)
    expect(result.png).not.toBe(input)
    expect(result.png.type).toBe('image/png')
    expect(atob(result.pngBase64).length).toBe(result.png.size)
    expect(close).toHaveBeenCalledTimes(1)
    expect(canvases[0]?.width).toBe(0)
  })
  it('honors decoded EXIF orientation and never enlarges a small photo', async () => {
    dimensions = { width: 90, height: 160 }
    const result = await prepareCustomPhoto(file(jpeg(160, 90), 'image/jpeg'), controller().signal)
    expect([result.width, result.height]).toEqual([90, 160])
    expect(draw).toHaveBeenCalledWith(expect.any(Object), 0, 0, 90, 160)
  })
  it('checks actual decoded bounds too and releases a rejected bitmap', async () => {
    dimensions = { width: 10000, height: 6000 }
    await expect(prepareCustomPhoto(file(png(10, 10)), controller().signal)).rejects.toThrow(
      '48 megapixels',
    )
    expect(close).toHaveBeenCalledOnce()
    expect(draw).not.toHaveBeenCalled()
  })
  it('does not accept a valid header when the browser cannot decode its image', async () => {
    vi.mocked(createImageBitmap).mockRejectedValue(new Error('bad compressed image'))
    await expect(prepareCustomPhoto(file(png(1600, 900)), controller().signal)).rejects.toThrow(
      'bad compressed image',
    )
    expect(draw).not.toHaveBeenCalled()
  })
  it('reduces dimensions when PNG exceeds 2 MiB while preserving the whole image', async () => {
    let calls = 0
    encode = (width, height) =>
      new NodeBlob([png(width, height, ++calls === 1 ? 2 * MiB + 1 : 40)], {
        type: 'image/png',
      }) as unknown as Blob
    const result = await prepareCustomPhoto(file(png(1600, 900)), controller().signal)
    expect(calls).toBe(2)
    expect(result.width).toBeLessThan(1024)
    expect(Math.abs(result.width / result.height - 16 / 9)).toBeLessThan(0.005)
    expect(
      draw.mock.calls.every((call) => call.length === 5 && call[1] === 0 && call[2] === 0),
    ).toBe(true)
    expect(result.png.size).toBeLessThanOrEqual(2 * MiB)
  })
  it.each(['null', 'wrong-type', 'wrong-size'])(
    'rejects a %s codec result and releases resources',
    async (kind) => {
      encode = (width, height) =>
        kind === 'null'
          ? null
          : (new NodeBlob([png(width + (kind === 'wrong-size' ? 1 : 0), height)], {
              type: kind === 'wrong-type' ? 'image/webp' : 'image/png',
            }) as unknown as Blob)
      await expect(prepareCustomPhoto(file(png(1600, 900)), controller().signal)).rejects.toThrow()
      expect(close).toHaveBeenCalledOnce()
      expect(canvases[0]?.height).toBe(0)
    },
  )
  it('bounds repeated oversized codec output instead of retrying forever', async () => {
    encode = (w, h) =>
      new NodeBlob([png(w, h, 2 * MiB + 1)], { type: 'image/png' }) as unknown as Blob
    await expect(prepareCustomPhoto(file(png(1600, 900)), controller().signal)).rejects.toThrow(
      'size limit',
    )
    expect(draw.mock.calls.length).toBeLessThanOrEqual(12)
    expect(close).toHaveBeenCalledOnce()
  })
  it('does nothing when already cancelled', async () => {
    const abort = controller()
    abort.abort()
    await expect(prepareCustomPhoto(file(png(1600, 900)), abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('cancels a pending file read before any decoder or canvas is created', async () => {
    const abort = controller(),
      input = file(png(1600, 900))
    let read!: (value: ArrayBuffer) => void
    vi.spyOn(input, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          read = resolve
        }),
    )
    const result = prepareCustomPhoto(input, abort.signal)
    abort.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    read(png(1600, 900).buffer as ArrayBuffer)
    await Promise.resolve()
    expect(createImageBitmap).not.toHaveBeenCalled()
    expect(canvases).toHaveLength(0)
  })
  it('rejects promptly during decoding, then closes the late bitmap exactly once', async () => {
    const abort = controller()
    let decoded!: (value: ImageBitmap) => void
    vi.mocked(createImageBitmap).mockImplementation(
      () =>
        new Promise((resolve) => {
          decoded = resolve
        }),
    )
    const result = prepareCustomPhoto(file(png(1600, 900)), abort.signal)
    await vi.waitFor(() => expect(createImageBitmap).toHaveBeenCalledOnce())
    abort.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    decoded({ ...dimensions, close } as unknown as ImageBitmap)
    await Promise.resolve()
    expect(close).toHaveBeenCalledOnce()
    expect(draw).not.toHaveBeenCalled()
  })
  it('cancels during PNG encoding without returning stale photo data', async () => {
    const abort = controller()
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(() => {
      abort.abort()
    })
    await expect(prepareCustomPhoto(file(png(1600, 900)), abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(close).toHaveBeenCalledOnce()
    expect(canvases[0]?.width).toBe(0)
  })
  it('uses and revokes a local image URL when ImageBitmap is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1600
        naturalHeight = 900
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
        removeAttribute = vi.fn()
      },
    )
    const revoke = vi.fn()
    class PhotoURL extends URL {
      static createObjectURL = vi.fn(() => 'blob:owned-photo')
      static revokeObjectURL = revoke
    }
    vi.stubGlobal('URL', PhotoURL)
    const result = await prepareCustomPhoto(file(png(1600, 900)), controller().signal)
    expect(result.width).toBe(1024)
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned-photo')
  })
  it('cancels the fallback image decoder and revokes only its owned URL', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const abort = controller(),
      remove = vi.fn(),
      revoke = vi.fn()
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1600
        naturalHeight = 900
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) {
          abort.abort()
        }
        removeAttribute = remove
      },
    )
    class PhotoURL extends URL {
      static createObjectURL = vi.fn(() => 'blob:cancelled-photo')
      static revokeObjectURL = revoke
    }
    vi.stubGlobal('URL', PhotoURL)
    await expect(prepareCustomPhoto(file(png(1600, 900)), abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:cancelled-photo')
    expect(remove).toHaveBeenCalledExactlyOnceWith('src')
    expect(draw).not.toHaveBeenCalled()
  })
  it('releases decoded resources when canvas creation has no usable context', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    await expect(prepareCustomPhoto(file(png(1600, 900)), controller().signal)).rejects.toThrow(
      'browser',
    )
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('configured saved-photo loading', () => {
  function response(
    bytes: Uint8Array,
    headers: Record<string, string> = { 'Content-Type': 'image/png' },
  ): Response {
    return new Response(bytes as Uint8Array<ArrayBuffer>, { status: 200, headers })
  }
  it('uses the configured image endpoint policy and returns exact PNG bytes without re-encoding/enlarging', async () => {
    dimensions = { width: 100, height: 75 }
    const bytes = png(100, 75)
    const fetcher = vi.fn(async () => response(bytes))
    vi.stubGlobal('fetch', fetcher)
    const abort = controller(),
      result = await loadSavedCustomPhoto(imageUrl, dimensions, abort.signal)
    expect(fetcher).toHaveBeenCalledWith(imageUrl, {
      signal: abort.signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
    expect([result.width, result.height, result.png.size]).toEqual([100, 75, bytes.length])
    expect(Uint8Array.from(atob(result.pngBase64), (c) => c.charCodeAt(0))).toEqual(bytes)
    expect(draw).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
  it.each([
    'data:image/png;base64,a',
    'https://user:pass@gifts.example/api/gift-images/' + 'a'.repeat(32),
    'https://gifts.example/arbitrary.png',
    'http://gifts.example/api/gift-images/' + 'a'.repeat(32),
  ])('rejects invalid configured endpoint %s without fetch', async (url) => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(
      loadSavedCustomPhoto(url, { width: 1, height: 1 }, controller().signal),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['image/jpeg', 'text/html', ''])(
    'rejects MIME %s even with PNG-looking bytes',
    async (type) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response(png(10, 10), { 'Content-Type': type })),
      )
      await expect(
        loadSavedCustomPhoto(imageUrl, { width: 10, height: 10 }, controller().signal),
      ).rejects.toThrow('PNG')
      expect(createImageBitmap).not.toHaveBeenCalled()
    },
  )
  it('rejects an oversized declared body before decoding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response(png(10, 10), {
          'Content-Type': 'image/png',
          'Content-Length': String(2 * MiB + 1),
        }),
      ),
    )
    await expect(
      loadSavedCustomPhoto(imageUrl, { width: 10, height: 10 }, controller().signal),
    ).rejects.toThrow('size limit')
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('bounds chunked reads even without Content-Length and cancels the stream', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({
      start(stream) {
        stream.enqueue(new Uint8Array(2 * MiB))
        stream.enqueue(new Uint8Array(1))
      },
      cancel,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'image/png' } })),
    )
    await expect(
      loadSavedCustomPhoto(imageUrl, { width: 10, height: 10 }, controller().signal),
    ).rejects.toThrow('size limit')
    expect(cancel).toHaveBeenCalledOnce()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it.each(['signature', 'dimension'])('rejects wrong %s before decoding', async (issue) => {
    const bytes = png(10, 10)
    if (issue === 'signature') bytes[0] = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(bytes)),
    )
    await expect(
      loadSavedCustomPhoto(
        imageUrl,
        { width: issue === 'dimension' ? 9 : 10, height: 10 },
        controller().signal,
      ),
    ).rejects.toThrow()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('requires actual decoded dimensions to match the saved receipt', async () => {
    dimensions = { width: 20, height: 10 }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(png(10, 10))),
    )
    await expect(
      loadSavedCustomPhoto(imageUrl, { width: 10, height: 10 }, controller().signal),
    ).rejects.toThrow('expected dimensions')
    expect(close).toHaveBeenCalledOnce()
  })
  it('cancels a stalled stream promptly and releases its reader', async () => {
    const abort = controller(),
      cancel = vi.fn()
    const body = new ReadableStream({ cancel })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'image/png' } })),
    )
    const result = loadSavedCustomPhoto(imageUrl, { width: 10, height: 10 }, abort.signal)
    await vi.waitFor(() => expect(body.locked).toBe(true))
    abort.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('rejects promptly during fetch and cancels a response that arrives later', async () => {
    const abort = controller(),
      cancel = vi.fn()
    let fetched!: (value: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            fetched = resolve
          }),
      ),
    )
    const result = loadSavedCustomPhoto(imageUrl, { width: 10, height: 10 }, abort.signal)
    abort.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    fetched(
      new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'image/png' } }),
    )
    await Promise.resolve()
    expect(cancel).toHaveBeenCalledOnce()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
})
