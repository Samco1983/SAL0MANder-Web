import { describe, expect, it } from 'vitest'

import {
  productionVersionId,
  verifyMissionControlDeployment,
  verifySecretList,
} from './verify-mission-control-deployment.mjs'

const SHA = 'a'.repeat(40)
const VERSION_ID = '11111111-2222-3333-4444-555555555555'
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
