import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@api/errors'
import { useGuestActivity } from './useGuestActivity'

const getGuestBundle = vi.fn()

vi.mock('@api/index', async () => {
  const errors = await import('@api/errors')
  return { api: { activities: { getGuestBundle: (...a: unknown[]) => getGuestBundle(...a) } }, ...errors }
})

const bundle = {
  summary: {
    id: 'demo',
    title: 'Fractions warm-up',
    description: '',
    mode: 'learning-puzzle',
    thumbnail: null,
  },
  version: {
    id: 'v1',
    activityId: 'demo',
    versionNumber: 1,
    payload: { schemaVersion: 1, body: {} },
    media: [],
    createdAt: new Date().toISOString(),
  },
}

beforeEach(() => {
  getGuestBundle.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useGuestActivity', () => {
  it('stays idle with no activity id', () => {
    const { result } = renderHook(() => useGuestActivity(undefined))
    expect(result.current.status).toBe('idle')
    expect(getGuestBundle).not.toHaveBeenCalled()
  })

  it('resolves to the bundle', async () => {
    getGuestBundle.mockResolvedValue(bundle)
    const { result } = renderHook(() => useGuestActivity('demo'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('surfaces a failure as an ApiError', async () => {
    getGuestBundle.mockRejectedValue(new ApiError({ code: 'timeout', message: 'slow' }))
    const { result } = renderHook(() => useGuestActivity('demo'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.status === 'error' && result.current.error.code).toBe('timeout')
  })

  it('wraps a non-ApiError throw rather than leaking it', async () => {
    getGuestBundle.mockRejectedValue(new TypeError('undefined is not a function'))
    const { result } = renderHook(() => useGuestActivity('demo'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.status === 'error' && result.current.error).toBeInstanceOf(ApiError)
  })

  it('recovers when the student retries after the network comes back', async () => {
    getGuestBundle.mockRejectedValueOnce(new ApiError({ code: 'network_error', message: 'offline' }))
    const { result } = renderHook(() => useGuestActivity('demo'))
    await waitFor(() => expect(result.current.status).toBe('error'))

    getGuestBundle.mockResolvedValueOnce(bundle)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getGuestBundle).toHaveBeenCalledTimes(2)
  })

  it('refetches when the activity id changes', async () => {
    getGuestBundle.mockResolvedValue(bundle)
    const { result, rerender } = renderHook(({ id }) => useGuestActivity(id), {
      initialProps: { id: 'demo' },
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ id: 'another' })
    await waitFor(() => expect(getGuestBundle).toHaveBeenCalledTimes(2))
    expect(getGuestBundle.mock.calls[1]?.[0]).toBe('another')
  })

  it('does not set state after unmount', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let reject: (e: unknown) => void = () => {}
    getGuestBundle.mockReturnValue(new Promise((_r, rj) => (reject = rj)))

    const { unmount } = renderHook(() => useGuestActivity('demo'))
    unmount()
    await act(async () => reject(new ApiError({ code: 'timeout', message: 'late' })))

    expect(spy).not.toHaveBeenCalled()
  })
})
