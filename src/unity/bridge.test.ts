import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BRIDGE_VERSION,
  UNITY_EVENT_NAME,
  correlateSession,
  onUnityMessage,
  summarizeBridgeMismatch,
  type BridgeMismatch,
  type UnityToWebMessage,
} from './bridge'

const unsubscribers: Array<() => void> = []

/** Subscribes and guarantees teardown, so a leaked listener can't cross tests. */
function subscribe(
  handler: (message: UnityToWebMessage) => void,
  onMismatch?: (mismatch: BridgeMismatch) => void,
) {
  const off = onUnityMessage(handler, onMismatch ? { onMismatch } : {})
  unsubscribers.push(off)
  return off
}

function emit(detail: unknown) {
  window.dispatchEvent(new CustomEvent(UNITY_EVENT_NAME, { detail }))
}

const ready = { type: 'ready', version: BRIDGE_VERSION } as const

afterEach(() => {
  while (unsubscribers.length) unsubscribers.pop()?.()
  vi.restoreAllMocks()
})

describe('onUnityMessage delivery', () => {
  it('delivers a well-formed message', () => {
    const handler = vi.fn()
    subscribe(handler)
    emit(ready)
    expect(handler).toHaveBeenCalledWith(ready)
  })

  it('stops delivering after unsubscribe', () => {
    const handler = vi.fn()
    subscribe(handler)()
    emit(ready)
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps the game alive when the handler throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const second = vi.fn()
    subscribe(() => {
      throw new Error('web bug')
    })
    subscribe(second)
    expect(() => emit(ready)).not.toThrow()
    // A bug in one subscriber must not starve another.
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('mismatch reporting', () => {
  it('reports a version skew instead of dropping it silently', () => {
    const handler = vi.fn()
    const onMismatch = vi.fn()
    subscribe(handler, onMismatch)

    emit({ type: 'ready', version: BRIDGE_VERSION + 1 })

    expect(handler).not.toHaveBeenCalled()
    expect(onMismatch).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'version',
        type: 'ready',
        received: BRIDGE_VERSION + 1,
        expected: BRIDGE_VERSION,
      }),
    )
  })

  it('reports malformed traffic on the shared event name', () => {
    const onMismatch = vi.fn()
    subscribe(vi.fn(), onMismatch)

    emit(undefined)
    emit({ noTypeField: true })

    expect(onMismatch).toHaveBeenCalledTimes(2)
    expect(onMismatch.mock.calls.every(([m]) => m.reason === 'malformed')).toBe(true)
  })

  it('ignores a correctly-versioned message of an unknown type', () => {
    const handler = vi.fn()
    const onMismatch = vi.fn()
    subscribe(handler, onMismatch)

    emit({ type: 'hint-requested', version: BRIDGE_VERSION })

    expect(handler).not.toHaveBeenCalled()
    expect(onMismatch).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unknown-type', type: 'hint-requested' }),
    )
  })

  it('drops silently when no callback is supplied — the original behavior', () => {
    const handler = vi.fn()
    subscribe(handler)
    expect(() => emit({ type: 'ready', version: 99 })).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('swallows a throwing onMismatch callback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    subscribe(vi.fn(), () => {
      throw new Error('diagnostics bug')
    })
    expect(() => emit({ type: 'ready', version: 99 })).not.toThrow()
  })

  it('can summarize a mismatch without exposing payload detail', () => {
    const mismatch: BridgeMismatch = {
      reason: 'unknown-type',
      type: 'session-finished-with-extra-debug',
      detail: {
        type: 'session-finished-with-extra-debug',
        version: BRIDGE_VERSION,
        shareCode: 'CLASSROOM-CODE',
        url: 'https://example.test/play?token=secret',
        result: { questionsCorrect: 4 },
      },
    }

    expect(summarizeBridgeMismatch(mismatch)).toEqual({
      reason: 'unknown-type',
      type: 'session-finished-with-extra-debug',
    })
  })

  it('keeps version-skew diagnostics while dropping the raw event detail', () => {
    expect(
      summarizeBridgeMismatch({
        reason: 'version',
        type: 'ready',
        received: 2,
        expected: BRIDGE_VERSION,
        detail: { shareCode: 'CLASSROOM-CODE', activity: { title: 'Unit test' } },
      }),
    ).toEqual({
      reason: 'version',
      type: 'ready',
      received: 2,
      expected: BRIDGE_VERSION,
    })
  })
})

describe('session correlation', () => {
  const finished = (correlation: { sessionId?: string; correlationId?: string }) =>
    ({
      type: 'session-finished',
      version: BRIDGE_VERSION,
      durationMs: 1000,
      questionsAnswered: 4,
      questionsCorrect: 3,
      piecesPlaced: 12,
      piecesTotal: 12,
      ...correlation,
    }) satisfies UnityToWebMessage

  it('matches a result carrying the expected session', () => {
    expect(correlateSession(finished({ sessionId: 's1' }), { sessionId: 's1' })).toBe('match')
  })

  it('rejects a result from a different session', () => {
    // The restart case: without this the second result is written against the
    // first session and a student's completion lands on the wrong record.
    expect(correlateSession(finished({ sessionId: 's2' }), { sessionId: 's1' })).toBe('mismatch')
  })

  it('rejects a stale boot attempt of the same session', () => {
    expect(
      correlateSession(finished({ sessionId: 's1', correlationId: 'boot-1' }), {
        sessionId: 's1',
        correlationId: 'boot-2',
      }),
    ).toBe('mismatch')
  })

  it('matches when the build echoes only the session id', () => {
    expect(
      correlateSession(finished({ sessionId: 's1' }), { sessionId: 's1', correlationId: 'boot-1' }),
    ).toBe('match')
  })

  it('reports a build that echoes nothing as uncorrelated, not as a match', () => {
    // A Unity build predating these fields must not be silently trusted, and
    // must not be silently discarded either — the caller decides.
    expect(correlateSession(finished({}), { sessionId: 's1' })).toBe('uncorrelated')
    expect(correlateSession(ready, { sessionId: 's1' })).toBe('uncorrelated')
  })
})
