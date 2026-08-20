import { describe, expect, it } from 'vitest'
import { evaluatePrGate, normalizeChecks } from './sal0-pr-gate.mjs'

describe('sal0-pr-gate', () => {
  it('normalizes GitHub check runs and status contexts', () => {
    expect(
      normalizeChecks([
      { __typename: 'CheckRun', name: 'verify', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { __typename: 'StatusContext', context: 'legacy/ci', state: 'SUCCESS' },
      ]),
    ).toEqual([
      { name: 'verify', status: 'COMPLETED', conclusion: 'SUCCESS', url: null },
      { name: 'legacy/ci', status: null, conclusion: 'SUCCESS', url: null },
    ])
  })

  it('blocks a PR with no checks', () => {
    const result = evaluatePrGate({ number: 29, state: 'OPEN', statusCheckRollup: [] })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('NO_CHECKS')
    expect(result.checks.total).toBe(0)
  })

  it('blocks a PR with pending checks', () => {
    const result = evaluatePrGate({
    number: 29,
    state: 'OPEN',
    statusCheckRollup: [{ name: 'verify', status: 'IN_PROGRESS', conclusion: null }],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('PENDING_CHECKS')
    expect(result.checks.pending).toBe(1)
  })

  it('blocks a PR with failed checks', () => {
    const result = evaluatePrGate({
    number: 29,
    state: 'OPEN',
    statusCheckRollup: [{ name: 'verify', status: 'COMPLETED', conclusion: 'FAILURE' }],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('FAILED_CHECKS')
    expect(result.checks.failing).toBe(1)
  })

  it('passes a PR with only successful checks', () => {
    const result = evaluatePrGate({
    number: 29,
    state: 'OPEN',
    statusCheckRollup: [
      { name: 'verify', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { context: 'artifact', state: 'SUCCESS' },
    ],
    })
    expect(result.ok).toBe(true)
    expect(result.code).toBe('PR_GATE_GREEN')
    expect(result.checks.passing).toBe(2)
  })

  it('blocks a PR that is not open', () => {
    const result = evaluatePrGate({ number: 29, state: 'CLOSED', statusCheckRollup: [] })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('PR_NOT_OPEN')
  })

  it('blocks a PR with merge conflicts', () => {
    const result = evaluatePrGate({
    number: 29,
    state: 'OPEN',
    mergeable: 'CONFLICTING',
    statusCheckRollup: [{ name: 'verify', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('MERGE_BLOCKED')
  })
})
