import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { UnityStage } from './UnityStage'
import { resolveUnityBuildConfig } from './buildConfig'

/**
 * Recovery for the Unity WebGL host.
 *
 * The failure this covers is the ordinary one: a classroom's wifi drops during
 * a multi-megabyte WebGL download. Before this, that was terminal — the student
 * saw "SAL0MANder could not start" and the only way forward was reloading the
 * whole page.
 *
 * Harness matches UnityStage.test.tsx: mock the build config, stub the global
 * factory Unity's loader registers, and drive the injected script's handlers
 * the way a browser would.
 */

vi.mock('./buildConfig', () => ({ resolveUnityBuildConfig: vi.fn() }))
const resolveConfig = vi.mocked(resolveUnityBuildConfig)

const CONFIG = {
  loaderUrl: 'https://cdn.example.com/u/Build/SAL0MANder.loader.js',
  dataUrl: 'https://cdn.example.com/u/Build/SAL0MANder.data',
  frameworkUrl: 'https://cdn.example.com/u/Build/SAL0MANder.framework.js',
  codeUrl: 'https://cdn.example.com/u/Build/SAL0MANder.wasm',
  streamingAssetsUrl: 'https://cdn.example.com/u/StreamingAssets',
  companyName: 'SAL0MANder',
  productName: 'SAL0MANder',
  productVersion: '0.0.0',
}

function stubUnityFactory() {
  const quit = vi.fn(async () => {})
  let resolveInstance: () => void = () => {}
  let rejectInstance: (error: unknown) => void = () => {}

  const createUnityInstance = vi.fn(
    () =>
      new Promise<{ Quit: () => Promise<void> }>((resolve, reject) => {
        resolveInstance = () => resolve({ Quit: quit })
        rejectInstance = reject
      }),
  )

  vi.stubGlobal('createUnityInstance', createUnityInstance)
  return {
    createUnityInstance,
    quit,
    ready: () => act(async () => void resolveInstance()),
    fail: (error: unknown) => act(async () => void rejectInstance(error)),
  }
}

const loaderScripts = () =>
  document.querySelectorAll<HTMLScriptElement>(`script[src="${CONFIG.loaderUrl}"]`)
const loaderScript = () => loaderScripts()[loaderScripts().length - 1] ?? null

const fireLoad = () => act(() => void loaderScript()?.onload?.(new Event('load')))
const fireError = () => act(() => void loaderScript()?.onerror?.(new Event('error')))

const renderStage = () =>
  render(
    <ThemeProvider>
      <UnityStage activityId="abc" />
    </ThemeProvider>,
  )

beforeEach(() => {
  resolveConfig.mockReturnValue(CONFIG)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  document.querySelectorAll('script').forEach((s) => s.remove())
})

describe('a host failure is never a dead end', () => {
  it('offers a retry when the loader script itself fails to download', async () => {
    stubUnityFactory()
    renderStage()
    await fireError()

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  it('offers a retry when the Unity instance rejects', async () => {
    const unity = stubUnityFactory()
    renderStage()
    await fireLoad()
    await unity.fail(new Error('failed to load Build/SAL0MANder.data'))

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  it('announces the failure to assistive technology', async () => {
    stubUnityFactory()
    renderStage()
    await fireError()
    expect(screen.getByRole('alert')).toBeVisible()
  })
})

describe('the failure is explained in words a student can act on', () => {
  // The raw loader text is kept too — existing tests assert it, deliberately,
  // because a teacher filing a bug needs the actual reason. This adds guidance
  // beside it rather than replacing it.
  it('says what to do about a failed download', async () => {
    stubUnityFactory()
    renderStage()
    await fireError()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/could not be downloaded/i)
    expect(alert).toHaveTextContent(/try again/i)
  })

  it('keeps the technical reason alongside the guidance', async () => {
    const unity = stubUnityFactory()
    renderStage()
    await fireLoad()
    await unity.fail(new Error('WebGL context creation failed'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/webgl context creation failed/i)
  })
})

describe('retry cannot create a duplicate Unity instance', () => {
  it('re-runs the load effect, injecting a fresh loader script', async () => {
    // Assert a NEW script element, not another factory call. Firing onload by
    // hand re-invokes the factory whether or not the effect re-ran, so counting
    // factory calls passes even when retryToken is missing from the deps and
    // the button does nothing at all. That mutation survived until this test
    // was rewritten.
    const unity = stubUnityFactory()
    const user = userEvent.setup()

    renderStage()
    await fireLoad()
    await unity.fail(new Error('network'))
    const scriptBefore = loaderScript()

    await user.click(screen.getByRole('button', { name: /try again/i }))
    const scriptAfter = loaderScript()

    expect(scriptAfter).not.toBeNull()
    expect(scriptAfter).not.toBe(scriptBefore)
  })

  it('quits the live instance on teardown, which is what stops duplicates', async () => {
    // A healthy instance is never offered a retry — the button only exists on
    // the error surface, so the state this guards is teardown. React runs the
    // cleanup before it re-runs the effect, so Quit() always precedes a new
    // createUnityInstance. Without it, a retry would leave the old build
    // running against a canvas the new one is also claiming.
    const unity = stubUnityFactory()
    const { unmount } = renderStage()
    await fireLoad()
    await unity.ready()

    await act(async () => unmount())
    expect(unity.quit).toHaveBeenCalled()
  })

  it('never leaves more than one canvas mounted across a retry', async () => {
    const unity = stubUnityFactory()
    const user = userEvent.setup()

    renderStage()
    await fireLoad()
    await unity.fail(new Error('network'))
    await user.click(screen.getByRole('button', { name: /try again/i }))
    await fireLoad()

    expect(document.querySelectorAll('canvas')).toHaveLength(1)
  })
})

describe('a missing build is explained, not blank', () => {
  it('names the missing configuration instead of rendering nothing', () => {
    resolveConfig.mockReturnValue(null)
    renderStage()
    expect(screen.getByRole('heading', { name: /unity webgl host/i })).toBeVisible()
    expect(screen.getByText(/VITE_UNITY_BUILD_BASE_URL/)).toBeVisible()
  })
})
