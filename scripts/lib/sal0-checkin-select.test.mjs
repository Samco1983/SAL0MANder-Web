import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TRUSTED_AUTHORS,
  isTrustedAuthor,
  oldestPending,
  parseEnvelope,
  readField,
  trustedAuthors,
} from './sal0-checkin-select.mjs'

const comment = (overrides = {}) => ({
  id: 1,
  created_at: '2026-08-16T00:00:00Z',
  user: { login: 'Samco1983' },
  body: 'CHECK_IN_REQUEST\n\nLane: Web\nRequest:\ndo the thing\n',
  ...overrides,
})

describe('oldestPending — request selection (F-3)', () => {
  it('does not select a comment whose only marker is the status word ACTION REQUIRED', () => {
    // Every supervisor post carries `STATUS: ACTION REQUIRED`. Treating it as a
    // request matched 38 false positives out of 46 against the live hub.
    const supervisorPost = comment({
      id: 10,
      body: 'AGENT: ChatGPT Supervisor\nSTATUS: ACTION REQUIRED — NO NEW ESCALATION\n',
    })

    expect(oldestPending([supervisorPost], {})).toBeUndefined()
  })

  it('reaches a genuine request that sits behind a wall of status posts', () => {
    const statusPosts = Array.from({ length: 25 }, (_, index) =>
      comment({
        id: 100 + index,
        created_at: `2026-08-16T00:${String(index).padStart(2, '0')}:00Z`,
        body: `STATUS: ACTION REQUIRED — post ${index}\n`,
      }),
    )
    const realRequest = comment({ id: 999, created_at: '2026-08-17T00:00:00Z' })

    expect(oldestPending([...statusPosts, realRequest], {})?.id).toBe(999)
  })

  it('still prefers the older of two genuine requests', () => {
    const older = comment({ id: 1, created_at: '2026-08-16T00:00:00Z' })
    const newer = comment({ id: 2, created_at: '2026-08-18T00:00:00Z' })

    expect(oldestPending([newer, older], {})?.id).toBe(1)
  })

  it('skips requests already processed on the hub or seen locally', () => {
    const processed = comment({ id: 3, body: 'CHECK_IN_REQUEST\nCHECK_IN_PROCESSED\n' })
    const seen = comment({ id: 4 })

    expect(oldestPending([processed], {})).toBeUndefined()
    expect(oldestPending([seen], { seenCommentIds: [4] })).toBeUndefined()
  })
})

describe('oldestPending — author trust (F-5)', () => {
  it('ignores a request from an untrusted author', () => {
    const stranger = comment({ id: 5, user: { login: 'drive-by' } })

    expect(oldestPending([stranger], {})).toBeUndefined()
  })

  it('ignores a request with no resolvable author', () => {
    expect(oldestPending([comment({ id: 6, user: null })], {})).toBeUndefined()
    expect(isTrustedAuthor({ user: {} })).toBe(false)
    expect(isTrustedAuthor(undefined)).toBe(false)
  })

  it('matches the trusted login case-insensitively', () => {
    expect(isTrustedAuthor({ user: { login: 'samco1983' } })).toBe(true)
  })

  it('honours an explicit allowlist override', () => {
    const other = comment({ id: 7, user: { login: 'someone-else' } })

    expect(oldestPending([other], {}, { trustedAuthors: ['someone-else'] })?.id).toBe(7)
  })
})

describe('trustedAuthors', () => {
  it('defaults to the canonical selector rule', () => {
    expect(trustedAuthors({})).toEqual(DEFAULT_TRUSTED_AUTHORS)
  })

  it('parses a comma-separated allowlist', () => {
    expect(trustedAuthors({ SAL0_TRUSTED_AUTHORS: 'a, b ,c' })).toEqual(['a', 'b', 'c'])
  })

  it('falls back rather than emptying the list — "unset" must never mean "trust anyone"', () => {
    expect(trustedAuthors({ SAL0_TRUSTED_AUTHORS: '' })).toEqual(DEFAULT_TRUSTED_AUTHORS)
    expect(trustedAuthors({ SAL0_TRUSTED_AUTHORS: '  ,  ' })).toEqual(DEFAULT_TRUSTED_AUTHORS)
  })
})

describe('readField — field boundaries (F-4)', () => {
  it('keeps a bare URL line inside the request instead of truncating there', () => {
    // `https:` matches a generic `^\w[\w /-]*:` next-field scan, which silently
    // dropped every line after the link — including the actual instruction.
    const body = [
      'CHECK_IN_REQUEST',
      '',
      'Lane: Web',
      'Request:',
      'review the head',
      'https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1',
      'return PASS or FAIL with evidence',
      '',
      'Expected evidence:',
      'commit and test output',
    ].join('\n')

    expect(readField(body, 'Request')).toBe(
      [
        'review the head',
        'https://github.com/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1',
        'return PASS or FAIL with evidence',
      ].join('\n'),
    )
  })

  it('keeps prose that merely looks like a field label', () => {
    const body = 'Request:\nNote: check the build\nWarning: it is slow\n\nExpected evidence:\nlogs'

    expect(readField(body, 'Request')).toBe('Note: check the build\nWarning: it is slow')
    expect(readField(body, 'Expected evidence')).toBe('logs')
  })

  it('still stops at a real envelope field', () => {
    const body = 'Lane: Web\nRequest:\ndo the thing\nExpected evidence:\na commit'

    expect(readField(body, 'Lane')).toBe('Web')
    expect(readField(body, 'Request')).toBe('do the thing')
  })

  it('returns empty for an absent field', () => {
    expect(readField('Lane: Web', 'Request')).toBe('')
    expect(readField(undefined, 'Request')).toBe('')
  })
})

describe('parseEnvelope', () => {
  it('accepts a well-formed request', () => {
    const envelope = parseEnvelope(comment().body)

    expect(envelope).toMatchObject({ marker: 'CHECK_IN_REQUEST', lane: 'Web', isStructured: true })
    expect(envelope.problems).toEqual([])
  })

  it('reports a status-only post as unstructured rather than dispatcher-ready', () => {
    const envelope = parseEnvelope('STATUS: ACTION REQUIRED — do something')

    expect(envelope.marker).toBe('')
    expect(envelope.isStructured).toBe(false)
    expect(envelope.problems).toContain('use CHECK_IN_REQUEST for dispatcher-ready work')
  })

  it('names an unknown lane and a missing request', () => {
    const envelope = parseEnvelope('CHECK_IN_REQUEST\n\nLane: Marketing\n')

    expect(envelope.isStructured).toBe(false)
    expect(envelope.problems).toHaveLength(2)
  })
})
