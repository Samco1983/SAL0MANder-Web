import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionIdSchema } from '@contracts/v1'
import { clearHeldResult, loadHeldResult, saveHeldResult } from './resultHold'

const RESULT = {
  status: 'completed' as const,
  durationMs: 1000,
  questionsAnswered: 4,
  questionsCorrect: 4,
  piecesPlaced: 4,
  piecesTotal: 4,
  completedAt: '2026-08-19T00:00:00.000Z',
}

const SESSION_ID = SessionIdSchema.parse('ses_12345678')

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('held result persistence', () => {
  it('round-trips a result with no session — the start-failure route', () => {
    saveHeldResult('av_1', { attemptId: 'att_1', result: RESULT })
    expect(loadHeldResult('av_1')).toEqual({ version: 1, attemptId: 'att_1', result: RESULT })
  })

  it('round-trips a result with a session — the submit-failure route', () => {
    saveHeldResult('av_1', { attemptId: 'att_1', result: RESULT, session: { id: SESSION_ID } })
    expect(loadHeldResult('av_1')?.session).toEqual({ id: SESSION_ID })
  })

  it('keeps separate records per activity version', () => {
    saveHeldResult('av_1', { attemptId: 'att_1', result: RESULT })
    expect(loadHeldResult('av_2')).toBeUndefined()
  })

  it('uses sessionStorage, so a new tab does not inherit it', () => {
    saveHeldResult('av_1', { attemptId: 'att_1', result: RESULT })
    expect(sessionStorage.getItem('sal0mander.session.heldResult.av_1')).not.toBeNull()
    expect(localStorage.getItem('sal0mander.session.heldResult.av_1')).toBeNull()
  })

  it('clears on delivery', () => {
    saveHeldResult('av_1', { attemptId: 'att_1', result: RESULT })
    clearHeldResult('av_1')
    expect(loadHeldResult('av_1')).toBeUndefined()
  })

  it('returns undefined for a key that was never written', () => {
    expect(loadHeldResult('never-written')).toBeUndefined()
  })
})

describe('fails closed on data this build should not trust', () => {
  it('malformed JSON', () => {
    sessionStorage.setItem('sal0mander.session.heldResult.av_1', '{not json')
    expect(loadHeldResult('av_1')).toBeUndefined()
  })

  it('a shape missing required fields', () => {
    sessionStorage.setItem(
      'sal0mander.session.heldResult.av_1',
      JSON.stringify({ version: 1, attemptId: 'att_1' }),
    )
    expect(loadHeldResult('av_1')).toBeUndefined()
  })

  it('a session id that is not a valid SAL0MANder id', () => {
    sessionStorage.setItem(
      'sal0mander.session.heldResult.av_1',
      JSON.stringify({
        version: 1,
        attemptId: 'att_1',
        result: RESULT,
        session: { id: '../not-an-id' },
      }),
    )
    expect(loadHeldResult('av_1')).toBeUndefined()
  })

  it('a future or otherwise unrecognized schema version', () => {
    sessionStorage.setItem(
      'sal0mander.session.heldResult.av_1',
      JSON.stringify({ version: 2, attemptId: 'att_1', result: RESULT }),
    )
    expect(loadHeldResult('av_1')).toBeUndefined()
  })
})

describe('when storage is blocked', () => {
  function blockStorage() {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
  }

  it('does not throw on save, and load reports nothing held', () => {
    blockStorage()
    expect(() => saveHeldResult('av_1', { attemptId: 'att_1', result: RESULT })).not.toThrow()
    expect(loadHeldResult('av_1')).toBeUndefined()
  })

  it('does not throw on clear', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => clearHeldResult('av_1')).not.toThrow()
  })
})
