import { useTheme } from '@app/providers/useTheme'
import { THEME_MODES, type ThemeMode } from '@design/theme'
import { Button } from '@components/ui/Button'

const LABEL: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

/** Cycles light → dark → system. Small surface, no final UX implied. */
export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const next = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length] ?? 'system'

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setMode(next)}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[mode]}`}
    >
      {LABEL[mode]}
    </Button>
  )
}
