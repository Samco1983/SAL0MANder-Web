import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'

vi.mock('@config/env', () => ({
  env: {
    appName: 'SAL0MANder',
    appEnv: 'development',
    isProd: false,
    api: {
      contractVersion: 'v1',
      isConfigured: true,
    },
  },
}))

import { AppShell } from './AppShell'

function renderShell(nav?: boolean) {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AppShell {...(nav === undefined ? {} : { nav })}>Page</AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('AppShell nav prop', () => {
  it('shows the internal site nav and dev banner by default', () => {
    renderShell()

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByText(/foundation preview/i)).toBeInTheDocument()
  })

  it('hides the internal nav and dev banner on a distribution-critical surface', () => {
    // Guest Play sets nav={false} — a student who scanned a handout QR has no
    // use for Home/Profile/Console, and on a real phone the wrapped nav plus
    // the dev banner squeezed the Unity stage to a sliver of the viewport.
    renderShell(false)

    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.queryByText(/foundation preview/i)).not.toBeInTheDocument()
    // The brand mark stays — a student should still see they're on SAL0MANder.
    expect(screen.getByRole('link', { name: /SAL0MANder home/i })).toBeInTheDocument()
  })
})
