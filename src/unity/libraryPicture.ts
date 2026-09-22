import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'

export const MAX_LIBRARY_IMAGE_BYTES = 2 * 1024 * 1024

/** Shared image preparation only; gameplay protocols remain separate. */
export async function prepareLibraryPicture(
  imageKey: string,
  signal: AbortSignal,
): Promise<{ key: string; pngBase64: string }> {
  signal.throwIfAborted()
  const picture = PUZZLE_LIBRARY.find((p) => p.key === imageKey)
  if (!picture) throw new Error('Choose a puzzle picture from the library.')
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const response = await fetch(`${base}${picture.src}`, { signal })
  if (!response.ok) throw new Error('The selected picture could not be loaded. Try again.')
  const blob = await response.blob()
  signal.throwIfAborted()
  if (blob.size > MAX_LIBRARY_IMAGE_BYTES)
    throw new Error('This picture is too large for a preview.')
  const image = new Image()
  const imageUrl = URL.createObjectURL(blob)
  let canvas: HTMLCanvasElement | null = null
  try {
    image.src = imageUrl
    await image.decode()
    signal.throwIfAborted()
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth > 1024 ||
      image.naturalHeight > 1024
    ) {
      throw new Error('This picture has unsupported dimensions.')
    }
    canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the puzzle picture.')
    // A small WebP can expand beyond the bridge's PNG budget. Try the original
    // resolution first, then redraw from the original at a uniform scale. Never
    // crop or progressively resample an already reduced canvas.
    const prefix = 'data:image/png;base64,'
    for (let attempt = 0; attempt < 6; attempt++) {
      signal.throwIfAborted()
      const scale = 0.75 ** attempt
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const png = canvas.toDataURL('image/png')
      signal.throwIfAborted()
      if (!png.startsWith(prefix)) throw new Error('The puzzle picture could not be prepared.')
      const pngBase64 = png.slice(prefix.length)
      const padding = pngBase64.endsWith('==') ? 2 : pngBase64.endsWith('=') ? 1 : 0
      const pngBytes = Math.floor((pngBase64.length * 3) / 4) - padding
      if (pngBytes <= MAX_LIBRARY_IMAGE_BYTES) return { key: picture.key, pngBase64 }
      // Yield between expensive encodes so navigation/cancellation can run.
      if (attempt < 5) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    throw new Error('This picture is too large for a preview.')
  } finally {
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
    image.src = ''
    URL.revokeObjectURL(imageUrl)
  }
}
