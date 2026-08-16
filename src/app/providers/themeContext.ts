import { createContext } from 'react'
import type { ThemeMode } from '@design/theme'

export type ThemeContextValue = {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

/** Kept out of ThemeProvider.tsx so that file exports only components (fast refresh). */
export const ThemeContext = createContext<ThemeContextValue | null>(null)
