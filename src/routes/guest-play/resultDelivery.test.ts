import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@api/errors'
import type { PlayerIdentity, SessionResult } from '@contracts/v1'
import { usePlaySession } from './usePlaySession'

/**
 * W-13. The result submission itself failing is the *common* loss path.
 *
 * `resultBuffering.test.ts` covers the startup race — a completion arriving
 * before `POST /sessions` resolves. This file covers the other end: the session
 * started fine, the student played, and `POST /sessions/{id}/result` is the call
 * that fails. That happens after all the work, so it is the failure that costs
 * the most, and it was collapsing into a generic `error` state carrying neither
 * the result nor the attempt it belonged to.
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

/** Get to an open session with a completed result already rejected once. */
async function undeliverable() {
  const handle = setup()
  await waitFor(() => expect(handle.result.current.status).toBe('active'))
  submitResult.mockRejectedValueOnce(new ApiError({ code: 'timeout', message: 'slow wifi' }))
  await act(async () => handle.result.current.submit(outcome))
  await waitFor(() => expect(handle.result.current.status).toBe('result-undeliverable'))
  return handle
}

beforeEach(() => {
  sessionStorage.clear()
  start.mockReset().mockResolvedValue(session)
  submitResult.mockReset().mockResolvedValue({ ...session, status: 'completed' })
})

afterEach(() => vi.restoreAllMocks())

describe('a result whose submission fails', () => {
  it('keeps the result, the attempt and the reason instead of a bare error', async () => {
    // The whole point of `result-undeliverable`: an ApiError alone cannot be
    // reported, retried, or reconciled — the numbers are gone with it.
    const { result } = await undeliverable()

    expect(result.current).toMatchObject({
      status: 'result-undeliverable',
      attemptId: 'attempt-1',
      result: outcome,
    })
    expect((result.current as { error: ApiError }).error.code).toBe('timeout')
  })

  it('offers a retry, because the derived key makes resubmitting safe', async () => {
    const { result } = await undeliverable()

    await act(async () => result.current.retryDelivery())

    await waitFor(() => expect(result.current.status).toBe('finished'))
    expect(submitResult).toHaveBeenCalledTimes(2)
    // Same session, same body, same key — a repeat write the server dedupes.
    expect(submitResult.mock.calls[1]?.[0]).toBe('ses_1')
    expect(submitResult.mock.calls[1]?.[1]).toMatchObject({ sessionId: 'ses_1', ...outcome })
    expect(submitResult.mock.calls[1]?.[2]).toBe('ses_1:result')
  })

  it('stays undeliverable, with the result intact, when the retry also fails', async () => {
    const { result } = await undeliverable()
    submitResult.mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))

    await act(async () => result.current.retryDelivery())

    await waitFor(() => expect(result.current.status).toBe('result-undeliverable'))
    expect(result.current).toMatchObject({ attemptId: 'attempt-1', result: outcome })
    expect((result.current as { error: ApiError }).error.code).toBe('network_error')
  })

  it('does nothing on retry from a state that has nothing to deliver', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => result.current.retryDelivery())

    expect(submitResult).not.toHaveBeenCalled()
    expect(result.current.status).toBe('active')
  })

  it('does not end the attempt identity while the result is still undelivered', async () => {
    // `clearStartKey` marks the attempt over. Doing that on a failed submit
    // would let a reload mint a fresh attempt and orphan the held result.
    sessionStorage.setItem('sal0mander.session.startKey.av_1', 'attempt-1')
    const { result } = await undeliverable()

    expect(sessionStorage.getItem('sal0mander.session.startKey.av_1')).toBe('attempt-1')
    expect(result.current.status).toBe('result-undeliverable')
  })

  it('re-opens the session under the same attempt when the start was what failed', async () => {
    // The other route through retryDelivery. The attempt id IS the idempotency
    // key, so a start that in fact succeeded server-side returns that session
    // rather than opening a second one.
    start.mockRejectedValueOnce(new ApiError({ code: 'timeout', message: 'slow wifi' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('error'))

    await act(async () => result.current.submit(outcome))
    // Nothing was held — the completion arrived after the start already failed,
    // so it is the error state that must not swallow it.
    await act(async () => result.current.retryDelivery())

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('retries the start and flushes the held result through the normal path', async () => {
    let reject: (error: Error) => void = () => {}
    start.mockReturnValueOnce(
      new Promise((_resolve, rejectStart) => {
        reject = rejectStart
      }),
    )
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe('starting'))

    await act(async () => result.current.submit(outcome))
    await act(async () => reject(new ApiError({ code: 'timeout', message: 'slow wifi' })))
    await waitFor(() => expect(result.current.status).toBe('result-undeliverable'))
    expect(result.current.canRetry).toBe(true)

    await act(async () => result.current.retryDelivery())

    await waitFor(() => expect(result.current.status).toBe('finished'))
    // Same attempt id both times: one session, not two.
    expect(start).toHaveBeenCalledTimes(2)
    expect(start.mock.calls[1]?.[1]).toBe('attempt-1')
    expect(submitResult).toHaveBeenCalledTimes(1)
    expect(submitResult.mock.calls[0]?.[1]).toMatchObject({ sessionId: 'ses_1', ...outcome })
  })

  it('holds without offering a retry once the app has moved past that attempt', async () => {
    /*
     * Re-running the start under a renewed attempt id would open a session the
     * held result does not belong to — the F-2 shape, one layer up.
     *
     * Driven through `enabled: false`, because that is the combination that
     * actually reaches the guard: the attempt id is renewed while there is
     * nothing to play, so the start effect returns early and the held result
     * survives with an attempt id the app no longer uses.
     */
    let reject: (error: Error) => void = () => {}
    start.mockReturnValueOnce(
      new Promise((_resolve, rejectStart) => {
        reject = rejectStart
      }),
    )
    const { result, rerender } = renderHook(
      ({ attemptId, enabled }) =>
        usePlaySession({
          activityId: 'act_1',
          activityVersionId: 'av_1',
          identity,
          selectedPlayMode: 'classic-puzzle',
          clientAttemptId: attemptId,
          enabled,
        }),
      { initialProps: { attemptId: 'attempt-1', enabled: true } },
    )
    await waitFor(() => expect(result.current.status).toBe('starting'))
    await act(async () => result.current.submit(outcome))
    await act(async () => reject(new ApiError({ code: 'timeout', message: 'slow wifi' })))
    await waitFor(() => expect(result.current.status).toBe('result-undeliverable'))
    expect(result.current.canRetry).toBe(true)

    start.mockResolvedValue(session)
    rerender({ attemptId: 'attempt-2', enabled: false })

    // The result is still held and still named — it just has no route home.
    expect(result.current).toMatchObject({
      status: 'result-undeliverable',
      attemptId: 'attempt-1',
      result: outcome,
    })
    expect(result.current.canRetry).toBe(false)

    await act(async () => result.current.retryDelivery())
    expect(start).toHaveBeenCalledTimes(1)
    expect(submitResult).not.toHaveBeenCalled()
  })

  it('still reports a start failure as an error when no result is held', async () => {
    // The generic error state is not being removed — it is being narrowed to
    // the case where nothing was lost.
    start.mockRejectedValueOnce(new ApiError({ code: 'not_found', message: 'gone' }))
    const { result } = setup()

    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
