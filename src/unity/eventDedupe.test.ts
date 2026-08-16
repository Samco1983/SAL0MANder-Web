import { describe, expect, it, vi } from 'vitest'
import { BRIDGE_VERSION, UNITY_EVENT_NAME, onUnityMessage } from './bridge'
import { createEventDeduper } from './eventDedupe'

describe('the deduper itself', () => {
  it('accepts an id once', () => {
    const d = createEventDeduper()
    expect(d.accept('e1')).toBe(true)
    expect(d.accept('e1')).toBe(false)
  })

  it('treats distinct ids independently', () => {
    const d = createEventDeduper()
    expect(d.accept('e1')).toBe(true)
    expect(d.accept('e2')).toBe(true)
  })

  it('always accepts a message with no id', () => {
    // Correlation fields are optional during the bridge rollout, so an id-less
    // message is expected. Dropping it would be worse than handling it twice.
    const d = createEventDeduper()
    expect(d.accept(undefined)).toBe(true)
    expect(d.accept(undefined)).toBe(true)
  })

  it('stays bounded, so a lesson-long tab does not leak', () => {
    const d = createEventDeduper(4)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) d.accept(id)
    expect(d.size).toBeLessThanOrEqual(4)
  })

  it('evicts oldest first', () => {
    const d = createEventDeduper(2)
    d.accept('a')
    d.accept('b')
    d.accept('c') // evicts 'a'
    expect(d.accept('a')).toBe(true) // forgotten, so accepted again
    expect(d.accept('c')).toBe(false) // still remembered
  })
})

describe('the bridge deduplicates deliveries', () => {
  const emit = (detail: unknown) =>
    window.dispatchEvent(new CustomEvent(UNITY_EVENT_NAME, { detail }))

  const finished = (eventId?: string) => ({
    type: 'session-finished',
    version: BRIDGE_VERSION,
    durationMs: 1000,
    questionsAnswered: 9,
    questionsCorrect: 8,
    piecesPlaced: 9,
    piecesTotal: 9,
    ...(eventId ? { eventId } : {}),
  })

  it('delivers a redelivered session-finished only once', () => {
    // The one that costs money to double-handle: a second delivery would
    // submit a student's result twice.
    const handler = vi.fn()
    const off = onUnityMessage(handler)

    emit(finished('evt-1'))
    emit(finished('evt-1'))
    emit(finished('evt-1'))

    expect(handler).toHaveBeenCalledTimes(1)
    off()
  })

  it('still delivers genuinely distinct events', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)

    emit(finished('evt-1'))
    emit(finished('evt-2'))

    expect(handler).toHaveBeenCalledTimes(2)
    off()
  })

  it('does not suppress messages that carry no eventId', () => {
    const handler = vi.fn()
    const off = onUnityMessage(handler)

    emit(finished())
    emit(finished())

    expect(handler).toHaveBeenCalledTimes(2)
    off()
  })

  it('keeps each subscriber independent', () => {
    // One listener's history must not silence another's — two panels can care
    // about the same event.
    const a = vi.fn()
    const b = vi.fn()
    const offA = onUnityMessage(a)
    const offB = onUnityMessage(b)

    emit(finished('evt-1'))

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    offB()
  })

  it('reports a duplicate as nothing at all, not as a mismatch', () => {
    // A redelivery is expected traffic, not a fault worth surfacing.
    const onMismatch = vi.fn()
    const off = onUnityMessage(vi.fn(), { onMismatch })

    emit(finished('evt-1'))
    emit(finished('evt-1'))

    expect(onMismatch).not.toHaveBeenCalled()
    off()
  })
})
