import { describe, expect, it } from 'vitest'

import {
  ATTRIBUTION,
  classifyAgentFailure,
  classifyOutputFailure,
  FAILURE,
  isModelAttributable,
} from './sal0-agent-failure.mjs'

describe('classifyAgentFailure', () => {
  it('never attributes a process failure to the model', () => {
    const cases = [
      { error: { code: 'ENOENT' } },
      { timedOut: true },
      { status: 1, stderr: 'Error: not logged in' },
      { status: 1, stderr: 'tool "run_shell_command" is not allowed' },
      { status: 42 },
      { status: 53 },
      { status: 7, stderr: 'something else' },
      { signal: 'SIGKILL' },
    ]
    for (const input of cases) {
      const verdict = classifyAgentFailure(input)
      expect(verdict.attribution).toBe(ATTRIBUTION.INFRASTRUCTURE)
      expect(isModelAttributable(verdict.failureClass)).toBe(false)
    }
  })

  it('separates a policy block from a model declining', () => {
    const verdict = classifyAgentFailure({ status: 1, stderr: 'denied by policy: shell' })
    expect(verdict.failureClass).toBe(FAILURE.TOOL_POLICY_DENIED)
    expect(verdict.attribution).toBe(ATTRIBUTION.INFRASTRUCTURE)
  })

  it('detects an unauthenticated CLI', () => {
    expect(classifyAgentFailure({ status: 1, stderr: 'HTTP 401 Unauthorized' }).failureClass).toBe(
      FAILURE.AGENT_AUTH,
    )
  })

  it('maps the documented Gemini headless exit codes', () => {
    expect(classifyAgentFailure({ status: 42 }).failureClass).toBe(FAILURE.AGENT_INVALID_INPUT)
    expect(classifyAgentFailure({ status: 53 }).failureClass).toBe(FAILURE.AGENT_TURN_LIMIT)
  })

  it('prefers a missing binary over any stderr text', () => {
    const verdict = classifyAgentFailure({ error: { code: 'ENOENT' }, stderr: 'not logged in' })
    expect(verdict.failureClass).toBe(FAILURE.AGENT_NOT_FOUND)
  })
})

describe('classifyOutputFailure', () => {
  it('attributes real output to the model', () => {
    expect(classifyOutputFailure('').failureClass).toBe(FAILURE.OUTPUT_EMPTY)
    expect(classifyOutputFailure('I think we should...').failureClass).toBe(FAILURE.OUTPUT_UNPARSEABLE)
    expect(classifyOutputFailure('{}', { schemaError: 'missing state' }).failureClass).toBe(
      FAILURE.OUTPUT_SCHEMA_INVALID,
    )
    for (const raw of ['', 'prose', '{}']) {
      expect(classifyOutputFailure(raw, { schemaError: 'x' }).attribution).toBe(ATTRIBUTION.MODEL)
    }
  })
})
