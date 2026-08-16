/**
 * Theme control surface.
 *
 * The token VALUES live in `tokens.css`. This module only owns *which* token
 * set is active and how that choice is persisted, so TS never hardcodes colors.
 */

export const THEME_MODES = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const THEME_STORAGE_KEY = 'sal0mander.theme'
export const DEFAULT_THEME: ThemeMode = 'system'

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/** Resolve `system` to the concrete theme the OS is currently asking for. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(stored) ? stored : DEFAULT_THEME
  } catch {
    // Private browsing / blocked storage — fall back rather than crash.
    return DEFAULT_THEME
  }
}

export function persistTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* non-fatal */
  }
}

/**
 * Stamp the choice on <html>. `system` is written through to a concrete value
 * so CSS never has to guess, while the stored preference stays `system`.
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = mode === 'system' ? resolveTheme('system') : mode
}
