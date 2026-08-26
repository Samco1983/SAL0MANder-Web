import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getWithRetries, isTransientGatewayStatus, verifyLiveSite } from './verify-live-site.mjs'

/**
 * The last-checked run before #70's PR #73 (`gh run 32823054422`) failed live
 * verification on a 503 for a single hashed asset ~13 seconds after Pages
 * finished deploying it — a known CDN edge-propagation delay (the same
 * pattern as `pages-outage-hotfix`, PRs #54/#55), not a real missing file.
 * This asserts the retry actually retries a gateway status and actually stops
 * retrying a real one, since a script that retries everything would just make
 * a genuine outage take longer to report.
 */

const okResponse = (body = 'ok') => new Response(body, { status: 200 })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isTransientGatewayStatus', () => {
  it('treats 502/503/504 as transient', () => {
    expect(isTransientGatewayStatus(502)).toBe(true)
    expect(isTransientGatewayStatus(503)).toBe(true)
    expect(isTransientGatewayStatus(504)).toBe(true)
  })

  it('does not treat a real failure as transient', () => {
    expect(isTransientGatewayStatus(404)).toBe(false)
    expect(isTransientGatewayStatus(500)).toBe(false)
    expect(isTransientGatewayStatus(200)).toBe(false)
  })
})

describe('getWithRetries', () => {
  it('recovers from a 503 that clears on the next attempt', async () => {
    fetch
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(okResponse('settled'))

    const sleep = vi.fn().mockResolvedValue(undefined)
    const result = await getWithRetries('https://example.test/', 'assets/app.js', { sleep })

    expect(result.status).toBe(200)
    expect(result.body).toBe('settled')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('gives up after the attempt budget and reports the last status', async () => {
    fetch.mockImplementation(() => Promise.resolve(new Response('', { status: 503 })))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await getWithRetries('https://example.test/', 'assets/app.js', { attempts: 3, sleep })

    expect(result.status).toBe(503)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('does not retry a real 404 — a genuine outage must report immediately', async () => {
    fetch.mockImplementation(() => Promise.resolve(new Response('', { status: 404 })))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await getWithRetries('https://example.test/', 'assets/missing.js', { sleep })

    expect(result.status).toBe(404)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe('verifyLiveSite', () => {
  const html =
    '<!doctype html><html><head>' +
    '<script type="module" src="/SAL0MANder-Web/assets/index-abc.js"></script>' +
    '</head><body><div id="root"></div></body></html>'

  it('treats a transient 503 on an asset as passing once it clears', async () => {
    vi.useFakeTimers()
    let assetCalls = 0
    fetch.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('__sal0_canary_')) return Promise.resolve(new Response('', { status: 404 }))
      if (u.includes('play/demo-activity')) return Promise.resolve(okResponse(html))
      if (u.includes('index-abc.js')) {
        assetCalls += 1
        if (assetCalls === 1) return Promise.resolve(new Response('', { status: 503 }))
        return Promise.resolve(okResponse('console.log(1)'))
      }
      return Promise.resolve(okResponse(html))
    })

    const pending = verifyLiveSite('https://example.test/SAL0MANder-Web/')
    await vi.runAllTimersAsync()
    const result = await pending
    vi.useRealTimers()

    expect(result.unknown).toBe(false)
    expect(result.failures).toEqual([])
    expect(assetCalls).toBe(2)
  })
})
