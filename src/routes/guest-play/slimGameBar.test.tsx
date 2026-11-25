import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { resetMusicPlaylistCache } from '@content/musicPlaylist'
import { resetMusicRotationMemory } from '@content/musicRotation'
import { GuestPlayPage } from './GuestPlayPage'

function installFullscreenMock() {
  let activeEl: Element | null = null
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => activeEl,
  })
  const requestFullscreen = vi.fn(async () => {
    activeEl = document.querySelector('[data-fullscreen]')
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  const exitFullscreen = vi.fn(async () => {
    activeEl = null
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: requestFullscreen,
  })
  Object.defineProperty(Document.prototype, 'exitFullscreen', {
    configurable: true,
    writable: true,
    value: exitFullscreen,
  })
  return { requestFullscreen, exitFullscreen }
}

function renderGuestPlay() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/play/${MOCK_DEMO_ACTIVITY_ID}`]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

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
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen')
  Reflect.deleteProperty(Document.prototype, 'exitFullscreen')
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
})

describe('Game page slim single bar (Part A)', () => {
  it('replaces the stacked site header with one slim bar containing Music, Next song, New picture and Full screen', async () => {
    const fs = installFullscreenMock()
    renderGuestPlay()

    // Full site navigation header must NOT appear on active game pages.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()

    // Single slim toolbar owns all game controls plus a compact home link.
    const bar = screen.getByRole('toolbar', { name: 'Game controls' })
    expect(within(bar).getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(within(bar).getByRole('button', { name: /show companion/i })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: /music on/i })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: /next song/i })).toBeInTheDocument()
    expect(
      await within(bar).findByRole('button', { name: 'New picture' }),
    ).toBeInTheDocument()
    const fullBtn = within(bar).getByRole('button', { name: 'Full screen' })
    expect(fullBtn).toBeInTheDocument()

    // Full screen toggles on the stage layout container without leaving the slim bar behind.
    await act(async () => fullBtn.click())
    expect(fs.requestFullscreen).toHaveBeenCalledOnce()
    expect(within(bar).getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument()

    await act(async () => within(bar).getByRole('button', { name: 'Exit full screen' }).click())
    expect(fs.exitFullscreen).toHaveBeenCalledOnce()
    expect(within(bar).getByRole('button', { name: 'Full screen' })).toBeInTheDocument()
  })
})
