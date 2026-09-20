import { expect, it } from 'vitest'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { giftComposerDefaults, giftComposerLink } from './giftComposer'

it('starts a fresh gift using only the public picture and mode', () => {
  const imageKey = PUZZLE_LIBRARY[0]!.key
  const link = giftComposerLink(imageKey, 'classic')
  expect(giftComposerDefaults(new URL(link, 'https://example.test').search)).toEqual({
    imageKey,
    mode: 'classic',
  })
  expect([...new URL(link, 'https://example.test').searchParams.keys()]).toEqual([
    'mode',
    'picture',
  ])
})

it('never copies private uploads or trusts arbitrary picture URLs and mode values', () => {
  expect(giftComposerLink('custom', 'mystery')).toBe('/gifts?mode=mystery')
  expect(
    giftComposerDefaults('?picture=https://outside.test/private.png&mode=invalid&answers=secret'),
  ).toEqual({ imageKey: '', mode: 'mystery' })
})
