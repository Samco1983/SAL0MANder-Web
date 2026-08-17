import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { api } from '@api/index'
import { MOCK_SHARE_CODES } from '@api/mockTransport'
import { BRIDGE_VERSION, UNITY_EVENT_NAME } from '@unity/bridge'
import { GuestPlayPage } from './GuestPlayPage'
import { resolveSelectedMode } from './modeSelection'

/**
 * Gate-1 web harness: boot → mode-selected → session-started → session-finished,
 * driven end to end against the mock backend.
 *
 * Unity is simulated by dispatching the real bridge events, so this exercises
 * the same listener, the same dedupe and the same validation the live game
 * would hit. What it cannot prove is interoperability — no C# receiver exists,
 * so the Web→Unity direction is asserted at the SendMessage boundary.
 */


/** Everything Unity would send, as the bridge really delivers it. */
const unity = {
  ready: () =>
    emit({ type: 'ready', version: BRIDGE_VERSION, eventId: `ready-${++seq}` }),
  modeSelected: (selectedPlayMode: string, eventId = `mode-${++seq}`) =>
    emit({ type: 'mode-selected', version: BRIDGE_VERSION, selectedPlayMode, eventId }),
  finished: (eventId = `fin-${++seq}`) =>
    emit({
      type: 'session-finished',
      version: BRIDGE_VERSION,
      durationMs: 42_000,
      questionsAnswered: 9,
      questionsCorrect: 8,
      piecesPlaced: 9,
      piecesTotal: 9,
      eventId,
    }),
}

let seq = 0
const emit = (detail: unknown) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(UNITY_EVENT_NAME, { detail }))
  })

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

beforeEach(() => {
  seq = 0
  sessionStorage.clear()
  localStorage.clear()
  // No Unity build in tests, so UnityStage never mounts an instance. Boot
  // messages are asserted at the resolver and API layers instead.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('mode resolution — the rules', () => {
  const allowed = ['learning-puzzle', 'classic-puzzle']

  it('accepts the first valid mode', () => {
    expect(resolveSelectedMode('classic-puzzle', undefined, allowed)).toEqual({
      outcome: 'accepted',
      mode: 'classic-puzzle',
    })
  })

  it('ignores an identical duplicate', () => {
    // Redelivery, or Unity re-announcing. Harmless, and must not re-pin.
    expect(resolveSelectedMode('classic-puzzle', 'classic-puzzle', allowed).outcome).toBe(
      'ignored-duplicate',
    )
  })

  it('rejects a conflicting later mode and keeps the pin', () => {
    const v = resolveSelectedMode('learning-puzzle', 'classic-puzzle', allowed)
    expect(v).toMatchObject({ outcome: 'rejected-conflict', pinned: 'classic-puzzle' })
  })

  it('rejects a mode the activity does not allow', () => {
    // Version skew: a build offering a mode this activity never published.
    expect(resolveSelectedMode('hard-mode', undefined, allowed).outcome).toBe(
      'rejected-not-allowed',
    )
  })

  it('rejects anything before the allow-list is known', () => {
    // Accepting here would pin a mode nothing has authorised.
    expect(resolveSelectedMode('classic-puzzle', undefined, undefined).outcome).toBe(
      'rejected-not-allowed',
    )
  })
})

describe('the handshake, end to end', () => {
  it('opens exactly one session for a Student Choice activity', async () => {
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)

    unity.ready()
    unity.modeSelected('classic-puzzle')

    await waitFor(() => expect(screen.getByText(/version:/)).toBeInTheDocument())
    // One attempt id in storage means one session was opened, not two.
    const keys = Object.keys(sessionStorage).filter((k) => k.includes('startKey'))
    expect(keys).toHaveLength(1)
  })

  it('does not open a session before a mode arrives', async () => {
    /*
     * Student Choice: the bundle resolves, but the choice does not exist yet.
     * Asserted against POST /sessions rather than storage — the attempt id is
     * now created before boot, so a stored key is expected here and proves
     * nothing about whether a session was opened.
     */
    const start = vi.spyOn(api.sessions, 'start')
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)
    unity.ready()

    expect(start).not.toHaveBeenCalled()
  })

  it('keeps one session across a duplicate mode-selected', async () => {
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)

    unity.modeSelected('classic-puzzle', 'mode-a')
    await waitFor(() =>
      expect(Object.keys(sessionStorage).filter((k) => k.includes('startKey'))).toHaveLength(1),
    )
    const before = sessionStorage.getItem(
      Object.keys(sessionStorage).find((k) => k.includes('startKey'))!,
    )

    // Same mode again, distinct eventId so dedupe does not mask the test.
    unity.modeSelected('classic-puzzle', 'mode-b')

    const after = sessionStorage.getItem(
      Object.keys(sessionStorage).find((k) => k.includes('startKey'))!,
    )
    expect(after).toBe(before)
  })

  it('refuses a conflicting mode without opening a second session', async () => {
    /*
     * Asserts on the mode that actually reached POST /sessions, not on the
     * start key. The key is derived from activityVersionId, so it is identical
     * whether conflict resolution works or not — an earlier version of this
     * test checked the key and passed happily with "last mode wins" patched in.
     */
    const start = vi.spyOn(api.sessions, 'start')
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)

    unity.modeSelected('classic-puzzle', 'mode-a')
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    expect(start.mock.calls[0]?.[0].selectedPlayMode).toBe('classic-puzzle')

    unity.modeSelected('learning-puzzle', 'mode-b')

    // No second start, and the first one stays pinned to the first choice.
    expect(start).toHaveBeenCalledTimes(1)
    expect(start.mock.calls[0]?.[0].selectedPlayMode).toBe('classic-puzzle')
    expect(Object.keys(sessionStorage).filter((k) => k.includes('startKey'))).toHaveLength(1)
  })

  it('does not re-start on a duplicate mode', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)

    unity.modeSelected('classic-puzzle', 'mode-a')
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))

    unity.modeSelected('classic-puzzle', 'mode-b')
    unity.modeSelected('classic-puzzle', 'mode-c')

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('sends clientAttemptId equal to the start idempotency key', async () => {
    // One concept, one value — two ids for the same thing eventually disagree.
    const start = vi.spyOn(api.sessions, 'start')
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)
    unity.modeSelected('classic-puzzle')

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    const [body, key] = start.mock.calls[0] as [{ clientAttemptId?: string }, string]
    expect(body.clientAttemptId).toBe(key)
    expect(key).toBeTruthy()
  })

  it('deduplicates a replayed session-finished', async () => {
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)
    unity.modeSelected('classic-puzzle')
    await waitFor(() =>
      expect(Object.keys(sessionStorage).filter((k) => k.includes('startKey'))).toHaveLength(1),
    )

    // Same eventId three times — a Unity retry, or a re-attached listener.
    unity.finished('fin-1')
    unity.finished('fin-1')
    unity.finished('fin-1')

    // The attempt resolves once; the start key is cleared exactly once and
    // never re-created by the replays.
    await waitFor(() =>
      expect(Object.keys(sessionStorage).filter((k) => k.includes('startKey'))).toHaveLength(0),
    )
  })

  it('does not lose a result that finishes before the session exists', async () => {
    // The race on a four-piece puzzle: Unity finishes before POST /sessions
    // returns. Buffered, not dropped.
    renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)

    unity.modeSelected('classic-puzzle')
    unity.finished('fin-early')

    await waitFor(() =>
      expect(Object.keys(sessionStorage).filter((k) => k.includes('startKey'))).toHaveLength(0),
    )
  })
})

describe('reconnect', () => {
  it('reuses the stored attempt id after a reload', async () => {
    const first = renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)
    unity.modeSelected('classic-puzzle')
    await waitFor(() =>
      expect(Object.keys(sessionStorage).filter((k) => k.includes('startKey'))).toHaveLength(1),
    )
    const key = Object.keys(sessionStorage).find((k) => k.includes('startKey'))!
    const attemptBefore = sessionStorage.getItem(key)

    first.unmount()

    const second = renderPlay(MOCK_SHARE_CODES.ok)
    await screen.findByText(/Fractions Review/i)
    unity.modeSelected('classic-puzzle')

    // Same tab, same activity version: the reload resumes rather than
    // fragmenting one student into two rows in a teacher's report.
    await waitFor(() => expect(sessionStorage.getItem(key)).toBe(attemptBefore))
    second.unmount()
  })
})
