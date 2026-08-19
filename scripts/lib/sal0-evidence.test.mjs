import { describe, expect, it } from 'vitest'

import {
  detectScheduleContext,
  detectVerificationLevel,
  summariseChange,
  VERIFICATION_LEVEL,
} from './sal0-evidence.mjs'

describe('detectScheduleContext', () => {
  it('trusts an explicit declaration', () => {
    expect(detectScheduleContext({ SAL0_SCHEDULE_CONTEXT: 'launchd' }, true)).toBe('launchd')
  })

  it('recognises CI environments', () => {
    expect(detectScheduleContext({ GITHUB_ACTIONS: 'true' }, false)).toBe('github-actions')
  })

  it('calls an interactive terminal manual', () => {
    expect(detectScheduleContext({}, true)).toBe('manual')
  })

  it('does not guess "scheduled" from a missing terminal', () => {
    // A human piping a command also has no TTY.
    expect(detectScheduleContext({}, false)).toBe('no-tty')
  })
})

describe('detectVerificationLevel', () => {
  it('degrades rather than upgrades when the context is unknown', () => {
    expect(detectVerificationLevel('no-tty')).toBe(VERIFICATION_LEVEL.UNKNOWN)
    expect(detectVerificationLevel('something-new')).toBe(VERIFICATION_LEVEL.UNKNOWN)
  })

  it('only claims scheduled for a real scheduler', () => {
    expect(detectVerificationLevel('launchd')).toBe(VERIFICATION_LEVEL.SCHEDULED)
    expect(detectVerificationLevel('github-actions')).toBe(VERIFICATION_LEVEL.SCHEDULED)
  })

  it('claims unattended only when nobody was present', () => {
    expect(detectVerificationLevel('launchd', { humanPresent: false })).toBe(
      VERIFICATION_LEVEL.UNATTENDED,
    )
  })

  it('never elevates a manual run', () => {
    expect(detectVerificationLevel('manual')).toBe(VERIFICATION_LEVEL.MANUAL)
  })
})

describe('summariseChange', () => {
  it('says NOTHING CHANGED in a shape that cannot be misread', () => {
    expect(summariseChange({ commitsCreated: [], filesChanged: [], artifacts: [] })).toBe(
      'NOTHING CHANGED',
    )
  })

  it('counts what actually changed', () => {
    const summary = summariseChange({
      commitsCreated: ['a'],
      filesChanged: ['x.ts', 'y.ts'],
      artifacts: ['packet.json'],
    })
    expect(summary).toContain('1 commit(s)')
    expect(summary).toContain('2 file(s) changed')
  })
})
