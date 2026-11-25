import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { resetMusicPlaylistCache } from '@content/musicPlaylist'
import { MUSIC_ENABLED_STORAGE_KEY, resetMusicRotationMemory } from '@content/musicRotation'
import { GuestPlayPage } from '@routes/guest-play/GuestPlayPage'
import { GameMusicControl } from './GameMusicControl'

beforeEach(() => {
  localStorage.clear()
  resetMusicRotationMemory()
  resetMusicPlaylistCache()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('GameMusicControl', () => {
  it('toggles music on and off, remembers the preference, and rotates on Next song', async () => {
    const user = userEvent.setup()
    const { container, unmount } = render(<GameMusicControl gameId="jigsaw" />)

    const toggle = screen.getByRole('button', { name: /music on/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const initialTrack = container.querySelector('[data-music-track]')?.getAttribute('data-music-track')
    expect(initialTrack).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /next song/i }))
    const nextTrack = container.querySelector('[data-music-track]')?.getAttribute('data-music-track')
    expect(nextTrack).toBeTruthy()
    expect(nextTrack).not.toBe(initialTrack)

    await user.click(toggle)
    expect(screen.getByRole('button', { name: /music off/i })).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY)).toBe('off')

    // Remount remembers music off.
    unmount()
    render(<GameMusicControl gameId="jigsaw" />)
    expect(screen.getByRole('button', { name: /music off/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('is visible on GuestPlayPage without opening the companion panel', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/play/${MOCK_DEMO_ACTIVITY_ID}`]}>
          <Routes>
            <Route path="/play/:activityId" element={<GuestPlayPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: /show companion/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('button', { name: /music on/i })).toBeVisible()
  })
})
