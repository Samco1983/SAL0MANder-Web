import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { GiftPlayPage } from './GiftPlayPage'
import { PuzzleGiftsPage } from './PuzzleGiftsPage'
import { GIFT_SURVEY } from '@/gifts/giftSurvey'
import { PREVIEW_ATTEMPT_EVENT } from '@unity/previewAttemptBridge'
const api = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  uploadImage: vi.fn(),
  imageUrl: vi.fn(),
  configured: true,
  prepare: vi.fn(),
  slide: vi.fn(),
  photo: vi.fn(),
  upload: vi.fn(),
  stage: vi.fn(),
}))
vi.mock('@/gifts/savedGiftLink', async (original) => ({
  ...(await original<typeof import('@/gifts/savedGiftLink')>()),
  configuredGiftStore: () => (api.configured ? api : null),
}))
vi.mock('@/gifts/customPhoto', () => ({
  loadSavedCustomPhoto: api.photo,
  prepareCustomPhoto: api.upload,
}))
vi.mock('@unity/previewBridge', async (original) => ({
  ...(await original<typeof import('@unity/previewBridge')>()),
  preparePreview: api.prepare,
}))
vi.mock('@unity/slideBridge', async (original) => ({
  ...(await original<typeof import('@unity/slideBridge')>()),
  prepareSlide: api.slide,
}))
vi.mock('@unity/UnityStage', () => ({
  UnityStage: (props: { completion?: ReactNode; controls?: ReactNode }) => {
    api.stage(props)
    return (
      <div aria-label="Running puzzle">
        {props.completion}
        {props.controls}
      </div>
    )
  },
}))
const id = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_'
const imageId = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB_'
const photo = {
  png: new Blob(['fixture'], { type: 'image/png' }),
  pngBase64: 'aGVsbG8=',
  width: 960,
  height: 540,
}
const gift = {
  version: 4,
  catalogVersion: 2,
  imageKey: 'custom',
  image: { id: imageId, width: 960, height: 540, contentType: 'image/png' },
  mode: 'mystery',
  answers: GIFT_SURVEY.map((q) => ({ templateId: q.id, answer: q.suggestions[0] })),
  occasion: 'birthday',
  wrapper: 'box',
  celebration: 'hearts',
}
function show(path = `/gifts/play?g=${id}`) {
  const router = createMemoryRouter([{ path: '/gifts/play', element: <GiftPlayPage /> }], {
    initialEntries: [path],
  })
  return {
    router,
    ...render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    ),
  }
}
beforeEach(() => {
  localStorage.clear()
  Object.values(api).forEach((fn) => {
    if (typeof fn === 'function') fn.mockReset()
  })
  api.configured = true
  api.load.mockResolvedValue({ id, gift, expiresAt: '2099-01-01T00:00:00Z' })
  api.photo.mockResolvedValue(photo)
  api.upload.mockResolvedValue(photo)
  api.imageUrl.mockReturnValue('https://gifts.example/api/gift-images/' + imageId)
  api.prepare.mockResolvedValue({ requestId: 'active', type: 'preview-boot' })
  api.slide.mockResolvedValue({ requestId: 'active', type: 'slide-boot' })
  api.uploadImage.mockResolvedValue({
    id: imageId,
    width: 960,
    height: 540,
    contentType: 'image/png',
    expiresAt: '2099-01-01T00:00:00Z',
  })
  api.save.mockResolvedValue({ id, expiresAt: '2099-01-01T00:00:00Z' })
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('loads a short gift without auto-launching; full photo enters Unity and stays concealed until completion', async () => {
  show()
  expect(await screen.findByRole('button', { name: 'Open gift box' })).toBeVisible()
  expect(api.load).toHaveBeenCalledWith(id, expect.any(AbortSignal))
  expect(api.photo).not.toHaveBeenCalled()
  expect(api.prepare).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Open gift box' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Open puzzle' }))
  await screen.findByLabelText('Running puzzle')
  expect(api.prepare).toHaveBeenCalledWith(
    expect.objectContaining({
      config: expect.objectContaining({ boardShape: 'Landscape' }),
      meta: expect.objectContaining({ imageKey: 'custom' }),
    }),
    expect.any(String),
    expect.any(AbortSignal),
    { key: 'custom', pngBase64: photo.pngBase64 },
  )
  expect(screen.queryByAltText('The personal photo chosen by the gift sender.')).toBeNull()
  for (const type of ['preview-attempt-ready', 'preview-attempt-finished'])
    act(() =>
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: { type, attemptVersion: 1, requestId: 'active', attempt: 1 },
        }),
      ),
    )
  expect(screen.getByAltText('The personal photo chosen by the gift sender.')).toHaveAttribute(
    'src',
    'data:image/png;base64,aGVsbG8=',
  )
})
it('restores a saved backup code locally without following its original host', async () => {
  const { router } = show('/gifts/play')
  fireEvent.change(screen.getByRole('textbox', { name: 'Gift link or backup code' }), {
    target: { value: `SAL0-SAVED:${id}` },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Open this gift' }))
  await screen.findByRole('button', { name: 'Open gift box' })
  expect(router.state.location.search).toBe(`?g=${id}`)
  expect(api.load).toHaveBeenCalledTimes(1)
})
it('prevents a cancelled saved response from replacing the next gift', async () => {
  let finish!: (value: unknown) => void
  api.load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { router } = show()
  await act(() => router.navigate('/gifts/play'))
  expect(api.load.mock.calls[0]?.[1]?.aborted).toBe(true)
  await act(() => finish({ id, gift }))
  expect(screen.getByRole('heading', { name: 'Open a gift' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Open gift box' })).toBeNull()
})
it('shows honest missing-service/expired failures without launching', async () => {
  api.configured = false
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('not connected')
  expect(api.load).not.toHaveBeenCalled()
  expect(api.prepare).not.toHaveBeenCalled()
})
it('keeps custom photos device-local even with saved sharing configured, and preserves catalog sharing', async () => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <PuzzleGiftsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
  fireEvent.change(screen.getByLabelText('Or use your own photo'), {
    target: { files: [new File(['x'], 'family.jpg', { type: 'image/jpeg' })] },
  })
  await screen.findByAltText('Your selection, previewed on this device')
  fireEvent.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  expect(screen.getByRole('button', { name: 'Create gift link' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Create gift link' }))
  expect(api.uploadImage).not.toHaveBeenCalled()
  expect(api.save).not.toHaveBeenCalled()
  expect(screen.getByText(/Choose a library picture to create a shareable gift/)).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Open gift' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Forest guardian/ }))
  expect(screen.queryByAltText('Your selection, previewed on this device')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Create gift link' }))
  expect(await screen.findByRole('link', { name: 'Open gift' })).toHaveAttribute(
    'href',
    expect.stringContaining(`?g=${id}`),
  )
  expect(api.save).toHaveBeenCalledWith(
    expect.objectContaining({ version: 2, imageKey: 'salamander-forest' }),
    expect.any(AbortSignal),
  )
  expect(api.uploadImage).not.toHaveBeenCalled()
})

it('cancels photo preparation when a library picture replaces it and cannot restore a stale custom choice', async () => {
  let finish: (value: typeof photo) => void = () => {}
  api.upload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  render(
    <ThemeProvider>
      <MemoryRouter>
        <PuzzleGiftsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
  fireEvent.change(screen.getByLabelText('Or use your own photo'), {
    target: { files: [new File(['x'], 'first.png', { type: 'image/png' })] },
  })
  const signal = api.upload.mock.calls[0]![1]
  fireEvent.click(screen.getByRole('button', { name: /Forest guardian/ }))
  expect(signal.aborted).toBe(true)
  await act(async () => finish(photo))
  expect(screen.queryByAltText('Your selection, previewed on this device')).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  expect(screen.getByRole('button', { name: 'Create gift link' })).toBeEnabled()
  expect(api.uploadImage).not.toHaveBeenCalled()
})
it('retries the same saved ID after an offline error through the recovery form', async () => {
  api.load.mockRejectedValueOnce(new Error('Saved gifts are unavailable right now.'))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
  fireEvent.change(screen.getByRole('textbox', { name: 'Gift link or backup code' }), {
    target: { value: `SAL0-SAVED:${id}` },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Open this gift' }))
  expect(await screen.findByRole('button', { name: 'Open gift box' })).toBeVisible()
  expect(api.load).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(api.prepare).not.toHaveBeenCalled()
})
it('clears the previous share outcome when generating a different saved link', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, share })
  const next = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC_'
  api.save
    .mockResolvedValueOnce({ id, expiresAt: '2099-01-01T00:00:00Z' })
    .mockResolvedValueOnce({ id: next, expiresAt: '2099-01-01T00:00:00Z' })
  render(
    <ThemeProvider>
      <MemoryRouter>
        <PuzzleGiftsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: /Forest guardian/ }))
  fireEvent.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Create gift link' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Share…' }))
  await screen.findByText(/Your device handled the share request/)
  fireEvent.click(screen.getByRole('button', { name: 'Create gift link' }))
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Open gift' }).getAttribute('href')).toContain(next),
  )
  expect(screen.queryByText(/Your device handled the share request/)).toBeNull()
  expect(share).toHaveBeenCalledTimes(1)
})
