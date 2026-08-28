import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  captureRollbackTarget,
  productionVersionId,
  rollbackVersionAfterProof,
  verifyMissionControlDeployment,
  verifyRollbackRestored,
  verifySecretList,
} from './verify-mission-control-deployment.mjs'

const SHA = 'a'.repeat(40)
const VERSION_ID = '11111111-2222-3333-4444-555555555555'
const WORKFLOW = readFileSync(resolve('.github/workflows/deploy-worker.yml'), 'utf8')
const REQUIRED_BINDINGS = [
  { name: 'GITHUB_TOKEN', type: 'secret_text' },
  { name: 'MISSION_GATE', type: 'durable_object_namespace' },
  { name: 'ALLOWED_ORIGINS', type: 'plain_text' },
  { name: 'OWNER_EMAILS', type: 'plain_text' },
  { name: 'ALLOW_SERVICE_TOKENS', type: 'plain_text' },
  { name: 'TEAM_DOMAIN', type: 'plain_text' },
  { name: 'POLICY_AUD', type: 'plain_text' },
  { name: 'PUBLIC_SITE_URL', type: 'plain_text' },
  { name: 'GITHUB_REPOSITORY', type: 'plain_text' },
  { name: 'DEPLOYED_GIT_SHA', type: 'plain_text' },
  { name: 'DEPLOYMENT_CANARY_ISSUE', type: 'plain_text' },
]

const deployment = () => ({
  versions: [{ version_id: VERSION_ID, percentage: 100 }],
})
const version = () => ({
  id: VERSION_ID,
  annotations: {
    'workers/tag': `github-${SHA}`,
    'workers/message': `github:${SHA}`,
  },
  resources: { bindings: structuredClone(REQUIRED_BINDINGS) },
})

describe('Mission Control deployment proof', () => {
  it('accepts the exact commit at 100% with every required binding', () => {
    expect(verifyMissionControlDeployment(deployment(), version(), SHA)).toEqual([])
  })

  it('rejects split production traffic', () => {
    const current = deployment()
    current.versions.push({ version_id: 'other', percentage: 10 })
    current.versions[0].percentage = 90
    expect(verifyMissionControlDeployment(current, version(), SHA).join(' ')).toMatch(/100%/)
    expect(productionVersionId(current)).toBeNull()
  })

  it('rejects version details for a different deployment', () => {
    const current = version()
    current.id = 'different'
    expect(verifyMissionControlDeployment(deployment(), current, SHA).join(' ')).toMatch(
      /production traffic/,
    )
  })

  it('rejects a stale Git tag', () => {
    const current = version()
    current.annotations['workers/tag'] = `github-${'b'.repeat(40)}`
    expect(verifyMissionControlDeployment(deployment(), current, SHA).join(' ')).toMatch(/tag/)
  })

  it('rejects a missing runtime GitHub secret binding', () => {
    const current = version()
    current.resources.bindings = current.resources.bindings.filter(
      (binding) => binding.name !== 'GITHUB_TOKEN',
    )
    expect(verifyMissionControlDeployment(deployment(), current, SHA).join(' ')).toMatch(
      /GITHUB_TOKEN.*missing/,
    )
  })

  it('rejects a GitHub token exposed as plain text', () => {
    const current = version()
    current.resources.bindings.find((binding) => binding.name === 'GITHUB_TOKEN').type =
      'plain_text'
    expect(verifyMissionControlDeployment(deployment(), current, SHA).join(' ')).toMatch(
      /GITHUB_TOKEN.*secret_text/,
    )
  })

  it('requires the secret before deployment begins', () => {
    expect(verifySecretList([{ name: 'OTHER_SECRET', type: 'secret_text' }]).join(' ')).toMatch(
      /GITHUB_TOKEN/,
    )
    expect(verifySecretList([{ name: 'GITHUB_TOKEN', type: 'secret_text' }])).toEqual([])
  })
})

describe('Mission Control rollback safety', () => {
  it('captures only the sole pre-deploy version at 100% traffic', () => {
    expect(captureRollbackTarget(deployment())).toEqual({
      versionId: VERSION_ID,
      percentage: 100,
    })

    const split = deployment()
    split.versions[0].percentage = 90
    split.versions.push({ version_id: 'other', percentage: 10 })
    expect(captureRollbackTarget(split)).toBeNull()
    expect(captureRollbackTarget({ versions: [] })).toBeNull()
  })

  it('selects the exact captured version after a forced proof failure', () => {
    const target = captureRollbackTarget(deployment())
    expect(rollbackVersionAfterProof(target, false)).toBe(VERSION_ID)
    expect(rollbackVersionAfterProof(target, true)).toBeNull()
  })

  it('proves rollback restored the captured version and 100% traffic', () => {
    const target = captureRollbackTarget(deployment())
    expect(verifyRollbackRestored(deployment(), target)).toEqual([])

    expect(
      verifyRollbackRestored(
        { versions: [{ version_id: 'different', percentage: 100 }] },
        target,
      ).join(' '),
    ).toMatch(/captured pre-deploy/)

    expect(
      verifyRollbackRestored(
        {
          versions: [
            { version_id: VERSION_ID, percentage: 90 },
            { version_id: 'other', percentage: 10 },
          ],
        },
        target,
      ).join(' '),
    ).toMatch(/exactly one.*100%/)
  })

  it('wires capture before deploy and rollback verification after a failed proof', () => {
    const capture = WORKFLOW.indexOf('--capture-rollback')
    const deploy = WORKFLOW.indexOf('id: deploy')
    const rollback = WORKFLOW.indexOf("steps.deploy.outcome == 'success'")
    const verify = WORKFLOW.indexOf('--verify-rollback')

    expect(capture).toBeGreaterThan(-1)
    expect(deploy).toBeGreaterThan(capture)
    expect(rollback).toBeGreaterThan(deploy)
    expect(verify).toBeGreaterThan(rollback)
    expect(WORKFLOW).toContain('wrangler@4.126.0 rollback "$version_id" --yes')
  })

  it('pins credential-bearing setup actions to immutable commit SHAs', () => {
    expect(WORKFLOW).toContain(
      'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    )
    expect(WORKFLOW).toContain(
      'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    )
    expect(WORKFLOW).not.toMatch(/actions\/(checkout|setup-node)@v\d/)
  })
})
