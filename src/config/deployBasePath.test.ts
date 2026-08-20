import { describe, expect, it } from 'vitest'
import { matchRoutes } from 'react-router-dom'

import { buildPath, buildShareLink, paths } from './routes'

/**
 * Deploying under a subpath.
 *
 * GitHub project Pages serves this app at `/SAL0MANder-Web/`, not at `/`. That
 * single fact breaks share links in two opposite ways, and the test suite
 * cannot see either one because it runs with BASE_URL='/'.
 *
 *   Too little prefix — the pasted link points at `/play/x` on a host that
 *   serves the app at `/SAL0MANder-Web/play/x`. The teacher's link 404s.
 *
 *   Too much prefix — the base is added in `buildPath` as well, so <Link>
 *   yields `/SAL0MANder-Web/SAL0MANder-Web/play/x` once React Router prepends
 *   basename. In-app navigation 404s instead.
 *
 * Both are silent at build time and only appear in a classroom, which is why
 * they are pinned here.
 */

const SUBPATH = '/SAL0MANder-Web/'

describe('share links under a deploy subpath', () => {
  it('carries the base, so a pasted link resolves on project Pages', () => {
    const link = buildShareLink('SUN-42', 'https://samco1983.github.io', SUBPATH)
    expect(link).toBe('https://samco1983.github.io/SAL0MANder-Web/play/SUN-42')
  })

  it('does not double the prefix', () => {
    const link = buildShareLink('SUN-42', 'https://samco1983.github.io', SUBPATH)
    expect(link).not.toContain('SAL0MANder-Web/SAL0MANder-Web')
  })

  it('is unchanged at the root, so a custom domain later keeps the same shape', () => {
    // The move from project Pages to a custom domain must not alter the path a
    // QR code encodes. Only the origin may change.
    const link = buildShareLink('SUN-42', 'https://sal0mander.com', '/')
    expect(link).toBe('https://sal0mander.com/play/SUN-42')
  })

  it('still encodes an activity id that would break a URL', () => {
    const link = buildShareLink('a b/c', 'https://samco1983.github.io', SUBPATH)
    expect(new URL(link).pathname).toBe('/SAL0MANder-Web/play/a%20b%2Fc')
  })
})

describe('in-app links under a deploy subpath', () => {
  it('leaves the base out, because React Router prepends basename itself', () => {
    // buildPath feeds <Link to=...>. If it carried the prefix too, every
    // in-app navigation would land on a doubled path.
    expect(buildPath.guestPlay('SUN-42')).toBe('/play/SUN-42')
  })

  it('still matches the route table once basename has been stripped', () => {
    const matched = matchRoutes(
      [{ path: paths.guestPlay }, { path: paths.notFound }],
      buildPath.guestPlay('SUN-42'),
    )
    expect(matched?.[0]?.route.path).toBe(paths.guestPlay)
  })
})

describe('a base URL that already carries the deploy prefix', () => {
  /**
   * The failure this guards is not exotic — it is the natural reading of the
   * variable's own name. `VITE_PUBLIC_BASE_URL` invites the full public URL of
   * the site, and on project Pages the full URL *contains* the deploy path.
   * Concatenating both produced
   * `/SAL0MANder-Web/SAL0MANder-Web/play/SUN-42`: every copied link and every
   * printed QR code dead, with nothing failing at build time.
   */
  it('does not add the prefix twice', () => {
    const link = buildShareLink('SUN-42', 'https://samco1983.github.io/SAL0MANder-Web', SUBPATH)
    expect(link).toBe('https://samco1983.github.io/SAL0MANder-Web/play/SUN-42')
  })

  it('is unaffected by a trailing slash on the configured URL', () => {
    const link = buildShareLink('SUN-42', 'https://samco1983.github.io/SAL0MANder-Web/', SUBPATH)
    expect(link).toBe('https://samco1983.github.io/SAL0MANder-Web/play/SUN-42')
  })

  it('still adds the prefix when the base URL is origin-only', () => {
    // The guard must not over-correct: an origin with no path still needs it.
    const link = buildShareLink('SUN-42', 'https://samco1983.github.io', SUBPATH)
    expect(link).toBe('https://samco1983.github.io/SAL0MANder-Web/play/SUN-42')
  })

  it('does not mistake a lookalike host for the prefix', () => {
    // 'SAL0MANder-Web' appearing in the HOST is not the deploy path. Matching
    // on substring rather than a path boundary would drop a needed prefix.
    const link = buildShareLink('SUN-42', 'https://SAL0MANder-Web.example.com', SUBPATH)
    expect(link).toBe('https://SAL0MANder-Web.example.com/SAL0MANder-Web/play/SUN-42')
  })
})
