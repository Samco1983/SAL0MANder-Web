import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { newDraft } from '@studio/activityDraft'
import { UnityStage } from './UnityStage'
import { PreviewBootSchema, PREVIEW_EVENT } from './previewBridge'
import { PREVIEW_ATTEMPT_EVENT, PreviewAttemptEventSchema } from './previewAttemptBridge'

vi.mock('./buildConfig', () => ({
  resolveUnityBuildConfig: () => ({
    loaderUrl: '/unity/Build/attempt.loader.js',
    dataUrl: '/attempt.data',
    frameworkUrl: '/attempt.framework.js',
    codeUrl: '/attempt.wasm',
    streamingAssetsUrl: '/StreamingAssets',
    companyName: 'Samco',
    productName: 'Gift',
    productVersion: 'test',
  }),
}))
const draft = newDraft('gift_test', '2026-09-10T00:00:00Z')
const preview = PreviewBootSchema.parse({
  type: 'preview-boot',
  previewVersion: 1,
  requestId: 'current',
  config: { ...draft.config, title: 'Replay test gift', activityType: 'Classic' },
  questions: [],
  picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' },
})
function emit(type: string, requestId = 'current', attempt?: number) {
  act(() =>
    window.dispatchEvent(
      new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
        detail: {
          type,
          attemptVersion: 1,
          requestId,
          ...(attempt === undefined ? {} : { attempt }),
        },
      }),
    ),
  )
}
function legacy(type: string, requestId = 'current') {
  act(() =>
    window.dispatchEvent(
      new CustomEvent(PREVIEW_EVENT, {
        detail: {
          type,
          previewVersion: 1,
          requestId,
          message: 'Current request failed',
        },
      }),
    ),
  )
}
function host(syncAck = false, previewAttempts = true) {
  const quit = vi.fn(async () => {})
  const send = vi.fn((_object: string, _method: string, wire: string) => {
    const boot = JSON.parse(wire)
    if (syncAck)
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: {
            type: 'preview-attempt-ready',
            attemptVersion: 1,
            requestId: boot.requestId,
            attempt: 1,
          },
        }),
      )
  })
  let resolve = () => {}
  const factory = vi.fn(
    (_canvas: HTMLCanvasElement, _config: unknown) =>
      new Promise((done) => {
        resolve = () => done({ Quit: quit, SendMessage: send })
      }),
  )
  vi.stubGlobal('createUnityInstance', factory)
  const view = render(
    <UnityStage preview={preview} previewAttempts={previewAttempts} audience="student" />,
  )
  const canvas = view.container.querySelector('canvas')!
  act(() =>
    document
      .querySelector<HTMLScriptElement>('script[src="/unity/Build/attempt.loader.js"]')!
      .onload?.(new Event('load')),
  )
  return { ...view, canvas, send, quit, factory, resolve: () => act(async () => resolve()) }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each([0, -1, 1.2, Infinity, NaN, 2_147_483_648])('rejects invalid attempt %s', (attempt) => {
  expect(
    PreviewAttemptEventSchema.safeParse({
      type: 'preview-attempt-ready',
      attemptVersion: 1,
      requestId: 'current',
      attempt,
    }).success,
  ).toBe(false)
})
it('requires exact event fields and known version', () => {
  const capability = { type: 'preview-attempt-receiver-ready', attemptVersion: 1, requestId: '' }
  expect(PreviewAttemptEventSchema.safeParse(capability).success).toBe(true)
  for (const value of [
    { ...capability, attempt: 1 },
    { ...capability, attemptVersion: 2 },
    { ...capability, requestId: 'old' },
  ])
    expect(PreviewAttemptEventSchema.safeParse(value).success).toBe(false)
})
it('keeps early capability during slow download and only reveals the current sent attempt', async () => {
  const view = host()
  emit('preview-attempt-receiver-ready', '')
  emit('preview-attempt-ready', 'current', 1)
  act(() => vi.advanceTimersByTime(60000))
  expect(screen.queryByRole('alert')).toBeNull()
  await view.resolve()
  expect(view.send).toHaveBeenCalledTimes(1)
  expect(view.send.mock.calls[0]!.slice(0, 2)).toEqual([
    'SAL0MANderPreview',
    'ReceivePreviewMessage',
  ])
  legacy('preview-ready')
  emit('preview-attempt-ready', 'old', 1)
  expect(view.canvas).toHaveAttribute('aria-hidden', 'true')
  emit('preview-attempt-ready', 'current', 1)
  expect(view.canvas).not.toHaveAttribute('aria-hidden')
  expect(view.canvas).toHaveFocus()
  emit('preview-attempt-ready', 'current', 2)
  emit('preview-attempt-ready', 'current', 1)
  expect(view.container.querySelector('canvas')).toBe(view.canvas)
  expect(view.factory).toHaveBeenCalledTimes(1)
})
it('accepts a synchronous current acknowledgement', async () => {
  const view = host(true)
  await view.resolve()
  emit('preview-attempt-receiver-ready', '')
  expect(view.canvas).not.toHaveAttribute('aria-hidden')
  act(() => vi.advanceTimersByTime(20000))
  expect(screen.queryByRole('alert')).toBeNull()
})
it('fails closed for an old binary and never reveals late legacy or attempt events', async () => {
  const view = host()
  await view.resolve()
  legacy('preview-receiver-ready', '')
  legacy('preview-ready')
  act(() => vi.advanceTimersByTime(20000))
  expect(screen.getByRole('alert')).toHaveTextContent('This game build cannot open this gift')
  emit('preview-attempt-receiver-ready', '')
  emit('preview-attempt-ready', 'current', 1)
  expect(view.send).not.toHaveBeenCalled()
  expect(view.canvas).toHaveAttribute('aria-hidden', 'true')
})
it('retries the identical boot, ignores foreign errors and treats current error as terminal', async () => {
  const view = host()
  await view.resolve()
  emit('preview-attempt-receiver-ready', '')
  act(() => vi.advanceTimersByTime(5000))
  expect(view.send).toHaveBeenCalledTimes(3)
  expect(new Set(view.send.mock.calls.map((call) => call[2])).size).toBe(1)
  legacy('preview-error', 'foreign')
  expect(screen.queryByRole('alert')).toBeNull()
  legacy('preview-error')
  emit('preview-attempt-ready', 'current', 1)
  expect(screen.getByRole('alert')).toHaveTextContent('Current request failed')
  view.unmount()
  emit('preview-attempt-receiver-ready', '')
  act(() => vi.advanceTimersByTime(20000))
  expect(view.send).toHaveBeenCalledTimes(3)
  expect(view.quit).toHaveBeenCalledTimes(1)
})
it('leaves legacy Teacher Studio boot and ready behavior unchanged', async () => {
  const view = host(false, false)
  await view.resolve()
  expect(view.send).toHaveBeenCalledTimes(1)
  legacy('preview-ready')
  expect(view.canvas).not.toHaveAttribute('aria-hidden')
})
