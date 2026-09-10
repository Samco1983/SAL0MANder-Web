import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { buildGiftLink, encodeGift, giftBackupCode, type Gift } from '@/gifts/giftLink'
import { GiftPlayPage } from './GiftPlayPage'

const { prepare, prepareSlide, stage } = vi.hoisted(() => ({
  prepare: vi.fn(),
  prepareSlide: vi.fn(),
  stage: vi.fn(),
}))
vi.mock('@unity/previewBridge', async (original) => ({
  ...(await original<typeof import('@unity/previewBridge')>()),
  preparePreview: prepare,
}))
vi.mock('@unity/slideBridge', async (original) => ({
  ...(await original<typeof import('@unity/slideBridge')>()),
  prepareSlide,
}))
vi.mock('@unity/UnityStage', () => ({
  UnityStage: (props: unknown) => {
    stage(props)
    return <div aria-label="Actual Unity wrapper" />
  },
}))
const gift: Gift = {
  version: 1,
  catalogVersion: 1,
  mode: 'classic',
  imageKey: 'salamander-forest',
  selections: [],
}
function show(hash = encodeGift(gift), basePath = '') {
  const router = createMemoryRouter([{ path: '/gifts/play', element: <GiftPlayPage /> }], {
    initialEntries: [basePath + '/gifts/play' + hash],
    basename: basePath || '/',
  })
  const rendered = render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  return { ...rendered, router }
}
async function openGift(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open gift box' }))
  await user.click(await screen.findByRole('button', { name: 'Open puzzle' }))
}
beforeEach(() => {
  prepare.mockReset()
  prepareSlide.mockReset()
  stage.mockReset()
  prepare.mockResolvedValue({ requestId: 'preview_gift', config: { title: 'Gift' } })
})
afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllEnvs()
})

it('keeps the local base path and handles repeated valid submits as one navigation with no launch', async () => {
  vi.stubEnv('BASE_URL', '/school/')
  const user = userEvent.setup()
  const { router } = show('', '/school')
  const navigate = vi.spyOn(router, 'navigate')
  await user.click(screen.getByRole('textbox', { name: 'Gift link or backup code' }))
  await user.paste(giftBackupCode(gift))
  const form = screen.getByRole('button', { name: 'Open this gift' }).closest('form')!
  act(() => {
    fireEvent.submit(form)
    fireEvent.submit(form)
  })
  expect(navigate).toHaveBeenCalledTimes(1)
  expect(router.state.location.pathname).toBe('/school/gifts/play')
  expect(router.state.location.hash).toBe(encodeGift(gift))
  expect(prepare).not.toHaveBeenCalled()
  expect(stage).not.toHaveBeenCalled()
})

it.each(['link', 'fragment', 'backup'])(
  'recovers a pasted %s without auto-opening or visiting its source origin',
  async (form) => {
    const user = userEvent.setup()
    const { router } = show('')
    expect(screen.getByRole('heading', { name: 'Open a gift' })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    const input =
      form === 'link'
        ? buildGiftLink(gift, 'https://elsewhere.example', '/elsewhere')
        : form === 'backup'
          ? giftBackupCode(gift)
          : encodeGift(gift)
    await user.click(screen.getByRole('textbox', { name: 'Gift link or backup code' }))
    await user.paste(input)
    await user.click(screen.getByRole('button', { name: 'Open this gift' }))
    expect(router.state.location.pathname).toBe('/gifts/play')
    expect(router.state.location.hash).toBe(encodeGift(gift))
    expect(screen.getByRole('button', { name: 'Open gift box' })).toBeVisible()
    expect(prepare).not.toHaveBeenCalled()
    expect(stage).not.toHaveBeenCalled()
    await openGift(user)
    expect(await screen.findByLabelText('Actual Unity wrapper')).toBeVisible()
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(stage.mock.calls[0]?.[0]).toHaveProperty('previewAttempts', true)
  },
)

it('retains invalid recovery text and location without touching image preparation', async () => {
  const user = userEvent.setup()
  const { router } = show('#gift=broken')
  const input = screen.getByRole('textbox', { name: 'Gift link or backup code' })
  await user.click(input)
  await user.paste('https://elsewhere.example/gifts/play#gift=broken')
  await user.click(screen.getByRole('button', { name: 'Open this gift' }))
  expect(input).toHaveValue('https://elsewhere.example/gifts/play#gift=broken')
  expect(screen.getByRole('alert')).toHaveTextContent(/complete gift link/)
  expect(router.state.location.hash).toBe('#gift=broken')
  expect(prepare).not.toHaveBeenCalled()
  expect(stage).not.toHaveBeenCalled()
})

it('skips to main by keyboard without replacing the gift fragment or Unity node', async () => {
  const user = userEvent.setup()
  const hash = encodeGift(gift)
  window.history.replaceState({}, '', '/gifts/play' + hash)
  const { router } = show(hash)
  await openGift(user)
  const mountedGame = await screen.findByLabelText('Actual Unity wrapper')
  const href = window.location.href
  const skip = screen.getByRole('link', { name: 'Skip to main content' })
  skip.focus()
  await user.keyboard('{Enter}')
  expect(window.location.href).toBe(href)
  expect(router.state.location.hash).toBe(hash)
  expect(screen.getByRole('main')).toHaveFocus()
  expect(screen.getByLabelText('Actual Unity wrapper')).toBe(mountedGame)
  expect(prepare).toHaveBeenCalledTimes(1)
})

it('opens a fresh link with no signup and passes only transient play to Unity', async () => {
  const user = userEvent.setup()
  show()
  expect(prepare).not.toHaveBeenCalled()
  expect(screen.queryByLabelText(/password|email|name/i)).toBeNull()
  const writes = vi.spyOn(Storage.prototype, 'setItem')
  await openGift(user)
  expect(await screen.findByLabelText('Actual Unity wrapper')).toBeInTheDocument()
  expect(prepare.mock.calls[0]?.[0]).toMatchObject({
    config: { activityType: 'Classic', allowResumeLater: false },
    questions: [],
  })
  expect(stage).toHaveBeenCalledWith(
    expect.objectContaining({
      preview: expect.objectContaining({ requestId: 'preview_gift' }),
      audience: 'student',
    }),
  )
  expect(stage.mock.calls[0]?.[0]).not.toHaveProperty('boot')
  expect(writes).not.toHaveBeenCalled()
  writes.mockRestore()
})

it.each(['#gift=bad', '#gift=' + 'x'.repeat(1700), encodeGift(gift).slice(0, -5)])(
  'rejects damaged input before preparing images or mounting Unity',
  (hash) => {
    show(hash)
    expect(screen.getByRole('alert')).toHaveTextContent(/incomplete or unsupported/)
    expect(screen.queryByRole('button', { name: 'Open puzzle' })).toBeNull()
    expect(prepare).not.toHaveBeenCalled()
    expect(stage).not.toHaveBeenCalled()
  },
)

it('shows a recoverable image error and does not mount the game', async () => {
  const user = userEvent.setup()
  prepare.mockRejectedValueOnce(new Error('Picture unavailable'))
  show()
  await openGift(user)
  expect(await screen.findByRole('alert')).toHaveTextContent('Picture unavailable')
  expect(stage).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Open puzzle' })).toBeEnabled()
})

it('cancels a stale preparation when the recipient opens another gift', async () => {
  const user = userEvent.setup()
  let finish: (value: unknown) => void = () => {}
  prepare.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { router } = show()
  await openGift(user)
  const signal = prepare.mock.calls[0]?.[2] as AbortSignal
  await act(() => router.navigate('/gifts/play' + encodeGift({ ...gift, imageKey: 'red-panda' })))
  expect(signal.aborted).toBe(true)
  await act(async () => {
    finish({ requestId: 'stale', config: { title: 'Old gift' } })
  })
  expect(stage).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Open gift box' })).toBeEnabled()
})

it('starts fresh on reopen and states the reload limit', async () => {
  const user = userEvent.setup()
  const first = show()
  await openGift(user)
  expect(await screen.findByText('Progress is temporary. Reloading starts again.')).toBeVisible()
  first.unmount()
  show()
  expect(screen.getByRole('button', { name: 'Open gift box' })).toBeEnabled()
  expect(screen.queryByLabelText('Actual Unity wrapper')).toBeNull()
})

it('launches sliding exclusively on its separate transient channel and cancels stale image work', async () => {
  const user = userEvent.setup()
  const slideGift = {
    version: 3,
    catalogVersion: 2,
    mode: 'sliding',
    imageKey: 'coral-reef',
    answers: [],
    occasion: 'birthday',
    wrapper: 'box',
    celebration: 'balloons',
  } as const
  prepareSlide.mockResolvedValue({
    type: 'slide-boot',
    slideVersion: 1,
    requestId: 'slide_current',
    mode: 'cyclic-3x3',
    picture: { key: 'coral-reef', pngBase64: 'aGVsbG8=' },
    questions: [],
  })
  const view = show(encodeGift({ ...slideGift, answers: [] }))
  await openGift(user)
  expect(await screen.findByLabelText('Actual Unity wrapper')).toBeInTheDocument()
  expect(prepare).not.toHaveBeenCalled()
  expect(prepareSlide).toHaveBeenCalledWith(
    'coral-reef',
    expect.any(String),
    expect.any(AbortSignal),
  )
  expect(stage.mock.calls[0]?.[0]).toMatchObject({
    slide: { type: 'slide-boot', questions: [] },
    audience: 'student',
  })
  expect(stage.mock.calls[0]?.[0]).not.toHaveProperty('preview')
  expect(stage.mock.calls[0]?.[0]).not.toHaveProperty('boot')
  view.unmount()
  stage.mockClear()
  let finish: (value: unknown) => void = () => {}
  prepareSlide.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const pending = show(encodeGift({ ...slideGift, answers: [] }))
  await openGift(user)
  const signal = prepareSlide.mock.calls[1]?.[2] as AbortSignal
  pending.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => finish({ type: 'slide-boot', requestId: 'stale' }))
  expect(stage).not.toHaveBeenCalled()
})
