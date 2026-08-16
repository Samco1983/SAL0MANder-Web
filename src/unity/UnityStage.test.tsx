import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { UnityStage } from './UnityStage'
import { resolveUnityBuildConfig } from './buildConfig'

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

type ProgressFn = (p: number) => void

/** Hands back control over when — and whether — Unity finishes booting. */
function stubUnityFactory() {
  const quit = vi.fn(async () => {})
  let resolveInstance: () => void = () => {}
  let rejectInstance: (error: unknown) => void = () => {}
  let reportProgress: ProgressFn = () => {}

  const createUnityInstance = vi.fn(
    (_canvas: HTMLCanvasElement, _cfg: Record<string, unknown>, onProgress: ProgressFn) => {
      reportProgress = onProgress
      return new Promise<{ Quit: () => Promise<void> }>((resolve, reject) => {
        resolveInstance = () => resolve({ Quit: quit })
        rejectInstance = reject
      })
    },
  )

  vi.stubGlobal('createUnityInstance', createUnityInstance)
  return {
    createUnityInstance,
    quit,
    // `ready` and `fail` settle a promise, so the continuation runs on a
    // microtask that a synchronous act() would not flush.
    ready: () => act(async () => void resolveInstance()),
    fail: (error: unknown) => act(async () => void rejectInstance(error)),
    // `onProgress` calls setState directly — synchronous.
    progress: (p: number) => act(() => reportProgress(p)),
  }
}

/** The loader `<script>` UnityStage injects. jsdom never fetches it. */
function loaderScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[src="${CONFIG.loaderUrl}"]`)
}

const fireLoad = () => act(() => void loaderScript()?.onload?.(new Event('load')))
const fireError = () => act(() => void loaderScript()?.onerror?.(new Event('error')))

const canvas = () => document.querySelector('canvas')

beforeEach(() => {
  resolveConfig.mockReturnValue(CONFIG)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('when no build is configured', () => {
  beforeEach(() => resolveConfig.mockReturnValue(null))

  it('shows the placeholder instead of failing', () => {
    render(<UnityStage />)
    expect(screen.getByRole('heading', { name: /unity webgl host/i })).toBeInTheDocument()
  })

  it('injects no loader script and renders no canvas', () => {
    render(<UnityStage activityId="demo" />)
    expect(loaderScript()).toBeNull()
    expect(canvas()).toBeNull()
  })

  it('still names the activity, so a share link is debuggable', () => {
    render(<UnityStage activityId="demo-activity" />)
    expect(screen.getByText(/demo-activity/)).toBeInTheDocument()
  })
})

describe('booting a configured build', () => {
  it('injects the loader from the resolved build config', () => {
    render(<UnityStage activityId="demo" />)
    const script = loaderScript()
    expect(script).not.toBeNull()
    expect(script?.async).toBe(true)
  })

  it('creates the instance against the canvas once the loader registers', async () => {
    const unity = stubUnityFactory()
    render(<UnityStage activityId="demo" />)
    fireLoad()

    expect(unity.createUnityInstance).toHaveBeenCalledTimes(1)
    expect(unity.createUnityInstance.mock.calls[0]?.[0]).toBe(canvas())
  })

  it('reports load progress', async () => {
    const unity = stubUnityFactory()
    render(<UnityStage activityId="demo" />)
    fireLoad()
    unity.progress(0.42)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/loading sal0mander/i)).toBeInTheDocument()
  })

  it('clears the loading overlay when Unity is ready', async () => {
    const unity = stubUnityFactory()
    render(<UnityStage activityId="demo" />)
    fireLoad()
    await unity.ready()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('the stage must never remount — non-negotiable #4', () => {
  it('keeps the same canvas node across the whole boot sequence', async () => {
    // Loading -> ready is a state change on this component. If the canvas were
    // rendered conditionally, that transition alone would destroy the WebGL
    // context and restart a student's game.
    const unity = stubUnityFactory()
    render(<UnityStage activityId="demo" />)

    const atMount = canvas()
    fireLoad()
    expect(canvas()).toBe(atMount)

    unity.progress(0.5)
    expect(canvas()).toBe(atMount)

    await unity.ready()
    expect(canvas()).toBe(atMount)
  })

  it('does not restart Unity when the activity id changes', async () => {
    const unity = stubUnityFactory()
    const { rerender } = render(<UnityStage activityId="demo" />)
    fireLoad()
    await unity.ready()

    const before = canvas()
    rerender(<UnityStage activityId="a-different-activity" />)

    expect(canvas()).toBe(before)
    expect(unity.createUnityInstance).toHaveBeenCalledTimes(1)
    expect(unity.quit).not.toHaveBeenCalled()
  })

  it('does not restart Unity on an unrelated parent re-render', async () => {
    const unity = stubUnityFactory()
    const { rerender } = render(<UnityStage activityId="demo" />)
    fireLoad()
    await unity.ready()

    const before = canvas()
    rerender(<UnityStage activityId="demo" />)
    rerender(<UnityStage activityId="demo" />)

    expect(canvas()).toBe(before)
    expect(unity.createUnityInstance).toHaveBeenCalledTimes(1)
  })
})

describe('failure paths', () => {
  it('reports a loader that never registers its factory', () => {
    // No global createUnityInstance — a truncated or wrong-version build.
    render(<UnityStage activityId="demo" />)
    fireLoad()

    expect(screen.getByRole('alert')).toHaveTextContent(/did not initialize/i)
  })

  it('reports a loader URL that fails to download', () => {
    render(<UnityStage activityId="demo" />)
    fireError()

    expect(screen.getByRole('alert')).toHaveTextContent(CONFIG.loaderUrl)
  })

  it('surfaces the reason Unity refused to start', async () => {
    const unity = stubUnityFactory()
    render(<UnityStage activityId="demo" />)
    fireLoad()
    await unity.fail(new Error('WebGL context creation failed'))

    expect(screen.getByRole('alert')).toHaveTextContent(/webgl context creation failed/i)
  })

  it('keeps the canvas mounted through an error', async () => {
    // The error overlay is a sibling, not a replacement — a transient failure
    // must not tear down the surface Unity is attached to.
    const unity = stubUnityFactory()
    render(<UnityStage activityId="demo" />)
    const before = canvas()
    fireLoad()
    await unity.fail(new Error('boom'))

    expect(canvas()).toBe(before)
  })
})

describe('teardown', () => {
  it('quits the instance and removes the loader on unmount', async () => {
    const unity = stubUnityFactory()
    const { unmount } = render(<UnityStage activityId="demo" />)
    fireLoad()
    await unity.ready()

    unmount()

    expect(unity.quit).toHaveBeenCalledTimes(1)
    expect(loaderScript()).toBeNull()
  })

  it('quits an instance that arrives after unmount, so no orphan keeps running', async () => {
    // Navigating away mid-boot: the promise still resolves, and the instance it
    // yields would otherwise hold a WebGL context and an audio stream forever.
    const unity = stubUnityFactory()
    const { unmount } = render(<UnityStage activityId="demo" />)
    fireLoad()

    unmount()
    await unity.ready()

    expect(unity.quit).toHaveBeenCalledTimes(1)
  })

  it('does not warn about state updates after unmount', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unity = stubUnityFactory()
    const { unmount } = render(<UnityStage activityId="demo" />)
    fireLoad()

    unmount()
    unity.progress(0.9)
    await unity.ready()

    expect(spy).not.toHaveBeenCalled()
  })
})
