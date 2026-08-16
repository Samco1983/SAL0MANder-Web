import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ThemeMode,
} from '@design/theme'
import { ThemeContext } from './themeContext'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredTheme())
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(mode))

  useEffect(() => {
    applyTheme(mode)
    setResolved(resolveTheme(mode))

    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return

    // Follow the OS live while the user is on `system`.
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      applyTheme('system')
      setResolved(resolveTheme('system'))
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    persistTheme(next)
  }, [])

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
