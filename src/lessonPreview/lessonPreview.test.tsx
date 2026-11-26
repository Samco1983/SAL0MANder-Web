import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { readEnv } from '@config/env'
import { HomePage } from '@routes/home/HomePage'
import { JigsawLessonPreviewPage } from '@routes/lesson-preview/JigsawLessonPreviewPage'
import {
  applyHostCommand,
  applyLearnerBoardCommand,
  buildPostLessonParentSummaries,
  buildPrivateWorkRecord,
  createInitialSharedState,
  findPrivacyLeaks,
  handleSeatPresence,
  publicLabelForSeat,
  sweepStaleSeats,
  syncAnsweredCount,
} from './lessonEngine'
import { LocalMultiTabTransport, parseFirebasePreviewUrl } from './syncTransport'
import type { PrivateLearnerWork, PrivateWorkBySeat, SharedBoardState } from './types'

/**
 * In-memory BroadcastChannel polyfill so multi-tab sync tests exercise real
 * cross-tab shared vs. seat-isolated private channels deterministically.
 */
class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>()
  readonly name: string
  onmessage: ((ev: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
    let peers = FakeBroadcastChannel.channels.get(name)
    if (!peers) {
      peers = new Set()
      FakeBroadcastChannel.channels.set(name, peers)
    }
    peers.add(this)
  }

  postMessage(data: unknown): void {
    const peers = FakeBroadcastChannel.channels.get(this.name)
    if (!peers) return
    for (const peer of peers) {
      if (peer === this || !peer.onmessage) continue
      peer.onmessage({ data } as MessageEvent)
    }
  }

  close(): void {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this)
  }

  static reset(): void {
    FakeBroadcastChannel.channels.clear()
  }
}

beforeEach(() => {
  localStorage.clear()
  FakeBroadcastChannel.reset()
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    value: FakeBroadcastChannel,
    configurable: true,
    writable: true,
  })
})

describe('Gate 1 — Single-Turn Control & Teacher Host Locks', () => {
  it('blocks every learner while locked/paused, allows ONLY active seat when unlocked, and rejects non-active seats', () => {
    let state = createInitialSharedState('gate1-room', 1000)
    state = handleSeatPresence(state, 'seat-1', true, 1001)
    state = handleSeatPresence(state, 'seat-2', true, 1002)
    state = handleSeatPresence(state, 'seat-3', true, 1003)

    // Starts locked ("Waiting for Mr. Sam")
    expect(state.boardLocked).toBe(true)
    const lockedAttempt = applyLearnerBoardCommand(state, {
      type: 'rotate_piece',
      actorSeatId: 'seat-1',
      pieceId: 0,
      deltaDeg: 45,
    })
    expect(lockedAttempt.ok).toBe(false)
    if (!lockedAttempt.ok) expect(lockedAttempt.code).toBe('BOARD_LOCKED')

    // Host unlocks board on Maya's turn (seat-1)
    const unlocked = applyHostCommand(state, { type: 'unlock_board' }, {}, 1010)
    expect(unlocked.ok).toBe(true)
    state = unlocked.state
    expect(state.activeSeatId).toBe('seat-1')
    expect(state.boardLocked).toBe(false)

    // Non-active learner Leo (seat-2) is strictly locked out
    const outOfTurn = applyLearnerBoardCommand(state, {
      type: 'place_piece',
      actorSeatId: 'seat-2',
      pieceId: 0,
      targetSlot: 0,
    })
    expect(outOfTurn.ok).toBe(false)
    if (!outOfTurn.ok) expect(outOfTurn.code).toBe('NOT_ACTIVE_TURN')

    // Active learner Maya (seat-1) can rotate by quarter turn (+90°) and place piece #1
    const rot = applyLearnerBoardCommand(state, {
      type: 'rotate_piece',
      actorSeatId: 'seat-1',
      pieceId: 0,
      deltaDeg: 90,
    })
    expect(rot.ok).toBe(true)
    expect(rot.state.pieces[0]?.rotationDeg).toBe(180)
    expect(rot.state.pieces[0]?.lastMovedByLabel).toBe('Maya')

    const placed = applyLearnerBoardCommand(rot.state, {
      type: 'place_piece',
      actorSeatId: 'seat-1',
      pieceId: 0,
      targetSlot: 0,
    })
    expect(placed.ok).toBe(true)
    expect(placed.state.pieces[0]?.placedSlot).toBe(0)

    // Host pauses board while teaching -> active learner is immediately locked out too
    const paused = applyHostCommand(placed.state, { type: 'toggle_pause' }, {}, 1020)
    expect(paused.state.paused).toBe(true)
    const duringPause = applyLearnerBoardCommand(paused.state, {
      type: 'rotate_piece',
      actorSeatId: 'seat-1',
      pieceId: 0,
      deltaDeg: 45,
    })
    expect(duringPause.ok).toBe(false)
    if (!duringPause.ok) expect(duringPause.code).toBe('BOARD_PAUSED')
  })

  it('lets the active learner pass their turn with zero penalty (Section 3.22A)', () => {
    let state = createInitialSharedState('pass-room', 2000)
    state = handleSeatPresence(state, 'seat-1', true, 2001)
    state = handleSeatPresence(state, 'seat-2', true, 2002)
    state = handleSeatPresence(state, 'seat-3', true, 2003)
    state = applyHostCommand(state, { type: 'assign_turn', seatId: 'seat-3' }, {}, 2005).state

    const passed = applyLearnerBoardCommand(
      state,
      { type: 'pass_turn', actorSeatId: 'seat-3' },
      2010,
    )
    expect(passed.ok).toBe(true)
    expect(passed.state.eventBanner).toContain('Priya passed')
    expect(passed.state.activeSeatId).toBe('seat-1')
  })
})

describe('Gate 2 — Strict Privacy Isolation (Sections 3.21, 3.22, 3.22A)', () => {
  it('never leaks typed answers, scratch work, parent emails, or non-consented name ("Leo") into shared state', () => {
    let state = createInitialSharedState('privacy-room', 3000)
    state = handleSeatPresence(state, 'seat-1', true, 3001)
    state = handleSeatPresence(state, 'seat-2', true, 3002)
    state = handleSeatPresence(state, 'seat-3', true, 3003)

    // Assign turn to Leo (consent321: false) -> group must see ONLY "Player 2"
    expect(publicLabelForSeat('seat-1')).toBe('Maya')
    expect(publicLabelForSeat('seat-2')).toBe('Player 2')
    expect(publicLabelForSeat('seat-3')).toBe('Priya')

    state = applyHostCommand(state, { type: 'assign_turn', seatId: 'seat-2' }, {}, 3010).state
    state = applyLearnerBoardCommand(
      state,
      { type: 'rotate_piece', actorSeatId: 'seat-2', pieceId: 1, deltaDeg: 45 },
      3015,
    ).state
    expect(state.pieces[1]?.lastMovedByLabel).toBe('Player 2')

    const privateWork: PrivateWorkBySeat = {
      'seat-1': buildPrivateWorkRecord(
        'seat-1',
        0,
        '-3',
        'maya-private-numberline-note-77',
        0,
        3020,
      ),
      'seat-2': buildPrivateWorkRecord(
        'seat-2',
        0,
        '-13',
        'leo-private-scratch-secret-42',
        0,
        3021,
      ),
      'seat-3': buildPrivateWorkRecord(
        'seat-3',
        0,
        '-3',
        'priya-private-mental-math-88',
        0,
        3022,
      ),
    }

    state = syncAnsweredCount(state, privateWork, 3025)
    expect(state.answeredCount).toBe(3)

    // Host reveals anonymous class total ("2 of 3 got it") — still zero names or answers!
    state = applyHostCommand(state, { type: 'toggle_class_total' }, privateWork, 3030).state
    expect(state.classTotal).toEqual({ shown: true, correctCount: 2, totalCount: 3 })

    expect(findPrivacyLeaks(state, privateWork)).toEqual([])

    // Host CANNOT spotlight Leo's work (3.21 consent === false)
    const deniedLeo = applyHostCommand(
      state,
      {
        type: 'spotlight_learner_work',
        seatId: 'seat-2',
        summary: 'Tried adding 8 + 5',
        familyConfirmed: true,
      },
      privateWork,
      3035,
    )
    expect(deniedLeo.ok).toBe(false)
    if (!deniedLeo.ok) expect(deniedLeo.code).toBe('CONSENT_321_REQUIRED')

    // Host CANNOT spotlight Maya's work without confirming family permission for this specific example
    const unconfirmedMaya = applyHostCommand(
      state,
      {
        type: 'spotlight_learner_work',
        seatId: 'seat-1',
        summary: 'Started at -8 and jumped 5 right',
        familyConfirmed: false,
      },
      privateWork,
      3040,
    )
    expect(unconfirmedMaya.ok).toBe(false)
    if (!unconfirmedMaya.ok) expect(unconfirmedMaya.code).toBe('FAMILY_CONFIRMATION_REQUIRED')

    // With 3.21 Yes + explicit family confirmation, Maya's example can be shown first-name only
    const allowedMaya = applyHostCommand(
      state,
      {
        type: 'spotlight_learner_work',
        seatId: 'seat-1',
        summary: 'Started at -8 and jumped 5 right',
        familyConfirmed: true,
      },
      privateWork,
      3045,
    )
    expect(allowedMaya.ok).toBe(true)
    expect(allowedMaya.state.spotlight?.publicLabel).toBe('Maya')

    // Post-lesson parent summaries isolate each child to their own parent email
    const summaries = buildPostLessonParentSummaries(privateWork)
    expect(summaries).toHaveLength(3)
    expect(summaries[1]?.learnerFirstName).toBe('Leo')
    expect(summaries[1]?.body).not.toContain('Maya')
    expect(summaries[1]?.body).not.toContain('Priya')
  })

  it('isolates private answer channels across live tabs so Learner A never receives Learner B work', () => {
    const hostPrivateReceived: PrivateLearnerWork[] = []
    const mayaSharedReceived: SharedBoardState[] = []
    const priyaPrivateSpy: PrivateLearnerWork[] = []

    const host = new LocalMultiTabTransport('iso-room', 'host', null, {
      onSharedMessage: () => {},
      onPrivateWork: (w) => hostPrivateReceived.push(w),
    })
    const maya = new LocalMultiTabTransport('iso-room', 'learner', 'seat-1', {
      onSharedMessage: (m) => {
        if (m.kind === 'state_sync') mayaSharedReceived.push(m.state)
      },
      onPrivateWork: (w) => priyaPrivateSpy.push(w),
    })
    const leo = new LocalMultiTabTransport('iso-room', 'learner', 'seat-2', {
      onSharedMessage: () => {},
    })

    const leoWork = buildPrivateWorkRecord('seat-2', 0, '-3', 'secret-leo-work-999', 0, 4000)
    leo.publishPrivateWork(leoWork)

    // Mr. Sam receives Leo's private answer, while Maya receives ZERO private payloads and ZERO shared leaks
    expect(hostPrivateReceived).toHaveLength(1)
    expect(hostPrivateReceived[0]?.scratchWork).toBe('secret-leo-work-999')
    expect(priyaPrivateSpy).toHaveLength(0)
    expect(mayaSharedReceived).toHaveLength(0)

    host.close()
    maya.close()
    leo.close()
  })
})

describe('Gate 3 — Disconnect Resilience', () => {
  it('auto-releases active turn lock when Leo closes tab mid-turn or goes stale without stranding the group', () => {
    let state = createInitialSharedState('drop-room', 5000)
    state = handleSeatPresence(state, 'seat-1', true, 5001)
    state = handleSeatPresence(state, 'seat-2', true, 5002)
    state = handleSeatPresence(state, 'seat-3', true, 5003)
    state = applyHostCommand(state, { type: 'assign_turn', seatId: 'seat-2' }, {}, 5010).state
    expect(state.activeSeatId).toBe('seat-2')

    // Case A: explicit disconnect beacon (tab close)
    const afterClose = handleSeatPresence(state, 'seat-2', false, 5020)
    expect(afterClose.seats.find((s) => s.seatId === 'seat-2')?.connected).toBe(false)
    expect(afterClose.activeSeatId).toBe('seat-3')
    expect(afterClose.boardLocked).toBe(false)
    expect(afterClose.eventBanner).toContain('Player 2 stepped away')
    expect(afterClose.eventBanner).not.toMatch(/\bLeo\b/i)

    // Case B: stale heartbeat TTL expiry (Leo's Wi-Fi drops while Maya & Priya keep heartbeating)
    let refreshed = handleSeatPresence(state, 'seat-1', true, 9500)
    refreshed = handleSeatPresence(refreshed, 'seat-3', true, 9500)
    const afterStale = sweepStaleSeats(refreshed, 11000, 4500)
    expect(afterStale.activeSeatId).toBe('seat-3')
    expect(afterStale.seats.find((s) => s.seatId === 'seat-2')?.connected).toBe(false)

    // Case C: last connected learner disconnects -> returns safely to Mr. Sam (locked, never stranded)
    let loneState = handleSeatPresence(afterClose, 'seat-1', false, 5030)
    loneState = handleSeatPresence(loneState, 'seat-3', false, 5035)
    expect(loneState.activeSeatId).toBeNull()
    expect(loneState.boardLocked).toBe(true)
    expect(loneState.eventBanner).toContain('Waiting for Mr. Sam')
  })
})

describe('Multi-tab UI integration, Firebase URL guard, audio audition & private route isolation', () => {
  it('validates opt-in Firebase RTDB URLs strictly (HTTPS firebaseio/firebasedatabase only)', () => {
    expect(parseFirebasePreviewUrl('https://sal0mander-demo.firebaseio.com/')).toBe(
      'https://sal0mander-demo.firebaseio.com',
    )
    expect(
      parseFirebasePreviewUrl('https://sal0mander-demo-default-rtdb.firebasedatabase.app'),
    ).toBe('https://sal0mander-demo-default-rtdb.firebasedatabase.app')
    expect(parseFirebasePreviewUrl('http://sal0mander-demo.firebaseio.com')).toBeNull()
    expect(parseFirebasePreviewUrl('https://evil.example.com')).toBeNull()
    expect(parseFirebasePreviewUrl('https://user:pass@sal0mander-demo.firebaseio.com')).toBeNull()
  })

  it('syncs Host + Maya + Leo tabs live in the DOM, keeps answers private, and loads Letters in the Rain at low volume', async () => {
    const user = userEvent.setup()

    const renderTab = (search: string) =>
      render(
        <MemoryRouter initialEntries={[`/preview/jigsaw-lesson${search}`]}>
          <Routes>
            <Route path="/preview/jigsaw-lesson" element={<JigsawLessonPreviewPage />} />
          </Routes>
        </MemoryRouter>,
      )

    const hostView = renderTab('?room=live-ui-1&role=host')
    const mayaView = renderTab('?room=live-ui-1&role=learner&seat=seat-1')
    const leoView = renderTab('?room=live-ui-1&role=learner&seat=seat-2')

    // Background music uses existing Letters in the Rain track
    const audioEl = hostView.container.querySelector('audio')
    expect(audioEl?.getAttribute('src')).toContain('audio/tracks/letters-in-the-rain.mp3')

    // Host unlocks board -> Maya gets controls, Leo stays locked out!
    await user.click(within(hostView.container).getByTestId('host-lock-toggle'))

    expect(within(mayaView.container).getByTestId('rotate-quarter-btn')).toBeEnabled()
    expect(within(leoView.container).getByTestId('rotate-quarter-btn')).toBeDisabled()

    // Maya rotates piece #1 (+90°) and places it in slot 1 -> Leo sees move live with label "Maya"
    await user.click(within(mayaView.container).getByTestId('rotate-quarter-btn'))
    await user.click(within(mayaView.container).getByTestId('board-slot-0'))
    expect(within(leoView.container).getByTestId('board-slot-0')).toHaveTextContent('Maya')

    // Leo submits a private math answer + scratch work -> Host sees it; Maya NEVER sees it!
    await user.type(within(leoView.container).getByTestId('private-answer-input'), '-3')
    await user.type(
      within(leoView.container).getByTestId('private-scratch-input'),
      'leo-only-secret-thought',
    )
    await user.click(within(leoView.container).getByTestId('private-submit-btn'))

    expect(within(hostView.container).getByTestId('host-private-seat-2')).toHaveTextContent(
      'leo-only-secret-thought',
    )
    expect(mayaView.container.textContent ?? '').not.toContain('leo-only-secret-thought')
    expect(mayaView.container.textContent ?? '').not.toMatch(/\bLeo\b/)
    expect(within(mayaView.container).getByTestId('shared-answered-count')).toHaveTextContent(
      '1 of 3 answered',
    )

    // Host passes turn to Leo (Player 2), then Leo clicks "Step away (disconnect)" -> lock auto-releases!
    await user.click(within(hostView.container).getByTestId('host-assign-seat-2'))
    expect(within(leoView.container).getByTestId('rotate-quarter-btn')).toBeEnabled()
    expect(within(mayaView.container).getByTestId('rotate-quarter-btn')).toBeDisabled()

    await user.click(within(leoView.container).getByTestId('toggle-disconnect-btn'))
    expect(within(hostView.container).getByTestId('event-banner')).toHaveTextContent(
      'Player 2 stepped away',
    )
    expect(within(mayaView.container).getByTestId('rotate-quarter-btn')).toBeEnabled()

    await act(async () => {
      hostView.unmount()
      mayaView.unmount()
      leoView.unmount()
    })
  })

  it('keeps the private preview route unlinked from the public HomePage and navigation', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </ThemeProvider>,
    )
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('jigsaw-lesson') || h.includes('/preview/'))).toBe(false)

    // Production builds keep the preview fail-closed unless explicitly opted in.
    const prodDefault = readEnv({ VITE_APP_ENV: 'production' })
    expect(!prodDefault.isProd || prodDefault.features.lessonPreview).toBe(false)

    const prodOptIn = readEnv({
      VITE_APP_ENV: 'production',
      VITE_FEATURE_LESSON_PREVIEW: 'true',
    })
    expect(!prodOptIn.isProd || prodOptIn.features.lessonPreview).toBe(true)

    const localDev = readEnv({ VITE_APP_ENV: 'local' })
    expect(!localDev.isProd || localDev.features.lessonPreview).toBe(true)
  })
})
