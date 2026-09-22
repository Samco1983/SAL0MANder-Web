import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { createRoutes } from '@app/router'

it.each(['', '/school'])(
  'loads the real lesson route without losing deployment base %s',
  async (base) => {
    const router = createMemoryRouter(createRoutes('puzzles'), {
      basename: base || '/',
      initialEntries: [base + '/learn'],
    })
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Find your next math lesson',
    )
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Math Lessons',
      }),
    ).toHaveAttribute('href', base + '/learn')
  },
)

it.each(['puzzles', 'tutoring'] as const)(
  'uses the explicit %s home without changing shared Guest/Gift routes',
  async (mode) => {
    const router = createMemoryRouter(createRoutes(mode), {
      basename: '/school',
      initialEntries: ['/school/'],
    })
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      mode === 'tutoring' ? 'Private tutoring' : 'Mystery Pictures',
    )
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getByRole('link', { name: 'Puzzle Practice' })).toHaveAttribute(
      'href',
      '/school/play',
    )
    expect(nav.getByRole('link', { name: 'Puzzle Gifts' })).toHaveAttribute('href', '/school/gifts')
    expect(nav.getByRole('link', { name: 'Math Lessons' })).toHaveAttribute('href', '/school/learn')
  },
)
