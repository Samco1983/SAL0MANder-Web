/**
 * Mission Control run lock with stale-lock recovery.
 *
 * The failure this exists to prevent: a run dies without releasing the lock —
 * SIGKILL, power loss, a panic — and every future run refuses to start. That
 * failure is silent and looks exactly like "nothing needed doing", so it must
 * be recovered automatically and reported loudly when it is.
 *
 * What is deliberately NOT automatic: clearing a lock whose PID is still alive.
 * PIDs are reused, so a live PID cannot be proven to be our run, and killing it
 * could kill something unrelated. That case refuses and names the PID.
 */
import { closeSync, existsSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'

/** A run older than this with a dead PID is unambiguously abandoned. */
export const DEFAULT_STALE_MS = 30 * 60 * 1000

export const LOCK_STATE = {
  ABSENT: 'absent',
  HELD: 'held',
  HELD_OVERRUN: 'held-overrun',
  STALE_DEAD_PID: 'stale-dead-pid',
  STALE_CORRUPT: 'stale-corrupt',
}

/** States we are willing to clear without a human. */
const CLEARABLE = new Set([LOCK_STATE.STALE_DEAD_PID, LOCK_STATE.STALE_CORRUPT])

export function isClearable(state) {
  return CLEARABLE.has(state)
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return error.code === 'EPERM'
  }
}

/**
 * Pure classifier — no filesystem access, so the decision table is testable.
 *
 * @param {string|null} rawContents lock file text, or null when absent
 * @param {object} ctx
 * @param {number} ctx.now epoch ms
 * @param {number} ctx.mtimeMs lock file mtime, the fallback clock
 * @param {number} ctx.staleMs age past which an abandoned lock is stale
 * @param {(pid: number) => boolean} ctx.isAlive
 */
export function classifyLock(rawContents, { now, mtimeMs, staleMs = DEFAULT_STALE_MS, isAlive }) {
  if (rawContents === null || rawContents === undefined) {
    return { state: LOCK_STATE.ABSENT, reason: 'no lock file' }
  }

  let lock = null
  try {
    lock = JSON.parse(rawContents)
  } catch {
    lock = null
  }

  if (!lock || typeof lock !== 'object' || !Number.isInteger(lock.pid)) {
    const age = now - mtimeMs
    if (age > staleMs) {
      return {
        state: LOCK_STATE.STALE_CORRUPT,
        reason: `unreadable lock, last written ${formatAge(age)} ago`,
      }
    }
    // Recent and unreadable: could be a live run mid-write. Refuse.
    return { state: LOCK_STATE.HELD, reason: 'unreadable lock written recently' }
  }

  const startedMs = Date.parse(lock.startedAt)
  const age = now - (Number.isNaN(startedMs) ? mtimeMs : startedMs)

  if (!isAlive(lock.pid)) {
    return {
      state: LOCK_STATE.STALE_DEAD_PID,
      reason: `dead PID ${lock.pid}, started ${formatAge(age)} ago`,
      pid: lock.pid,
    }
  }

  if (age > staleMs) {
    // Alive, but far past any plausible run. Could be a genuine hang, could be
    // an unrelated process that inherited the PID. Not ours to kill.
    return {
      state: LOCK_STATE.HELD_OVERRUN,
      reason: `PID ${lock.pid} still alive after ${formatAge(age)} — kill it by hand or clear ${'the lock'} deliberately`,
      pid: lock.pid,
    }
  }

  return { state: LOCK_STATE.HELD, reason: `PID ${lock.pid} running`, pid: lock.pid }
}

function formatAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'an unknown time'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  return `${(minutes / 60).toFixed(1)}h`
}

/**
 * Acquire the lock, recovering from an abandoned one.
 *
 * Returns { release, repairs }. `repairs` is non-empty when a stale lock was
 * cleared — the caller must surface it, never swallow it.
 */
export function acquireRunLock({
  lockFile,
  mode,
  pid = process.pid,
  now = () => Date.now(),
  staleMs = DEFAULT_STALE_MS,
  isAlive = isProcessAlive,
}) {
  const repairs = []

  const open = () => {
    const descriptor = openSync(lockFile, 'wx')
    writeFileSync(
      descriptor,
      `${JSON.stringify({ pid, startedAt: new Date(now()).toISOString(), mode }, null, 2)}\n`,
    )
    closeSync(descriptor)
  }

  try {
    open()
  } catch (error) {
    if (error.code !== 'EEXIST') throw error

    const raw = existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : null
    const mtimeMs = existsSync(lockFile) ? statSync(lockFile).mtimeMs : now()
    const verdict = classifyLock(raw, { now: now(), mtimeMs, staleMs, isAlive })

    if (!isClearable(verdict.state)) {
      throw new Error(`Mission Control is already running: ${verdict.reason} (${lockFile})`)
    }

    unlinkSync(lockFile)
    repairs.push(`cleared stale lock (${verdict.reason})`)

    try {
      open()
    } catch (retryError) {
      if (retryError.code === 'EEXIST') {
        throw new Error(`Lost a race to reclaim the stale lock: ${lockFile}`)
      }
      throw retryError
    }
  }

  let released = false
  const release = () => {
    if (released) return
    released = true
    try {
      unlinkSync(lockFile)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  return { release, repairs }
}
