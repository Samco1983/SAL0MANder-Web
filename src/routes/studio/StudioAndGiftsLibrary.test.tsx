import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { newDraft } from '@studio/activityDraft'
import { giftToDraft } from '@/gifts/giftActivity'
import { GiftPicturePicker } from '@routes/gifts/GiftPicturePicker'
import { ImagePanel } from './ImagePanel'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('Teacher Studio and Puzzle Gifts share the full puzzle library', () => {
  it('shows all PUZZLE_LIBRARY entries in Teacher Studio with BASE_URL-safe thumbnails and photo credits', async () => {
    vi.stubEnv('BASE_URL', '/SAL0MANder-Web/')
    const user = userEvent.setup()

    function Harness() {
      const [draft, setDraft] = useState(() => newDraft('act_lib_test', '2026-11-25T00:00:00Z'))
      return (
        <>
          <output data-testid="selected-key">{draft.meta.imageKey}</output>
          <output data-testid="board-shape">{draft.config.boardShape}</output>
          <output data-testid="preset-index">{draft.config.imagePresetIndex}</output>
          <ImagePanel draft={draft} onChange={setDraft} />
        </>
      )
    }

    render(<Harness />)

    const pickButtons = screen.getAllByRole('button', { pressed: false })
    expect(pickButtons).toHaveLength(PUZZLE_LIBRARY.length)

    // Rover expedition and verified photos are both present with BASE_URL prefixes.
    const roverImg = screen.getByRole('img', { name: /rover/i })
    expect(roverImg.getAttribute('src')).toMatch(/^\/SAL0MANder-Web\/images\/library\//)

    const puppies = PUZZLE_LIBRARY.find((item) => item.key === 'sleeping-puppies')!
    expect(screen.getByRole('link', { name: puppies.photoCredit!.author })).toHaveAttribute(
      'href',
      puppies.photoCredit!.source,
    )

    // Filtering by search finds the puppy photos and resets cleanly.
    await user.type(screen.getByRole('searchbox', { name: 'Find a picture' }), 'puppies')
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Sleeping puppies/i }))
    expect(screen.getByTestId('selected-key')).toHaveTextContent('sleeping-puppies')
    expect(screen.getByTestId('board-shape')).toHaveTextContent('Landscape')
    expect(screen.getByTestId('preset-index')).toHaveTextContent('-1')

    await user.click(screen.getByRole('button', { name: 'Show all pictures' }))
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(PUZZLE_LIBRARY.length - 1)
  })

  it('allows Puzzle Gifts to pick and convert every PUZZLE_LIBRARY picture without falling back to legacy presets', () => {
    vi.stubEnv('BASE_URL', '/SAL0MANder-Web/')
    render(<GiftPicturePicker selectedKey="" onSelect={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(PUZZLE_LIBRARY.length)

    for (const picture of PUZZLE_LIBRARY) {
      const draft = giftToDraft(
        {
          version: 2,
          catalogVersion: 2,
          mode: 'classic',
          imageKey: picture.key,
          answers: [],
          occasion: 'just-because',
          wrapper: 'box',
          celebration: 'confetti',
        },
        `gift_${picture.key}`,
      )
      expect(draft.meta.imageKey).toBe(picture.key)
      expect(draft.config.boardShape).toBe(picture.shape)
      expect(draft.config.imagePresetIndex).toBe(-1)
    }
  })
})
