import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { paths } from '@config/routes'
import { GIFT_MODES } from './giftCatalog'
import type { GiftMode } from './giftLink'

/** Carry only public library choices forward, never the sender's answers or uploaded photo. */
export function giftComposerLink(pictureKey?: string, mode: GiftMode = 'mystery') {
  const query = new URLSearchParams({ mode })
  if (PUZZLE_LIBRARY.some((picture) => picture.key === pictureKey))
    query.set('picture', pictureKey!)
  return `${paths.gifts}?${query}`
}

export function giftComposerDefaults(search: string): { imageKey: string; mode: GiftMode } {
  const query = new URLSearchParams(search)
  return {
    imageKey: PUZZLE_LIBRARY.find((picture) => picture.key === query.get('picture'))?.key ?? '',
    mode: GIFT_MODES.find((mode) => mode.id === query.get('mode'))?.id ?? 'mystery',
  }
}
