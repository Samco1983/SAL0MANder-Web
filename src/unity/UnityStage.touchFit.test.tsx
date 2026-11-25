import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
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

const stageCss = readFileSync(resolve(__dirname, 'UnityStage.module.css'), 'utf8')
const appShellCss = readFileSync(
  resolve(__dirname, '../components/layout/AppShell.module.css'),
  'utf8',
)
const companionCss = readFileSync(
  resolve(__dirname, '../components/layout/CompanionLayout.module.css'),
  'utf8',
)

function createTouchMove(touchCount: number): Event {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: Array.from({ length: touchCount }, (_, index) => ({ identifier: index })),
  })
  return event
}

beforeEach(() => {
  resolveConfig.mockReturnValue(CONFIG)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('phone screen fit and touch drag', () => {
  it('locks canvas touch gestures and prevents pull-to-refresh or text selection callouts in CSS', () => {
    const canvasBlock = stageCss.slice(stageCss.indexOf('.canvas {'))
    expect(canvasBlock).toMatch(/touch-action:\s*none/)
    expect(canvasBlock).toMatch(/overscroll-behavior:\s*none/)
    expect(canvasBlock).toMatch(/user-select:\s*none/)
    expect(canvasBlock).toMatch(/-webkit-touch-callout:\s*none/)
    expect(canvasBlock).toMatch(/width:\s*100%\s*!important/)
    expect(canvasBlock).toMatch(/height:\s*100%\s*!important/)
  })

  it('prevents page overscroll and keeps full-viewport shells clipped to phone width', () => {
    const fillBlock = appShellCss.slice(
      appShellCss.indexOf(".shell[data-fill='true'] {"),
      appShellCss.indexOf('.skipLink {'),
    )
    expect(fillBlock).toMatch(/overflow:\s*clip/)
    expect(fillBlock).toMatch(/overscroll-behavior:\s*none/)
    expect(companionCss).toMatch(/\.layout\s*\{[\s\S]*max-width:\s*100%/)
    expect(companionCss).toMatch(/\.toggle\s*\{[\s\S]*flex-wrap:\s*wrap/)
  })

  it('prevents browser scrolling on single-finger piece drag while keeping two-finger pinch zoom free', () => {
    render(<UnityStage activityId="demo" />)
    const canvas = document.getElementById('unity-canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()

    const singleFingerDrag = createTouchMove(1)
    canvas.dispatchEvent(singleFingerDrag)
    expect(singleFingerDrag.defaultPrevented).toBe(true)

    const twoFingerPinch = createTouchMove(2)
    canvas.dispatchEvent(twoFingerPinch)
    expect(twoFingerPinch.defaultPrevented).toBe(false)
  })

  it('blocks long-press context menus on the game canvas during touch drag', () => {
    render(<UnityStage activityId="demo" />)
    const canvas = document.getElementById('unity-canvas') as HTMLCanvasElement

    const menuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    canvas.dispatchEvent(menuEvent)
    expect(menuEvent.defaultPrevented).toBe(true)
  })

  it('dispatches a window resize when the hosted stage box resizes on phones without remounting the canvas', () => {
    const observer: {
      callback: ((entries: Array<{ contentRect: { width: number; height: number } }>) => void) | null
    } = { callback: null }
    class FakeResizeObserver {
      constructor(cb: (entries: Array<{ contentRect: { width: number; height: number } }>) => void) {
        observer.callback = cb
      }
      observe() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const onResize = vi.fn()
    window.addEventListener('resize', onResize)

    render(<UnityStage activityId="demo" />)
    const canvasBefore = document.getElementById('unity-canvas')

    observer.callback?.([{ contentRect: { width: 390, height: 700 } }])
    expect(onResize).toHaveBeenCalledTimes(1)

    // Same rounded dimensions should not loop resize events.
    observer.callback?.([{ contentRect: { width: 390.2, height: 699.8 } }])
    expect(onResize).toHaveBeenCalledTimes(1)

    // Orientation/toolbar change triggers another layout fit.
    observer.callback?.([{ contentRect: { width: 844, height: 390 } }])
    expect(onResize).toHaveBeenCalledTimes(2)
    expect(document.getElementById('unity-canvas')).toBe(canvasBefore)

    window.removeEventListener('resize', onResize)
  })
})
