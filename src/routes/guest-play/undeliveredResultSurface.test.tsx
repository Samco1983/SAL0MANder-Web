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

/**
 * W-13, the visible half.
 *
 * `usePlaySession` holding a result is worth nothing if no surface reads it.
 * `result-undeliverable` existed for a full release without a single component
 * referencing it — a state no human could ever see, which is the same silence
 * from the outside as not having the state at all.
 *
 * Two things are asserted together on purpose: the notice appears, AND the
 * stage is untouched. A save problem that interrupts the game would trade one
 * defect for a worse one (non-negotiable #4).
 */

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
 * Play an activity from share link to `session-finished`.
 *
 * Whether the submission succeeds is up to the caller's spy — the same drive is
 * used for the failing and the succeeding case, so nothing about the surface
 * can be an artefact of a different path.
 *
 * Drives the real bridge events and the real mock transport, so the session is
 * genuinely open before the completion fires — a result sent too early would
 * only be buffered, and this test would pass through a different code path.
 */
async function playToCompletion(startSpy: { mock: { results: { value: unknown }[] } }) {
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
}

beforeEach(() => {
  seq = 0
  sessionStorage.clear()
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('a result the backend would not take', () => {
  it('tells the student, and leaves the stage alone', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'offline' }),
    )

    await playToCompletion(start)

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/isn't saved yet/i)
    // W-16: the notice must not promise durability the app does not have —
    // the result lives in memory only and a reload loses it, so the copy must
    // tell the student to keep the tab open rather than claim the device (or
    // "nothing is lost" unconditionally) is holding it for them.
    expect(notice).toHaveTextContent(/keep this tab open/i)
    expect(notice).not.toHaveTextContent(/this device is holding/i)
    // The game stage is still mounted and was never replaced by the failure.
    // The notice lives in the companion panel, not over the stage.
    const stage = screen.getByLabelText('Game stage')
    expect(stage).toBeInTheDocument()
    expect(stage).not.toContainElement(notice)
  })

  it('names the attempt, so the record can be reconciled later', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'offline' }),
    )

    await playToCompletion(start)

    const attemptId = live().clientAttemptId as string
    expect(attemptId).toBeTruthy()
    expect(await screen.findByText(new RegExp(`attempt: ${attemptId}`))).toBeInTheDocument()
  })

  it('saves the held result when the student retries and the network is back', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    const submitResult = vi
      .spyOn(api.sessions, 'submitResult')
      .mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))

    await playToCompletion(start)
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: /try saving again/i }))

    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(2))
    // Same session, same derived key: a repeat write, not a second completion.
    expect(submitResult.mock.calls[1]?.[0]).toBe(submitResult.mock.calls[0]?.[0])
    expect(submitResult.mock.calls[1]?.[2]).toBe(submitResult.mock.calls[0]?.[2])
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('says nothing at all when the submission succeeds', async () => {
    // The notice must not be a permanent fixture of the finished state.
    const start = vi.spyOn(api.sessions, 'start')

    await playToCompletion(start)

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})

/**
 * W-15 — the notice in a panel the student had closed.
 *
 * W-13 shipped the notice into the companion panel, which is collapsible, and
 * left the gap open in writing: a student who had collapsed it would never see
 * that their result failed to save. The panel is where the notice belongs —
 * nothing may cover the stage — so the panel has to open instead.
 *
 * Ruled 2026-08-19: expand automatically on either failure route, do not
 * overlay the stage, do not take focus, and give the student's collapse
 * preference back once the result is delivered.
 */

const COLLAPSE_KEY = 'sal0mander.companion.collapsed'
const panelState = () =>
  screen.getByRole('button', { name: /companion/i }).getAttribute('aria-expanded')

/** The student closed the companion panel on a previous visit. */
const studentCollapsedThePanel = () => localStorage.setItem(COLLAPSE_KEY, 'true')

/**
 * The *other* failure route: `POST /sessions` never succeeds, and the student
 * finishes while it is still in flight. No session is ever opened, so the held
 * result has no session to name — the route W-12 built and W-13 kept.
 */
async function startFailureToUndeliverable() {
  let rejectStart: (reason: unknown) => void = () => {}
  const start = vi
    .spyOn(api.sessions, 'start')
    .mockImplementation(() => new Promise((_, reject) => (rejectStart = reject)))

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
  expect(start).toHaveBeenCalled()

  // Finishes before the start resolves — the race a four-piece puzzle wins.
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
}

describe('an undelivered result the student cannot see', () => {
  it('opens the panel when the submission is what failed', async () => {
    studentCollapsedThePanel()
    const start = vi.spyOn(api.sessions, 'start')
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'offline' }),
    )

    await playToCompletion(start)

    await screen.findByRole('alert')
    expect(panelState()).toBe('true')
  })

  it('opens the panel when the session never started', async () => {
    studentCollapsedThePanel()

    await startFailureToUndeliverable()

    await screen.findByRole('alert')
    expect(panelState()).toBe('true')
  })

  it('keeps the notice out of the stage and off the keyboard', async () => {
    studentCollapsedThePanel()
    const start = vi.spyOn(api.sessions, 'start')
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'offline' }),
    )

    await playToCompletion(start)
    const notice = await screen.findByRole('alert')

    // Opening the panel must not turn a save problem into a game interruption.
    expect(screen.getByLabelText('Game stage')).not.toContainElement(notice)
    expect(document.activeElement).toBe(document.body)
  })

  it('gives the collapsed panel back once the result is saved', async () => {
    studentCollapsedThePanel()
    const start = vi.spyOn(api.sessions, 'start')
    const submitResult = vi
      .spyOn(api.sessions, 'submitResult')
      .mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))

    await playToCompletion(start)
    await screen.findByRole('alert')
    expect(panelState()).toBe('true')

    await userEvent.click(screen.getByRole('button', { name: /try saving again/i }))
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(2))

    // The reveal was the app borrowing the panel, not overruling the student.
    await waitFor(() => expect(panelState()).toBe('false'))
    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('true')
  })

  it('does not close and re-open the panel when a retry fails too', async () => {
    studentCollapsedThePanel()
    const start = vi.spyOn(api.sessions, 'start')
    const submitResult = vi
      .spyOn(api.sessions, 'submitResult')
      .mockRejectedValue(new ApiError({ code: 'network_error', message: 'offline' }))

    await playToCompletion(start)
    await screen.findByRole('alert')
    expect(panelState()).toBe('true')

    // Watch the layout itself, because the flicker is a transient: a retry
    // passes through `submitting`, and a surface keyed on the status alone
    // collapses the panel there and re-expands it when the retry fails.
    const layout = document.querySelector('[data-collapsed]')
    if (!layout) throw new Error('companion layout not found')
    const seen: (string | null)[] = []
    const observer = new MutationObserver((records) =>
      records.forEach((r) => seen.push((r.target as HTMLElement).getAttribute('data-collapsed'))),
    )
    observer.observe(layout, { attributes: true, attributeFilter: ['data-collapsed'] })

    await userEvent.click(screen.getByRole('button', { name: /try saving again/i }))
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    observer.disconnect()

    // On a flaky connection a student may press this several times. The panel
    // must not flap shut and open again each time.
    expect(seen).not.toContain('true')
    expect(panelState()).toBe('true')
  })

  it('leaves an open panel open, and never writes a preference of its own', async () => {
    // No stored preference at all: the reveal must not invent one, or the next
    // visit inherits a collapse state the student never chose.
    const start = vi.spyOn(api.sessions, 'start')
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'offline' }),
    )

    await playToCompletion(start)
    await screen.findByRole('alert')

    expect(panelState()).toBe('true')
    expect(localStorage.getItem(COLLAPSE_KEY)).toBeNull()
  })
})
