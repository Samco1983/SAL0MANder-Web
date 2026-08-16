import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@api/errors'
import type { PlayerIdentity, SessionResult } from '@contracts/v1'
import { usePlaySession } from './usePlaySession'

const start = vi.fn()
const submitResult = vi.fn()

vi.mock('@api/index', async () => {
  const errors = await import('@api/errors')
  return {
    api: {
      sessions: {
        start: (...a: unknown[]) => start(...a),
        submitResult: (...a: unknown[]) => submitResult(...a),
      },
    },
    ...errors,
  }
})

const identity: PlayerIdentity = { kind: 'guest', guestToken: 'guest-token-1' }

const session = {
  id: 'ses_1',
  activityId: 'act_1',
  activityVersionId: 'av_1',
  identity,
  status: 'in-progress' as const,
  startedAt: new Date().toISOString(),
  completedAt: null,
}

const outcome: Omit<SessionResult, 'sessionId'> = {
  status: 'completed',
  durationMs: 90_000,
  questionsAnswered: 9,
  questionsCorrect: 8,
  piecesPlaced: 9,
  piecesTotal: 9,
  completedAt: new Date().toISOString(),
}

const setup = (overrides: Partial<Parameters<typeof usePlaySession>[0]> = {}) =>
  renderHook(() =>
    usePlaySession({
      activityId: 'act_1',
      activityVersionId: 'av_1',
      identity,
      selectedPlayMode: 'classic-puzzle',
      enabled: true,
      ...overrides,
    }),
  )

beforeEach(() => {
  sessionStorage.clear()
  start.mockReset().mockResolvedValue(session)
  submitResult.mockReset().mockResolvedValue({ ...session, status: 'completed' })
})

afterEach(() => vi.restoreAllMocks())

describe('starting', () => {
  it('waits until there is something to play', () => {
    setup({ enabled: false })
    expect(start).not.toHaveBeenCalled()
  })

  it('waits for a pinned version, never attributing play to an unknown one', () => {
    setup({ activityVersionId: undefined })
    expect(start).not.toHaveBeenCalled()
  })

  it('starts once the activity resolves', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('sends the pinned version, mode, identity and attempt id', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))
    const [body, key] = start.mock.calls[0] as [Record<string, unknown>, string]

    expect(body).toEqual({
      activityId: 'act_1',
      activityVersionId: 'av_1',
      identity,
      selectedPlayMode: 'classic-puzzle',
      clientAttemptId: key,
    })
    // One concept, one value: minting clientAttemptId separately from the
    // idempotency key would guarantee they eventually disagree.
    expect(body.clientAttemptId).toBe(key)
  })

  it('opens no session until the mode is known', async () => {
    // Student Choice: Unity owns the picker. Pinning a guess is unfixable —
    // the value is immutable once set, so a teacher's mode breakdown would be
    // quietly wrong with nothing to reveal it.
    const { rerender } = renderHook(
      ({ mode }: { mode: string | undefined }) =>
        usePlaySession({
          activityId: 'act_1',
          activityVersionId: 'av_1',
          identity,
          selectedPlayMode: mode,
          enabled: true,
        }),
      { initialProps: { mode: undefined as string | undefined } },
    )
    expect(start).not.toHaveBeenCalled()

    rerender({ mode: 'learning-puzzle' })
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    expect(start.mock.calls[0]?.[0]).toMatchObject({ selectedPlayMode: 'learning-puzzle' })
  })

  it('reuses the stored key so a reload resumes rather than duplicating', async () => {
    const first = setup()
    await waitFor(() => expect(first.result.current.status).toBe('active'))
    const keyBefore = start.mock.calls[0]?.[1]

    // A reload: same tab, hook mounts again.
    first.unmount()
    const second = setup()
    await waitFor(() => expect(second.result.current.status).toBe('active'))

    expect(start.mock.calls[1]?.[1]).toBe(keyBefore)
  })

  it('does not restart when the identity object changes shape each render', async () => {
    // getGuestIdentity() returns a fresh object every render; that must not
    // count as a reason to open a second session.
    const { result, rerender } = renderHook(
      ({ token }) =>
        usePlaySession({
          activityId: 'act_1',
          activityVersionId: 'av_1',
          identity: { kind: 'guest', guestToken: token },
          selectedPlayMode: 'classic-puzzle',
          enabled: true,
        }),
      { initialProps: { token: 'guest-token-1' } },
    )
    await waitFor(() => expect(result.current.status).toBe('active'))

    rerender({ token: 'guest-token-1' })
    rerender({ token: 'guest-token-1' })

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('surfaces a start failure without throwing', async () => {
    start.mockRejectedValue(new ApiError({ code: 'server_error', message: 'down' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})

describe('submitting a result', () => {
  it('derives the key from the session id', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => result.current.submit(outcome))

    expect(submitResult).toHaveBeenCalledWith('ses_1', expect.anything(), 'ses_1:result')
  })

  it('stamps the session id onto the result', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => result.current.submit(outcome))

    expect(submitResult.mock.calls[0]?.[1]).toMatchObject({ sessionId: 'ses_1', ...outcome })
  })

  it('ignores a result when no session is active', async () => {
    // Otherwise it would invent a session id or double-submit.
    const { result } = setup({ enabled: false })
    await act(async () => result.current.submit(outcome))
    expect(submitResult).not.toHaveBeenCalled()
  })

  it('ignores a second submit for the same session', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => result.current.submit(outcome))
    await act(async () => result.current.submit(outcome))

    expect(submitResult).toHaveBeenCalledTimes(1)
  })

  it('clears the start key once the attempt is over', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(sessionStorage.getItem('sal0mander.session.startKey.av_1')).not.toBeNull()

    await act(async () => result.current.submit(outcome))

    expect(sessionStorage.getItem('sal0mander.session.startKey.av_1')).toBeNull()
  })

  it('surfaces a submit failure without losing the session', async () => {
    submitResult.mockRejectedValue(new ApiError({ code: 'timeout', message: 'slow' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => result.current.submit(outcome))

    expect(result.current.status).toBe('error')
  })
})

describe('play again', () => {
  it('opens a genuinely new session with a new key', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))
    const firstKey = start.mock.calls[0]?.[1]

    act(() => result.current.reset())
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))

    expect(start.mock.calls[1]?.[1]).not.toBe(firstKey)
  })
})
