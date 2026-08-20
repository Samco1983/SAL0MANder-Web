import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { verifyArtifact, localAssetRefs } from './verify-deploy-artifact.mjs'

/**
 * Guarantees about the built artifact, not the source.
 *
 * Every failure covered here ships silently: the unit suite is green, the build
 * exits 0, and the site is blank or the share links 404. The only place these
 * are observable is the output directory, so that is what gets asserted —
 * against fixtures, so the checks are testable without a four-minute build.
 */

const BASE = '/SAL0MANder-Web/'
const GOOD_HTML =
  '<!doctype html><html><head>' +
  '<script type="module" src="/SAL0MANder-Web/assets/index-abc.js"></script>' +
  '<link rel="stylesheet" href="/SAL0MANder-Web/assets/index-abc.css">' +
  '</head><body><div id="root"></div></body></html>'

let dir
const write = (name, body) => writeFileSync(join(dir, name), body)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sal0-artifact-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const completeArtifact = () => {
  write('index.html', GOOD_HTML)
  write('404.html', GOOD_HTML)
  write('.nojekyll', '')
}

describe('a correct artifact', () => {
  it('reports no problems', () => {
    completeArtifact()
    expect(verifyArtifact(dir, BASE)).toEqual([])
  })

  it('accepts a base written without a trailing slash', () => {
    completeArtifact()
    expect(verifyArtifact(dir, '/SAL0MANder-Web')).toEqual([])
  })
})

describe('the failures that ship silently', () => {
  it('catches assets that lost the deploy base', () => {
    // The whole site renders blank. Build exits 0, tests are green.
    write('index.html', GOOD_HTML.replaceAll('/SAL0MANder-Web/assets', '/assets'))
    write('404.html', GOOD_HTML.replaceAll('/SAL0MANder-Web/assets', '/assets'))
    write('.nojekyll', '')
    const problems = verifyArtifact(dir, BASE)
    expect(problems.join(' ')).toMatch(/outside the deploy base/)
  })

  it('catches a missing 404 fallback', () => {
    write('index.html', GOOD_HTML)
    write('.nojekyll', '')
    expect(verifyArtifact(dir, BASE).join(' ')).toMatch(/404\.html is missing/)
  })

  it('catches a 404 fallback that has drifted from index', () => {
    write('index.html', GOOD_HTML)
    write('404.html', GOOD_HTML.replace('index-abc.js', 'index-STALE.js'))
    write('.nojekyll', '')
    expect(verifyArtifact(dir, BASE).join(' ')).toMatch(/differs from index\.html/)
  })

  it('catches a missing .nojekyll', () => {
    write('index.html', GOOD_HTML)
    write('404.html', GOOD_HTML)
    expect(verifyArtifact(dir, BASE).join(' ')).toMatch(/\.nojekyll is missing/)
  })

  it('reports only the missing entry point when there is no build at all', () => {
    // Not a cascade. A build that produced nothing should say that once,
    // rather than three derived failures that bury the real cause.
    const problems = verifyArtifact(dir, BASE)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/no entry point/)
  })
})

describe('references it must not judge', () => {
  it('ignores absolute URLs, so a working CDN is never flagged', () => {
    write('index.html', GOOD_HTML.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>'))
    write('404.html', GOOD_HTML.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>'))
    write('.nojekyll', '')
    expect(verifyArtifact(dir, BASE)).toEqual([])
  })

  it('ignores protocol-relative and fragment references', () => {
    expect(localAssetRefs('<a href="//cdn/x">a</a><a href="#top">b</a>')).toEqual([])
  })

  it('ignores page-relative references, which resolve correctly on their own', () => {
    write('index.html', GOOD_HTML.replace('</body>', '<img src="logo.png"></body>'))
    write('404.html', GOOD_HTML.replace('</body>', '<img src="logo.png"></body>'))
    write('.nojekyll', '')
    expect(verifyArtifact(dir, BASE)).toEqual([])
  })
})

describe('at the root', () => {
  it('accepts a site served from a custom domain', () => {
    const rootHtml = GOOD_HTML.replaceAll('/SAL0MANder-Web/assets', '/assets')
    write('index.html', rootHtml)
    write('404.html', rootHtml)
    write('.nojekyll', '')
    expect(verifyArtifact(dir, '/')).toEqual([])
  })
})
