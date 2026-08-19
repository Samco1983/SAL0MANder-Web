import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@api/errors'
import type { PlayerIdentity, SessionResult } from '@contracts/v1'
import { usePlaySession } from './usePlaySession'

/**
 * A result finishing while session creation is still in flight must be
 * buffered, not dropped (Codex ruling, 2026-08-15).
 *
 * The race favours short activities: a four-piece puzzle on a fast device can
 * finish before POST /sessions returns over classroom wifi. Dropping it throws
 * away a child's completed work with no error anywhere.
 */

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

const identity: PlayerIdentity = { kind: 'guest', guestToken: 'g1' }

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
  durationMs: 4200,
  questionsAnswered: 4,
  questionsCorrect: 4,
  piecesPlaced: 4,
  piecesTotal: 4,
  completedAt: new Date().toISOString(),
}

/** Session creation left deliberately in flight until released. */
function pendingStart() {
  let release: () => void = () => {}
  start.mockReturnValue(
    new Promise((resolve) => {
      release = () => resolve(session)
    }),
  )
  return { release: () => act(async () => void release()) }
}

const setup = () =>
  renderHook(() =>
    usePlaySession({
      activityId: 'act_1',
      activityVersionId: 'av_1',
      identity,
      selectedPlayMode: 'classic-puzzle',
      clientAttemptId: 'attempt-1',
      enabled: true,
    }),
  )

const setupWithAttempt = (clientAttemptId: string) =>
  renderHook(
    ({ attemptId }) =>
      usePlaySession({
        activityId: 'act_1',
        activityVersionId: 'av_1',
        identity,
        selectedPlayMode: 'classic-puzzle',
        clientAttemptId: attemptId,
        enabled: true,
      }),
    { initialProps: { attemptId: clientAttemptId } },
  )

beforeEach(() => {
  sessionStorage.clear()
  start.mockReset().mockResolvedValue(session)
  submitResult.mockReset().mockResolvedValue({ ...session, status: 'completed' })
})

afterEach(() => vi.restoreAllMocks())

describe('a result that beats its own session', () => {
  it('is submitted once the session exists, not dropped', async () => {
    const { release } = pendingStart()
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))

    // Unity finishes mid-start.
    await act(async () => result.current.submit(outcome))
    expect(submitResult).not.toHaveBeenCalled()

    await release()

    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(1))
    expect(submitResult.mock.calls[0]?.[1]).toMatchObject({ sessionId: 'ses_1', ...outcome })
  })

  it('flushes through the same derived key a live result would use', async () => {
    // Not a parallel path that could drift from the normal one.
    const { release } = pendingStart()
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))
    await release()

    await waitFor(() => expect(submitResult).toHaveBeenCalled())
    expect(submitResult.mock.calls[0]?.[2]).toBe('ses_1:result')
  })

  it('keeps only the first of several early results', async () => {
    // A session has exactly one result, so a second arrival is a duplicate.
    const { release } = pendingStart()
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))

    await act(async () => result.current.submit(outcome))
    await act(async () => result.current.submit({ ...outcome, questionsCorrect: 0 }))
    await release()

    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(1))
    expect(submitResult.mock.calls[0]?.[1]).toMatchObject({ questionsCorrect: 4 })
  })

  it('reaches the finished state, so the UI is not stranded', async () => {
    const { release } = pendingStart()
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))
    await release()

    await waitFor(() => expect(result.current.status).toBe('finished'))
  })

  it('does not resubmit a buffered result twice', async () => {
    const { release } = pendingStart()
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))
    await release()
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(1))

    rerender()
    rerender()

    expect(submitResult).toHaveBeenCalledTimes(1)
  })

  it('surfaces the completed result when session start rejects', async () => {
    let reject: (error: Error) => void = () => {}
    start.mockReturnValue(
      new Promise((_resolve, rejectStart) => {
        reject = rejectStart
      }),
    )
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))

    await act(async () => result.current.submit(outcome))
    await act(async () => reject(new ApiError({ code: 'timeout', message: 'slow wifi' })))

    await waitFor(() => expect(result.current.undelivered).toHaveLength(1))
    expect(result.current.undelivered[0]).toMatchObject({
      attemptId: 'attempt-1',
      result: outcome,
    })
    expect(submitResult).not.toHaveBeenCalled()
  })

  it('does not flush an old buffered result into a new attempt', async () => {
    const oldSession = { ...session, id: 'ses_old' }
    const newSession = { ...session, id: 'ses_new' }
    let releaseOld: () => void = () => {}
    start
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseOld = () => resolve(oldSession)
        }),
      )
      .mockResolvedValueOnce(newSession)

    const { result, rerender } = setupWithAttempt('attempt-1')
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))

    rerender({ attemptId: 'attempt-2' })
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    await releaseOld()

    await waitFor(() => expect(result.current.undelivered).toHaveLength(1))
    expect(result.current.undelivered[0]).toMatchObject({
      attemptId: 'attempt-1',
      result: outcome,
    })
    expect(submitResult).not.toHaveBeenCalled()
  })

  it('keeps the new attempt playable while the orphan is recorded', async () => {
    // Recording attempt 1's loss must not cost the student attempt 2. Holding
    // the orphan *as a status* dropped the live session, and attempt 2's own
    // completion was then discarded as "not active" — the same data loss, one
    // attempt further along.
    const newSession = { ...session, id: 'ses_new' }
    let releaseOld: () => void = () => {}
    start
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseOld = () => resolve({ ...session, id: 'ses_old' })
        }),
      )
      .mockResolvedValueOnce(newSession)

    const { result, rerender } = setupWithAttempt('attempt-1')
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))

    rerender({ attemptId: 'attempt-2' })
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    await releaseOld()
    await waitFor(() => expect(result.current.undelivered).toHaveLength(1))

    expect(result.current).toMatchObject({ status: 'active', session: newSession })

    // Attempt 2 finishes for real, and it is recorded.
    const second = { ...outcome, questionsCorrect: 2 }
    await act(async () => result.current.submit(second))
    await waitFor(() => expect(submitResult).toHaveBeenCalledTimes(1))
    expect(submitResult.mock.calls[0]?.[1]).toMatchObject({ sessionId: 'ses_new', ...second })
  })
})

describe('a result that arrives after its session already failed', () => {
  /**
   * The ordering the buffer never covered, and the likelier one in a
   * classroom: the start fails fast against a dead connection, the student
   * plays on — a failure must never stop a student playing — and finishes into
   * a state that had already given up.
   */
  it('is recorded, not dropped, when the session start failed first', async () => {
    start.mockRejectedValue(new ApiError({ code: 'network_error', message: 'offline' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('error'))

    await act(async () => result.current.submit(outcome))

    expect(result.current.undelivered).toHaveLength(1)
    expect(result.current.undelivered[0]).toMatchObject({
      attemptId: 'attempt-1',
      result: outcome,
    })
    expect(result.current.undelivered[0]?.reason.code).toBe('network_error')
  })

  it('is recorded, not dropped, when the result submission itself fails', async () => {
    submitResult.mockRejectedValue(new ApiError({ code: 'timeout', message: 'slow wifi' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => result.current.submit(outcome))

    await waitFor(() => expect(result.current.undelivered).toHaveLength(1))
    expect(result.current.undelivered[0]).toMatchObject({
      attemptId: 'attempt-1',
      result: outcome,
    })
    expect(result.current.undelivered[0]?.reason.code).toBe('timeout')
  })

  it('records one entry per attempt, however many times it is reported', async () => {
    start.mockRejectedValue(new ApiError({ code: 'network_error', message: 'offline' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('error'))

    await act(async () => result.current.submit(outcome))
    await act(async () => result.current.submit({ ...outcome, questionsCorrect: 0 }))

    expect(result.current.undelivered).toHaveLength(1)
    expect(result.current.undelivered[0]?.result).toMatchObject({ questionsCorrect: 4 })
  })
})

describe('re-sending a result that never landed', () => {
  it('delivers it under the same attempt identity, so it cannot double-count', async () => {
    submitResult.mockRejectedValueOnce(new ApiError({ code: 'timeout', message: 'slow wifi' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))
    await act(async () => result.current.submit(outcome))
    await waitFor(() => expect(result.current.canRetryDelivery).toBe(true))

    await act(async () => result.current.retryDelivery())

    await waitFor(() => expect(result.current.status).toBe('finished'))
    expect(result.current.undelivered).toHaveLength(0)
    // Same idempotency key on the start, same derived key on the result: the
    // retry resolves to one session and one recorded result.
    expect(start.mock.calls[1]?.[1]).toBe('attempt-1')
    expect(submitResult.mock.calls.every((call) => call[2] === 'ses_1:result')).toBe(true)
  })

  it('is not offered for a result belonging to some other attempt', async () => {
    // Re-sending it would write attempt 1's numbers against attempt 2's
    // session — the corruption W-12 was opened for.
    start.mockRejectedValue(new ApiError({ code: 'network_error', message: 'offline' }))
    const { result, rerender } = setupWithAttempt('attempt-1')
    await waitFor(() => expect(result.current.status).toBe('error'))
    await act(async () => result.current.submit(outcome))

    rerender({ attemptId: 'attempt-2' })

    await waitFor(() => expect(result.current.canRetryDelivery).toBe(false))
    expect(result.current.undelivered).toHaveLength(1)
  })
})

describe('starting a fresh attempt', () => {
  it('records a still-buffered result rather than clearing it away', async () => {
    // "Play again" must not be a quiet delete of the game just finished.
    pendingStart()
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))

    await act(async () => result.current.reset())

    expect(result.current.undelivered).toHaveLength(1)
    expect(result.current.undelivered[0]).toMatchObject({
      attemptId: 'attempt-1',
      result: outcome,
    })
  })
})
