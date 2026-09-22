import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'

it.each(['', '/school'])(
  'opens the real Sound library route with its footer link under %s',
  async (base) => {
    const router = createMemoryRouter(routes, {
      basename: base || '/',
      initialEntries: [base + '/sounds'],
    })
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Sound library')
    expect(
      within(screen.getByRole('navigation', { name: 'Site information' })).getByRole('link', {
        name: 'Sound library',
      }),
    ).toHaveAttribute('href', base + '/sounds')
    expect(screen.getByRole('link', { name: 'Make a puzzle gift' })).toHaveAttribute(
      'href',
      base + '/gifts',
    )
    expect(document.querySelector('audio, canvas')).toBeNull()
  },
)
