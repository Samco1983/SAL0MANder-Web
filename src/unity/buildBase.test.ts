import { describe, expect, it } from 'vitest'
import { resolveBuildBase } from './buildConfig'

/**
 * Where the WebGL build is fetched from, once the deploy path exists.
 *
 * The env schema accepts any string for VITE_UNITY_BUILD_BASE_URL, so hosting
 * the build alongside the site — the obvious choice with no CDN — is allowed
 * and, before this, broken: `/unity-build` resolves to a path that does not
 * exist when the site is served from `/SAL0MANder-Web/`.
 *
 * What makes it expensive is the symptom. Nothing reports a wrong URL; the
 * stage shows its "game isn't ready" surface, which reads as a missing build.
 * The person debugging goes looking in Unity for a file that is already there.
 */

const DEPLOY = '/SAL0MANder-Web/'

describe('a build hosted on the same site', () => {
  it('carries the deploy prefix', () => {
    expect(resolveBuildBase('/unity-build', DEPLOY)).toBe('/SAL0MANder-Web/unity-build')
  })

  it('accepts a value written without a leading slash', () => {
    expect(resolveBuildBase('unity-build', DEPLOY)).toBe('/SAL0MANder-Web/unity-build')
  })

  it('does not add the prefix twice', () => {
    expect(resolveBuildBase('/SAL0MANder-Web/unity-build', DEPLOY)).toBe(
      '/SAL0MANder-Web/unity-build',
    )
  })

  it('strips a trailing slash so /Build is not doubled up', () => {
    expect(resolveBuildBase('/unity-build/', DEPLOY)).toBe('/SAL0MANder-Web/unity-build')
  })
})

describe('a build hosted somewhere else', () => {
  it('leaves an https CDN completely alone', () => {
    // The case that already worked. Prefixing it would break a working deploy
    // to fix a broken one, which is a worse trade than doing nothing.
    expect(resolveBuildBase('https://cdn.example.com/sal0', DEPLOY)).toBe(
      'https://cdn.example.com/sal0',
    )
  })

  it('leaves a protocol-relative URL alone', () => {
    expect(resolveBuildBase('//cdn.example.com/sal0', DEPLOY)).toBe('//cdn.example.com/sal0')
  })

  it('leaves any other scheme alone', () => {
    expect(resolveBuildBase('blob:https://x/y', DEPLOY)).toBe('blob:https://x/y')
  })
})

describe('at the root, nothing changes', () => {
  it('leaves a site-relative path untouched on a custom domain', () => {
    // Moving to a custom domain must not alter a working configuration.
    expect(resolveBuildBase('/unity-build', '/')).toBe('/unity-build')
  })

  it('treats an unset build path as unset', () => {
    expect(resolveBuildBase('', DEPLOY)).toBe('')
  })
})
