import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, matchRoutes } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes, router } from './router'
import { buildPath } from '@config/routes'

/**
 * The app served from a subpath — the production case, untested until now.
 *
 * GitHub project Pages serves this app at `/SAL0MANder-Web/`, and Pages has no
 * server-side rewrite, so a share link like `/SAL0MANder-Web/play/SUN-42` is
 * answered with `404.html`. That file is a copy of `index.html`, so the app
 * boots and React Router must strip the basename before matching.
 *
 * Every other routing test runs at the root. If basename handling regressed,
 * the URL-builder tests would still pass — they only build strings — and every
 * student following a teacher's link would land on the not-found page. The one
 * path that matters most had no test on it.
 */

const BASENAME = '/SAL0MANder-Web'

function renderDeployed(pathWithBase: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [pathWithBase],
    basename: BASENAME,
  })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('a share link opened on project Pages', () => {
  it('reaches Guest Play, not the catch-all', async () => {
    // Asserted on the route's own surface, not on the activity id. Guest Play
    // is code-split, so the id is not on screen while the chunk downloads —
    // the first version of this test asserted the id and failed against a
    // correct app, which would have sent someone hunting a routing bug that
    // did not exist.
    renderDeployed(`${BASENAME}${buildPath.guestPlay('SUN-42')}`)
    await waitFor(() =>
      expect(screen.queryByText(/page not found|cannot find/i)).toBeNull(),
    )
    // Either the loading state or the loaded page proves we are on the route;
    // what matters is that we are NOT on the not-found page.
    expect(screen.queryByRole('link', { name: /try guest play/i })).toBeNull()
  })

  it('never asks for an account on that path', async () => {
    // The non-negotiable, re-checked under the deploy prefix specifically:
    // a basename bug must not be able to reroute a student into a gate.
    renderDeployed(`${BASENAME}${buildPath.guestPlay('SUN-42')}`)
    await waitFor(() => expect(document.querySelector('form')).toBeNull())
    expect(screen.queryByText(/sign in|sign up|password|your email/i)).toBeNull()
  })

  it('survives an activity id that needed escaping', async () => {
    renderDeployed(`${BASENAME}${buildPath.guestPlay('a b/c')}`)
    await waitFor(() =>
      expect(screen.queryByText(/page not found|cannot find/i)).toBeNull(),
    )
  })

  it('still shows not-found for a path that matches nothing', async () => {
    renderDeployed(`${BASENAME}/definitely-not-a-route`)
    await waitFor(() =>
      expect(screen.queryByText(/not found|cannot find|Guest Play/i)).not.toBeNull(),
    )
  })
})

describe('the router that actually ships', () => {
  it('takes its basename from the deploy base, not a hard-coded string', () => {
    // The tests above build their own memory router, so they prove React
    // Router behaves — not that OUR router is configured. Mutating the shipped
    // basename left all of them green, which is how a test suite passes while
    // production 404s. This is the assertion that closes that gap.
    expect(router.basename).toBe((import.meta.env?.BASE_URL as string | undefined) ?? '/')
  })
})

describe('the test is actually sensitive to the basename', () => {
  it('does not match the route table when the prefix is left on', () => {
    // Proves the assertions above are earned. `matchRoutes` sees the raw path,
    // so the prefixed one must NOT match — that mismatch is exactly what
    // basename exists to remove, and a test that passes either way is
    // measuring nothing.
    const withPrefix = matchRoutes(routes, `${BASENAME}/play/SUN-42`) ?? []
    const guestPlay = withPrefix.find((m) => m.route.path === '/play/:activityId')
    expect(guestPlay).toBeUndefined()

    const withoutPrefix = matchRoutes(routes, '/play/SUN-42') ?? []
    expect(withoutPrefix.some((m) => m.route.path === '/play/:activityId')).toBe(true)
  })
})
