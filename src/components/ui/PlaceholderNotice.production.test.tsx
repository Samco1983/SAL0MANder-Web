import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'

/**
 * The production half of `PlaceholderNotice.tsx`'s contract.
 *
 * This is the regression that already happened once. `deploy.yml` states, in a
 * comment explaining why `VITE_APP_ENV` must be set, that the public site would
 * otherwise render "every <PlaceholderNotice> listing what is not built yet".
 * The banner and the env badge were gated behind `env.isProd`; the notice never
 * was. The comment described the intention, the code did not implement it, and
 * nothing anywhere failed — so `/profile`, which is in the production
 * navigation, opened onto "Accounts are not enabled" above a six-item list of
 * unbuilt features, and a student who expanded Guest Play's companion panel was
 * offered "Player profile, badges, credits — pending".
 *
 * A screenshot of the fix proves today. This proves it stays fixed, which is
 * what the comment in `deploy.yml` was already relying on.
 */
vi.mock('@config/env', () => ({
  env: {
    appName: 'SAL0MANder',
    appEnv: 'production',
    isProd: true,
    features: { accounts: false },
    api: { contractVersion: 'v1', isConfigured: true },
  },
}))

import { PlaceholderNotice } from './PlaceholderNotice'
import { ProfilePage } from '@routes/profile/ProfilePage'

describe('PlaceholderNotice in production', () => {
  it('renders nothing at all', () => {
    const { container } = render(
      <PlaceholderNotice
        title="Accounts are not enabled"
        pending={['Auth provider and account model — pending architecture approval']}
      >
        Profiles add persistence on top of play.
      </PlaceholderNotice>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * Through a real route rather than the component alone: the leak was never a
   * bug in the notice, it was three call sites that did not guard it. Rendering
   * the page is what proves the guard sits where a fourth caller cannot miss it.
   */
  it('leaves no "not built yet" copy on a page in the public navigation', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.queryByText(/accounts are not enabled/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pending product approval/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pending architecture approval/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^placeholder$/i)).not.toBeInTheDocument()

    // The page still has its actual content — gating the scaffolding must not
    // empty the route it was sitting on.
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText(/playing as a guest/i)).toBeInTheDocument()
  })
})
