import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
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
})
