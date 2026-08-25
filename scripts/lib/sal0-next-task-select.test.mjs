import { describe, expect, it } from 'vitest'

import { parseMissionEnvelope, selectNextIssue } from './sal0-next-task-select.mjs'

const issue = (number, overrides = {}) => ({
  number,
  title: `[WEB] issue ${number}`,
  body: '',
  labels: [],
  ...overrides,
})

const missionBody = (status = 'queued') => `## SAL0MANder mission

<!-- sal0-mission-control:v1
{"mission":{"status":"${status}"}}
-->`

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
      issue(65, { title: '[OVERNIGHT][WEB] second', body: missionBody() }),
      issue(64, { title: '[OVERNIGHT][WEB] first', body: missionBody() }),
    ])

    expect(selected?.number).toBe(64)
  })

  it('does not rerun active or malformed Mission Control envelopes as generic issues', () => {
    const selected = selectNextIssue([
      issue(64, { title: '[OVERNIGHT][WEB] active', body: missionBody('active') }),
      issue(65, {
        title: '[OVERNIGHT][WEB] malformed',
        body: '<!-- sal0-mission-control:v1\nnot json\n-->',
      }),
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
})
