import { describe, expect, it } from 'vitest'

import { BRIDGE_VERSION, summarizeBridgeMismatch } from './bridge'
import type { BridgeMismatch } from './bridge'

/**
 * Observability audit for the boot bridge.
 *
 * `summarizeBridgeMismatch` is documented as the "privacy-safe shape for logs
 * and support notes" — the thing a human is meant to paste into a ticket. That
 * promise had two holes.
 *
 * These tests pin the two properties the docstring claims: every failure class
 * stays distinguishable, and nothing that arrived from outside this process is
 * copied into the summary verbatim.
 */

const SENSITIVE = {
  shareCode: 'SUN-42',
  studentName: 'Ana',
  token: 'sk-ant-oat01-secret',
  url: 'https://example.com/play/SUN-42',
}

describe('failure classes stay distinguishable', () => {
  // Daytime debugging needs to tell these apart without reading a payload:
  // malformed traffic, version skew, an unknown type, and wrong direction.
  const cases: BridgeMismatch[] = [
    { reason: 'malformed', detail: SENSITIVE },
    { reason: 'version', type: 'boot', received: 99, expected: BRIDGE_VERSION, detail: SENSITIVE },
    { reason: 'unknown-type', type: 'future-thing', detail: SENSITIVE },
    { reason: 'wrong-direction', type: 'boot', detail: SENSITIVE },
  ]

  it('reports a distinct reason for each', () => {
    const reasons = cases.map((c) => summarizeBridgeMismatch(c).reason)
    expect(new Set(reasons).size).toBe(cases.length)
  })

  it('keeps the message type, which is what a support note needs', () => {
    for (const c of cases.filter((c) => c.reason !== 'malformed')) {
      expect(summarizeBridgeMismatch(c)).toHaveProperty('type')
    }
  })

  it('says whether a malformed message had a payload without quoting it', () => {
    const summary = summarizeBridgeMismatch({ reason: 'malformed', detail: SENSITIVE })
    expect(summary).toEqual({ reason: 'malformed', hasDetail: true })
  })
})

describe('nothing from outside this process reaches the summary verbatim', () => {
  it('drops detail on every failure class', () => {
    for (const mismatch of [
      { reason: 'malformed', detail: SENSITIVE },
      { reason: 'version', type: 'boot', received: 2, expected: BRIDGE_VERSION, detail: SENSITIVE },
      { reason: 'unknown-type', type: 'x', detail: SENSITIVE },
      { reason: 'wrong-direction', type: 'boot', detail: SENSITIVE },
    ] as BridgeMismatch[]) {
      const text = JSON.stringify(summarizeBridgeMismatch(mismatch))
      expect(text).not.toContain('SUN-42')
      expect(text).not.toContain('Ana')
      expect(text).not.toContain('sk-ant-oat')
      expect(text).not.toContain('https://')
    }
  })

  it('does not copy a non-primitive version field through', () => {
    // `received` is typed unknown and comes straight off inbound traffic. A
    // build sending an object there would land it inside the value documented
    // as safe to paste into a ticket.
    const summary = summarizeBridgeMismatch({
      reason: 'version',
      type: 'session-finished',
      received: SENSITIVE,
      expected: BRIDGE_VERSION,
      detail: undefined,
    })
    const text = JSON.stringify(summary)
    expect(text).not.toContain('SUN-42')
    expect(text).not.toContain('Ana')
  })

  it('still reports a plain version number, because that is the useful part', () => {
    const summary = summarizeBridgeMismatch({
      reason: 'version',
      type: 'boot',
      received: 99,
      expected: BRIDGE_VERSION,
      detail: undefined,
    })
    expect(summary).toMatchObject({ received: 99, expected: BRIDGE_VERSION })
  })

  it('describes an unusable version by shape rather than dropping it silently', () => {
    // Knowing "an object arrived where a number belongs" is the diagnostic.
    // Knowing nothing at all is not.
    const summary = summarizeBridgeMismatch({
      reason: 'version',
      type: 'boot',
      received: SENSITIVE,
      expected: BRIDGE_VERSION,
      detail: undefined,
    })
    expect(JSON.stringify(summary)).toMatch(/object/i)
  })
})
