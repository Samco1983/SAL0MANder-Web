import { describe, expect, it } from 'vitest'

import { verifyLiveDeploymentProof } from './prove-live-mission-control.mjs'

const SHA = 'a'.repeat(40)
const ISSUE = 72
const proof = () => ({
  deployedGitSha: SHA,
  repository: 'Samco1983/SAL0MANder-Web',
  canaryIssue: ISSUE,
  issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/72',
  commentCreated: true,
  commentDeleted: true,
})

describe('live Mission Control proof', () => {
  it('accepts the exact Worker SHA and completed GitHub write cleanup', () => {
    expect(verifyLiveDeploymentProof(proof(), SHA, ISSUE)).toEqual([])
  })

  it('rejects a stale live Worker', () => {
    expect(verifyLiveDeploymentProof(proof(), 'b'.repeat(40), ISSUE).join(' ')).toMatch(/SHA/)
  })

  it('rejects a receipt for another repository or issue', () => {
    const current = proof()
    current.repository = 'someone/else'
    current.canaryIssue = 99
    expect(verifyLiveDeploymentProof(current, SHA, ISSUE).join(' ')).toMatch(
      /repository.*canary issue/,
    )
  })

  it('rejects a write that was not cleaned up', () => {
    const current = proof()
    current.commentDeleted = false
    expect(verifyLiveDeploymentProof(current, SHA, ISSUE).join(' ')).toMatch(/create and remove/)
  })
})
