import { describe, expect, it } from 'vitest'
import { readEnv } from '@config/env'
import { clampDevicePixelRatio, resolveUnityBuildConfig } from './buildConfig'

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
      dataUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.data',
      frameworkUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.framework.js',
      codeUrl: 'https://cdn.example.com/unity/v3/Build/SAL0MANder.wasm',
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
    expect(config?.codeUrl).toBe('https://cdn.example.com/u/Build/PuzzleProto.wasm')
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

describe('clampDevicePixelRatio', () => {
  it('passes through an ordinary desktop ratio', () => {
    expect(clampDevicePixelRatio(1)).toBe(1)
  })

  it('caps a phone-class ratio so the canvas fill rate stays bounded', () => {
    expect(clampDevicePixelRatio(3)).toBe(2)
  })

  it('leaves a ratio right at the cap untouched', () => {
    expect(clampDevicePixelRatio(2)).toBe(2)
  })

  it('falls back to 1 for a missing or invalid ratio, never to 0 or NaN', () => {
    expect(clampDevicePixelRatio(0)).toBe(1)
    expect(clampDevicePixelRatio(Number.NaN)).toBe(1)
    expect(clampDevicePixelRatio(-1)).toBe(1)
  })
})
