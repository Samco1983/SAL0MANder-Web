import { describe, expect, it } from 'vitest'

import {
  buildExecutePrompt,
  describeOutcome,
  EXECUTE_OUTCOME,
  isWebLane,
  screenAction,
  touchesForbiddenPath,
} from './sal0-execute.mjs'

const good = {
  owner: 'SAL0-04',
  action: 'Add a regression test asserting UnityStage stays mounted across a collapse.',
  successCheck: 'The new test fails when CompanionLayout remounts the stage.',
}

describe('lane screening', () => {
  it('accepts the web lane', () => {
    expect(isWebLane('SAL0-04')).toBe(true)
    expect(screenAction(good).allowed).toBe(true)
  })

  it('refuses Unity work instead of reassigning it', () => {
    const verdict = screenAction({ ...good, owner: 'SAL0-01' })
    expect(verdict.allowed).toBe(false)
    expect(verdict.outcome).toBe(EXECUTE_OUTCOME.WRONG_LANE)
  })

  it('refuses an action with no falsifiable check', () => {
    expect(screenAction({ ...good, successCheck: '' }).outcome).toBe(EXECUTE_OUTCOME.REFUSED)
    expect(screenAction({ ...good, successCheck: 'ok' }).outcome).toBe(EXECUTE_OUTCOME.REFUSED)
  })

  it('refuses a vague action', () => {
    expect(screenAction({ ...good, action: 'fix it' }).outcome).toBe(EXECUTE_OUTCOME.REFUSED)
  })

  it('refuses a missing action outright', () => {
    expect(screenAction(null).outcome).toBe(EXECUTE_OUTCOME.REFUSED)
  })
})

describe('forbidden paths', () => {
  it('catches the Unity repo, git internals, env files and credentials', () => {
    const hits = touchesForbiddenPath([
      'src/app/App.tsx',
      '/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype/Assets/x.cs',
      '.git/config',
      '.env.local',
      'auth.json',
    ])
    expect(hits).toHaveLength(4)
    expect(hits).not.toContain('src/app/App.tsx')
  })
})

describe('the execute prompt', () => {
  it('forbids proposals and scope creep, and withholds commit rights', () => {
    const prompt = buildExecutePrompt(good, 'packet summary')
    expect(prompt).toContain(good.action)
    expect(prompt).toContain(good.successCheck)
    expect(prompt).toMatch(/do not write a proposal/i)
    expect(prompt).toMatch(/do not commit/i)
    expect(prompt).toMatch(/exit code/i)
    expect(prompt).toMatch(/SAL0MANDER-Puzzle-Prototype/)
  })
})

describe('outcome reporting', () => {
  it('says NOTHING CHANGED in a shape that cannot be misread as success', () => {
    expect(describeOutcome({ outcome: EXECUTE_OUTCOME.NOTHING_CHANGED })).toMatch(/NOTHING CHANGED/)
  })

  it('says the tree was left dirty on purpose when blocked', () => {
    const line = describeOutcome({ outcome: EXECUTE_OUTCOME.BLOCKED, reason: 'verify exit 1' })
    expect(line).toMatch(/BLOCKED - NEED OWNER/)
    expect(line).toMatch(/dirty on purpose/)
  })

  it('names the commit when work landed', () => {
    const line = describeOutcome({
      outcome: EXECUTE_OUTCOME.COMMITTED,
      commit: 'abcdef1234567890',
      filesChanged: ['src/a.ts', 'src/b.ts'],
    })
    expect(line).toContain('abcdef12')
    expect(line).toContain('2 file(s)')
  })
})
