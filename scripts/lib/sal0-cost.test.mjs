import { describe, expect, it } from 'vitest'

import { parseAgentEnvelope, summariseCost } from './sal0-cost.mjs'

describe('parseAgentEnvelope', () => {
  it('unwraps a --output-format json envelope and reads the cost', () => {
    const raw = JSON.stringify({
      result: '{"state":"WORKING"}',
      total_cost_usd: 0.0123,
      session_id: 'abc',
      usage: { input_tokens: 10 },
    })
    const parsed = parseAgentEnvelope(raw)
    expect(parsed.text).toBe('{"state":"WORKING"}')
    expect(parsed.costUsd).toBe(0.0123)
    expect(parsed.sessionId).toBe('abc')
  })

  it('passes plain text through unchanged when there is no envelope', () => {
    const parsed = parseAgentEnvelope('{"state":"WORKING"}')
    expect(parsed.text).toBe('{"state":"WORKING"}')
    expect(parsed.costUsd).toBeNull()
  })

  it('does not mistake a bare position object for an envelope', () => {
    // A position has no string `result` field, so it must pass through whole.
    const raw = '{"state":"WORKING","result":{"nested":true}}'
    expect(parseAgentEnvelope(raw).text).toBe(raw)
  })

  it('survives empty and malformed output', () => {
    expect(parseAgentEnvelope('').text).toBe('')
    expect(parseAgentEnvelope('not json').costUsd).toBeNull()
    expect(parseAgentEnvelope(null).text).toBe('')
  })
})

describe('summariseCost', () => {
  it('totals by run mode', () => {
    const summary = summariseCost([
      { runMode: 'agent-claude-position', costUsd: 0.01, modelCalls: 1 },
      { runMode: 'agent-claude-position', costUsd: 0.02, modelCalls: 1 },
      { runMode: 'dry-run', costUsd: null, modelCalls: 0 },
    ])
    expect(summary.totalUsd).toBeCloseTo(0.03)
    expect(summary.byMode['agent-claude-position'].runs).toBe(2)
    expect(summary.modelRunsMissingCost).toBe(0)
  })

  it('flags model runs that reported no cost, so the total reads as a floor', () => {
    const summary = summariseCost([
      { runMode: 'agent-claude-position', costUsd: 0.01, modelCalls: 1 },
      { runMode: 'agent-claude-position', costUsd: null, modelCalls: 1 },
    ])
    expect(summary.modelRunsMissingCost).toBe(1)
  })
})
