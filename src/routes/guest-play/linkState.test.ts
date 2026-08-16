import { describe, expect, it } from 'vitest'
import { ApiError } from '@api/errors'
import { isRecoverable, linkCopy, linkStateFrom, type LinkState } from './linkState'

/**
 * Direct cover for the share-link failure taxonomy.
 *
 * These states were previously exercised only through `GuestPlayPage`, which
 * asserted the rendered copy but not the mapping underneath. A mutation pass
 * found three ways to break this module that the page-level tests did not
 * notice: dropping the `serverCode` case-fold, and — twice — removing the
 * retryability check from `isRecoverable`. Each case below fails against the
 * corresponding broken source.
 */

const error = (init: {
  code?: ConstructorParameters<typeof ApiError>[0]['code']
  serverCode?: string
  retryable?: boolean
}) =>
  new ApiError({
    code: init.code ?? 'not_found',
    message: 'test',
    ...(init.serverCode ? { serverCode: init.serverCode } : {}),
    ...(init.retryable !== undefined ? { retryable: init.retryable } : {}),
  })

describe('linkStateFrom', () => {
  it('distinguishes a revoked link from an unpublished activity', () => {
    expect(linkStateFrom(error({ serverCode: 'SHARE_LINK_REVOKED' }))).toBe('revoked')
    expect(linkStateFrom(error({ serverCode: 'ACTIVITY_UNPUBLISHED' }))).toBe('unpublished')
  })

  it('falls back to a mistyped-link reading for a bare 404', () => {
    expect(linkStateFrom(error({ code: 'not_found' }))).toBe('missing')
  })

  it('treats anything else as a transient failure, not a dead link', () => {
    expect(linkStateFrom(error({ code: 'server_error' }))).toBe('unavailable')
    expect(linkStateFrom(error({ code: 'timeout' }))).toBe('unavailable')
  })

  it('accepts server codes in any casing', () => {
    // The wire casing for the shared error vocabulary is still unsettled, so
    // matching must not depend on the server shouting. Without the case-fold a
    // revoked link silently degrades to "check the link" — telling a student to
    // retype a code their teacher deliberately turned off.
    for (const wire of ['share_link_revoked', 'Share_Link_Revoked', 'sHaRe_LiNk_ReVoKeD']) {
      expect(linkStateFrom(error({ serverCode: wire }))).toBe('revoked')
    }
    expect(linkStateFrom(error({ serverCode: 'activity_unpublished' }))).toBe('unpublished')
  })

  it('prefers an explicit server code over the transport status', () => {
    // A revoked link is delivered as a 404. The specific code must win.
    expect(linkStateFrom(error({ code: 'not_found', serverCode: 'SHARE_LINK_REVOKED' }))).toBe(
      'revoked',
    )
  })

  it('ignores a server code it does not recognize', () => {
    expect(linkStateFrom(error({ code: 'not_found', serverCode: 'SOMETHING_NEW' }))).toBe('missing')
  })
})

describe('isRecoverable', () => {
  it('offers a retry when the failure is transient', () => {
    // The positive case. Without it, hard-coding `false` — i.e. never offering
    // a retry to a student whose wifi dropped — passes every other assertion.
    expect(isRecoverable('unavailable', error({ code: 'server_error', retryable: true }))).toBe(true)
  })

  it('withholds a retry for a terminal link state, however it is reported', () => {
    // Retrying cannot resurrect a revoked or unpublished link; a button that
    // re-runs it teaches a student the app is broken rather than the link.
    for (const state of ['revoked', 'unpublished', 'missing'] as LinkState[]) {
      expect(isRecoverable(state, error({ code: 'not_found' }))).toBe(false)
    }
  })

  it('withholds a retry when the error itself is not retryable', () => {
    // 'unavailable' alone is not sufficient — this is the second half of the
    // condition, and dropping it lets a non-retryable failure offer a retry.
    expect(isRecoverable('unavailable', error({ code: 'forbidden', retryable: false }))).toBe(false)
  })
})

describe('linkCopy', () => {
  it('gives each state distinct, actionable copy', () => {
    const states: LinkState[] = ['revoked', 'unpublished', 'missing', 'unavailable']
    const titles = states.map((s) => linkCopy(s, error({ code: 'server_error' })).title)
    expect(new Set(titles).size).toBe(states.length)
  })

  it('tells a student with a revoked link to stop retyping it', () => {
    const copy = linkCopy('revoked', error({ serverCode: 'SHARE_LINK_REVOKED' }))
    expect(copy.body).toMatch(/ask them for a new one/i)
  })

  it('never leaks a server string into student-facing copy', () => {
    const leaky = new ApiError({
      code: 'not_found',
      message: 'pg: relation "share_links" does not exist',
      serverCode: 'SHARE_LINK_REVOKED',
    })
    const copy = linkCopy(linkStateFrom(leaky), leaky)
    expect(`${copy.title} ${copy.body}`).not.toMatch(/relation|pg:|share_links/)
  })
})
