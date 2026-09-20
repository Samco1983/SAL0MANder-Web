import type { PuzzlePicture } from '@content/puzzleLibrary'
import type { PreparedCustomPhoto } from './customPhoto'
export function customGiftPicture(photo: PreparedCustomPhoto): PuzzlePicture {
  return {
    key: 'custom',
    name: 'Your gift photo',
    category: 'Places',
    shape:
      photo.width === photo.height
        ? 'Square'
        : photo.width > photo.height
          ? 'Landscape'
          : 'Portrait',
    width: photo.width,
    height: photo.height,
    alt: 'The personal photo chosen by the gift sender.',
    src: `data:image/png;base64,${photo.pngBase64}`,
  }
}
export function giftPictureSrc(picture: PuzzlePicture) {
  if (picture.key === 'custom' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(picture.src))
    return picture.src
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${picture.src}`
}
