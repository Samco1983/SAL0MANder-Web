import { describe, expect, it } from 'vitest'
import { readEnv } from '@config/env'
import { resolveUnityBuildConfig, UNITY_RELEASE_REVISION } from './buildConfig'

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
      loaderUrl: `https://cdn.example.com/unity/v3/Build/SAL0MANder.loader.js?v=${UNITY_RELEASE_REVISION}`,
      dataUrl: `https://cdn.example.com/unity/v3/Build/SAL0MANder.data?v=${UNITY_RELEASE_REVISION}`,
      frameworkUrl: `https://cdn.example.com/unity/v3/Build/SAL0MANder.framework.js?v=${UNITY_RELEASE_REVISION}`,
      codeUrl: `https://cdn.example.com/unity/v3/Build/SAL0MANder.wasm?v=${UNITY_RELEASE_REVISION}`,
      streamingAssetsUrl: 'https://cdn.example.com/unity/v3/StreamingAssets',
      companyName: 'SAL0MANder',
      productName: 'SAL0MANder',
      productVersion: UNITY_RELEASE_REVISION,
    })
  })

  it('never produces a doubled slash from a trailing-slash base', () => {
    const config = resolveUnityBuildConfig(
      readEnv({ VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/unity//' }),
    )
    expect(config?.loaderUrl).not.toContain('//Build')
    expect(config?.loaderUrl).toBe(
      `https://cdn.example.com/unity/Build/SAL0MANder.loader.js?v=${UNITY_RELEASE_REVISION}`,
    )
  })

  it('honours a custom build name', () => {
    const config = resolveUnityBuildConfig(
      readEnv({
        VITE_UNITY_BUILD_BASE_URL: 'https://cdn.example.com/u',
        VITE_UNITY_BUILD_NAME: 'PuzzleProto',
      }),
    )
    expect(config?.codeUrl).toBe(
      `https://cdn.example.com/u/Build/PuzzleProto.wasm?v=${UNITY_RELEASE_REVISION}`,
    )
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

  it('versions every downloadable artifact together while keeping StreamingAssets a directory', () => {
    const config = resolveUnityBuildConfig(readEnv({ VITE_UNITY_BUILD_BASE_URL: '/unity' }))!
    const urls = [config.loaderUrl, config.dataUrl, config.frameworkUrl, config.codeUrl]
    for (const url of urls) {
      const parsed = new URL(url, 'https://sal0mander.com')
      expect(parsed.searchParams.getAll('v')).toEqual([config.productVersion])
      expect(parsed.pathname).toMatch(
        /^\/unity\/Build\/SAL0MANder\.(loader\.js|data|framework\.js|wasm)$/,
      )
    }
    expect(config.productVersion).toBe(UNITY_RELEASE_REVISION)
    expect(config.productVersion).not.toBe('0.0.0')
    expect(config.streamingAssetsUrl).toBe('/unity/StreamingAssets')
  })
})
