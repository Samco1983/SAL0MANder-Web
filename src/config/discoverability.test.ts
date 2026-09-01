import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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

describe('what a crawler reads', () => {
  it('has a title that says what this is, not just the brand name', () => {
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1] ?? ''
    expect(title).toMatch(/math/i)
    expect(title.length).toBeGreaterThan(20)
  })

  it('describes a classroom math tool rather than a software platform', () => {
    const description = /name="description"[\s\S]*?content="(.*?)"/.exec(html)?.[1] ?? ''
    expect(description).toMatch(/math/i)
    expect(description).toMatch(/classroom|teacher|student/i)
    // The exact phrasing that produced "Unknown".
    expect(description).not.toMatch(/cloud companion platform/i)
  })

  it('gives a non-JavaScript reader real content, not an error line', () => {
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? ''
    expect(noscript).toMatch(/math/i)
    expect(noscript).toMatch(/teacher|student/i)
    // A bare "needs JavaScript" is indistinguishable from a parked domain.
    expect(noscript.length).toBeGreaterThan(200)
  })

  it('invites crawlers and points them at the sitemap', () => {
    expect(robots).toMatch(/^User-agent: \*/m)
    expect(robots).toMatch(/^Allow: \/$/m)
    expect(robots).toMatch(/Sitemap: https:\/\/sal0mander\.com\/sitemap\.xml/)
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
   */
  it('lists only pages that are actually routed', () => {
    const routes = readFileSync('src/config/routes.ts', 'utf8')
    const listed = [...sitemap.matchAll(/<loc>https:\/\/sal0mander\.com(\/[^<]*)<\/loc>/g)].map(
      (m) => m[1],
    )
    expect(listed.length).toBeGreaterThan(0)
    for (const path of listed) {
      if (path === '/') continue
      expect(routes, `${path} is in the sitemap but not in the route table`).toContain(`'${path}'`)
    }
  })
})
