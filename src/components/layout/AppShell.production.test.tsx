import { render, screen } from '@testing-library/react'
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

import { AppShell } from './AppShell'

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
      'SAL0MANder — cloud companion platform',
    )
    expect(screen.queryByText(/env: production/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/contract:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/api: live/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/foundation preview/i)).not.toBeInTheDocument()
  })
})
