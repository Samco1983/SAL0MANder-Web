import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Every URL the sitemap promises must be a real file.
 *
 * GitHub Pages cannot rewrite URLs, so a client-side route is served the SPA
 * shell with an HTTP 404. Measured live on 2026-08-31: `/about`, `/privacy` and
 * `/terms` all returned 404 while rendering correctly for a human. A crawler
 * reads the status, so every trust page was invisible to the classifiers this
 * site is trying to satisfy — and the sitemap was actively promising 404s.
 */
const dirs: string[] = []
afterEach(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

function fixture(sitemapPaths: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'prerender-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>')
  writeFileSync(
    join(dir, 'sitemap.xml'),
    `<?xml version="1.0"?><urlset>${sitemapPaths
      .map((p) => `<url><loc>https://sal0mander.com${p}</loc></url>`)
      .join('')}</urlset>`,
  )
  return dir
}

const run = (dir: string) =>
  execFileSync('node', ['scripts/prerender-routes.mjs', dir], { encoding: 'utf8' })

describe('prerendering the public pages', () => {
  it('writes a real file for every sitemap URL, so crawlers get 200', () => {
    const dir = fixture(['/', '/about', '/privacy', '/terms'])
    run(dir)

    expect(existsSync(join(dir, 'about', 'index.html'))).toBe(true)
    expect(existsSync(join(dir, 'privacy', 'index.html'))).toBe(true)
    expect(existsSync(join(dir, 'terms', 'index.html'))).toBe(true)
  })

  /**
   * The route list is derived from the sitemap rather than a second hardcoded
   * array, so the two cannot drift. This is the drift that would otherwise
   * happen quietly: a page added to the sitemap, the build step forgotten, and
   * the 404 silently back.
   */
  it('picks up a newly listed page without anyone editing the script', () => {
    const dir = fixture(['/', '/newly-added'])
    run(dir)
    expect(existsSync(join(dir, 'newly-added', 'index.html'))).toBe(true)
  })

  it('fails loudly rather than shipping a dist with no pages prerendered', () => {
    const dir = fixture(['/'])
    expect(() => run(dir)).toThrow()
  })

  it('fails when there is no build to prerender', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prerender-empty-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'sub'))
    expect(() => run(dir)).toThrow()
  })
})
