import { describe, expect, it } from 'vitest'

import {
  isQueuedMissionIssue,
  parseMissionEnvelope,
  selectNextIssue,
} from './sal0-next-task-select.mjs'

const issue = (number, overrides = {}) => ({
  number,
  title: `[WEB] issue ${number}`,
  body: '',
  labels: [],
  author: { login: 'Samco1983' },
  ...overrides,
})

const missionBody = (overrides = {}) => {
  const requestedAtUtc = overrides.requestedAtUtc || '2026-08-25T07:05:30.144Z'
  const { mission: missionOverrides, ...envelopeOverrides } = overrides
  const envelope = {
    action: 'fast_break',
    idempotencyKey: 'fast_break:new:2026-08-25T07:05:52a12c18',
    requestFingerprint: 'f9470211b15218791dd01608e50d618b6ec5302498032ff54a2c7ed74ad70fbf',
    requestedAtUtc,
    source: 'owner_console',
    mission: {
      title: 'owner mission',
      status: 'queued',
      updatedAtUtc: requestedAtUtc,
      ...missionOverrides,
    },
    ...envelopeOverrides,
  }

  return `## SAL0MANder mission

<!-- sal0-mission-control:v1
${JSON.stringify(envelope)}
-->`
}

describe('selectNextIssue', () => {
  it('prioritizes a queued Mission Control issue over the older generic backlog', () => {
    const selected = selectNextIssue([
      issue(41),
      issue(64, {
        title: '[OVERNIGHT][WEB] owner mission',
        body: missionBody(),
      }),
    ])

    expect(selected?.number).toBe(64)
  })

  it('takes the oldest queued owner mission when more than one is present', () => {
    const selected = selectNextIssue([
      issue(65, {
        title: '[OVERNIGHT][WEB] second',
        body: missionBody({ mission: { title: 'second' } }),
      }),
      issue(64, {
        title: '[OVERNIGHT][WEB] first',
        body: missionBody({ mission: { title: 'first' } }),
      }),
    ])

    expect(selected?.number).toBe(64)
  })

  it('does not rerun active or malformed Mission Control envelopes as generic issues', () => {
    const selected = selectNextIssue([
      issue(64, {
        title: '[OVERNIGHT][WEB] active',
        body: missionBody({ mission: { title: 'active', status: 'active' } }),
      }),
      issue(65, {
        title: '[OVERNIGHT][WEB] malformed',
        body: '<!-- sal0-mission-control:v1\nnot json\n-->',
      }),
      issue(51),
    ])

    expect(selected?.number).toBe(51)
  })

  it('rejects a valid-looking mission from an untrusted issue author', () => {
    const selected = selectNextIssue([
      issue(64, {
        title: '[OVERNIGHT][WEB] owner mission',
        body: missionBody(),
        author: { login: 'someone-else' },
      }),
      issue(51),
    ])

    expect(selected?.number).toBe(51)
  })

  it('rejects incomplete and tampered mission envelopes', () => {
    const invalidMissions = [
      missionBody({ action: 'championship' }),
      missionBody({ source: 'browser_copy' }),
      missionBody({ idempotencyKey: '' }),
      missionBody({ requestFingerprint: 'not-a-fingerprint' }),
      missionBody({ requestedAtUtc: 'not-a-date' }),
      missionBody({ mission: { updatedAtUtc: '2026-08-25T07:06:30.144Z' } }),
    ]
    const selected = selectNextIssue([
      ...invalidMissions.map((body, index) =>
        issue(64 + index, { title: '[OVERNIGHT][WEB] owner mission', body }),
      ),
      issue(51),
    ])

    expect(selected?.number).toBe(51)
  })

  it('keeps the existing label brakes and oldest-generic fallback', () => {
    const selected = selectNextIssue([
      issue(45, { labels: [{ name: 'blocked' }] }),
      issue(46),
      issue(51),
    ])

    expect(selected?.number).toBe(46)
  })
})

describe('parseMissionEnvelope', () => {
  it('returns null instead of trusting malformed mission metadata', () => {
    expect(parseMissionEnvelope('<!-- sal0-mission-control:v1\n{\n-->')).toBeNull()
  })

  it('accepts the complete envelope emitted by the Mission Control worker', () => {
    expect(
      isQueuedMissionIssue(
        issue(64, {
          title: '[OVERNIGHT][WEB] owner mission',
          body: missionBody(),
        }),
      ),
    ).toBe(true)
  })
})
