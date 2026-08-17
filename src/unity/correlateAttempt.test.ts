import { describe, expect, it } from 'vitest'
import {
  BRIDGE_VERSION,
  UNITY_EVENT_NAME,
  correlateAttempt,
  onUnityMessage,
  type UnityToWebMessage,
} from './bridge'
import { vi } from 'vitest'

const finished = (extra: Record<string, unknown> = {}) =>
  ({
    type: 'session-finished',
    version: BRIDGE_VERSION,
    durationMs: 1000,
    questionsAnswered: 1,
    questionsCorrect: 1,
    piecesPlaced: 4,
    piecesTotal: 4,
    ...extra,
  }) as UnityToWebMessage

describe('attempt correlation', () => {
  it('matches when the attempt id is the current one', () => {
    expect(correlateAttempt(finished({ clientAttemptId: 'a1' }), { clientAttemptId: 'a1' })).toBe(
      'match',
    )
  })

  it('rejects a superseded boot', () => {
    // The event is well-formed and looks legitimate; only the id reveals it
    // belongs to an attempt that is no longer on screen.
    expect(correlateAttempt(finished({ clientAttemptId: 'a0' }), { clientAttemptId: 'a1' })).toBe(
      'stale-attempt',
    )
  })

  it('rejects a message carrying no attempt id at all', () => {
    // Fail-closed, per the Gate-1 ruling. Previously this was treated as
    // "cannot tell", which let an uncorrelated result through.
    expect(correlateAttempt(finished(), { clientAttemptId: 'a1' })).toBe('missing-attempt')
  })

  it('rejects everything before the web has an attempt id', () => {
    expect(correlateAttempt(finished({ clientAttemptId: 'a1' }), { clientAttemptId: undefined })).toBe(
      'missing-attempt',
    )
  })

  it('accepts the deprecated correlationId during rollout', () => {
    // A build compiled before the rename must keep working.
    expect(correlateAttempt(finished({ correlationId: 'a1' }), { clientAttemptId: 'a1' })).toBe(
      'match',
    )
  })

  it('ignores the session id until the web has one', () => {
    // At mode-selected there is no session; matching the attempt is the
    // strongest statement available and has to be enough.
    expect(
      correlateAttempt(finished({ clientAttemptId: 'a1', sessionId: 'whatever' }), {
        clientAttemptId: 'a1',
      }),
    ).toBe('match')
  })

  it('rejects the right attempt with the wrong session', () => {
    expect(
      correlateAttempt(finished({ clientAttemptId: 'a1', sessionId: 'ses_old' }), {
        clientAttemptId: 'a1',
        sessionId: 'ses_new',
      }),
    ).toBe('stale-session')
  })

  it('accepts a message that omits the session once one exists', () => {
    // A build echoing only the attempt id is still placeable.
    expect(
      correlateAttempt(finished({ clientAttemptId: 'a1' }), {
        clientAttemptId: 'a1',
        sessionId: 'ses_1',
      }),
    ).toBe('match')
  })
})

describe('v1 parser alignment', () => {
  const emit = (detail: unknown) =>
    window.dispatchEvent(new CustomEvent(UNITY_EVENT_NAME, { detail }))

  it('accepts contractVersion, the v1 field', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)
    emit({ type: 'unity-ready', contractVersion: BRIDGE_VERSION, eventId: 'e1' })
    expect(handler).toHaveBeenCalledTimes(1)
    off()
  })

  it('still accepts the legacy version field', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)
    emit({ type: 'ready', version: BRIDGE_VERSION, eventId: 'e2' })
    expect(handler).toHaveBeenCalledTimes(1)
    off()
  })

  it('prefers contractVersion when both disagree', () => {
    // A build sending both is a v1 build; the legacy field must not decide.
    const handler = vi.fn()
    const off = onUnityMessage(handler)
    emit({ type: 'ready', contractVersion: BRIDGE_VERSION, version: 99, eventId: 'e3' })
    expect(handler).toHaveBeenCalledTimes(1)
    off()
  })

  it('normalizes v1 names onto the internal ones', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)
    emit({ type: 'unity-ready', contractVersion: BRIDGE_VERSION, eventId: 'e4' })
    emit({ type: 'fatal-error', contractVersion: BRIDGE_VERSION, message: 'boom', eventId: 'e5' })

    // Consumers see one vocabulary regardless of which the build was built on.
    expect(handler.mock.calls.map(([m]) => (m as UnityToWebMessage).type)).toEqual([
      'ready',
      'error',
    ])
    off()
  })

  it('accepts contract-mismatch as a real message', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)
    emit({ type: 'contract-mismatch', contractVersion: BRIDGE_VERSION, eventId: 'e6' })
    expect(handler).toHaveBeenCalledTimes(1)
    off()
  })

  it('normalizes version so consumers reading it still work', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)
    emit({ type: 'unity-ready', contractVersion: BRIDGE_VERSION, eventId: 'e7' })
    const [received] = handler.mock.calls[0] as [{ version: number }]
    expect(received.version).toBe(BRIDGE_VERSION)
    off()
  })

  it('still rejects a genuine version mismatch', () => {
    const handler = vi.fn()
    const onMismatch = vi.fn()
    const off = onUnityMessage(handler, { onMismatch })
    emit({ type: 'ready', contractVersion: 99, eventId: 'e8' })
    expect(handler).not.toHaveBeenCalled()
    expect(onMismatch).toHaveBeenCalledWith(expect.objectContaining({ reason: 'version' }))
    off()
  })
})
