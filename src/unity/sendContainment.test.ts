import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BRIDGE_VERSION, sendToUnity, UNITY_BRIDGE_TARGET } from './bridge'
import type { UnityMessageTarget, WebToUnityMessage } from './bridge'

/**
 * Containment for the outbound half of the bridge.
 *
 * `sendToUnity` returns a boolean rather than throwing, and callers branch on
 * it — `bootedRef` is only set when the send returned true, so a failed boot is
 * retried and a delivered one is never repeated. That contract had no test.
 *
 * The invariant these protect: **a failed send must never look like a delivered
 * one.** If the web believes Unity received a message it did not, the session
 * the teacher sees and the game the student plays diverge with nothing to
 * reveal it — the exact silent-success failure this project keeps hitting.
 */

const BOOT: WebToUnityMessage = {
  type: 'boot',
  version: BRIDGE_VERSION,
  activityId: 'act-1',
  activityVersionId: 'ver-1',
  clientAttemptId: 'attempt-1',
}

function target(sendMessage: UnityMessageTarget['SendMessage']): UnityMessageTarget {
  return { SendMessage: sendMessage } as UnityMessageTarget
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('no Unity instance attached', () => {
  it('reports failure rather than pretending the message went out', () => {
    expect(sendToUnity(null, BOOT)).toBe(false)
    expect(sendToUnity(undefined, BOOT)).toBe(false)
  })

  it('treats an instance with no SendMessage as unusable', () => {
    // A partially initialised Unity object is worse than none: it satisfies a
    // truthiness check and then silently does nothing.
    expect(sendToUnity({} as UnityMessageTarget, BOOT)).toBe(false)
  })

  it('says the message was not delivered, and that gameplay continues', () => {
    sendToUnity(null, BOOT)
    const [line] = consoleError.mock.calls.at(-1) ?? []
    expect(String(line)).toMatch(/NOT delivered/i)
    expect(String(line)).toMatch(/gameplay continues/i)
  })

  it('names the message type so a log line identifies what was lost', () => {
    sendToUnity(null, BOOT)
    expect(String(consoleError.mock.calls.at(-1)?.[0])).toContain('boot')
  })
})

describe('SendMessage throwing', () => {
  const thrower = () => {
    throw new Error('GameObject not found')
  }

  it('contains the throw instead of tearing down the caller', () => {
    expect(() => sendToUnity(target(thrower), BOOT)).not.toThrow()
    expect(sendToUnity(target(thrower), BOOT)).toBe(false)
  })

  it('names the GameObject and method, which is what is actually wrong', () => {
    sendToUnity(target(thrower), BOOT)
    const line = String(consoleError.mock.calls.at(-1)?.[0])
    expect(line).toContain(UNITY_BRIDGE_TARGET.gameObject)
    expect(line).toContain(UNITY_BRIDGE_TARGET.method)
  })
})

describe('a successful send', () => {
  it('reports true and delivers exactly once', () => {
    const send = vi.fn()
    expect(sendToUnity(target(send), BOOT)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('carries both version fields, so deploy order does not matter', () => {
    const send = vi.fn()
    sendToUnity(target(send), BOOT)
    const payload = JSON.parse(String(send.mock.calls[0]?.[2]))
    // Unity's v1 receiver reads contractVersion; a build still on the stub
    // reads version. Sending both removes the ordering dependency.
    expect(payload.contractVersion).toBe(BRIDGE_VERSION)
    expect(payload.version).toBe(BRIDGE_VERSION)
  })

  it('sends valid JSON, not a stringified object', () => {
    const send = vi.fn()
    sendToUnity(target(send), BOOT)
    expect(() => JSON.parse(String(send.mock.calls[0]?.[2]))).not.toThrow()
  })
})

describe('duplicate triggers are the caller decision, and the return value is what drives it', () => {
  // UnityStage sets bootedRef only when the send returned true. These lock in
  // the values that logic depends on: a false must be retryable and a true must
  // be trusted, or a student either never boots or boots twice.
  it('a failed send stays false on every attempt, so a retry is legitimate', () => {
    const send = vi.fn(() => {
      throw new Error('not ready')
    })
    expect(sendToUnity(target(send), BOOT)).toBe(false)
    expect(sendToUnity(target(send), BOOT)).toBe(false)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('a send that starts failing and then succeeds reports the change honestly', () => {
    let ready = false
    const send = vi.fn(() => {
      if (!ready) throw new Error('not ready')
    })
    expect(sendToUnity(target(send), BOOT)).toBe(false)
    ready = true
    expect(sendToUnity(target(send), BOOT)).toBe(true)
  })
})

describe('web state is isolated from a bridge failure', () => {
  it('mutates nothing on the message it was given', () => {
    // The caller keeps its own object. A send that rewrote it would corrupt the
    // state the web renders from, on a failure path nobody watches.
    const original = { ...BOOT }
    sendToUnity(null, BOOT)
    sendToUnity(target(() => {}), BOOT)
    expect(BOOT).toEqual(original)
  })

  it('does not put the wire envelope on the caller message', () => {
    sendToUnity(target(() => {}), BOOT)
    expect(BOOT).not.toHaveProperty('contractVersion')
  })
})
