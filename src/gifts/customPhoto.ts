export type PreparedCustomPhoto = {
  png: Blob
  pngBase64: string
  width: number
  height: number
}

const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_PNG_BYTES = 2 * 1024 * 1024
const MAX_SOURCE_EDGE = 16384
const MAX_SOURCE_PIXELS = 48_000_000
const MAX_OUTPUT_EDGE = 1024
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
type Dimensions = { width: number; height: number }
type Decoded = Dimensions & { image: CanvasImageSource; dispose(): void }

function validDimensions(size: Dimensions, maxEdge = MAX_SOURCE_EDGE): void {
  if (
    !Number.isInteger(size.width) ||
    !Number.isInteger(size.height) ||
    size.width < 1 ||
    size.height < 1 ||
    size.width > maxEdge ||
    size.height > maxEdge ||
    size.width * size.height > MAX_SOURCE_PIXELS
  )
    throw new Error('Choose a photo no larger than 48 megapixels or 16,384 pixels per side.')
}

/** Abort promptly, and release a decoder result that arrives after cancellation. */
function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  discard?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const abort = () => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      reject(signal.reason ?? new DOMException('Photo preparation cancelled.', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        if (settled || signal.aborted) {
          discard?.(value)
          if (!settled) abort()
        } else {
          settled = true
          resolve(value)
        }
      },
      (error) => {
        signal.removeEventListener('abort', abort)
        if (!settled) {
          settled = true
          reject(error)
        }
      },
    )
    if (signal.aborted) abort()
  })
}

function pngDimensions(bytes: Uint8Array): Dimensions {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 33 || !signature.every((value, i) => bytes[i] === value))
    throw new Error('The picture is not a valid PNG image.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452)
    throw new Error('The PNG picture has an invalid header.')
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** Header bounds prevent a compressed oversized image being sent to the decoder. */
function sourceDimensions(bytes: Uint8Array, type: string): Dimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (type === 'image/png') return pngDimensions(bytes)
  if (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 0xff) break
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === undefined || marker === 0xda || marker === 0xd9) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) break
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) break
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (length < 8) break
        return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) }
      }
      offset += length
    }
  }
  if (
    type === 'image/webp' &&
    bytes.length >= 30 &&
    view.getUint32(0) === 0x52494646 &&
    view.getUint32(8) === 0x57454250 &&
    view.getUint32(4, true) + 8 === bytes.length
  ) {
    const chunk = view.getUint32(12),
      length = view.getUint32(16, true)
    if (20 + length <= bytes.length) {
      if (chunk === 0x56503858 && length >= 10)
        // VP8X extended canvas
        return {
          width: 1 + (view.getUint32(24, true) & 0xffffff),
          height: 1 + (view.getUint32(26, true) >>> 8),
        }
      if (
        chunk === 0x56503820 &&
        length >= 10 &&
        bytes[23] === 0x9d &&
        bytes[24] === 0x01 &&
        bytes[25] === 0x2a
      )
        return {
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff,
        }
      if (chunk === 0x5650384c && length >= 5 && bytes[20] === 0x2f) {
        const bits = view.getUint32(21, true)
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
      }
    }
  }
  throw new Error('Choose a valid JPEG, PNG or WebP photo.')
}

async function decode(blob: Blob, signal: AbortSignal): Promise<Decoded> {
  signal.throwIfAborted()
  if (typeof createImageBitmap === 'function') {
    const bitmap = await abortable(
      createImageBitmap(blob, { imageOrientation: 'from-image' }),
      signal,
      (value) => value.close(),
    )
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  }
  // Safari/older browsers without ImageBitmap still decode only a local blob URL.
  const image = new Image()
  const url = URL.createObjectURL(blob)
  const dispose = () => {
    image.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        image.onload = image.onerror = null
        signal.removeEventListener('abort', abort)
      }
      const abort = () => {
        cleanup()
        reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'))
      }
      image.onload = () => {
        cleanup()
        resolve()
      }
      image.onerror = () => {
        cleanup()
        reject(new Error('This photo could not be decoded. Choose another photo.'))
      }
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      else image.src = url
    })
    signal.throwIfAborted()
    return { image, width: image.naturalWidth, height: image.naturalHeight, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}

/** User-selected local file only. Redrawing strips source metadata and retains the whole photo. */
export async function prepareCustomPhoto(
  file: File,
  signal: AbortSignal,
): Promise<PreparedCustomPhoto> {
  signal.throwIfAborted()
  if (!PHOTO_TYPES.has(file.type) || file.size < 1 || file.size > MAX_FILE_BYTES)
    throw new Error('Choose a JPEG, PNG or WebP photo up to 12 MiB.')
  const bytes = new Uint8Array(await abortable(file.arrayBuffer(), signal))
  signal.throwIfAborted()
  validDimensions(sourceDimensions(bytes, file.type))
  const decoded = await decode(file, signal)
  let canvas: HTMLCanvasElement | undefined
  try {
    signal.throwIfAborted()
    validDimensions(decoded)
    canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the photo.')
    let scale = Math.min(1, MAX_OUTPUT_EDGE / decoded.width, MAX_OUTPUT_EDGE / decoded.height)
    for (let attempt = 0; attempt < 12; attempt++) {
      signal.throwIfAborted()
      canvas.width = Math.max(1, Math.floor(decoded.width * scale))
      canvas.height = Math.max(1, Math.floor(decoded.height * scale))
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height)
      const png = await abortable(
        new Promise<Blob>((resolve, reject) =>
          canvas!.toBlob((blob) => {
            if (!blob || blob.type !== 'image/png' || blob.size === 0)
              reject(new Error('The photo could not be encoded as PNG.'))
            else resolve(blob)
          }, 'image/png'),
        ),
        signal,
      )
      signal.throwIfAborted()
      if (png.size <= MAX_PNG_BYTES) {
        const pngBytes = new Uint8Array(await abortable(png.arrayBuffer(), signal))
        signal.throwIfAborted()
        const actual = pngDimensions(pngBytes)
        if (actual.width !== canvas.width || actual.height !== canvas.height)
          throw new Error('The photo encoder returned unexpected dimensions.')
        return { png, pngBase64: base64(pngBytes), width: actual.width, height: actual.height }
      }
      if (canvas.width === 1 && canvas.height === 1) break
      scale *= Math.min(0.85, Math.sqrt(MAX_PNG_BYTES / png.size) * 0.9)
    }
    throw new Error('This photo could not fit the puzzle image size limit. Choose another photo.')
  } finally {
    decoded.dispose()
    if (canvas) canvas.width = canvas.height = 0
  }
}

/** Call only with giftStore.imageUrl(id), never a recipient- or author-supplied URL. */
export async function loadSavedCustomPhoto(
  url: string,
  expected: Dimensions,
  signal: AbortSignal,
): Promise<PreparedCustomPhoto> {
  signal.throwIfAborted()
  validDimensions(expected, MAX_OUTPUT_EDGE)
  const address = new URL(url)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
  if (
    (address.protocol !== 'https:' && !(address.protocol === 'http:' && loopback)) ||
    address.username ||
    address.password ||
    address.search ||
    address.hash ||
    !/\/api\/gift-images\/[A-Za-z0-9_-]{32}$/.test(address.pathname)
  )
    throw new Error('The saved photo address is invalid.')
  const response = await abortable(
    fetch(address.href, {
      signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    }),
    signal,
    (value) => {
      void value.body?.cancel().catch(() => undefined)
    },
  )
  if (signal.aborted) {
    void response.body?.cancel().catch(() => undefined)
    signal.throwIfAborted()
  }
  if (
    !response.ok ||
    response.redirected ||
    response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'image/png'
  ) {
    void response.body?.cancel().catch(() => undefined)
    throw new Error('The saved photo could not be loaded as PNG.')
  }
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_PNG_BYTES)) {
    void response.body?.cancel().catch(() => undefined)
    throw new Error('The saved photo exceeds the size limit.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The saved photo has no readable image data.')
  const chunks: Uint8Array[] = []
  let count = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await abortable(reader.read(), signal)
      signal.throwIfAborted()
      if (done) break
      count += value.byteLength
      if (count > MAX_PNG_BYTES) throw new Error('The saved photo exceeds the size limit.')
      chunks.push(value)
    }
  } finally {
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(count)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const dimensions = pngDimensions(bytes)
  validDimensions(dimensions, MAX_OUTPUT_EDGE)
  if (dimensions.width !== expected.width || dimensions.height !== expected.height)
    throw new Error('The saved photo dimensions do not match this gift.')
  const png = new Blob([bytes], { type: 'image/png' })
  const decoded = await decode(png, signal)
  try {
    signal.throwIfAborted()
    if (decoded.width !== expected.width || decoded.height !== expected.height)
      throw new Error('The saved photo could not be decoded at its expected dimensions.')
    return { png, pngBase64: base64(bytes), ...dimensions }
  } finally {
    decoded.dispose()
  }
}
