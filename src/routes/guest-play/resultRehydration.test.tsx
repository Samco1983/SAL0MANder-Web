import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { api } from '@api/index'
import { ApiError } from '@api/errors'
import { MOCK_SHARE_CODES } from '@api/mockTransport'
import { BRIDGE_VERSION, UNITY_EVENT_NAME } from '@unity/bridge'
import { GuestPlayPage } from './GuestPlayPage'
import { saveHeldResult } from './resultHold'

/**
 * W-16 — a reload must not destroy a held, undelivered result.
 *
 * A real reload tears down every React state value and ref, but leaves
 * `sessionStorage` untouched. Modelled here as `unmount()` followed by a fresh
 * render of the same route, *without* clearing storage in between — the one
 * thing an actual reload does that this file's own `beforeEach` must not.
 */

const DEMO_VERSION_ID = 'demo-version-1'
const HELD_RESULT_KEY = `sal0mander.session.heldResult.${DEMO_VERSION_ID}`

let seq = 0
const emit = (detail: unknown) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(UNITY_EVENT_NAME, { detail }))
  })

/** The attempt id the app is currently using, as Unity would echo it back. */
function live(): Record<string, unknown> {
  const key = Object.keys(sessionStorage).find((k) => k.includes('startKey'))
  return key ? { clientAttemptId: sessionStorage.getItem(key) } : {}
}

function renderPlay(code: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/play/${code}`]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

/**
 * A real reload restarts Unity too — a fresh WebGL instance, with no memory of
 * having picked a mode. `chosenMode` is ordinary React state, gone with the
 * remount, so `usePlaySession` stays `enabled` but without `selectedPlayMode`
 * until this handshake repeats. Anything simulating a reload has to redo it,
 * the same as the very first boot.
 */
async function reboot() {
  await screen.findByText(/Fractions Review/i)
  emit({ type: 'ready', version: BRIDGE_VERSION, eventId: `ready-${++seq}` })
  emit({
    type: 'mode-selected',
    version: BRIDGE_VERSION,
    selectedPlayMode: 'classic-puzzle',
    eventId: `mode-${++seq}`,
    ...live(),
  })
}

/** Play an activity from share link to `session-finished`, session opened. */
async function playToCompletion(startSpy: { mock: { results: { value: unknown }[] } }) {
  const utils = renderPlay(MOCK_SHARE_CODES.ok)
  await screen.findByText(/Fractions Review/i)

  emit({ type: 'ready', version: BRIDGE_VERSION, eventId: `ready-${++seq}` })
  emit({
    type: 'mode-selected',
    version: BRIDGE_VERSION,
    selectedPlayMode: 'classic-puzzle',
    eventId: `mode-${++seq}`,
    ...live(),
  })

  const first = startSpy.mock.results[0]
  if (!first) throw new Error('POST /sessions was never called')
  await act(async () => {
    await first.value
  })
  const sessionId = ((await first.value) as { id: string }).id

  emit({
    type: 'session-finished',
    version: BRIDGE_VERSION,
    durationMs: 42_000,
    questionsAnswered: 9,
    questionsCorrect: 8,
    piecesPlaced: 9,
    piecesTotal: 9,
    eventId: `fin-${++seq}`,
    ...live(),
    sessionId,
  })

  return utils
}

/**
 * The other failure route: `POST /sessions` never succeeds, and the student
 * finishes while it is still in flight. No session is ever opened.
 */
async function startFailureToUndeliverable() {
  let rejectStart: (reason: unknown) => void = () => {}
  const start = vi
    .spyOn(api.sessions, 'start')
    .mockImplementation(() => new Promise((_, reject) => (rejectStart = reject)))

  const utils = renderPlay(MOCK_SHARE_CODES.ok)
  await screen.findByText(/Fractions Review/i)

  emit({ type: 'ready', version: BRIDGE_VERSION, eventId: `ready-${++seq}` })
  emit({
    type: 'mode-selected',
    version: BRIDGE_VERSION,
    selectedPlayMode: 'classic-puzzle',
    eventId: `mode-${++seq}`,
    ...live(),
  })
  expect(start).toHaveBeenCalled()

  emit({
    type: 'session-finished',
    version: BRIDGE_VERSION,
    durationMs: 900,
    questionsAnswered: 4,
    questionsCorrect: 4,
    piecesPlaced: 4,
    piecesTotal: 4,
    eventId: `fin-${++seq}`,
    ...live(),
  })

  await act(async () => {
    rejectStart(new ApiError({ code: 'network_error', message: 'offline' }))
    await Promise.resolve()
  })

  return { ...utils, start }
}

beforeEach(() => {
  seq = 0
  sessionStorage.clear()
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('reloading after a submission failure', () => {
  it('restores the notice without losing the session, and a retry saves and clears storage', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    const submitResult = vi
      .spyOn(api.sessions, 'submitResult')
      .mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))

    const { unmount } = await playToCompletion(start)
    await screen.findByRole('alert')
    expect(sessionStorage.getItem(HELD_RESULT_KEY)).not.toBeNull()

    // The reload: tear down React, keep storage.
    unmount()
    renderPlay(MOCK_SHARE_CODES.ok)
    await reboot()

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/isn't saved yet/i)
    // Restored from storage, not from a fresh network round trip.
    expect(start).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /try saving again/i }))
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(2))
    // Wait on the definitive signal, not on the alert's absence: `submitting`
    // is also alert-free, so that check alone can pass mid-flight, before
    // delivery has actually resolved either way.
    await waitFor(() => expect(sessionStorage.getItem(HELD_RESULT_KEY)).toBeNull())
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('keeps the notice and the held record when the post-reload retry fails too', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    const submitResult = vi
      .spyOn(api.sessions, 'submitResult')
      .mockRejectedValue(new ApiError({ code: 'network_error', message: 'offline' }))

    const { unmount } = await playToCompletion(start)
    await screen.findByRole('alert')

    unmount()
    renderPlay(MOCK_SHARE_CODES.ok)
    await reboot()
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: /try saving again/i }))
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(2))
    await screen.findByRole('alert')
    expect(sessionStorage.getItem(HELD_RESULT_KEY)).not.toBeNull()
  })
})

describe('reloading after a start failure', () => {
  it('restores the notice with no network call, then a retry starts and delivers', async () => {
    const { unmount, start: staleStart } = await startFailureToUndeliverable()
    await screen.findByRole('alert')
    expect(sessionStorage.getItem(HELD_RESULT_KEY)).not.toBeNull()

    unmount()
    // The original spy never resolves; restore it so the reload's start call,
    // once retried, hits the real (now-succeeding) mock transport.
    staleStart.mockRestore()

    const start = vi.spyOn(api.sessions, 'start')
    const submitResult = vi.spyOn(api.sessions, 'submitResult')

    renderPlay(MOCK_SHARE_CODES.ok)
    await reboot()
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/isn't saved yet/i)
    expect(start).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /try saving again/i }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(sessionStorage.getItem(HELD_RESULT_KEY)).toBeNull())
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})

describe('a held record for a superseded attempt', () => {
  it('is ignored and cleared, rather than restored into a stranger\'s notice', async () => {
    // Seeded under the live activity version, for an attempt this browser
    // is not on any more — e.g. a record left behind by a previous student
    // on a shared classroom device, or by an abandoned attempt.
    saveHeldResult(DEMO_VERSION_ID, {
      attemptId: 'stale-attempt-id',
      result: {
        status: 'completed',
        durationMs: 1,
        questionsAnswered: 1,
        questionsCorrect: 1,
        piecesPlaced: 1,
        piecesTotal: 1,
        completedAt: new Date(0).toISOString(),
      },
    })

    const start = vi.spyOn(api.sessions, 'start')
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)

    emit({ type: 'ready', version: BRIDGE_VERSION, eventId: `ready-${++seq}` })
    emit({
      type: 'mode-selected',
      version: BRIDGE_VERSION,
      selectedPlayMode: 'classic-puzzle',
      eventId: `mode-${++seq}`,
      ...live(),
    })

    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // Dead data from a session that will never come back for it.
    expect(sessionStorage.getItem(HELD_RESULT_KEY)).toBeNull()
  })
})

describe('a new tab', () => {
  it('does not inherit a held result left in another tab', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'offline' }),
    )

    await playToCompletion(start)
    await screen.findByRole('alert')

    expect(sessionStorage.getItem(HELD_RESULT_KEY)).not.toBeNull()
    // sessionStorage is per-tab by construction; nothing here is ever written
    // to localStorage, which is what a new tab would actually share.
    expect(localStorage.getItem(HELD_RESULT_KEY)).toBeNull()
  })
})
