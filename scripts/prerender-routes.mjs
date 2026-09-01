#!/usr/bin/env node
/**
 * Give every public page a real file, so a crawler gets 200 instead of 404.
 *
 * GitHub Pages cannot rewrite URLs. The SPA fallback copies index.html to
 * 404.html, so a client-side route like /privacy is served the app shell with
 * an HTTP **404** status. A person clicks the link and sees the page; a
 * crawler reads the status and does not index it.
 *
 * Measured on the live site 2026-08-31:
 *
 *     /           200
 *     /about      404
 *     /privacy    404
 *     /terms      404
 *
 * That makes every trust page invisible to the automated classifiers school
 * web filters use — which is the entire reason those pages were written, since
 * sal0mander.com is currently categorised "Unknown". Worse, sitemap.xml
 * promises those URLs, and a sitemap pointing at 404s is a negative signal
 * rather than a neutral one.
 *
 * Writing dist/<route>/index.html makes Pages serve each one as a directory
 * index with 200. The router still owns what renders; this only changes the
 * status code and the fact that the file exists.
 *
 * ## The route list comes from sitemap.xml on purpose
 *
 * Not from a second hardcoded array. The sitemap is the promise made to
 * crawlers, so deriving from it means the two cannot drift: a page added to the
 * sitemap is prerendered automatically, and a page removed stops being. The
 * failure this prevents is the quiet one — adding a URL to the sitemap and
 * forgetting the build step, which reintroduces exactly the 404 above.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const shell = join(dist, 'index.html')

if (!existsSync(shell)) {
  console.error(`[prerender] ${shell} not found — run the build first.`)
  process.exit(1)
}

const sitemapPath = join(dist, 'sitemap.xml')
if (!existsSync(sitemapPath)) {
  console.error(`[prerender] ${sitemapPath} not found — nothing declares which pages are public.`)
  process.exit(1)
}

const html = readFileSync(shell, 'utf8')
const sitemap = readFileSync(sitemapPath, 'utf8')

const paths = [...sitemap.matchAll(/<loc>\s*https?:\/\/[^/]+(\/[^<\s]*)\s*<\/loc>/g)]
  .map((m) => m[1].replace(/\/$/, ''))
  .filter((p) => p !== '')

if (paths.length === 0) {
  console.error('[prerender] sitemap.xml lists no paths beyond the root. Refusing to no-op silently.')
  process.exit(1)
}

for (const path of paths) {
  const dir = join(dist, path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
  console.log(`[prerender] ${path}/index.html`)
}

console.log(`[prerender] ${paths.length} page(s) now resolve with 200 instead of 404.`)
