import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import {
  createMockTransport,
  MOCK_DEMO_ACTIVITIES,
  MOCK_SHARE_CODES,
} from '@api/mockTransport'
import { GuestActivityBundleSchema, PlayBundleSchema } from '@contracts/v1'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import {
  LAST_PUZZLE_PICTURE_STORAGE_KEY,
  pickNextLibraryPicture,
  resetPictureRotationMemory,
  resolveActivityPicture,
  writeLastPuzzlePictureKey,
} from '@content/pictureRotation'
import { buildSampleActivityDraft } from '@content/demoActivities'
import { newDraft } from '@studio/activityDraft'
import { giftToDraft } from '@/gifts/giftActivity'
import { HomePage } from '@routes/home/HomePage'
import { GuestPlayPage } from '@routes/guest-play/GuestPlayPage'
import { PreviewActivitySchema, preparePreview } from '@unity/previewBridge'

const { stageMock, preparePreviewMock, resolveBuildConfigMock } = vi.hoisted(() => ({
  stageMock: vi.fn(),
  preparePreviewMock: vi.fn(),
  resolveBuildConfigMock: vi.fn(),
}))

vi.mock('@unity/buildConfig', () => ({
  resolveUnityBuildConfig: resolveBuildConfigMock,
}))

vi.mock('@unity/previewBridge', async (original) => ({
  ...(await original<typeof import('@unity/previewBridge')>()),
  preparePreview: preparePreviewMock,
}))

vi.mock('@unity/UnityStage', () => ({
  UnityStage: (props: { preview?: { picture: { key: string }; requestId: string } }) => {
    stageMock(props)
    return (
      <div
        data-testid="mock-unity-stage"
        data-preview-key={props.preview?.picture.key ?? ''}
      />
    )
  },
}))

const LIBRARY_KEYS = new Set(PUZZLE_LIBRARY.map((p) => p.key))
const LIBRARY_SRCS = new Set(PUZZLE_LIBRARY.map((p) => p.src))

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

function renderGuestPlay(initialEntry: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetPictureRotationMemory()
  stageMock.mockReset()
  preparePreviewMock.mockReset()
  resolveBuildConfigMock.mockReset()
  resolveBuildConfigMock.mockReturnValue(null)
  preparePreviewMock.mockImplementation(async (draft, requestId) => ({
    type: 'preview-boot',
    previewVersion: 1,
    requestId,
    config: { ...draft.config },
    questions: draft.questions,
    picture: { key: draft.meta.imageKey, pngBase64: 'aGVsbG8=' },
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PJ-B picture rotation — sample activities, defaults, and explicit overrides', () => {
  it('picks a real library picture for act_integer_operations and never repeats twice in a row', async () => {
    const transport = createMockTransport()
    const first = await transport.request(
      { path: '/guest/activities/act_integer_operations' },
      GuestActivityBundleSchema,
    )
    const second = await transport.request(
      { path: '/guest/activities/act_integer_operations' },
      GuestActivityBundleSchema,
    )

    const firstKey = (first.version.payload.body as { imageKey?: string }).imageKey
    const secondKey = (second.version.payload.body as { imageKey?: string }).imageKey

    expect(firstKey).toBeDefined()
    expect(secondKey).toBeDefined()
    expect(LIBRARY_KEYS.has(firstKey!)).toBe(true)
    expect(LIBRARY_KEYS.has(secondKey!)).toBe(true)
    expect(secondKey).not.toBe(firstKey)
  })

  it('rotates all built-in sample activities and share-code play bundles without repeating or using media_demo_1024', async () => {
    const transport = createMockTransport()
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      const a = await transport.request(
        { path: `/guest/activities/${activity.id}` },
        GuestActivityBundleSchema,
      )
      const b = await transport.request(
        { path: `/guest/activities/${activity.id}` },
        GuestActivityBundleSchema,
      )
      const keyA = (a.version.payload.body as { imageKey?: string }).imageKey
      const keyB = (b.version.payload.body as { imageKey?: string }).imageKey
      expect(keyA, `${activity.id} first game must pick a library picture`).toBeTruthy()
      expect(keyB, `${activity.id} second game must pick a library picture`).toBeTruthy()
      expect(keyB, `${activity.id} must not repeat the same picture twice in a row`).not.toBe(keyA)
    }

    const playA = await transport.request(
      { path: `/v1/play/${MOCK_SHARE_CODES.ok}` },
      PlayBundleSchema,
    )
    const playB = await transport.request(
      { path: `/v1/play/${MOCK_SHARE_CODES.ok}` },
      PlayBundleSchema,
    )
    expect(playA.puzzleAsset.assetId).not.toBe('media_demo_1024')
    expect(playB.puzzleAsset.assetId).not.toBe('media_demo_1024')
    expect(playA.puzzleAsset.downloadUrl).not.toContain('cdn.example.invalid')
    expect(playB.puzzleAsset.downloadUrl).not.toContain('cdn.example.invalid')
    expect(playB.puzzleAsset.assetId).not.toBe(playA.puzzleAsset.assetId)
  })

  it('does not hard-code the old salamander hero picture twice in a row on HomePage', () => {
    const renderHeroSrc = () => {
      const view = render(
        <ThemeProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </ThemeProvider>,
      )
      const img = screen.getByAltText(/puzzle part-way through/i)
      const src = img.getAttribute('src') ?? ''
      view.unmount()
      return src
    }

    const firstSrc = renderHeroSrc()
    const secondSrc = renderHeroSrc()

    expect(LIBRARY_SRCS.has(firstSrc)).toBe(true)
    expect(LIBRARY_SRCS.has(secondSrc)).toBe(true)
    expect(secondSrc).not.toBe(firstSrc)
  })

  it('retires built-in Unity imagePresetIndex 0 from new studio drafts and gift drafts', () => {
    const draft = newDraft('act_new', '2026-11-24T00:00:00.000Z')
    expect(draft.config.imagePresetIndex).toBe(-1)

    const giftDraft = giftToDraft(
      {
        version: 1,
        catalogVersion: 1,
        mode: 'classic',
        imageKey: 'red-panda',
        selections: [],
      },
      'gift_explicit',
    )
    expect(giftDraft.meta.imageKey).toBe('red-panda')
    expect(giftDraft.config.imagePresetIndex).toBe(-1)
  })

  it('never repeats back-to-back across 50 consecutive device draws and honors explicit teacher/parent choice', () => {
    let previous = ''
    const seen = new Set<string>()
    for (let i = 0; i < 50; i += 1) {
      const picked = pickNextLibraryPicture()
      expect(picked.key).not.toBe(previous)
      expect(localStorage.getItem(LAST_PUZZLE_PICTURE_STORAGE_KEY)).toBe(picked.key)
      previous = picked.key
      seen.add(picked.key)
    }
    expect(seen.size).toBeGreaterThan(5)

    // Explicit teacher/parent choice wins even when it matches the device's last picture.
    writeLastPuzzlePictureKey('coral-reef')
    const resolved = resolveActivityPicture({ explicitKey: 'coral-reef' })
    expect(resolved.source).toBe('explicit')
    expect(resolved.picture.key).toBe('coral-reef')

    // Missing or invalid explicit key falls back to a random library picture, never repeating lastKey.
    const fallback = resolveActivityPicture({ explicitKey: 'missing-key', random: () => 0 })
    expect(fallback.source).toBe('rotated')
    expect(fallback.picture.key).not.toBe('coral-reef')
    expect(LIBRARY_KEYS.has(fallback.picture.key)).toBe(true)
  })

  it('boots /play/act_integer_operations in Unity via SAL0MANderPreview with a non-repeating library picture each game', async () => {
    resolveBuildConfigMock.mockReturnValue(UNITY_CONFIG)

    const firstRun = renderGuestPlay('/play/act_integer_operations')
    await waitFor(() =>
      expect(screen.getByTestId('mock-unity-stage')).toHaveAttribute('data-preview-key'),
    )
    const firstKey = screen.getByTestId('mock-unity-stage').getAttribute('data-preview-key')!
    expect(LIBRARY_KEYS.has(firstKey)).toBe(true)
    expect(preparePreview).toHaveBeenCalledTimes(1)
    firstRun.unmount()

    const secondRun = renderGuestPlay('/play/act_integer_operations')
    await waitFor(() =>
      expect(screen.getByTestId('mock-unity-stage')).toHaveAttribute('data-preview-key'),
    )
    const secondKey = screen.getByTestId('mock-unity-stage').getAttribute('data-preview-key')!
    expect(LIBRARY_KEYS.has(secondKey)).toBe(true)
    expect(secondKey).not.toBe(firstKey)

    // Expanding the companion panel and clicking "New picture" rotates immediately to another picture.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /show companion/i }))
    await user.click(screen.getByRole('button', { name: 'New picture' }))
    await waitFor(() => {
      const thirdKey = screen.getByTestId('mock-unity-stage').getAttribute('data-preview-key')!
      expect(LIBRARY_KEYS.has(thirdKey)).toBe(true)
      expect(thirdKey).not.toBe(secondKey)
    })
    secondRun.unmount()
  })

  it('honors an explicit ?picture= choice on /play/act_integer_operations even if it was just played', async () => {
    resolveBuildConfigMock.mockReturnValue(UNITY_CONFIG)
    writeLastPuzzlePictureKey('coral-reef')

    renderGuestPlay('/play/act_integer_operations?picture=coral-reef')
    await waitFor(() =>
      expect(screen.getByTestId('mock-unity-stage')).toHaveAttribute(
        'data-preview-key',
        'coral-reef',
      ),
    )
    expect(screen.queryByRole('button', { name: 'New picture' })).toBeNull()
  })

  it('builds valid 9-question Unity preview drafts for every sample activity across all board shapes', () => {
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      for (const picture of PUZZLE_LIBRARY.slice(0, 10)) {
        const draft = buildSampleActivityDraft(activity.id, picture)
        expect(PreviewActivitySchema.safeParse(draft).success).toBe(true)
        expect(draft.config.boardShape).toBe(picture.shape)
        expect(draft.config.imagePresetIndex).toBe(-1)
        expect(draft.meta.imageKey).toBe(picture.key)
      }
    }
  })
})
