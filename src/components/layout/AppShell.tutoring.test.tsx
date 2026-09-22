import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'

vi.mock('@config/env', () => ({
  env: {
    appName: 'SAL0MANder Math',
    siteMode: 'tutoring',
    isProd: true,
    sites: { tutoring: '', puzzles: 'https://sal0mander.com' },
    classroom: { bookingUrl: 'https://calendar.app.google/AbCdEfGh12345678' },
  },
}))

import { AppShell } from './AppShell'

it('keeps booking visible outside the closed menu and links practice to the game', () => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AppShell>Lesson content</AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  )
  expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  const booking = screen.getByRole('link', { name: 'Book a lesson' })
  expect(booking).toHaveAttribute('href', 'https://calendar.app.google/AbCdEfGh12345678')
  expect(booking.closest('nav')).toBeNull()
  const nav = within(screen.getByRole('navigation', { name: 'Main' }))
  expect(nav.getByRole('link', { name: 'Puzzle Gifts' })).toHaveAttribute(
    'href',
    'https://sal0mander.com/gifts',
  )
  expect(nav.queryByRole('link', { name: 'Profile' })).toBeNull()
  expect(nav.queryByRole('link', { name: /Teacher Studio/ })).toBeNull()
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
    'href',
    'mailto:sal@salomandermath.com',
  )
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    'live math tutoring and puzzle practice',
  )
})
