import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ApiError } from '@api/errors'
import { ThemeProvider } from './providers/ThemeProvider'
import { RouteError } from './RouteError'
import { router } from './router'

/**
 * The boundary a student lands on when a route throws. Two things matter:
 * they get a way out, and they never see the server's own words.
 */

/** React Router logs the caught error; that noise is expected, not a failure. */
function quiet() {
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * `AppShell` renders `ThemeToggle`, which requires `ThemeProvider`. `App`
 * places the provider outside `RouterProvider`, so the boundary is always
 * inside it in production — this mirrors that nesting rather than papering
 * over it.
 */
function renderThrowing(error: unknown) {
  quiet()
  const memoryRouter = createMemoryRouter(
    [
      {
        path: '/',
        loader() {
          throw error
        },
        element: <p>should not render</p>,
        errorElement: <RouteError />,
        hydrateFallbackElement: <p>loading</p>,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <ThemeProvider>
      <RouterProvider router={memoryRouter} />
    </ThemeProvider>,
  )
}

describe('recovery', () => {
  it('always offers a way back home', async () => {
    renderThrowing(new Error('anything'))
    expect(await screen.findByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })

  it('announces itself to assistive tech', async () => {
    renderThrowing(new Error('anything'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('message selection', () => {
  it('uses the ApiError user copy, chosen from its code', async () => {
    renderThrowing(new ApiError({ code: 'not_found', message: 'internal detail' }))
    expect(await screen.findByText(/couldn't find that activity/i)).toBeInTheDocument()
  })

  it('never renders the server message, only copy derived from the code', async () => {
    // A student must never be shown a database error.
    renderThrowing(
      new ApiError({ code: 'server_error', message: 'pg: relation "activities" does not exist' }),
    )
    await screen.findByRole('alert')
    expect(document.body.textContent).not.toContain('pg:')
    expect(document.body.textContent).not.toContain('activities')
  })

  it('explains a 404 thrown as a route response', async () => {
    renderThrowing(new Response('', { status: 404 }))
    expect(await screen.findByText(/couldn't find that page/i)).toBeInTheDocument()
  })

  it('falls back to generic copy for a non-404 route response', async () => {
    renderThrowing(new Response('', { status: 500 }))
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('falls back to generic copy for a thrown value that is not an Error', async () => {
    renderThrowing('a bare string')
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('does not leak the message of an ordinary thrown Error', async () => {
    renderThrowing(new Error('Cannot read properties of undefined'))
    await screen.findByRole('alert')
    expect(document.body.textContent).not.toContain('Cannot read properties')
  })
})

describe('router wiring', () => {
  it('gives every route an error boundary', () => {
    // A route without one renders React Router's default white screen, which
    // is exactly the blank page this component exists to prevent.
    const unguarded = router.routes.filter((route) => !route.errorElement)
    expect(unguarded.map((r) => r.path ?? '(index)')).toEqual([])
  })
})
