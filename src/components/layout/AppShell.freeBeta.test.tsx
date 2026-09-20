import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { PUBLIC_TUTORING_BOOKING_URL } from '@config/classroom'
import { AppShell } from './AppShell'

const config = vi.hoisted(() => ({
  accounts: false,
  booking: undefined as string | undefined,
  siteMode: 'puzzles' as 'puzzles' | 'tutoring',
}))
vi.mock('@config/env', async (load) => {
  const original = await load<typeof import('@config/env')>()
  return {
    ...original,
    env: {
      ...original.env,
      isProd: true,
      get siteMode() {
        return config.siteMode
      },
      get features() {
        return { ...original.env.features, accounts: config.accounts }
      },
      get classroom() {
        return original.readEnv({ VITE_CLASSROOM_BOOKING_URL: config.booking }).classroom
      },
      sites: { tutoring: 'https://salomandermath.com', puzzles: '' },
    },
  }
})

beforeEach(() => {
  config.accounts = false
  config.booking = undefined
  config.siteMode = 'puzzles'
})

function show() {
  render(
    <ThemeProvider>
      <MemoryRouter basename="/school" initialEntries={['/school/']}>
        <AppShell>Free practice</AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )
  return within(screen.getByRole('navigation', { name: 'Main' }))
}

describe('free beta navigation', () => {
  it('hides disabled accounts, keeps local drafts, and uses the real default booking destination', () => {
    const nav = show()
    expect(nav.queryByRole('link', { name: 'Profile' })).toBeNull()
    expect(nav.getByRole('link', { name: 'Teacher Studio drafts' })).toHaveAttribute(
      'href',
      '/school/studio',
    )
    expect(nav.getByRole('link', { name: 'Book Tutoring' })).toHaveAttribute(
      'href',
      PUBLIC_TUTORING_BOOKING_URL,
    )
    expect(nav.getByRole('link', { name: 'Puzzle Practice' })).toHaveAttribute(
      'href',
      '/school/play',
    )
    expect(nav.getByRole('link', { name: 'Puzzle Gifts' })).toHaveAttribute('href', '/school/gifts')
    expect(nav.queryByRole('link', { name: 'WebGL Host' })).toBeNull()
  })

  it('keeps account navigation conditional on its existing feature flag', () => {
    config.accounts = true
    expect(show().getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/school/profile')
  })

  it.each(['', 'https://salomandermath.com'])(
    'uses an inquiry when booking is disabled or invalid: %s',
    (booking) => {
      config.booking = booking
      config.siteMode = 'tutoring'
      const nav = show()
      expect(nav.queryByRole('link', { name: 'Book Tutoring' })).toBeNull()
      expect(nav.getByRole('link', { name: 'Ask about tutoring' })).toHaveAttribute(
        'href',
        'mailto:sal@salomandermath.com?subject=Tutoring%20inquiry',
      )
      const persistent = screen
        .getAllByRole('link', { name: 'Ask about tutoring' })
        .find((link) => !link.closest('nav'))
      expect(persistent).toHaveAttribute(
        'href',
        'mailto:sal@salomandermath.com?subject=Tutoring%20inquiry',
      )
      expect(nav.queryByRole('link', { name: 'Teacher Studio drafts' })).toBeNull()
    },
  )
})
