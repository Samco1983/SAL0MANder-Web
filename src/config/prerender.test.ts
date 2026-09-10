import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readEnv } from './env'
import { resolveUnityBuildConfig, UNITY_RELEASE_REVISION } from '@unity/buildConfig'

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
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><html><head>' +
      '<meta name="description" content="HOMEPAGE COPY" />' +
      '<meta property="og:title" content="HOMEPAGE TITLE" />' +
      '<meta property="og:description" content="HOMEPAGE COPY" />' +
      '<title>HOMEPAGE TITLE</title>' +
      '</head><body><div id="root"></div></body></html>',
  )
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
  it.each(['/', '/SAL0MANder-Web/'])(
    'serves fresh Unity and Gift hard loads through physical app entries under %s',
    async (base) => {
      const dir = fixture(['/', '/about', '/gifts', '/gifts/play'])
      const entry = `${base}assets/app-fixture.js`
      writeFileSync(
        join(dir, 'index.html'),
        readFileSync(join(dir, 'index.html'), 'utf8').replace(
          '</body>',
          `<script type="module" src="${entry}"></script></body>`,
        ),
      )
      mkdirSync(join(dir, 'assets'))
      writeFileSync(join(dir, 'assets/app-fixture.js'), '// bundled React entry')
      mkdirSync(join(dir, 'unity/Build'), { recursive: true })
      mkdirSync(join(dir, 'unity/StreamingAssets'))
      writeFileSync(join(dir, 'unity/StreamingAssets/marker.json'), '{"retained":true}')
      // A stale public-folder export must be replaced, even when /unity is intentionally absent from the sitemap.
      writeFileSync(
        join(dir, 'unity/index.html'),
        '<canvas width="960" height="600">legacy host</canvas>',
      )
      const config = resolveUnityBuildConfig(
        readEnv({
          VITE_UNITY_BUILD_BASE_URL: `${base}unity`,
          VITE_UNITY_BUILD_NAME: 'Fixture',
        }),
      )!
      const artifactUrls = [config.loaderUrl, config.dataUrl, config.frameworkUrl, config.codeUrl]
      for (const url of artifactUrls) {
        const pathname = new URL(url, 'https://example.test').pathname.slice(base.length)
        writeFileSync(join(dir, pathname), `artifact: ${pathname}`)
      }
      run(dir)

      // Serve physical files, with directory-index redirects and no SPA fallback.
      // A memory router alone cannot catch a legacy public/index.html winning this request.
      const server = createServer((request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const file = resolve(dir, url.pathname.slice(base.length))
        if (
          !url.pathname.startsWith(base) ||
          (file !== resolve(dir) && !file.startsWith(resolve(dir) + sep))
        ) {
          response.writeHead(404).end()
          return
        }
        if (!existsSync(file)) {
          response.writeHead(404).end()
          return
        }
        if (statSync(file).isDirectory() && !url.pathname.endsWith('/')) {
          response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end()
          return
        }
        const target = statSync(file).isDirectory() ? join(file, 'index.html') : file
        if (!existsSync(target)) {
          response.writeHead(404).end()
          return
        }
        response.writeHead(200).end(readFileSync(target))
      })
      await new Promise<void>((ready, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', ready)
      })
      try {
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('No test server port')
        const origin = `http://127.0.0.1:${address.port}`
        for (const path of ['unity', 'unity/', 'unity/index.html']) {
          const response = await fetch(`${origin}${base}${path}?probe=keep`)
          expect(response.status).toBe(200)
          expect(new URL(response.url).search).toBe('?probe=keep')
          const page = await response.text()
          expect(page).toContain('<div id="root"></div>')
          expect(page).toContain(`src="${entry}"`)
          expect(page).not.toContain('legacy host')
          expect(page).not.toContain('createUnityInstance')
        }
        for (const path of ['gifts', 'gifts/', 'gifts/play', 'gifts/play/']) {
          const response = await fetch(`${origin}${base}${path}?probe=gift`)
          expect(response.status).toBe(200)
          expect(new URL(response.url).search).toBe('?probe=gift')
          const page = await response.text()
          expect(page).toContain('<div id="root"></div>')
          expect(page).toContain(`src="${entry}"`)
          expect(page).toMatch(/<title>(Make|Open) a puzzle gift/)
          expect(page).toMatch(/property="og:title" content="(Make|Open) a puzzle gift/)
          expect(page).not.toContain('HOMEPAGE COPY')
          const canonicalPath = path.replace(/\/$/, '')
          expect(page).toContain(`href="https://sal0mander.com/${canonicalPath}/"`)
        }
        for (const url of artifactUrls) {
          expect(new URL(url, origin).searchParams.get('v')).toBe(UNITY_RELEASE_REVISION)
          const response = await fetch(`${origin}${url}`)
          expect(response.status).toBe(200)
          expect(await response.text()).toContain('artifact: unity/Build/')
        }
        const streaming = await fetch(`${origin}${base}unity/StreamingAssets/marker.json`)
        expect(await streaming.json()).toEqual({ retained: true })
      } finally {
        await new Promise<void>((closed, reject) =>
          server.close((error) => (error ? reject(error) : closed())),
        )
      }
    },
  )

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

  /**
   * A 200 was only half of it. Copying the shell verbatim gave every route the
   * homepage's title and no description, so a classifier that does not run
   * JavaScript read the same page at every URL — and identical titles across a
   * domain is a weak signal, not a neutral one. The districts page in
   * particular exists to be read by web filter review.
   */
  it('gives each page its own title, description and canonical', () => {
    const dir = fixture(['/', '/districts'])
    run(dir)

    const page = readFileSync(join(dir, 'districts', 'index.html'), 'utf8')
    expect(page).toContain('<title>For school districts')
    expect(page).toContain('name="description" content="Domains to allow')
    expect(page).toContain('<link rel="canonical" href="https://sal0mander.com/districts/" />')
  })

  /**
   * Prerendering every sitemap URL is the contract. An earlier version of the
   * metadata step made a missing entry fatal, which would have failed the build
   * and shipped no page at all — reintroducing the 404 this script exists to
   * fix. The miss is loud; the file is still written.
   */
  it('still ships a page that has no metadata entry yet', () => {
    const dir = fixture(['/', '/newly-added'])
    expect(() => run(dir)).not.toThrow()
    expect(existsSync(join(dir, 'newly-added', 'index.html'))).toBe(true)
  })

  /**
   * The failure this guards is one I shipped and did not see.
   *
   * The first version inserted the route's description next to <title>, and
   * the shell already carried one higher up the document. A crawler reads the
   * first, so every page still advertised the homepage — the bug the step was
   * written to fix, still present, now invisible. Count the tags, not just
   * their content.
   */
  it('replaces the homepage tags rather than shipping two of each', () => {
    const dir = fixture(['/', '/districts'])
    run(dir)

    const page = readFileSync(join(dir, 'districts', 'index.html'), 'utf8')
    const count = (needle: string) => page.split(needle).length - 1

    expect(count('name="description"')).toBe(1)
    expect(count('property="og:title"')).toBe(1)
    expect(count('property="og:description"')).toBe(1)
    expect(count('rel="canonical"')).toBe(1)
    expect(page).not.toContain('HOMEPAGE COPY')
    expect(page).not.toContain('HOMEPAGE TITLE')
  })

  /**
   * A teacher hands these links to a class in Classroom or a message. Without
   * per-route Open Graph tags every shared page previews as the homepage, so a
   * student cannot tell one activity link from another.
   */
  it('gives a shared link its own preview', () => {
    const dir = fixture(['/', '/play/act_linear_equations'])
    run(dir)

    const page = readFileSync(join(dir, 'play/act_linear_equations', 'index.html'), 'utf8')
    expect(page).toContain('property="og:title" content="Linear equations puzzle')
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
