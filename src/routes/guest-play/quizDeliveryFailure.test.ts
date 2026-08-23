import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@api/errors'
import type { PlayerIdentity, SessionResult } from '@contracts/v1'
import { usePlaySession } from './usePlaySession'
import { isQuizFinished } from './quizDelivery'

/**
 * The gap I flagged three times and never closed: does the quiz claim
 * "Finished. Your teacher will see this" when delivery FAILED?
 *
 * The original bug shipped because a commit message of mine claimed
 * "submitted flips only after the awaited write". That was false. `deliver`
 * catches a submitResult rejection, stores `result-undeliverable`, and
 * RESOLVES — so awaiting it says the call finished, never that a teacher will
 * see anything. Codex rebounded it and was right.
 *
 * The fix derives finished-ness from SESSION STATE instead, and explicitly
 * treats `result-undeliverable` as NOT finished so its existing retry surface
 * survives. Until now that fix was reasoning, not evidence. This file is the
 * evidence.
 *
 * It tests the seam directly rather than through the rendered page, because the
 * claim under test is about usePlaySession's resolution behaviour, and routing
 * it through React would prove the page agreed with itself.
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
  id: 'ses_quiz',
  activityId: 'act_1',
  activityVersionId: 'av_1',
  identity,
  status: 'in-progress' as const,
  startedAt: new Date().toISOString(),
  completedAt: null,
}

/** A quiz-only completion: no pieces were placed, and none are claimed. */
const quizOutcome: Omit<SessionResult, 'sessionId'> = {
  status: 'completed',
  durationMs: 61_000,
  questionsAnswered: 9,
  questionsCorrect: 9,
  piecesPlaced: 0,
  piecesTotal: 0,
  completedAt: new Date().toISOString(),
}

const setup = () =>
  renderHook(() =>
    usePlaySession({
      activityId: 'act_1',
      activityVersionId: 'av_1',
      identity,
      selectedPlayMode: 'learning-puzzle',
      clientAttemptId: 'attempt-quiz',
      enabled: true,
    }),
  )

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  start.mockReset().mockResolvedValue(session)
  submitResult.mockReset().mockResolvedValue(undefined)
})

describe('the quiz must not claim delivery it cannot see', () => {
  it('submit() RESOLVES even when the write was rejected — the trap, proven', async () => {
    /*
     * This is the assertion the original fake completion rested on. If this
     * ever starts throwing, the fix downstream can be simplified — but until
     * then, awaiting submit() is not evidence of anything reaching a backend,
     * and any code that treats it as such is lying to a student.
     */
    const handle = setup()
    await waitFor(() => expect(handle.result.current.status).toBe('active'))
    submitResult.mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))

    let threw = false
    await act(async () => {
      await handle.result.current.submit(quizOutcome).catch(() => {
        threw = true
      })
    })

    expect(threw, 'submit() rejected — the original reasoning would now be safe').toBe(false)
  })

  it('lands in result-undeliverable, which is what the quiz reads instead', async () => {
    const handle = setup()
    await waitFor(() => expect(handle.result.current.status).toBe('active'))
    submitResult.mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))
    await act(async () => handle.result.current.submit(quizOutcome))

    // GuestPlayPage derives quizFinished as: delivered AND status is neither
    // 'result-undeliverable' nor 'error'. This is the state that must keep the
    // panel out of its "Finished" branch.
    await waitFor(() => expect(handle.result.current.status).toBe('result-undeliverable'))
  })

  it('keeps the result and its attempt, so the retry surface is real', async () => {
    /*
     * Codex's rebound said explicitly: do not throw away the held-result
     * behaviour. A quiz that refuses to claim delivery is only half right — the
     * student also needs the work to survive, or refusing to lie just loses
     * their lesson politely.
     */
    const handle = setup()
    await waitFor(() => expect(handle.result.current.status).toBe('active'))
    submitResult.mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))
    await act(async () => handle.result.current.submit(quizOutcome))
    await waitFor(() => expect(handle.result.current.status).toBe('result-undeliverable'))

    const state = handle.result.current
    if (state.status !== 'result-undeliverable') throw new Error('wrong state')
    expect(state.result.questionsCorrect).toBe(9)
    expect(state.result.questionsAnswered).toBe(9)
    // Quiz-only attempt: claiming placed pieces would put fabricated progress
    // in a teacher's record.
    expect(state.result.piecesPlaced).toBe(0)
  })

  it('reaches finished only when the write actually succeeds', async () => {
    // The other half. Refusing to claim delivery is worthless if it also
    // refuses when delivery worked.
    const handle = setup()
    await waitFor(() => expect(handle.result.current.status).toBe('active'))
    await act(async () => handle.result.current.submit(quizOutcome))
    await waitFor(() => expect(handle.result.current.status).toBe('finished'))
  })
})

describe('isQuizFinished — the derivation the page actually uses', () => {
  /*
   * The tests above prove usePlaySession RESOLVES on a failed write. These
   * prove the page reads that correctly, which is a different claim and was
   * unguarded until now — the fix lived inline in a 550-line component, so a
   * revert to `quizFinished = quizDelivered` would have gone unnoticed.
   */
  it('is NOT finished when the result could not be delivered', () => {
    expect(isQuizFinished(true, 'result-undeliverable')).toBe(false)
  })

  it('is NOT finished on error', () => {
    expect(isQuizFinished(true, 'error')).toBe(false)
  })

  it('is NOT finished before anything was submitted', () => {
    expect(isQuizFinished(false, 'finished')).toBe(false)
  })

  it('IS finished when the write landed', () => {
    // The other half: refusing to claim delivery is worthless if it also
    // refuses when delivery worked.
    expect(isQuizFinished(true, 'finished')).toBe(true)
  })
})
