#!/usr/bin/env node

const MISSION_CONTROL_ORIGIN = 'https://sal0mander-mission-control.samco1983.workers.dev'
const REPOSITORY = 'Samco1983/SAL0MANder-Web'
const PUBLIC_ORIGIN = 'https://samco1983.github.io'

export function verifyLiveDeploymentProof(payload, expectedSha, canaryIssue) {
  const expectedIssueUrl = `https://github.com/${REPOSITORY}/issues/${canaryIssue}`
  const problems = []
  if (!payload || typeof payload !== 'object') {
    return ['live Worker did not return a JSON object']
  }
  if (payload.deployedGitSha !== expectedSha) {
    problems.push('live Worker Git SHA does not match the deployed commit')
  }
  if (payload.repository !== REPOSITORY) {
    problems.push('live Worker wrote to an unexpected GitHub repository')
  }
  if (payload.canaryIssue !== canaryIssue || payload.issueUrl !== expectedIssueUrl) {
    problems.push('live Worker did not use the reserved deployment canary issue')
  }
  if (payload.commentCreated !== true || payload.commentDeleted !== true) {
    problems.push('live Worker did not create and remove its GitHub canary comment')
  }
  return problems
}

async function main() {
  const expectedSha = process.argv[2] ?? ''
  const canaryIssue = Number(process.argv[3])
  const clientId = process.env.CF_ACCESS_CLIENT_ID ?? ''
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET ?? ''
  if (
    !/^[a-f0-9]{40}$/.test(expectedSha) ||
    !Number.isSafeInteger(canaryIssue) ||
    canaryIssue < 1
  ) {
    console.error('usage: prove-live-mission-control.mjs GIT_SHA CANARY_ISSUE')
    return 2
  }
  if (!clientId || !clientSecret) {
    console.error('::error::Cloudflare Access service-token credentials are missing')
    return 1
  }

  const response = await fetch(`${MISSION_CONTROL_ORIGIN}/ops/deployment-proof`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: PUBLIC_ORIGIN,
      'CF-Access-Client-Id': clientId,
      'CF-Access-Client-Secret': clientSecret,
    },
    body: JSON.stringify({ expectedGitSha: expectedSha }),
  })
  if (response.status !== 200) {
    const redirect = response.headers.get('location')
    console.error(
      `::error::Known Mission Control URL returned HTTP ${response.status}${redirect ? ' through Cloudflare Access' : ''}`,
    )
    return 1
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    console.error('::error::Known Mission Control URL did not return JSON')
    return 1
  }
  const problems = verifyLiveDeploymentProof(payload, expectedSha, canaryIssue)
  for (const problem of problems) console.error(`::error::${problem}`)
  if (problems.length > 0) return 1

  console.log(
    `LIVE_PASS ${MISSION_CONTROL_ORIGIN} runs ${expectedSha} and its scoped GitHub token wrote then removed a canary comment`,
  )
  return 0
}

if (process.argv[1]?.endsWith('prove-live-mission-control.mjs')) {
  process.exit(await main())
}
