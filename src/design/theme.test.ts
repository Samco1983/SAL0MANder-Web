import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  isThemeMode,
  persistTheme,
  readStoredTheme,
  resolveTheme,
} from './theme'

/** Pretend the OS is asking for dark, or light, or has no opinion at all. */
function stubPrefersDark(matches: boolean | 'unsupported') {
  if (matches === 'unsupported') {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })
    return
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('dark') ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => vi.restoreAllMocks())

describe('mode validation', () => {
  it('accepts the three real modes and nothing else', () => {
    for (const good of ['light', 'dark', 'system']) expect(isThemeMode(good)).toBe(true)
    for (const bad of ['Dark', 'sepia', '', null, undefined, 1, {}]) {
      expect(isThemeMode(bad)).toBe(false)
    }
  })
})

describe('resolving system to something concrete', () => {
  it('follows the OS preference', () => {
    stubPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')
    stubPrefersDark(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('leaves an explicit choice alone, whatever the OS says', () => {
    stubPrefersDark(true)
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('falls back to light where matchMedia does not exist', () => {
    // Older embedded webviews, and jsdom without a shim.
    stubPrefersDark('unsupported')
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('reading the stored preference', () => {
  it('returns a previously stored mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('ignores a corrupted value rather than trusting it', () => {
    // Anything could be in localStorage — another app, an old version, a user.
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse')
    expect(readStoredTheme()).toBe(DEFAULT_THEME)
  })

  it('defaults to system when nothing is stored', () => {
    expect(readStoredTheme()).toBe('system')
  })

  it('survives storage being blocked', () => {
    // Private mode or an embedded frame: reading throws rather than returning null.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(readStoredTheme()).toBe(DEFAULT_THEME)
  })
})

describe('persisting', () => {
  it('writes the choice', () => {
    persistTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    // A theme that fails to persist is a nuisance; a crash is not acceptable.
    expect(() => persistTheme('dark')).not.toThrow()
  })
})

describe('stamping the document', () => {
  it('writes an explicit mode straight through', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('resolves system to a concrete value, so CSS never has to guess', () => {
    stubPrefersDark(true)
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('dark')

    stubPrefersDark(false)
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('overwrites a previous value rather than accumulating', () => {
    applyTheme('dark')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
