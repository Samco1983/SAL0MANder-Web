import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { THEME_STORAGE_KEY } from '@design/theme'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

/** A matchMedia whose value can be changed, as the OS would. */
function stubMatchMedia(initialDark: boolean) {
  const listeners = new Set<() => void>()
  let dark = initialDark

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      get matches() {
        return query.includes('dark') ? dark : false
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })),
  })

  return {
    /** The user flips their OS to dark mode while the page is open. */
    setDark(next: boolean) {
      dark = next
      act(() => listeners.forEach((fn) => fn()))
    },
    get listenerCount() {
      return listeners.size
    },
  }
}

function Probe() {
  const { mode, resolved, setMode } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setMode('dark')}>go dark</button>
      <button onClick={() => setMode('system')}>go system</button>
    </div>
  )
}

const renderProvider = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

const stamped = () => document.documentElement.dataset.theme

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => vi.restoreAllMocks())

describe('initial state', () => {
  it('starts on system and resolves it against the OS', () => {
    stubMatchMedia(true)
    renderProvider()

    expect(screen.getByTestId('mode')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(stamped()).toBe('dark')
  })

  it('restores a stored preference on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    stubMatchMedia(true)
    renderProvider()

    // Explicit choice wins over the OS.
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(stamped()).toBe('light')
  })
})

describe('following the OS while on system', () => {
  it('re-resolves when the OS flips', () => {
    // The case a static read misses entirely: the user changes their system
    // appearance with the page already open.
    const media = stubMatchMedia(false)
    renderProvider()
    expect(stamped()).toBe('light')

    media.setDark(true)

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(stamped()).toBe('dark')
  })

  it('stops following once an explicit choice is made', () => {
    const media = stubMatchMedia(false)
    renderProvider()

    act(() => screen.getByText('go dark').click())
    expect(stamped()).toBe('dark')

    // The OS goes light; the explicit choice must not be overridden.
    media.setDark(false)
    expect(stamped()).toBe('dark')
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
  })

  it('resumes following when the user returns to system', () => {
    const media = stubMatchMedia(true)
    renderProvider()

    act(() => screen.getByText('go dark').click())
    act(() => screen.getByText('go system').click())

    expect(stamped()).toBe('dark')
    media.setDark(false)
    expect(stamped()).toBe('light')
  })

  it('removes its listener on unmount', () => {
    // A provider that leaks listeners accumulates one per mount, and each one
    // writes to the document after its component is gone.
    const media = stubMatchMedia(false)
    const { unmount } = renderProvider()
    expect(media.listenerCount).toBe(1)

    unmount()
    expect(media.listenerCount).toBe(0)
  })

  it('does not subscribe at all for an explicit mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const media = stubMatchMedia(false)
    renderProvider()
    expect(media.listenerCount).toBe(0)
  })
})

describe('choosing a mode', () => {
  it('persists the choice so it survives a reload', () => {
    stubMatchMedia(false)
    renderProvider()

    act(() => screen.getByText('go dark').click())

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('persists system as system, not as its resolved value', () => {
    // Storing "dark" here would freeze the user out of OS-following forever.
    stubMatchMedia(true)
    renderProvider()

    act(() => screen.getByText('go dark').click())
    act(() => screen.getByText('go system').click())

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })
})

describe('useTheme outside a provider', () => {
  it('fails loudly rather than silently returning nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)
  })
})
