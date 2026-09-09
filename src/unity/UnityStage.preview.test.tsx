import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { newDraft } from '@studio/activityDraft'
import { UnityStage } from './UnityStage'
import { PREVIEW_EVENT, PreviewBootSchema } from './previewBridge'
import { resolveUnityBuildConfig } from './buildConfig'

vi.mock('./buildConfig', () => ({ resolveUnityBuildConfig: vi.fn() }))
const config = { loaderUrl: '/preview.loader.js', dataUrl: '/preview.data', frameworkUrl: '/preview.framework.js', codeUrl: '/preview.wasm', streamingAssetsUrl: '/StreamingAssets', companyName: 'SAL0MANder', productName: 'SAL0MANder', productVersion: 'test' }
const draft = newDraft('act_test', '2026-09-08T00:00:00Z')
draft.config.title = 'Exact teacher title'
draft.config.activityType = 'Classic'
const preview = PreviewBootSchema.parse({ type: 'preview-boot', previewVersion: 1, requestId: 'preview_test', config: draft.config, questions: [], picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' } })
const emit = (type: string, requestId = preview.requestId) => act(() => { window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: { type, requestId, previewVersion: 1 } })) })

let previousUrl: string
beforeEach(() => {
  previousUrl = window.location.href
  vi.mocked(resolveUnityBuildConfig).mockReturnValue(config)
})
afterEach(() => {
  window.history.replaceState(null, '', previousUrl)
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks()
})

async function load(failFirstSend = false) {
  const SendMessage = vi.fn()
  if (failFirstSend) SendMessage.mockImplementationOnce(() => { throw new Error('Receiver not created yet') })
  const Quit = vi.fn(async () => {})
  const create = vi.fn(async () => ({ SendMessage, Quit }))
  vi.stubGlobal('createUnityInstance', create)
  const view = render(<UnityStage preview={preview} />)
  await act(async () => { document.querySelector<HTMLScriptElement>('script[src="/preview.loader.js"]')?.onload?.(new Event('load')) })
  return { SendMessage, Quit, create, ...view }
}

it('shows no built-in game until the exact preview is acknowledged', async () => {
  const stage = await load()
  expect(stage.SendMessage).toHaveBeenCalledOnce()
  expect(stage.SendMessage.mock.calls[0]!.slice(0, 2)).toEqual(['SAL0MANderPreview', 'ReceivePreviewMessage'])
  expect(document.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
  expect(screen.getByText('Opening your activity…')).toBeVisible()
  emit('preview-ready', 'preview_stale')
  expect(document.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
  emit('preview-ready')
  expect(document.querySelector('canvas')).not.toHaveAttribute('aria-hidden')
  expect(screen.queryByText('Opening your activity…')).not.toBeInTheDocument()
  expect(stage.create).toHaveBeenCalledOnce()
  emit('preview-error', '')
  expect(document.querySelector('canvas')).not.toHaveAttribute('aria-hidden')
})

it('recovers a lost acknowledgement with identical retries and stops after acceptance', async () => {
  vi.useFakeTimers()
  const stage = await load()
  act(() => vi.advanceTimersByTime(2000))
  expect(stage.SendMessage).toHaveBeenCalledTimes(2)
  expect(stage.SendMessage.mock.calls[1]).toEqual(stage.SendMessage.mock.calls[0])
  emit('preview-ready')
  act(() => vi.advanceTimersByTime(30000))
  expect(stage.SendMessage).toHaveBeenCalledTimes(2)
  expect(stage.create).toHaveBeenCalledOnce()
})

it('reports an old build that never acknowledges, and keeps its default game hidden', async () => {
  vi.useFakeTimers()
  await load()
  act(() => vi.advanceTimersByTime(20000))
  expect(screen.getByRole('alert')).toHaveTextContent('This game build did not open the activity')
  expect(document.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
})

it('handles a receiver handshake after a failed first send without rebuilding Unity', async () => {
  const stage = await load(true)
  emit('preview-receiver-ready', '')
  expect(stage.SendMessage).toHaveBeenCalledTimes(2)
  emit('preview-receiver-ready', '')
  expect(stage.SendMessage).toHaveBeenCalledTimes(2)
  stage.rerender(<UnityStage preview={preview} />)
  expect(stage.create).toHaveBeenCalledOnce()
  stage.unmount()
  expect(stage.Quit).toHaveBeenCalledOnce()
})

it('keeps a cancelled runtime isolated after the URL changes and discards its late startup', async () => {
  const oldInstance = { SendMessage: vi.fn(), Quit: vi.fn(async () => {}) }
  const currentInstance = { SendMessage: vi.fn(), Quit: vi.fn(async () => {}) }
  let finishOld: (instance: typeof oldInstance) => void = () => {}
  let oldProgress: (progress: number) => void = () => {}
  const create = vi.fn((_canvas: HTMLCanvasElement, _config: Record<string, unknown>, _progress: (progress: number) => void) => Promise.resolve(currentInstance))
  create.mockImplementationOnce((_canvas, _config, progress) => {
    oldProgress = progress
    return new Promise((resolve) => { finishOld = resolve })
  })
  vi.stubGlobal('createUnityInstance', create)
  window.history.replaceState(null, '', '/studio?teacherPreview=1')
  const oldView = render(<UnityStage preview={preview} />)
  await act(async () => { document.querySelector<HTMLScriptElement>('script[src="/preview.loader.js"]')?.onload?.(new Event('load')) })
  const oldConfig = create.mock.calls[0]![1]
  expect(oldConfig.sal0manderTeacherPreview).toBe(true)

  oldView.unmount()
  window.history.replaceState(null, '', '/studio')
  expect(oldConfig.sal0manderTeacherPreview).toBe(true)
  const replacement = { ...preview, requestId: 'preview_replacement' }
  const currentView = render(<UnityStage preview={replacement} />)
  await act(async () => { document.querySelector<HTMLScriptElement>('script[src="/preview.loader.js"]')?.onload?.(new Event('load')) })
  emit('preview-ready', replacement.requestId)
  const currentCanvas = document.querySelector('canvas')
  expect(currentCanvas).not.toHaveAttribute('aria-hidden')

  await act(async () => {
    oldProgress(0.75)
    finishOld(oldInstance)
  })
  expect(oldInstance.Quit).toHaveBeenCalledOnce()
  expect(oldInstance.SendMessage).not.toHaveBeenCalled()
  expect(currentInstance.Quit).not.toHaveBeenCalled()
  expect(currentInstance.SendMessage).toHaveBeenCalledOnce()
  expect(JSON.parse(currentInstance.SendMessage.mock.calls[0]![2]).requestId).toBe(replacement.requestId)
  expect(document.querySelector('canvas')).toBe(currentCanvas)
  expect(currentCanvas).not.toHaveAttribute('aria-hidden')
  expect(screen.queryByText('Loading SAL0MANder…')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(create).toHaveBeenCalledTimes(2)
  currentView.unmount()
  expect(currentInstance.Quit).toHaveBeenCalledOnce()
  expect(oldInstance.Quit).toHaveBeenCalledOnce()
})

it('explicitly disables preview isolation on an ordinary runtime even with a stale URL flag', async () => {
  window.history.replaceState(null, '', '/unity?teacherPreview=1')
  const create = vi.fn(async (_canvas: HTMLCanvasElement, _config: Record<string, unknown>) => ({ SendMessage: vi.fn(), Quit: vi.fn(async () => {}) }))
  vi.stubGlobal('createUnityInstance', create)
  render(<UnityStage activityId="act_integer_operations" />)
  await act(async () => { document.querySelector<HTMLScriptElement>('script[src="/preview.loader.js"]')?.onload?.(new Event('load')) })
  expect(create).toHaveBeenCalledOnce()
  expect(create.mock.calls[0]![1].sal0manderTeacherPreview).toBe(false)
})
