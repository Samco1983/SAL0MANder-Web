import { StrictMode } from 'react'
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
  FIRST_GAME_PICTURE_KEY,
  FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY,
  LAST_PUZZLE_PICTURE_STORAGE_KEY,
  RECENT_PICTURE_MEMORY,
  RECENT_PUZZLE_PICTURES_STORAGE_KEY,
  pickNextLibraryPicture,
  pickPictureForGameLoad,
  resetPictureRotationLoadCache,
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
  UnityStage: (props: {
    preview?: { picture: { key: string }; requestId: string; config: { activityId: string } }
    boot?: unknown
  }) => {
    stageMock(props)
    return (
      <div
        data-testid="mock-unity-stage"
        data-preview-key={props.preview?.picture.key ?? ''}
        data-preview-activity-id={props.preview?.config.activityId ?? ''}
        data-has-boot={props.boot ? 'true' : 'false'}
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

function renderGuestPlay(initialEntry: string, strict = false) {
  const tree = (
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
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

    // "New picture" is visible on the stage bar without opening the companion panel.
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: /show companion/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    const newPictureBtn = screen.getByRole('button', { name: 'New picture' })
    expect(newPictureBtn).toBeVisible()
    await user.click(newPictureBtn)
    await waitFor(() => {
      const thirdKey = screen.getByTestId('mock-unity-stage').getAttribute('data-preview-key')!
      expect(LIBRARY_KEYS.has(thirdKey)).toBe(true)
      expect(thirdKey).not.toBe(secondKey)
    })
    // Opening the companion keeps exactly one "New picture" button (no duplicate inside companion).
    await user.click(screen.getByRole('button', { name: /show companion/i }))
    expect(screen.getAllByRole('button', { name: 'New picture' })).toHaveLength(1)
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

  it('never shows a recent picture again when one page load picks twice (refetch / StrictMode)', () => {
    for (let trial = 0; trial < 200; trial += 1) {
      localStorage.clear()
      resetPictureRotationMemory()
      const shown: string[] = []
      for (let game = 0; game < 5; game += 1) {
        const first = pickNextLibraryPicture()
        const second = pickNextLibraryPicture()
        shown.push(trial % 2 === 0 ? first.key : second.key)
      }
      expect(new Set(shown).size, `trial ${trial}: ${shown.join(', ')}`).toBe(5)
    }
  })

  it('shows five different pictures across five consecutive games and keeps the history capped', () => {
    const keys = Array.from({ length: 5 }, () => pickNextLibraryPicture().key)
    expect(new Set(keys).size).toBe(5)
    for (let i = 0; i < 30; i += 1) pickNextLibraryPicture()
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_PUZZLE_PICTURES_STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(RECENT_PICTURE_MEMORY)
  })

  it("opens a device's first game on the rover expedition picture, then rotates", () => {
    expect(LIBRARY_KEYS.has(FIRST_GAME_PICTURE_KEY)).toBe(true)
    const first = pickNextLibraryPicture({ random: () => 0.5 })
    expect(first.key).toBe(FIRST_GAME_PICTURE_KEY)
    expect(localStorage.getItem(FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY)).toBe('1')
    const later = Array.from({ length: 8 }, () => pickNextLibraryPicture().key)
    expect(later).not.toContain(FIRST_GAME_PICTURE_KEY)
  })

  it('home page hero (firstGamePicture: false) does not use up the rover first game', () => {
    const hero = pickNextLibraryPicture({ shape: 'Square', firstGamePicture: false, random: () => 0 })
    if (hero.key !== FIRST_GAME_PICTURE_KEY) {
      expect(pickNextLibraryPicture().key).toBe(FIRST_GAME_PICTURE_KEY)
    }
    expect(localStorage.getItem(FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY)).toBe(
      hero.key === FIRST_GAME_PICTURE_KEY ? null : '1',
    )
  })

  it('"New picture" (excludeKey) never forces the rover', () => {
    const picked = pickNextLibraryPicture({ excludeKey: 'coral-reef', random: () => 0 })
    expect(LIBRARY_KEYS.has(picked.key)).toBe(true)
    expect(localStorage.getItem(FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY)).toBeNull()
  })

  it('memoizes per load so refetches reuse the picture, while a reload rotates without repeating', () => {
    const loadKey = 'act_integer_operations:attempt-1:load-1'
    const first = pickPictureForGameLoad(loadKey, { random: () => 0 })
    const refetch = pickPictureForGameLoad(loadKey, { random: () => 0 })
    expect(first.key).toBe(FIRST_GAME_PICTURE_KEY)
    expect(refetch.key).toBe(first.key)

    resetPictureRotationLoadCache()
    const reloaded = pickPictureForGameLoad('act_integer_operations:attempt-1:load-2', {
      random: () => 0,
    })
    expect(reloaded.key).not.toBe(first.key)
  })

  it('StrictMode loads of /play/act_integer_operations open rover-first, never flash legacy boot, use transient sample_ ids, and give 5 distinct pictures across 5 loads', async () => {
    resolveBuildConfigMock.mockReturnValue(UNITY_CONFIG)
    const shownAcrossFiveLoads: string[] = []

    for (let load = 0; load < 5; load += 1) {
      stageMock.mockClear()
      const view = renderGuestPlay('/play/act_integer_operations', true)
      await waitFor(() =>
        expect(screen.getByTestId('mock-unity-stage')).toHaveAttribute('data-preview-key'),
      )
      // Never mounts UnityStage without a preview on initial idle/loading renders.
      for (const call of stageMock.mock.calls) {
        expect(call[0]).toHaveProperty('preview')
        expect(call[0]).not.toHaveProperty('boot')
      }
      const stageEl = screen.getByTestId('mock-unity-stage')
      const key = stageEl.getAttribute('data-preview-key')!
      expect(LIBRARY_KEYS.has(key)).toBe(true)
      expect(stageEl.getAttribute('data-preview-activity-id')).toMatch(/^sample_/)
      shownAcrossFiveLoads.push(key)
      view.unmount()
      resetPictureRotationLoadCache()
    }

    expect(shownAcrossFiveLoads[0]).toBe(FIRST_GAME_PICTURE_KEY)
    expect(new Set(shownAcrossFiveLoads).size).toBe(5)
  })
})
