import { describe, expect, it } from 'vitest'

import { classifyLock, isClearable, LOCK_STATE } from './sal0-run-lock.mjs'

const NOW = Date.parse('2026-08-19T12:00:00.000Z')
const STALE_MS = 30 * 60 * 1000
const alive = () => true
const dead = () => false

const lock = (startedAt, pid = 4242) => JSON.stringify({ pid, startedAt, mode: 'dry-run' })

describe('classifyLock', () => {
  it('reports absent when there is no lock', () => {
    expect(classifyLock(null, { now: NOW, mtimeMs: NOW, isAlive: dead }).state).toBe(LOCK_STATE.ABSENT)
  })

  it('clears a lock whose process is gone — the reboot case', () => {
    const verdict = classifyLock(lock('2026-08-19T11:59:00.000Z'), {
      now: NOW,
      mtimeMs: NOW,
      staleMs: STALE_MS,
      isAlive: dead,
    })
    expect(verdict.state).toBe(LOCK_STATE.STALE_DEAD_PID)
    expect(isClearable(verdict.state)).toBe(true)
  })

  it('refuses a lock held by a live process', () => {
    const verdict = classifyLock(lock('2026-08-19T11:59:00.000Z'), {
      now: NOW,
      mtimeMs: NOW,
      staleMs: STALE_MS,
      isAlive: alive,
    })
    expect(verdict.state).toBe(LOCK_STATE.HELD)
    expect(isClearable(verdict.state)).toBe(false)
  })

  it('will not clear a long-overrunning live PID, because PIDs are reused', () => {
    const verdict = classifyLock(lock('2026-08-18T01:00:00.000Z'), {
      now: NOW,
      mtimeMs: NOW,
      staleMs: STALE_MS,
      isAlive: alive,
    })
    expect(verdict.state).toBe(LOCK_STATE.HELD_OVERRUN)
    expect(isClearable(verdict.state)).toBe(false)
    expect(verdict.reason).toContain('4242')
  })

  it('refuses a recent unreadable lock — it may be a live run mid-write', () => {
    const verdict = classifyLock('{ truncated', {
      now: NOW,
      mtimeMs: NOW - 1000,
      staleMs: STALE_MS,
      isAlive: dead,
    })
    expect(isClearable(verdict.state)).toBe(false)
  })

  it('clears an old unreadable lock', () => {
    const verdict = classifyLock('{ truncated', {
      now: NOW,
      mtimeMs: NOW - 10 * 60 * 60 * 1000,
      staleMs: STALE_MS,
      isAlive: dead,
    })
    expect(verdict.state).toBe(LOCK_STATE.STALE_CORRUPT)
    expect(isClearable(verdict.state)).toBe(true)
  })

  it('falls back to file mtime when startedAt is unparseable', () => {
    const verdict = classifyLock(lock('not-a-date'), {
      now: NOW,
      mtimeMs: NOW - 10 * 60 * 60 * 1000,
      staleMs: STALE_MS,
      isAlive: alive,
    })
    expect(verdict.state).toBe(LOCK_STATE.HELD_OVERRUN)
  })
})
