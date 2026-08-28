#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'

const REQUIRED_BINDINGS = new Map([
  ['GITHUB_TOKEN', 'secret_text'],
  ['MISSION_GATE', 'durable_object_namespace'],
  ['ALLOWED_ORIGINS', 'plain_text'],
  ['OWNER_EMAILS', 'plain_text'],
  ['ALLOW_SERVICE_TOKENS', 'plain_text'],
  ['TEAM_DOMAIN', 'plain_text'],
  ['POLICY_AUD', 'plain_text'],
  ['PUBLIC_SITE_URL', 'plain_text'],
  ['GITHUB_REPOSITORY', 'plain_text'],
  ['DEPLOYED_GIT_SHA', 'plain_text'],
  ['DEPLOYMENT_CANARY_ISSUE', 'plain_text'],
])

export function verifySecretList(secrets) {
  if (!Array.isArray(secrets)) return ['Wrangler secret list did not return an array']
  if (!secrets.some((secret) => secret?.name === 'GITHUB_TOKEN')) {
    return ['GITHUB_TOKEN is not configured on the deployed Worker']
  }
  return []
}

export function productionVersionId(deployment) {
  const versions = deployment?.versions
  if (!Array.isArray(versions) || versions.length !== 1 || versions[0]?.percentage !== 100) {
    return null
  }
  return typeof versions[0].version_id === 'string' ? versions[0].version_id : null
}

export function captureRollbackTarget(deployment) {
  const versionId = productionVersionId(deployment)
  if (!versionId) return null
  return { versionId, percentage: 100 }
}

export function rollbackVersionAfterProof(target, proofSucceeded) {
  if (proofSucceeded || typeof target?.versionId !== 'string' || target.percentage !== 100) {
    return null
  }
  return target.versionId
}

export function verifyRollbackRestored(deployment, target) {
  const restoredVersionId = productionVersionId(deployment)
  if (!restoredVersionId) {
    return ['rollback must restore exactly one Worker version at 100% traffic']
  }
  if (restoredVersionId !== target?.versionId) {
    return ['rollback did not restore the captured pre-deploy Worker version']
  }
  return []
}

export function verifyMissionControlDeployment(deployment, version, expectedSha) {
  const problems = []
  const activeVersionId = productionVersionId(deployment)
  if (!activeVersionId) {
    problems.push('production must route 100% of traffic to exactly one Worker version')
  } else if (version?.id !== activeVersionId) {
    problems.push('version details do not match the version receiving production traffic')
  }

  if (!/^[a-f0-9]{40}$/.test(expectedSha)) {
    problems.push('expected Git SHA is not a full 40-character commit')
  } else {
    const annotations = version?.annotations ?? {}
    if (annotations['workers/tag'] !== `github-${expectedSha}`) {
      problems.push('active Worker version tag does not match the checked-out Git commit')
    }
    if (annotations['workers/message'] !== `github:${expectedSha}`) {
      problems.push('active Worker version message does not match the checked-out Git commit')
    }
  }

  const bindings = version?.resources?.bindings
  if (!Array.isArray(bindings)) {
    problems.push('active Worker version did not expose binding metadata')
    return problems
  }

  const bindingTypes = new Map(bindings.map((binding) => [binding?.name, binding?.type]))
  for (const [name, expectedType] of REQUIRED_BINDINGS) {
    const actualType = bindingTypes.get(name)
    if (actualType !== expectedType) {
      problems.push(`${name} binding must be ${expectedType}; received ${actualType ?? 'missing'}`)
    }
  }

  return problems
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function report(problems, success) {
  if (problems.length === 0) {
    process.stdout.write(`${success}\n`)
    return 0
  }
  for (const problem of problems) console.error(`::error::${problem}`)
  return 1
}

const isMain = process.argv[1]?.endsWith('verify-mission-control-deployment.mjs')
if (isMain) {
  if (process.argv[2] === '--capture-rollback') {
    if (process.argv.length !== 5) {
      console.error(
        'usage: verify-mission-control-deployment.mjs --capture-rollback DEPLOYMENT_JSON TARGET_JSON',
      )
      process.exit(2)
    }
    const target = captureRollbackTarget(readJson(process.argv[3]))
    if (!target) {
      console.error(
        '::error::pre-deploy state must route 100% of traffic to exactly one Worker version',
      )
      process.exit(1)
    }
    writeFileSync(process.argv[4], `${JSON.stringify(target)}\n`, { mode: 0o600 })
    process.stdout.write(`Captured rollback target ${target.versionId} at 100% traffic\n`)
    process.exit(0)
  }

  if (process.argv[2] === '--rollback-version') {
    if (process.argv.length !== 4) {
      console.error('usage: verify-mission-control-deployment.mjs --rollback-version TARGET_JSON')
      process.exit(2)
    }
    const versionId = rollbackVersionAfterProof(readJson(process.argv[3]), false)
    if (!versionId) {
      console.error('::error::rollback target is invalid')
      process.exit(1)
    }
    process.stdout.write(versionId)
    process.exit(0)
  }

  if (process.argv[2] === '--verify-rollback') {
    if (process.argv.length !== 5) {
      console.error(
        'usage: verify-mission-control-deployment.mjs --verify-rollback DEPLOYMENT_JSON TARGET_JSON',
      )
      process.exit(2)
    }
    process.exit(
      report(
        verifyRollbackRestored(readJson(process.argv[3]), readJson(process.argv[4])),
        'Captured pre-deploy Worker version restored at 100% traffic',
      ),
    )
  }

  if (process.argv[2] === '--secrets') {
    if (process.argv.length !== 4) {
      console.error('usage: verify-mission-control-deployment.mjs --secrets SECRETS_JSON')
      process.exit(2)
    }
    process.exit(
      report(verifySecretList(readJson(process.argv[3])), 'GITHUB_TOKEN secret binding exists'),
    )
  }

  if (process.argv.length !== 6) {
    console.error(
      'usage: verify-mission-control-deployment.mjs DEPLOYMENT_JSON VERSION_JSON SECRETS_JSON GIT_SHA',
    )
    process.exit(2)
  }

  const deployment = readJson(process.argv[2])
  const version = readJson(process.argv[3])
  const secrets = readJson(process.argv[4])
  const problems = [
    ...verifySecretList(secrets),
    ...verifyMissionControlDeployment(deployment, version, process.argv[5]),
  ]
  process.exit(
    report(
      problems,
      `Mission Control commit ${process.argv[5]} is the sole production version with required bindings`,
    ),
  )
}
