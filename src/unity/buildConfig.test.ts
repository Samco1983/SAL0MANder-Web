import { describe, expect, it } from 'vitest'
import { readEnv } from '@config/env'
import { resolveUnityBuildConfig } from './buildConfig'

/*
 * NOTE on the .br suffixes below — these expectations CHANGED on 2026-08-22.
 *
 * They previously asserted un-suffixed names (SAL0MANder.wasm, .data,
 * .framework.js). That was never verified against a build; it was what this
 * code happened to produce. The first real Unity WebGL build emitted
 * WebGL.data.br / WebGL.framework.js.br / WebGL.wasm.br, and Unity's own
 * generated index.html requests exactly those names.
 *
 * So the old expectations were a test certifying our own output rather than
 * agreement with the thing on the other side — the same shape as a broker test
 * that asserted its argv contained a flag while the adapter had never once
 * reached a model. They are corrected here against real evidence, not relaxed
 * to make a change pass.
 */

describe('resolveUnityBuildConfig', () => {
  it('returns null when no build is configured, so the host can show a placeholder', () => {
    expect(resolveUnityBuildConfig(readEnv({}))).toBeNull()
  })

  it('lays out the artifact names Unity emits for a build', () => {
    const config = resolveUnityBuildConfig(
      readEnv({
        VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/unity/v3',
        VITE_UNITY_BUILD_NAME: 'SAL0MANder',
      }),
    )

    expect(config).toEqual({
      loaderUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.loader.js',
      dataUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.data.br',
      frameworkUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.framework.js.br',
      codeUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.wasm.br',
      streamingAssetsUrl: 'https://cdn.example.com/unity/v3/StreamingAssets',
      companyName: 'SAL0MANder',
      productName: 'SAL0MANder',
      productVersion: '0.0.0',
    })
  })

  it('never produces a doubled slash from a trailing-slash base', () => {
    const config = resolveUnityBuildConfig(
      readEnv({ VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/unity//' }),
    )
    expect(config?.loaderUrl).not.toContain('//Build')
    expect(config?.loaderUrl).toBe('https://cdn.example.com/unity/Build/SAL0MANder.loader.js')
  })

  it('honours a custom build name', () => {
    const config = resolveUnityBuildConfig(
      readEnv({
        VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/u',
        VITE_UNITY_BUILD_NAME: 'PuzzleProto',
      }),
    )
    expect(config?.codeUrl).toBe('https://cdn.example.com/u/Build/PuzzleProto.wasm.br')
  })

  it('reads the product name from the same source, not the ambient env', () => {
    const config = resolveUnityBuildConfig(
      readEnv({
        VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/u',
        VITE_APP_NAME: 'SAL0MANder Staging',
      }),
    )
    expect(config?.productName).toBe('SAL0MANder Staging')
  })
})

describe('compression suffix', () => {
  /*
   * Verified against a REAL Unity build on 2026-08-22, not assumed. The build
   * emitted WebGL.data.br / WebGL.framework.js.br / WebGL.wasm.br and its own
   * generated index.html requests exactly those names. Before this, buildConfig
   * asked for the un-suffixed names and three of the four requests would have
   * 404'd while the loader resolved — a game that half-loads and dies, which
   * reads as a Unity fault rather than a URL one.
   */
  const src = (over: Record<string, unknown> = {}) =>
    ({
      appName: 'SAL0MANder',
      unity: {
        isConfigured: true,
        buildBaseUrl: 'https://cdn.example.com/unity',
        buildName: 'WebGL',
        compression: 'br',
        ...over,
      },
    }) as unknown as Parameters<typeof resolveUnityBuildConfig>[0]

  it('appends .br to data, framework and wasm — the real build shape', () => {
    const c = resolveUnityBuildConfig(src())
    expect(c?.dataUrl).toBe('https://cdn.example.com/unity/Build/WebGL.data.br')
    expect(c?.frameworkUrl).toBe('https://cdn.example.com/unity/Build/WebGL.framework.js.br')
    expect(c?.codeUrl).toBe('https://cdn.example.com/unity/Build/WebGL.wasm.br')
  })

  it('never compresses the loader, because Unity ships it plain', () => {
    // The loader is the script that decides how to fetch everything else, so it
    // cannot itself require the decompression it sets up.
    const c = resolveUnityBuildConfig(src())
    expect(c?.loaderUrl).toBe('https://cdn.example.com/unity/Build/WebGL.loader.js')
    expect(c?.loaderUrl).not.toContain('.br')
  })

  it('supports an uncompressed build rather than hardcoding .br', () => {
    const c = resolveUnityBuildConfig(src({ compression: 'none' }))
    expect(c?.dataUrl).toBe('https://cdn.example.com/unity/Build/WebGL.data')
    expect(c?.codeUrl).toBe('https://cdn.example.com/unity/Build/WebGL.wasm')
  })

  it('supports gzip', () => {
    const c = resolveUnityBuildConfig(src({ compression: 'gzip' }))
    expect(c?.codeUrl).toBe('https://cdn.example.com/unity/Build/WebGL.wasm.gzip')
  })
})
