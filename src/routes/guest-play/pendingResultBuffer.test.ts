import { describe, expect, it } from 'vitest'
import { nextPendingResult } from './usePlaySession'

/**
 * W-14 — the one buffer slot, and which result is allowed to hold it.
 *
 * A result that lands before the session exists is buffered rather than
 * dropped. There is exactly one slot, because a session has exactly one
 * result — but "one slot" left an unanswered question: what happens when the
 * occupant belongs to an attempt the student already abandoned?
 *
 * The old `??=` answered "keep whatever got there first", which silently
 * discarded the newer attempt's real result and later surfaced the stale one.
 * The student sees an alert about the wrong attempt and their actual work is
 * gone with no signal anywhere.
 */

const result = (score: number) => ({ score, total: 4 }) as never

describe('an empty slot', () => {
  it('takes the result', () => {
    expect(nextPendingResult(undefined, 'attempt-1', result(3))).toEqual({
      attemptId: 'attempt-1',
      result: result(3),
    })
  })
})

describe('the same attempt arriving twice', () => {
  it('keeps the first, because the second is a duplicate not a second result', () => {
    const held = { attemptId: 'attempt-1', result: result(3) }
    expect(nextPendingResult(held, 'attempt-1', result(99))).toBe(held)
  })
})

describe('a newer attempt arriving over a stale one', () => {
  it('replaces it — the newer result is the real one', () => {
    // W-14 itself. Under `??=` this returned the stale occupant and the
    // student's actual result was dropped.
    const stale = { attemptId: 'abandoned', result: result(1) }
    expect(nextPendingResult(stale, 'attempt-2', result(4))).toEqual({
      attemptId: 'attempt-2',
      result: result(4),
    })
  })

  it('does not keep the stale result anywhere', () => {
    const stale = { attemptId: 'abandoned', result: result(1) }
    const next = nextPendingResult(stale, 'attempt-2', result(4))
    expect(next.attemptId).not.toBe('abandoned')
    expect(next).not.toBe(stale)
  })

  it('holds the result under the attempt that produced it', () => {
    // A held result labelled with the wrong attempt is worse than no record:
    // it is a confident, wrong answer to "which session was this?".
    const next = nextPendingResult(
      { attemptId: 'abandoned', result: result(1) },
      'attempt-2',
      result(4),
    )
    expect(next.attemptId).toBe('attempt-2')
    expect(next.result).toEqual(result(4))
  })
})

describe('the rule does not depend on who calls it', () => {
  it('survives repeated alternation between two attempts', () => {
    // The guarantee is structural, not a property of today's call order —
    // which is exactly what made W-14 latent rather than safe.
    let slot = nextPendingResult(undefined, 'a', result(1))
    slot = nextPendingResult(slot, 'b', result(2))
    slot = nextPendingResult(slot, 'a', result(3))
    expect(slot).toEqual({ attemptId: 'a', result: result(3) })
  })
})
