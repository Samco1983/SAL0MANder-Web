import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOCK_DEMO_ACTIVITIES } from '@api/mockTransport'

/**
 * What a web filter's crawler can actually read.
 *
 * This is a React app: a crawler that does not execute JavaScript sees an empty
 * `<div id="root">`. The title, the meta description, and the `<noscript>` block
 * are the entire page to it — and to the automated classifiers school filters
 * use.
 *
 * sal0mander.com is blocked by at least one district as "categorized as
 * Unknown". The description at the time read "cloud companion platform for the
 * SAL0MANder learning puzzle application", which says nothing about
 * mathematics, students, or classrooms. These tests keep it from drifting back.
 */
const html = readFileSync('index.html', 'utf8')
const robots = readFileSync('public/robots.txt', 'utf8')
const sitemap = readFileSync('public/sitemap.xml', 'utf8')

/** Every path the sitemap vouches for, checked in both directions below. */
const listedPaths = [
  ...sitemap.matchAll(/<loc>https:\/\/sal0mander\.com(\/[^<]*)<\/loc>/g),
]
  .map((m) => m[1])
  .filter((p): p is string => p !== undefined)

describe('what a crawler reads', () => {
  it('has a title that says what this is, not just the brand name', () => {
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1] ?? ''
    // Not /math/: the puzzle is subject-agnostic and Unity already ships cell
    // biology and vocabulary activities alongside quadratics. Naming one
    // subject in the title would be inaccurate and would box the product in.
    expect(title).toMatch(/learning|classroom|practice/i)
    expect(title.length).toBeGreaterThan(20)
  })

  it('describes a classroom math tool rather than a software platform', () => {
    const description = /name="description"[\s\S]*?content="(.*?)"/.exec(html)?.[1] ?? ''
    expect(description).toMatch(/classroom|teacher|student/i)
    // Several subjects named, which is a stronger Education signal than one.
    expect(description).toMatch(/math/i)
    expect(description).toMatch(/science/i)
    expect(description).toMatch(/vocabulary/i)
    // The exact phrasing that produced "Unknown".
    expect(description).not.toMatch(/cloud companion platform/i)
  })

  it('gives a non-JavaScript reader real content, not an error line', () => {
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? ''
    expect(noscript).toMatch(/teacher|student/i)
    expect(noscript).toMatch(/classroom/i)
    // A bare "needs JavaScript" is indistinguishable from a parked domain.
    expect(noscript.length).toBeGreaterThan(200)
  })

  it('invites crawlers and points them at the sitemap', () => {
    expect(robots).toMatch(/^User-agent: \*/m)
    expect(robots).toMatch(/^Allow: \/$/m)
    expect(robots).toMatch(/Sitemap: https:\/\/sal0mander\.com\/sitemap\.xml/)
  })

  /**
   * The hole this closes: /about had nothing linking to it anywhere on the
   * site. Four trust pages that exist but cannot be reached by following links
   * are worth very little to a crawler or a district reviewer.
   */
  it('gives a non-JavaScript reader a route to every trust page', () => {
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? ''
    for (const href of [
      'https://sal0mander.com/about',
      'https://sal0mander.com/privacy',
      'https://sal0mander.com/terms',
      'mailto:samco1983@gmail.com',
    ]) {
      expect(noscript).toContain(href)
    }
  })

  /**
   * Google's guidance says organization data helps automated systems understand
   * and distinguish an organization — the same machine readability a filter's
   * classifier benefits from.
   */
  it('publishes valid structured data identifying who runs this', () => {
    const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1]
    expect(block, 'no JSON-LD block found').toBeDefined()

    const data = JSON.parse(block!) as { '@graph': Array<Record<string, unknown>> }
    const types = data['@graph'].map((n) => n['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')

    const org = data['@graph'].find((n) => n['@type'] === 'Organization')!
    expect(JSON.stringify(org)).toContain('samco1983@gmail.com')
  })

  /**
   * Structured data that overstates is worse than none: a founding date, a logo
   * URL, social profiles or an aggregate rating would each be invented or
   * unverifiable here.
   */
  it('claims nothing in structured data it cannot support', () => {
    const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    for (const key of ['aggregateRating', 'foundingDate', 'sameAs', 'award', 'numberOfEmployees']) {
      expect(block).not.toContain(key)
    }
  })

  /**
   * The contradiction this catches, which I shipped and did not notice.
   *
   * Adding the three activity URLs to sitemap.xml while robots.txt still said
   * `Disallow: /play/` told crawlers two opposite things at once. A crawler
   * does not treat that as a tie: it reports "submitted URL blocked by
   * robots.txt", which is a WORSE signal than never listing the page — on a
   * domain already categorised "Unknown", which is the whole problem these
   * files exist to solve.
   *
   * Neither file was wrong on its own. Only together.
   */
  it('never promises a URL that robots.txt forbids', () => {
    const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]!)
    const allowed = [...robots.matchAll(/^Allow:\s*(\S+)/gm)].map((m) => m[1]!)

    for (const path of listedPaths) {
      const blockedBy = disallowed.filter((rule) => path.startsWith(rule))
      if (blockedBy.length === 0) continue

      // A more specific Allow wins over a broader Disallow.
      const rescuedBy = allowed.filter((rule) => path.startsWith(rule))
      const mostSpecificBlock = Math.max(...blockedBy.map((r) => r.length))
      const mostSpecificAllow = rescuedBy.length ? Math.max(...rescuedBy.map((r) => r.length)) : -1

      expect(
        mostSpecificAllow,
        `${path} is in sitemap.xml but robots.txt blocks it via "${blockedBy.join(', ')}"`,
      ).toBeGreaterThan(mostSpecificBlock)
    }
  })

  it('keeps internal surfaces out of the index', () => {
    expect(robots).toMatch(/^Disallow: \/console$/m)
    expect(robots).toMatch(/^Disallow: \/unity$/m)
  })

  /**
   * A sitemap is a promise that these URLs exist. The SPA fallback serves
   * index.html for anything unknown, so a listed-but-unrouted path renders the
   * not-found screen under a URL the sitemap vouched for — worse than omitting
   * it.
   *
   * Two kinds of URL are legitimate here. A static page must appear as a
   * literal in the route table. An activity link cannot — the route is
   * `/play/:activityId` — so it is checked against the activities the transport
   * will actually resolve instead. Anything matching neither is a promised 404.
   */
  it('lists only pages that are actually routed', () => {
    const routes = readFileSync('src/config/routes.ts', 'utf8')
    const known = new Set<string>(MOCK_DEMO_ACTIVITIES.map((a) => a.id))

    expect(listedPaths.length).toBeGreaterThan(0)
    for (const path of listedPaths) {
      if (path === '/') continue

      const activityId = /^\/play\/([^/]+)\/?$/.exec(path)?.[1]
      if (activityId) {
        expect(known, `${path} is in the sitemap but no such activity exists`).toContain(activityId)
        continue
      }

      expect(routes, `${path} is in the sitemap but not in the route table`).toContain(`'${path}'`)
    }
  })

  /**
   * The other direction, and the one that fails quietly.
   *
   * `prerender-routes.mjs` derives its file list from this sitemap, so an
   * activity that is not listed here is an activity whose share link returns
   * HTTP 404 on GitHub Pages. It still renders for a student — the SPA fallback
   * serves the shell — which is exactly why nobody would notice. A crawler, a
   * link checker, and a filter's classifier all read the status.
   *
   * So: adding a fourth activity without adding its URL fails here rather than
   * shipping a link that reads as missing.
   */
  it('promises a real URL for every activity a teacher can share', () => {
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      expect(
        listedPaths,
        `${activity.title} has no sitemap entry, so its share link will 404`,
      ).toContain(`/play/${activity.id}`)
    }
  })
})
