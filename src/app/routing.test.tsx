import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, matchRoutes } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from './router'
import { paths, buildShareLink } from '@config/routes'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'

/**
 * These tests mount the *real* route table — the exported `routes` array that
 * `createBrowserRouter` is built from — rather than a hand-declared stand-in.
 *
 * The distinction matters. Every existing route test declares its own two- or
 * three-entry `<Routes>`, so all of them would keep passing if a path were
 * renamed, an `errorElement` dropped, or a `Suspense` boundary removed from the
 * table that actually ships. What a student travels was untested.
 */
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

function firstRouteMatch(path: string) {
  const [match] = matchRoutes(routes, path) ?? []
  expect(match).toBeDefined()
  return match!
}

describe('the share link a teacher hands out', () => {
  it('reaches playable content with no account prompt anywhere on the path', async () => {
    // Non-negotiable #3, asserted end to end through the shipped table: the URL
    // is built by the same helper that produces the string a teacher pastes
    // into TPT or a QR code.
    const shareLink = buildShareLink(MOCK_DEMO_ACTIVITY_ID, 'https://sal0mander.example')
    const { pathname } = new URL(shareLink)

    renderAt(pathname)

    expect(await screen.findByRole('region', { name: /game stage/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/password|email/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /sign in|log in|create account/i })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /name/i })).toBeNull()
  })

  it('routes the built link to the Guest Play route and not the catch-all', () => {
    // A route table can render the right thing for the wrong reason. This pins
    // the match itself, so renaming `/play/:activityId` without updating
    // `buildShareLink` fails here instead of in a classroom.
    const { pathname } = new URL(buildShareLink('abc123', 'https://sal0mander.example'))
    const matched = firstRouteMatch(pathname)

    expect(matched.route.path).toBe(paths.guestPlay)
    expect(matched.params.activityId).toBe('abc123')
  })

  it('survives an id that needed escaping', () => {
    const { pathname } = new URL(buildShareLink('a b/c', 'https://sal0mander.example'))
    const matched = firstRouteMatch(pathname)

    expect(matched.route.path).toBe(paths.guestPlay)
    expect(matched.params.activityId).toBe('a b/c')
  })
})

describe('a link that arrived damaged', () => {
  it('sends a truncated /play/ to Guest Play, not to the 404', async () => {
    // An LMS that wraps a link at the last slash produces exactly this. The
    // index page tells the student the link arrived incomplete and offers a way
    // forward; the 404 does neither.
    expect(firstRouteMatch('/play/').route.path).toBe(paths.guestPlayIndex)

    renderAt('/play/')
    expect(await screen.findByRole('heading', { name: /link looks incomplete/i })).toBeVisible()
    // The assertion that carries the intent: this is NOT the not-found page.
    expect(screen.queryByRole('heading', { name: /couldn.t find that page/i })).toBeNull()
  })

  it('shows the not-found page for a path that matches nothing', async () => {
    renderAt('/teacher/dashboard')
    expect(await screen.findByRole('heading', { name: /couldn.t find that page/i })).toBeVisible()
  })
})

describe('the route table itself', () => {
  it('gives every route an error boundary, so no path can render blank', () => {
    // React Router renders its own bare "Unexpected Application Error" screen
    // for a route with no `errorElement`. A student mid-activity must never
    // reach it, and a new route is the easiest way to reintroduce one.
    const unguarded = routes.filter((route) => !route.errorElement).map((route) => route.path)
    expect(unguarded).toEqual([])
  })

  it('keeps a catch-all as the last entry', () => {
    expect(routes.at(-1)?.path).toBe(paths.notFound)
  })

  it('declares a route for every canonical path', () => {
    // `paths` is the versioned contract for share-link shape. A path that has no
    // route is a link a teacher can print and a student cannot open.
    expect(routes.map((route) => route.path).sort()).toEqual(Object.values(paths).sort())
  })
})

describe('routes that download before they render', () => {
  it('tells a student something is happening instead of showing white', async () => {
    // Classroom wifi turns a chunk download into seconds. The fallback is
    // `status`, not `alert` — waiting is progress, not a problem.
    renderAt(paths.profile)

    const pending = screen.getByRole('status')
    expect(pending).toHaveTextContent(/loading/i)
    expect(screen.queryByRole('alert')).toBeNull()

    // And it does resolve to the real page.
    expect(await screen.findByRole('heading', { name: /^profile$/i })).toBeVisible()
  })

  it('loads the bare WebGL host', async () => {
    renderAt(paths.unity)
    expect(await screen.findByRole('heading', { name: /unity webgl host/i })).toBeVisible()
  })

  it('serves home eagerly, with no loading state at all', () => {
    // Home is the most common cold entry after a share link, so it is not split.
    renderAt(paths.home)
    expect(screen.queryByText(/loading/i)).toBeNull()
    expect(screen.getByRole('link', { name: /try guest play/i })).toBeVisible()
  })
})
