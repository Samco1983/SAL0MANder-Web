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
  if (blob.size > MAX_LIBRARY_IMAGE_BYTES)
    throw new Error('This picture is too large for a preview.')
  const image = new Image()
  const imageUrl = URL.createObjectURL(blob)
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
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the puzzle picture.')
    context.drawImage(image, 0, 0)
    const png = canvas.toDataURL('image/png')
    if (!png.startsWith('data:image/png;base64,'))
      throw new Error('The puzzle picture could not be prepared.')
    const pngBase64 = png.slice('data:image/png;base64,'.length)
    if (pngBase64.length > Math.ceil(MAX_LIBRARY_IMAGE_BYTES / 3) * 4)
      throw new Error('This picture is too large for a preview.')
    return { key: picture.key, pngBase64 }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
