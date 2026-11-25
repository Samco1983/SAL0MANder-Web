import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { resetPictureRotationMemory } from '@content/pictureRotation'
import { BRIDGE_VERSION, UNITY_EVENT_NAME } from '@unity/bridge'
import { PREVIEW_ATTEMPT_EVENT } from '@unity/previewAttemptBridge'
import { PREVIEW_EVENT } from '@unity/previewBridge'
import { JigsawCelebration } from './JigsawCelebration'
import { GuestPlayPage } from './GuestPlayPage'

const resolveBuildConfigMock = vi.fn()

vi.mock('@unity/buildConfig', () => ({
  resolveUnityBuildConfig: () => resolveBuildConfigMock(),
}))

vi.mock('@unity/previewBridge', async (original) => ({
  ...(await original<typeof import('@unity/previewBridge')>()),
  preparePreview: vi.fn(async (draft: { meta: { imageKey: string } }, requestId: string) => {
    const picture =
      PUZZLE_LIBRARY.find((item) => item.key === draft.meta.imageKey) ?? PUZZLE_LIBRARY[0]!
    return {
      requestId,
      draft,
      picture,
      payloadJson: JSON.stringify({ requestId, imageKey: picture.key }),
    }
  }),
}))

vi.mock('@unity/UnityStage', () => ({
  UnityStage: (props: { preview?: { picture: { key: string }; requestId: string } }) => (
    <div
      data-testid="mock-unity-stage"
      data-preview-key={props.preview?.picture.key ?? ''}
      data-request-id={props.preview?.requestId ?? ''}
    />
  ),
}))

const UNITY_CONFIG = {
  loaderUrl: '/unity/Build/sal0-unity-webgl.loader.js',
  dataUrl: '/unity/Build/sal0-unity-webgl.data',
  frameworkUrl: '/unity/Build/sal0-unity-webgl.framework.js',
  codeUrl: '/unity/Build/sal0-unity-webgl.wasm',
  streamingAssetsUrl: '/unity/StreamingAssets',
  companyName: 'SAL0MANder',
  productName: 'SAL0MANder',
  productVersion: 'test',
}

function firePreviewAttempt(detail: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(PREVIEW_ATTEMPT_EVENT, { detail }))
  })
}

function firePreview(detail: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail }))
  })
}

function fireUnity(detail: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(UNITY_EVENT_NAME, { detail }))
  })
}

beforeEach(() => {
  localStorage.clear()
  resetPictureRotationMemory()
  resolveBuildConfigMock.mockReset()
  resolveBuildConfigMock.mockReturnValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('JigsawCelebration', () => {
  it('stays hidden until completion, ignores stale events, and celebrates on preview-attempt-finished', () => {
    const onNext = vi.fn()
    const picture = PUZZLE_LIBRARY[0]!
    render(
      <JigsawCelebration
        previewRequestId="sample_1"
        picture={picture}
        onNextPicture={onNext}
      />,
    )

    expect(screen.queryByRole('region', { name: /puzzle complete/i })).toBeNull()

    // Mismatched requestId or finish before ready is ignored.
    firePreviewAttempt({
      type: 'preview-attempt-finished',
      attemptVersion: 1,
      requestId: 'sample_other',
      attempt: 1,
    })
    firePreviewAttempt({
      type: 'preview-attempt-finished',
      attemptVersion: 1,
      requestId: 'sample_1',
      attempt: 1,
    })
    expect(screen.queryByRole('region', { name: /puzzle complete/i })).toBeNull()

    firePreviewAttempt({
      type: 'preview-attempt-ready',
      attemptVersion: 1,
      requestId: 'sample_1',
      attempt: 1,
    })
    firePreviewAttempt({
      type: 'preview-attempt-finished',
      attemptVersion: 1,
      requestId: 'sample_1',
      attempt: 1,
    })

    expect(screen.getByRole('region', { name: /puzzle complete/i })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      `Puzzle complete! You uncovered ${picture.name}.`,
    )
    expect(screen.getByRole('button', { name: 'Next picture' })).toBeInTheDocument()
  })

  it('celebrates on legacy preview-finished and correlated session-finished with score summary', () => {
    const picture = PUZZLE_LIBRARY[1]!
    const { unmount } = render(
      <JigsawCelebration previewRequestId="sample_legacy" picture={picture} />,
    )
    firePreview({
      type: 'preview-finished',
      previewVersion: 1,
      requestId: 'sample_legacy',
    })
    expect(screen.getByRole('status')).toHaveTextContent(`You uncovered ${picture.name}.`)
    unmount()

    render(
      <JigsawCelebration
        clientAttemptId="attempt-42"
        sessionId="session-99"
        picture={picture}
      />,
    )
    fireUnity({
      type: 'session-finished',
      version: BRIDGE_VERSION,
      clientAttemptId: 'attempt-42',
      sessionId: 'session-99',
      durationMs: 42_000,
      questionsAnswered: 9,
      questionsCorrect: 8,
      piecesPlaced: 9,
      piecesTotal: 9,
    })
    expect(screen.getByRole('status')).toHaveTextContent('8 of 9 questions answered correctly.')
  })

  it('respects prefers-reduced-motion and lets students dismiss with Keep looking', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList)

    const user = userEvent.setup()
    const { container } = render(
      <JigsawCelebration previewRequestId="sample_rm" picture={PUZZLE_LIBRARY[0]!} />,
    )
    firePreview({ type: 'preview-finished', previewVersion: 1, requestId: 'sample_rm' })

    expect(container.querySelector('[data-moving]')).toHaveAttribute('data-moving', 'false')
    await user.click(screen.getByRole('button', { name: 'Keep looking' }))
    expect(screen.queryByRole('region', { name: /puzzle complete/i })).toBeNull()
  })

  it('integrates with GuestPlayPage so Next picture rotates to a new puzzle and clears celebration', async () => {
    resolveBuildConfigMock.mockReturnValue(UNITY_CONFIG)
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/play/act_integer_operations']}>
          <Routes>
            <Route path="/play/:activityId" element={<GuestPlayPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('mock-unity-stage').getAttribute('data-request-id')).toMatch(
        /^sample_/,
      ),
    )
    const stage = screen.getByTestId('mock-unity-stage')
    const firstKey = stage.getAttribute('data-preview-key')!
    const requestId = stage.getAttribute('data-request-id')!

    firePreviewAttempt({
      type: 'preview-attempt-ready',
      attemptVersion: 1,
      requestId,
      attempt: 1,
    })
    firePreviewAttempt({
      type: 'preview-attempt-finished',
      attemptVersion: 1,
      requestId,
      attempt: 1,
    })

    const nextButton = screen.getByRole('button', { name: 'Next picture' })
    expect(nextButton).toBeVisible()

    const user = userEvent.setup()
    await user.click(nextButton)

    await waitFor(() => {
      const secondKey = screen.getByTestId('mock-unity-stage').getAttribute('data-preview-key')!
      expect(secondKey).toBeTruthy()
      expect(secondKey).not.toBe(firstKey)
    })
    expect(screen.queryByRole('region', { name: /puzzle complete/i })).toBeNull()
  })
})
