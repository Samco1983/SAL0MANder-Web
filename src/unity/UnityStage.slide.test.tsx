import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UnityStage } from './UnityStage'
import { SlideBootSchema, SLIDE_EVENT } from './slideBridge'
import { PREVIEW_EVENT } from './previewBridge'

const config = {
  loaderUrl: '/unity/Build/slide.loader.js',
  dataUrl: '/slide.data',
  frameworkUrl: '/slide.framework.js',
  codeUrl: '/slide.wasm',
  streamingAssetsUrl: '/StreamingAssets',
  companyName: 'Samco',
  productName: 'Slide',
  productVersion: 'test',
}
vi.mock('./buildConfig', () => ({
  resolveUnityBuildConfig: () => ({
    loaderUrl: '/unity/Build/slide.loader.js',
    dataUrl: '/slide.data',
    frameworkUrl: '/slide.framework.js',
    codeUrl: '/slide.wasm',
    streamingAssetsUrl: '/StreamingAssets',
    companyName: 'Samco',
    productName: 'Slide',
    productVersion: 'test',
  }),
}))
const slide = SlideBootSchema.parse({
  type: 'slide-boot',
  slideVersion: 1,
  requestId: 'current',
  mode: 'cyclic-3x3',
  picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' },
  questions: [],
})
function emit(detail: unknown) {
  act(() => window.dispatchEvent(new CustomEvent(SLIDE_EVENT, { detail })))
}
function capable() {
  emit({
    type: 'slide-receiver-ready',
    slideVersion: 1,
    requestId: '',
    capabilities: ['cyclic-3x3'],
  })
}
function ready(id = 'current', attempt = 1) {
  emit({ type: 'slide-ready', slideVersion: 1, requestId: id, attempt })
}
function createHost(ack = false) {
  const quit = vi.fn(async () => {})
  const send = vi.fn((_object: string, _method: string, json: string) => {
    const packet = JSON.parse(json)
    if (ack && packet.type === 'slide-boot')
      window.dispatchEvent(
        new CustomEvent(SLIDE_EVENT, {
          detail: { type: 'slide-ready', slideVersion: 1, requestId: packet.requestId, attempt: 1 },
        }),
      )
  })
  let resolve: () => void = () => {}
  const factory = vi.fn(
    (_canvas: HTMLCanvasElement, _config: Record<string, unknown>) =>
      new Promise<{ Quit: typeof quit; SendMessage: typeof send }>((done) => {
        resolve = () => done({ Quit: quit, SendMessage: send })
      }),
  )
  vi.stubGlobal('createUnityInstance', factory)
  const view = render(<UnityStage slide={slide} audience="student" />)
  const canvas = view.container.querySelector('canvas')!
  const script = document.querySelector<HTMLScriptElement>(`script[src="${config.loaderUrl}"]`)!
  act(() => script.onload?.(new Event('load')))
  return { ...view, canvas, send, quit, factory, resolve: () => act(async () => resolve()) }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('retains an early capability handshake, sends only slide boot, and waits for current acknowledgement', async () => {
  const host = createHost()
  capable() // Managed startup can announce before the loader factory promise settles.
  ready('current') // A ready before our boot is not acceptance.
  await host.resolve()
  expect(host.send).toHaveBeenCalledTimes(1)
  expect(host.factory.mock.calls[0]?.[1]).toMatchObject({
    sal0manderTeacherPreview: true,
    sal0manderSlideGift: true,
  })
  expect(host.send.mock.calls[0]?.slice(0, 2)).toEqual(['SAL0MANderSlide', 'ReceiveSlideMessage'])
  expect(host.canvas).toHaveStyle({ visibility: 'hidden' })
  ready('stale')
  act(() =>
    window.dispatchEvent(
      new CustomEvent(PREVIEW_EVENT, {
        detail: { type: 'preview-ready', previewVersion: 1, requestId: 'current' },
      }),
    ),
  )
  expect(host.canvas).toHaveStyle({ visibility: 'hidden' })
  ready()
  expect(host.canvas).not.toHaveAttribute('aria-hidden')
  expect(host.canvas).toHaveFocus()
  ready('current', 2)
  ready('current', 1)
  expect(host.container.querySelector('canvas')).toBe(host.canvas)
  expect(host.factory).toHaveBeenCalledTimes(1)
})
it('accepts synchronous SendMessage acknowledgement without losing it', async () => {
  const host = createHost(true)
  await host.resolve()
  capable()
  expect(host.canvas).not.toHaveAttribute('aria-hidden')
  act(() => vi.advanceTimersByTime(20000))
  expect(screen.queryByRole('alert')).toBeNull()
})
it('fails closed for an old player and ignores late acknowledgements after the terminal timeout', async () => {
  const host = createHost()
  await host.resolve()
  act(() => vi.advanceTimersByTime(20000))
  expect(screen.getByRole('alert')).toHaveTextContent('Slide & Solve could not start')
  capable()
  ready()
  expect(host.send).not.toHaveBeenCalled()
  expect(host.canvas).toHaveAttribute('aria-hidden', 'true')
  expect(host.canvas).toHaveAttribute('tabindex', '-1')
})
it('retries the immutable request only within the handshake window, cancels before Quit and detaches timers', async () => {
  const host = createHost()
  await host.resolve()
  capable()
  act(() => vi.advanceTimersByTime(5000))
  expect(host.send).toHaveBeenCalledTimes(3)
  expect(new Set(host.send.mock.calls.map((call) => call[2])).size).toBe(1)
  host.unmount()
  expect(JSON.parse(host.send.mock.calls[3]![2]).type).toBe('slide-cancel')
  expect(host.send.mock.invocationCallOrder[3]).toBeLessThan(host.quit.mock.invocationCallOrder[0]!)
  const sends = host.send.mock.calls.length
  capable()
  ready()
  act(() => vi.advanceTimersByTime(20000))
  expect(host.send).toHaveBeenCalledTimes(sends)
  expect(host.quit).toHaveBeenCalledTimes(1)
})
