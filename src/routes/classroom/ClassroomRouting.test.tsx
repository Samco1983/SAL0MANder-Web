import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { PUBLIC_TUTORING_BOOKING_URL } from '@config/classroom'

it.each(['', '/school'])(
  'opens the classroom route with external booking and base-preserving practice under %s',
  async (base) => {
    const router = createMemoryRouter(routes, {
      basename: base || '/',
      initialEntries: [base + '/classroom'],
    })
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/Private tutoring/)
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Book Tutoring',
      }),
    ).toHaveAttribute('href', PUBLIC_TUTORING_BOOKING_URL)
    expect(screen.getByRole('link', { name: 'Open puzzle practice' })).toHaveAttribute(
      'href',
      base + '/play',
    )
  },
)
