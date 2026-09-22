import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { encodeGift, type Gift } from '@/gifts/giftLink'
import { GiftFeedback } from '@/gifts/giftFeedback'
import { newDraft } from '@studio/activityDraft'
import { PreviewBootSchema } from '@unity/previewBridge'
import { PREVIEW_ATTEMPT_EVENT } from '@unity/previewAttemptBridge'
import { SlideBootSchema, SLIDE_EVENT } from '@unity/slideBridge'
import { GiftPlayPage } from './GiftPlayPage'

const { preparePreview, prepareSlide } = vi.hoisted(() => ({
  preparePreview: vi.fn(),
  prepareSlide: vi.fn(),
}))
vi.mock('@unity/previewBridge', async (original) => ({
  ...(await original<typeof import('@unity/previewBridge')>()),
  preparePreview,
}))
vi.mock('@unity/slideBridge', async (original) => ({
  ...(await original<typeof import('@unity/slideBridge')>()),
  prepareSlide,
}))
vi.mock('@unity/buildConfig', () => ({
  resolveUnityBuildConfig: () => ({
    loaderUrl: '/fullscreen-test.loader.js',
    dataUrl: '/fullscreen-test.data',
    frameworkUrl: '/fullscreen-test.framework.js',
    codeUrl: '/fullscreen-test.wasm',
    streamingAssetsUrl: '/StreamingAssets',
    companyName: 'SAL0MANder',
    productName: 'Gift fullscreen test',
    productVersion: 'test',
  }),
}))

const requestId = 'fullscreen_gift'
const picture = { key: 'coral-reef', pngBase64: 'aGVsbG8=' }
const greeting = 'You did it, Riley!'
let fullscreenElement: Element | null = null

function changeFullscreen(element: Element | null) {
  fullscreenElement = element
  document.dispatchEvent(new Event('fullscreenchange'))
}

beforeEach(() => {
  localStorage.clear()
  fullscreenElement = null
  preparePreview.mockResolvedValue(
    PreviewBootSchema.parse({
      type: 'preview-boot',
      previewVersion: 1,
      requestId,
      config: {
        ...newDraft('gift_test', '2026-09-10T00:00:00Z').config,
        title: 'A gift for Riley',
        activityType: 'Classic',
      },
      questions: [],
      picture,
    }),
  )
  prepareSlide.mockResolvedValue(
    SlideBootSchema.parse({
      type: 'slide-boot',
      slideVersion: 1,
      requestId,
      mode: 'cyclic-3x3',
      picture,
      questions: [],
    }),
  )
  vi.spyOn(GiftFeedback.prototype, 'play').mockResolvedValue(false)
  vi.spyOn(GiftFeedback.prototype, 'unlock').mockImplementation(() => {})
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  })
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: vi.fn(async function (this: HTMLElement) {
      changeFullscreen(this)
    }),
  })
  Object.defineProperty(Document.prototype, 'exitFullscreen', {
    configurable: true,
    value: vi.fn(async () => {
      changeFullscreen(null)
    }),
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }),
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen')
  Reflect.deleteProperty(Document.prototype, 'exitFullscreen')
  Reflect.deleteProperty(document, 'fullscreenElement')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  localStorage.clear()
})

async function launchGift(mode: 'classic' | 'sliding') {
  const user = userEvent.setup()
  const presentation = {
    occasion: 'birthday' as const,
    occasionText: greeting,
    wrapper: 'box' as const,
    celebration: 'balloons' as const,
  }
  const gift: Gift =
    mode === 'sliding'
      ? {
          version: 3,
          catalogVersion: 2,
          mode,
          imageKey: picture.key,
          answers: [],
          ...presentation,
        }
      : {
          version: 1,
          catalogVersion: 1,
          mode,
          imageKey: picture.key,
          selections: [],
          ...presentation,
        }
  const quit = vi.fn(async () => {})
  const send = vi.fn()
  const factory = vi.fn(async () => ({ Quit: quit, SendMessage: send }))
  vi.stubGlobal('createUnityInstance', factory)
  const view = render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/gifts/play' + encodeGift(gift)]}>
        <GiftPlayPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Open gift box' }))
  await user.click(await screen.findByRole('button', { name: 'Open puzzle' }))
  const canvas = await screen.findByLabelText('SAL0MANder game')
  const stage = canvas.parentElement!
  const loader = document.querySelector<HTMLScriptElement>(
    'script[src="/fullscreen-test.loader.js"]',
  )!
  await act(async () => loader.onload?.(new Event('load')))

  const emit = (kind: 'receiver-ready' | 'ready' | 'finished', attempt = 1) => {
    const detail =
      mode === 'sliding'
        ? {
            type: 'slide-' + kind,
            slideVersion: 1,
            requestId: kind === 'receiver-ready' ? '' : requestId,
            ...(kind === 'receiver-ready'
              ? { capabilities: ['cyclic-3x3'] }
              : { attempt, ...(kind === 'finished' ? { moves: 4, seconds: 12 } : {}) }),
          }
        : {
            type: 'preview-attempt-' + kind,
            attemptVersion: 1,
            requestId: kind === 'receiver-ready' ? '' : requestId,
            ...(kind === 'receiver-ready' ? {} : { attempt }),
          }
    act(() => {
      window.dispatchEvent(
        new CustomEvent(mode === 'sliding' ? SLIDE_EVENT : PREVIEW_ATTEMPT_EVENT, { detail }),
      )
    })
  }
  emit('receiver-ready')
  emit('ready')
  expect(send).toHaveBeenCalledTimes(1)
  return { user, canvas, stage, emit, view, factory, send, quit }
}

it.each(['classic', 'sliding'] as const)(
  'keeps the personalized %s reward and player controls inside fullscreen without restarting the game',
  async (mode) => {
    const { user, canvas, stage, emit, view, factory, send, quit } = await launchGift(mode)
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(document.fullscreenElement).toBe(stage)
    expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()

    const sound = screen.getByRole('button', { name: 'Gift sounds on' })
    const textSize = screen.getByRole('combobox', { name: 'Gift text size' })
    const close = screen.getByRole('button', { name: 'Close puzzle' })
    for (const control of [
      sound,
      textSize,
      close,
      screen.getByRole('group', { name: 'Gift effects and text' }),
    ]) {
      expect(document.fullscreenElement).toContainElement(control)
    }
    await user.click(sound)
    await user.selectOptions(textSize, 'large')
    expect(screen.getByRole('button', { name: 'Gift sounds off' })).toBeVisible()
    expect(canvas.closest('[data-gift-text]')).toHaveAttribute('data-gift-text', 'large')
    expect(view.container.querySelector('canvas')).toBe(canvas)
    for (const size of ['smaller', 'smallest', 'normal']) {
      await user.selectOptions(textSize, size)
      expect(canvas.closest('[data-gift-text]')).toHaveAttribute('data-gift-text', size)
      expect(view.container.querySelector('canvas')).toBe(canvas)
      expect(factory).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledTimes(1)
      expect(quit).not.toHaveBeenCalled()
    }

    emit('finished')
    const reward = screen.getByRole('region', { name: 'Gift complete' })
    expect(reward).toHaveTextContent(greeting)
    // jsdom does not enforce the browser's fullscreen top layer. Containment
    // is essential: toBeVisible alone would incorrectly pass the old sibling reward.
    expect(document.fullscreenElement).toContainElement(reward)
    expect(document.fullscreenElement).toContainElement(
      screen.getByRole('link', { name: 'Make a gift for someone' }),
    )
    expect(document.fullscreenElement).toContainElement(
      screen.getByRole('button', { name: 'Exit full screen' }),
    )
    const controls = screen.getByRole('group', { name: 'Game display controls' })
    expect(controls.parentElement).toBe(stage)
    expect(reward.parentElement?.parentElement).toBe(stage)
    expect(reward.parentElement).not.toContainElement(controls)
    expect(reward.parentElement).not.toContainElement(canvas)

    if (mode === 'sliding') {
      const completionSlot = reward.parentElement!
      const stopFeedback = vi.spyOn(GiftFeedback.prototype, 'stop')
      await user.click(screen.getByRole('button', { name: 'Return to puzzle' }))
      expect(stopFeedback).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()
      expect(completionSlot).toBeEmptyDOMElement()
      const showGift = screen.getByRole('button', { name: 'Show gift' })
      expect(document.fullscreenElement).toContainElement(showGift)
      expect(view.container.querySelector('canvas')).toBe(canvas)
      expect(factory).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledTimes(1)
      expect(quit).not.toHaveBeenCalled()
      emit('finished')
      expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()
      await user.click(showGift)
      expect(screen.getByRole('region', { name: 'Gift complete' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'View picture' })).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'View picture' }))
      expect(screen.getByRole('dialog', { name: 'Your completed picture' })).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Back to celebration' }))
      expect(send).toHaveBeenCalledTimes(1)
      await user.click(screen.getByRole('button', { name: 'Return to puzzle' }))
    }

    act(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('orientationchange'))
    })
    emit('ready', 2)
    expect(screen.queryByRole('button', { name: 'Show gift' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()
    emit('finished', 1)
    expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()
    emit('finished', 2)
    expect(document.fullscreenElement).toContainElement(
      screen.getByRole('region', { name: 'Gift complete' }),
    )
    expect(screen.getByRole('group', { name: 'Game display controls' })).toBe(controls)
    expect(document.exitFullscreen).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Exit full screen' }))
    expect(document.fullscreenElement).toBeNull()
    expect(screen.getByRole('region', { name: 'Gift complete' })).toBeVisible()
    expect(view.container.querySelector('canvas')).toBe(canvas)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(quit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(document.fullscreenElement).toContainElement(close)
    await user.click(close)
    expect(view.container.querySelector('canvas')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open gift box' })).toBeVisible()
    expect(quit).toHaveBeenCalledTimes(1)
  },
)

// Defensive coverage for compatible builds that request fullscreen on the
// canvas itself. The currently published game's Maximize board only changes layout.
it.each(['classic', 'sliding'] as const)(
  'exits canvas-only fullscreen on %s completion and replay without replacing the canvas',
  async (mode) => {
    const { canvas, stage, emit, view, factory, send, quit } = await launchGift(mode)
    act(() => changeFullscreen(canvas))
    expect(document.fullscreenElement).toBe(canvas)
    expect(stage).toHaveAttribute('data-fullscreen-self', 'false')
    expect(document.exitFullscreen).not.toHaveBeenCalled()
    emit('finished')
    await waitFor(() => expect(document.fullscreenElement).toBeNull())
    expect(screen.getByRole('region', { name: 'Gift complete' })).toBeVisible()
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)

    emit('ready', 2)
    act(() => changeFullscreen(canvas))
    emit('finished', 1)
    expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()
    expect(document.fullscreenElement).toBe(canvas)
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
    emit('finished', 2)
    await waitFor(() => expect(document.fullscreenElement).toBeNull())
    expect(document.exitFullscreen).toHaveBeenCalledTimes(2)
    expect(HTMLElement.prototype.requestFullscreen).not.toHaveBeenCalled()
    expect(view.container.querySelector('canvas')).toBe(canvas)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(quit).not.toHaveBeenCalled()
  },
)

it('offers top-layer recovery when canvas fullscreen refuses to exit, then retries without entering fullscreen', async () => {
  const { user, canvas, emit, view, factory, quit } = await launchGift('classic')
  vi.mocked(document.exitFullscreen).mockRejectedValueOnce(new Error('Exit denied'))
  act(() => changeFullscreen(canvas))
  emit('finished')
  const recovery = await screen.findByRole('dialog', { name: 'Your gift is ready' })
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1)
  expect(recovery).toContainElement(screen.getByRole('alert'))
  expect(recovery).toHaveTextContent('Use your browser’s exit control, or try again')
  expect(document.fullscreenElement).toBe(canvas)
  expect(document.exitFullscreen).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: 'Try exiting full screen' }))
  await waitFor(() => expect(document.fullscreenElement).toBeNull())
  expect(document.exitFullscreen).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: 'Gift complete' })).toBeVisible()
  expect(HTMLElement.prototype.requestFullscreen).not.toHaveBeenCalled()
  expect(view.container.querySelector('canvas')).toBe(canvas)
  expect(factory).toHaveBeenCalledTimes(1)
  expect(quit).not.toHaveBeenCalled()
})

it('keeps the recovery message when the browser also refuses the top-layer dialog', async () => {
  const { canvas, emit } = await launchGift('sliding')
  vi.mocked(document.exitFullscreen).mockRejectedValueOnce(new Error('Exit denied'))
  vi.mocked(HTMLDialogElement.prototype.showModal).mockImplementationOnce(() => {
    throw new Error('Dialog denied')
  })
  act(() => changeFullscreen(canvas))
  emit('finished')
  expect(await screen.findByRole('dialog', { name: 'Your gift is ready' })).toHaveAttribute('open')
  expect(document.fullscreenElement).toBe(canvas)
  expect(HTMLElement.prototype.requestFullscreen).not.toHaveBeenCalled()
  act(() => changeFullscreen(null))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: 'Gift complete' })).toBeVisible()
})
