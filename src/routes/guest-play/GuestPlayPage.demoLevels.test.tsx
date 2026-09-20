import { useEffect, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { api } from '@api/index'
import { ApiError } from '@api/errors'
import { ActivityIdSchema, ActivityVersionIdSchema } from '@contracts/v1/ids'
import { BRIDGE_VERSION, UNITY_EVENT_NAME } from '@unity/bridge'
import { GuestPlayPage, GuestPlayIndexPage } from './GuestPlayPage'

const probe = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  configured: false,
  boot: undefined as
    | undefined
    | {
        clientAttemptId?: string
        sessionId?: string
        selectedPlayMode?: string
        activityVersionId: string
        playBundle?: unknown
      },
}))
vi.mock('@config/env', async (load) => {
  const original = await load<typeof import('@config/env')>()
  return {
    ...original,
    env: {
      ...original.env,
      api: {
        ...original.env.api,
        get isConfigured() {
          return probe.configured
        },
      },
    },
  }
})
vi.mock('@unity/UnityStage', () => ({
  UnityStage: ({ controls, boot }: { controls?: ReactNode; boot?: typeof probe.boot }) => {
    probe.boot = boot
    useEffect(() => {
      probe.mounts++
      return () => {
        probe.unmounts++
      }
    }, [])
    return <div data-testid="native-unity-stage">{controls}</div>
  },
}))
let sequence = 0
function emit(overrides: Record<string, unknown> = {}) {
  act(() =>
    window.dispatchEvent(
      new CustomEvent(UNITY_EVENT_NAME, {
        detail: {
          type: 'session-finished',
          version: BRIDGE_VERSION,
          eventId: `demo-finish-${++sequence}`,
          clientAttemptId: probe.boot?.clientAttemptId,
          sessionId: probe.boot?.sessionId,
          durationMs: 1200,
          questionsAnswered: 4,
          questionsCorrect: 4,
          piecesPlaced: 4,
          piecesTotal: 4,
          ...overrides,
        },
      }),
    ),
  )
}
function play(id = 'act_demo_integer_1') {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={['/play/' + id]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
          <Route path="/demos/slide" element={<h1>Swap &amp; Solve demo</h1>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}
async function active() {
  await waitFor(() => expect(probe.boot?.sessionId).toBeTruthy())
  expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
}
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  sequence = 0
  probe.mounts = 0
  probe.unmounts = 0
  probe.configured = false
  probe.boot = undefined
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('native demo session lifecycle', () => {
  it.each([1, 2, 3])(
    'sends old Matching level %s links to the combined game before opening a player',
    async (level) => {
      render(play(`act_demo_matching_${level}`))
      expect(await screen.findByRole('heading', { name: 'Swap & Solve demo' })).toBeVisible()
      expect(probe.mounts).toBe(0)
      expect(probe.boot).toBeUndefined()
    },
  )
  it('preserves a configured backend activity even if its ID resembles the retired demo', async () => {
    probe.configured = true
    render(play('act_demo_matching_1'))
    await active()
    expect(screen.getByTestId('native-unity-stage')).toBeVisible()
    expect(probe.mounts).toBe(1)
    expect(screen.queryByRole('heading', { name: 'Swap & Solve demo' })).toBeNull()
  })
  it('retains the same stage, boot identity and session through ordinary rerender and companion toggles', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    const view = render(play())
    await active()
    const boot = probe.boot
    const stage = screen.getByTestId('native-unity-stage')
    view.rerender(play())
    fireEvent.click(screen.getByRole('button', { name: /show companion/i }))
    expect(probe.boot).toBe(boot)
    expect(screen.getByTestId('native-unity-stage')).toBe(stage)
    expect(probe.mounts).toBe(1)
    expect(probe.unmounts).toBe(0)
    expect(start).toHaveBeenCalledOnce()
    expect(start.mock.calls[0]![0].selectedPlayMode).toBe('learning-puzzle')
  })
  it('ignores stale, wrong-session, uncorrelated and malformed completions, then waits for delivery', async () => {
    const original = api.sessions.submitResult
    let deliver!: () => Promise<void>
    const submit = vi.spyOn(api.sessions, 'submitResult').mockImplementation(
      (...args) =>
        new Promise((resolve, reject) => {
          deliver = async () => {
            try {
              resolve(await original(...args))
            } catch (error) {
              reject(error)
            }
          }
        }),
    )
    render(play())
    await active()
    emit({ clientAttemptId: 'old-attempt' })
    emit({ sessionId: 'old-session' })
    emit({ clientAttemptId: undefined, sessionId: undefined })
    emit({ piecesTotal: undefined })
    expect(submit).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
    const boot = probe.boot
    emit()
    expect(submit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Replay level' })).toBeNull()
    await act(async () => {
      await deliver()
    })
    expect(await screen.findByRole('link', { name: 'Next level' })).toHaveAttribute(
      'href',
      '/play/act_demo_integer_2',
    )
    expect(probe.boot?.clientAttemptId).toBe(boot?.clientAttemptId)
    expect(probe.boot?.activityVersionId).toBe('act_demo_integer_1-v1')
    expect(probe.mounts).toBe(1)
    expect(probe.unmounts).toBe(0)
  })
  it('withholds Next and Replay while a completed result is undeliverable', async () => {
    vi.spyOn(api.sessions, 'submitResult').mockRejectedValue(
      new ApiError({ code: 'network_error', message: 'Offline' }),
    )
    render(play())
    await active()
    emit()
    expect(
      await screen.findByRole('heading', { name: "Your finished activity isn't saved yet" }),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Replay level' })).toBeNull()
    expect(probe.mounts).toBe(1)
  })
  it('replay explicitly starts a new attempt and has no inherited completion', async () => {
    const view = render(play())
    await active()
    const previous = probe.boot?.clientAttemptId
    emit()
    const replay = await screen.findByRole('link', { name: 'Replay level' })
    document.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(replay)
    view.unmount()
    render(play())
    await active()
    expect(probe.boot?.clientAttemptId).not.toBe(previous)
    expect(screen.queryByRole('link', { name: 'Replay level' })).toBeNull()
    emit({ clientAttemptId: previous })
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
  })
  it('uses Classic wire mode and never claims all levels from a direct Challenge landing', async () => {
    const start = vi.spyOn(api.sessions, 'start')
    render(play('act_demo_classic_3'))
    await active()
    expect(probe.boot?.selectedPlayMode).toBe('classic-puzzle')
    expect(start.mock.calls[0]![0].selectedPlayMode).toBe('classic-puzzle')
    emit({ questionsAnswered: 0, questionsCorrect: 0, piecesPlaced: 16, piecesTotal: 16 })
    expect(await screen.findByText('Final level complete!')).toBeVisible()
    expect(screen.queryByText(/all.*levels complete/i)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
  })
  it.each(['act_integer_operations', 'demo-activity'])(
    'does not attach native progression to legacy path %s',
    async (id) => {
      render(play(id))
      await waitFor(() => expect(probe.boot?.activityVersionId).toBeTruthy())
      expect(screen.queryByRole('region', { name: 'Demo levels' })).toBeNull()
    },
  )
  it('preserves a teacher-authored payload and offers no native levels even after completion', async () => {
    const original = await api.activities.getGuestBundle('demo-activity')
    const id = ActivityIdSchema.parse('act_teacher_science')
    const authored = {
      allowedPlayModes: ['learning-puzzle'],
      defaultPlayMode: 'learning-puzzle',
      quiz: { questions: [{ id: 'teacher-q1', prompt: 'Which phase is liquid water?' }] },
      teacherNote: 'Keep this authored activity unchanged.',
    }
    const snapshot = JSON.stringify(authored)
    vi.spyOn(api.activities, 'getGuestBundle').mockResolvedValue({
      ...original,
      summary: { ...original.summary, id, title: 'Teacher Science' },
      version: {
        ...original.version,
        id: ActivityVersionIdSchema.parse(`${id}-v1`),
        activityId: id,
        payload: { ...original.version.payload, body: authored },
      },
    })
    const submit = vi.spyOn(api.sessions, 'submitResult')
    render(play(id))
    await active()
    expect(probe.boot?.playBundle).toEqual(authored)
    emit()
    await waitFor(() => expect(submit).toHaveBeenCalledOnce())
    await act(async () => {
      await submit.mock.results[0]!.value
    })
    expect(screen.queryByRole('region', { name: 'Demo levels' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Next level' })).toBeNull()
    expect(JSON.stringify(authored)).toBe(snapshot)
  })
  it('never opens a stage or progression for an unknown ID', async () => {
    render(play('act_demo_integer_4'))
    await screen.findByRole('alert')
    expect(screen.queryByTestId('native-unity-stage')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Demo levels' })).toBeNull()
  })
  it('does not attach native progression when an external activity API is configured', async () => {
    probe.configured = true
    render(play())
    await waitFor(() => expect(probe.boot?.activityVersionId).toBeTruthy())
    expect(screen.queryByRole('region', { name: 'Demo levels' })).toBeNull()
  })
  it('offers four games and keeps the topic chooser limited to three math roots', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <GuestPlayIndexPage />
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(
      screen.getByText('Free beta · A little practice. A picture worth revealing.'),
    ).toBeVisible()
    const roots = within(screen.getByRole('region', { name: 'Choose a math topic' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/play/act_demo_'))
    expect(roots).toEqual(
      ['integer', 'inequality', 'linear'].map((series) => `/play/act_demo_${series}_1`),
    )
    expect(
      within(screen.getByRole('region', { name: 'Try every way to play' })).getAllByRole('link'),
    ).toHaveLength(4)
    expect(screen.queryByLabelText(/email|password/i)).toBeNull()
  })
})
