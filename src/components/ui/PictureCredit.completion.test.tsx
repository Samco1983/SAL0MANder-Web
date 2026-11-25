import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { resetPictureRotationMemory } from '@content/pictureRotation'
import { DEFAULT_GIFT_PRESENTATION } from '@/gifts/giftPresentation'
import { GiftCelebration } from '@routes/gifts/GiftCelebration'
import { GuestPlayPage } from '@routes/guest-play/GuestPlayPage'
import { PREVIEW_EVENT } from '@unity/previewBridge'
import { PREVIEW_ATTEMPT_EVENT } from '@unity/previewAttemptBridge'
import { PictureCredit } from './PictureCredit'

const PHOTO_PICTURE = PUZZLE_LIBRARY.find((item) => item.key === 'sleeping-puppies')!
const ARTWORK_PICTURE = PUZZLE_LIBRARY.find((item) => item.key === 'sal0mander-rover-expedition')!

const { mockPreparePreview } = vi.hoisted(() => ({
  mockPreparePreview: vi.fn(),
}))

vi.mock('@unity/buildConfig', () => ({
  resolveUnityBuildConfig: () => ({
    loaderUrl: 'https://cdn.example.com/u/Build/SAL0MANder.loader.js',
    dataUrl: 'https://cdn.example.com/u/Build/SAL0MANder.data',
    frameworkUrl: 'https://cdn.example.com/u/Build/SAL0MANder.framework.js',
    codeUrl: 'https://cdn.example.com/u/Build/SAL0MANder.wasm',
    streamingAssetsUrl: 'https://cdn.example.com/u/StreamingAssets',
    companyName: 'SAL0MANder',
    productName: 'SAL0MANder',
    productVersion: '0.0.0',
  }),
}))

vi.mock('@unity/previewBridge', async (original) => ({
  ...(await original<typeof import('@unity/previewBridge')>()),
  preparePreview: (...args: unknown[]) => mockPreparePreview(...args),
}))

afterEach(() => {
  cleanup()
  resetPictureRotationMemory()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('PictureCredit component', () => {
  it('renders author and license links for photographs', () => {
    render(<PictureCredit picture={PHOTO_PICTURE} />)
    expect(screen.getByText('Sleeping puppies')).toBeInTheDocument()
    const authorLink = screen.getByRole('link', { name: PHOTO_PICTURE.photoCredit!.author })
    expect(authorLink).toHaveAttribute('href', PHOTO_PICTURE.photoCredit!.source)
    expect(authorLink).toHaveAttribute('rel', 'noopener noreferrer')
    const licenseLink = screen.getByRole('link', { name: PHOTO_PICTURE.photoCredit!.license })
    expect(licenseLink).toHaveAttribute('href', PHOTO_PICTURE.photoCredit!.licenseUrl)
  })

  it('renders original SAL0MANder artwork attribution when a picture has no external photo credit', () => {
    render(<PictureCredit picture={ARTWORK_PICTURE} />)
    expect(screen.getByText(ARTWORK_PICTURE.name)).toBeInTheDocument()
    expect(screen.getByText(/Artwork:\s*SAL0MANder Studios/i)).toBeInTheDocument()
  })
})

describe('picture credits after puzzle completion', () => {
  it('shows photograph credits inside GiftCelebration only after completing the puzzle and hides on replay', () => {
    render(
      <MemoryRouter>
        <GiftCelebration
          requestId="req_photo"
          channel="preview-attempt"
          presentation={DEFAULT_GIFT_PRESENTATION}
          picture={PHOTO_PICTURE}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: PHOTO_PICTURE.photoCredit!.author })).toBeNull()

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: { type: 'preview-attempt-ready', attemptVersion: 1, requestId: 'req_photo', attempt: 1 },
        }),
      )
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: { type: 'preview-attempt-finished', attemptVersion: 1, requestId: 'req_photo', attempt: 1 },
        }),
      )
    })

    expect(screen.getByRole('link', { name: PHOTO_PICTURE.photoCredit!.author })).toBeVisible()
    expect(screen.getByRole('link', { name: PHOTO_PICTURE.photoCredit!.license })).toBeVisible()

    // Replaying hides the credit again until the new attempt finishes.
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: { type: 'preview-attempt-ready', attemptVersion: 1, requestId: 'req_photo', attempt: 2 },
        }),
      )
    })
    expect(screen.queryByRole('link', { name: PHOTO_PICTURE.photoCredit!.author })).toBeNull()
  })

  it('shows picture credits on GuestPlayPage only after completion without remounting the canvas', async () => {
    const user = userEvent.setup()
    mockPreparePreview.mockImplementation(async (draft: { config: { title: string } }, requestId: string) => ({
      requestId,
      config: { title: draft.config.title },
    }))

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/play/act_integer_operations?picture=sleeping-puppies']}>
          <Routes>
            <Route path="/play/:activityId" element={<GuestPlayPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    await waitFor(() => expect(mockPreparePreview).toHaveBeenCalledTimes(1))
    const requestId = mockPreparePreview.mock.calls[0]?.[1] as string
    const canvasBefore = await waitFor(() => {
      const el = document.getElementById('unity-canvas')
      expect(el).not.toBeNull()
      return el
    })

    expect(screen.queryByRole('complementary', { name: 'Picture credit' })).toBeNull()

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: { type: 'preview-attempt-ready', attemptVersion: 1, requestId, attempt: 1 },
        }),
      )
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: { type: 'preview-attempt-finished', attemptVersion: 1, requestId, attempt: 1 },
        }),
      )
    })

    const creditBar = await screen.findByRole('complementary', { name: 'Picture credit' })
    expect(creditBar).toHaveTextContent('Sleeping puppies')
    expect(screen.getByRole('link', { name: PHOTO_PICTURE.photoCredit!.author })).toBeVisible()
    // Non-negotiable #4: revealing the credit bar must never remount Unity's canvas.
    expect(document.getElementById('unity-canvas')).toBe(canvasBefore)

    // Legacy preview-finished also works on a fresh non-explicit rotated run; New picture clears it.
    cleanup()
    mockPreparePreview.mockClear()
    resetPictureRotationMemory()
    localStorage.clear()

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/play/act_integer_operations']}>
          <Routes>
            <Route path="/play/:activityId" element={<GuestPlayPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    await waitFor(() => expect(mockPreparePreview).toHaveBeenCalledTimes(1))
    const firstReqId = mockPreparePreview.mock.calls[0]?.[1] as string

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EVENT, {
          detail: { previewVersion: 1, requestId: firstReqId, type: 'preview-finished' },
        }),
      )
    })

    const firstCredit = await screen.findByRole('complementary', { name: 'Picture credit' })
    expect(firstCredit).toHaveTextContent(ARTWORK_PICTURE.name)
    expect(firstCredit).toHaveTextContent(/SAL0MANder Studios/i)

    // Switching picture hides the completed credit until the next puzzle is finished.
    await user.click(screen.getByRole('button', { name: /new picture/i }))
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Picture credit' })).toBeNull()
    })
  })
})
