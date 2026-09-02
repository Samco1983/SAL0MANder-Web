import { MEDIA_LIMITS, type MediaStorage, type UploadInput } from './provider'

/**
 * Resize and re-encode an image before it is stored.
 *
 * ## The measurement this exists for
 *
 * Unity's WebGL picker (`Sal0manderBridge.jslib`) accepts any image up to 12 MB
 * and does nothing else to it — no resize, no re-encode. A teacher's phone photo
 * therefore reaches the activity at full size, and on the current base64 path it
 * becomes roughly 1.37x that again as text inside the activity JSON.
 *
 * The art optimisation run on 2026-09-02 measured the other end of that: twelve
 * source images totalling 13.9 MB came out at 932 KB — **10.3%** — with no
 * visible loss at the size a puzzle actually renders. One 1.2 MB original became
 * 92 KB.
 *
 * The cost is not storage, which is cheap. It is the class of thirty opening the
 * same activity at the same moment on school wifi.
 *
 * ## Why a wrapper rather than a step inside each provider
 *
 * Same reason as `guardUploads`: every provider gets the behaviour, and none of
 * them can forget it. A provider added later is optimised by construction.
 *
 * ## What it deliberately does not touch
 *
 * SVG is vector — rasterising it would make it larger and worse. GIF may be
 * animated, and re-encoding to a still frame silently destroys it. Both pass
 * through unchanged; neither is a sensible puzzle source anyway, and quietly
 * mangling a file is worse than leaving it alone.
 *
 * If the browser lacks `createImageBitmap` or `HTMLCanvasElement.toBlob`, the
 * original passes through. Failing open on a missing capability is right: the
 * upload still works, it is simply not optimised, and the size limit still
 * applies.
 */

/**
 * Longest edge, in pixels.
 *
 * A 9-piece board at this width gives each piece roughly 680px, which is beyond
 * what any classroom display resolves. Larger only costs the student download
 * time.
 */
export const MAX_EDGE_PX = 2048

/** WebP at this quality was indistinguishable from source at render size. */
export const WEBP_QUALITY = 0.8

/** Formats that must never be re-encoded — see the module note. */
const PASS_THROUGH = new Set(['image/svg+xml', 'image/gif'])

function canProcess(): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  )
}

/**
 * Returns the original blob when it should not or cannot be processed, so the
 * caller never has to distinguish "declined" from "failed".
 */
export async function optimizeImage(file: Blob): Promise<Blob> {
  if (PASS_THROUGH.has(file.type)) return file
  if (!canProcess()) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Not decodable as an image. Let validation upstream reject it rather than
    // failing here with a less useful message.
    return file
  }

  const { width, height } = bitmap
  const longest = Math.max(width, height)
  const scale = longest > MAX_EDGE_PX ? MAX_EDGE_PX / longest : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const encoded = await new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob !== 'function') return resolve(null)
    canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
  })

  if (!encoded) return file

  // Re-encoding can enlarge an already-optimised file — a small WebP redrawn at
  // the same size is not guaranteed to shrink. Keep whichever is smaller so this
  // can never make things worse.
  return encoded.size < file.size ? encoded : file
}

/** Wraps any provider so uploads are resized and re-encoded first. */
export function optimizeImages(storage: MediaStorage): MediaStorage {
  return {
    ...storage,
    async upload(input: UploadInput) {
      const file = await optimizeImage(input.file)
      return storage.upload({ ...input, file })
    },
  }
}

/**
 * What a teacher should be told before uploading, in their terms.
 *
 * `MEDIA_LIMITS.maxBytes` is the hard stop; this is the number worth showing.
 */
export const UPLOAD_GUIDANCE = {
  maxBytes: MEDIA_LIMITS.maxBytes,
  resizedTo: MAX_EDGE_PX,
} as const
