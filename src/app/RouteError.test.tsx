import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { RouteError } from './RouteError'
import { NotFoundPage } from '@routes/not-found/NotFoundPage'
import { ApiError } from '@api/errors'

/**
 * Renders a route that throws, so the real error boundary handles it exactly as
 * it would in the app. Throwing inside a loader is what React Router actually
 * routes to `errorElement`; rendering `<RouteError />` directly would test the
 * component and not the wiring.
 */
function renderThrowingRoute(thrown: unknown) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <p>ok</p>,
        loader: () => {
          throw thrown
        },
        errorElement: <RouteError />,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

function renderUnknownRoute(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>home</p> },
      { path: '*', element: <NotFoundPage />, errorElement: <RouteError /> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('unknown routes', () => {
  it('shows the not-found page rather than a blank screen', async () => {
    renderUnknownRoute('/this/does/not/exist')
    expect(await screen.findByRole('heading', { name: /couldn.t find that page/i })).toBeVisible()
  })

  it('offers a way back into play, not only the home page', async () => {
    // The likely visitor is a student whose share link was mistyped or wrapped
    // by an LMS. Sending them to marketing copy is a dead end.
    renderUnknownRoute('/play/')
    const guestPlay = await screen.findByRole('link', { name: /enter a class code/i })
    expect(guestPlay).toHaveAttribute('href', '/play')
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })

  it('never asks an unknown-route visitor to sign in', async () => {
    renderUnknownRoute('/nope')
    expect(screen.queryByText(/sign in|log in|create an account|email/i)).toBeNull()
  })
})

describe('render errors', () => {
  it('announces the failure to assistive technology', async () => {
    renderThrowingRoute(new Error('kaboom'))
    expect(await screen.findByRole('alert')).toBeVisible()
  })

  it('shows an ApiError user message, never its internals', async () => {
    const apiError = new ApiError({
      code: 'conflict',
      message: 'internal: activity 8842 unpublished by teacher_id=1201',
      status: 409,
    })
    renderThrowingRoute(apiError)

    expect(await screen.findByText(apiError.userMessage)).toBeVisible()
    // The raw server message names an internal identifier. It must not surface.
    expect(screen.queryByText(/teacher_id/i)).toBeNull()
    expect(screen.queryByText(/8842/)).toBeNull()
  })

  it('leaks no stack trace into the rendered page', async () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at secretModule (/Users/someone/private/path.ts:42:7)'
    renderThrowingRoute(error)

    await screen.findByRole('alert')
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\bat \w+ \(/)
    expect(text).not.toMatch(/\/Users\//)
    expect(text).not.toMatch(/secretModule/)
  })

  it('offers recovery navigation home', async () => {
    renderThrowingRoute(new Error('kaboom'))
    expect(await screen.findByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})

describe('a stale chunk after a deploy', () => {
  // Every play route is lazy, so an open tab holds the chunk hashes from when it
  // loaded. Deploy while a student has Guest Play open and the next navigation
  // requests a file that no longer exists.
  const messages = [
    'Failed to fetch dynamically imported module: https://example.com/assets/GuestPlay-abc123.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 42 failed.',
  ]

  it.each(messages)('offers Reload, not a dead link: %s', async (message) => {
    renderThrowingRoute(new Error(message))

    expect(await screen.findByRole('button', { name: /reload/i })).toBeVisible()
    // "Back to home" cannot fix this — home requests the same missing manifest,
    // so the student would fail a second time.
    expect(screen.queryByRole('link', { name: /back to home/i })).toBeNull()
  })

  it('actually reloads when the button is pressed', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    })

    try {
      const user = userEvent.setup()
      renderThrowingRoute(new Error('Failed to fetch dynamically imported module: /x.js'))
      await user.click(await screen.findByRole('button', { name: /reload/i }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('does not mistake an ordinary error for a stale chunk', async () => {
    renderThrowingRoute(new Error('the module could not compute the answer'))
    expect(await screen.findByRole('link', { name: /back to home/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /reload/i })).toBeNull()
  })
})
