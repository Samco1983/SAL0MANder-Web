import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClientAttemptId } from './useClientAttemptId'

beforeEach(() => sessionStorage.clear())

describe('the attempt identity', () => {
  it('is undefined until a version is pinned', () => {
    // An id predating the pinned version would outlive it on a republish.
    const { result } = renderHook(() => useClientAttemptId(undefined))
    expect(result.current.clientAttemptId).toBeUndefined()
  })

  it('exists as soon as the version does — before any session', () => {
    // This is the whole point of moving it out of the session effect: Unity
    // must be able to correlate from `boot`, which fires long before a
    // Student Choice session is created.
    const { result } = renderHook(() => useClientAttemptId('av_1'))
    expect(result.current.clientAttemptId).toBeTruthy()
  })

  it('survives a reload rather than fragmenting one student into two attempts', () => {
    const first = renderHook(() => useClientAttemptId('av_1'))
    const id = first.result.current.clientAttemptId
    first.unmount()

    const second = renderHook(() => useClientAttemptId('av_1'))
    expect(second.result.current.clientAttemptId).toBe(id)
  })

  it('differs per activity version', () => {
    const a = renderHook(() => useClientAttemptId('av_1'))
    const b = renderHook(() => useClientAttemptId('av_2'))
    expect(a.result.current.clientAttemptId).not.toBe(b.result.current.clientAttemptId)
  })

  it('mints a genuinely new id on renewal', () => {
    /*
     * The case a mutation exposed: bumping the epoch alone is not enough,
     * because the memo reads storage first and would hand back the very same
     * id. Reusing a finished attempt's identity makes the server deduplicate
     * the new session away — "play again" would silently do nothing.
     */
    const { result } = renderHook(() => useClientAttemptId('av_1'))
    const first = result.current.clientAttemptId

    act(() => result.current.renewAttempt())

    expect(result.current.clientAttemptId).toBeTruthy()
    expect(result.current.clientAttemptId).not.toBe(first)
  })

  it('persists the renewed id, so a reload resumes the new attempt', () => {
    const { result, unmount } = renderHook(() => useClientAttemptId('av_1'))
    act(() => result.current.renewAttempt())
    const renewed = result.current.clientAttemptId
    unmount()

    const after = renderHook(() => useClientAttemptId('av_1'))
    expect(after.result.current.clientAttemptId).toBe(renewed)
  })

  it('still yields an id when storage is blocked', () => {
    // Private mode: a guest must be able to play, so a lost id degrades to
    // "this reload is a new attempt" rather than to no attempt at all.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const { result } = renderHook(() => useClientAttemptId('av_1'))
    expect(result.current.clientAttemptId).toBeTruthy()
    vi.restoreAllMocks()
  })
})
