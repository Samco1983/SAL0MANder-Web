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
