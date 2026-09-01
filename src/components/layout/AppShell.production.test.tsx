import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'

vi.mock('@config/env', () => ({
  env: {
    appName: 'SAL0MANder',
    appEnv: 'production',
    isProd: true,
    api: {
      contractVersion: 'v1',
      isConfigured: true,
    },
  },
}))

import { AppShell, visibleNav } from './AppShell'

describe('AppShell in production', () => {
  it('does not expose deployment diagnostics to students or teachers', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>Page</AppShell>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'SAL0MANder — learning puzzles for the classroom.',
    )
    expect(screen.queryByText(/env: production/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/contract:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/api: live/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/foundation preview/i)).not.toBeInTheDocument()
  })

  /**
   * The nav is what a teacher reads first, and "WebGL Host" / "Console" say
   * this is a developer build rather than a classroom product. They stayed
   * visible even with the banner and footer gated, because the nav list was
   * static.
   */
  it('does not offer developer destinations in the public navigation', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppShell>Page</AppShell>
        </MemoryRouter>
      </ThemeProvider>,
    )

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByRole('link', { name: 'WebGL Host' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Console' })).not.toBeInTheDocument()

    // What a teacher should still see.
    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Play' })).toBeInTheDocument()
  })

  /**
   * Hidden from the nav, not removed. The team's own smoke-test surfaces must
   * keep resolving in production — hiding two links must not cost them.
   */
  it('keeps internal routes reachable, just unlisted', () => {
    expect(visibleNav(false).map((i) => i.label)).toContain('Console')
    expect(visibleNav(true).map((i) => i.label)).not.toContain('Console')
  })
})
