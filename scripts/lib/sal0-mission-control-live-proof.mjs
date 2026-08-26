/**
 * Live proof that Mission Control's real dispatch code creates exactly one
 * bounded test mission, then retires it so the live Mission Log carries no
 * trace of it afterward.
 *
 * This calls the exact `githubMissionRequest()` function that ships in
 * `edge/mission-control/worker.js` -- the same code the deployed Cloudflare
 * Worker runs -- so a pass here proves the shipped dispatch/list/get contract
 * against a real GitHub repository, not a rebuilt approximation of it.
 */
import { randomUUID, createHash } from 'node:crypto'
import { githubMissionRequest } from '../../edge/mission-control/worker.js'

export class LiveProofError extends Error {}

function assert(condition, message) {
  if (!condition) throw new LiveProofError(message)
}

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function defaultLiveProofTitle(now = new Date()) {
  return `Mission Control live proof — ${now.toISOString()} — ${randomUUID().slice(0, 8)}`
}

export function parseIssueUrl(issueUrl) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/.exec(issueUrl ?? '')
  assert(match, `expected a github.com issue url, got: ${issueUrl}`)
  return { owner: match[1], repo: match[2], number: match[3] }
}

function retireIssuePayload(issueUrl) {
  return {
    state: 'closed',
    state_reason: 'not_planned',
    body: [
      'Live proof test mission created and retired by `npm run mission:live-proof`.',
      '',
      'The SAL0MANder mission marker was intentionally removed from this body so this',
      'issue no longer counts as a mission for Mission Control. It cannot block a real',
      'Fast Break or Championship possession, and it will not appear in the live',
      'Mission Log again.',
      '',
      `Original issue: ${issueUrl}`,
    ].join('\n'),
  }
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

/**
 * GitHub's issues *list* endpoint is a search-backed index and can lag a
 * write by a second or two; a direct single-issue GET does not have this
 * lag. Poll list_missions briefly rather than asserting on the very first
 * read, so a real propagation delay is not mistaken for a contract defect.
 */
async function pollListMissions(env, missionRequest, fetchGitHub, isReady, { attempts = 5, delayMs = 1000, sleep = wait } = {}) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await missionRequest(env, { operation: 'list_missions', source: 'owner_console' }, fetchGitHub)
    if (last.ok && isReady(last.body.missions)) return last
    if (attempt < attempts) await sleep(delayMs)
  }
  return last
}

/**
 * Runs the full bounded live-proof cycle: dispatch a new fast_break mission,
 * confirm it round-trips through list_missions and get_mission exactly once,
 * retire it, then confirm it is gone from the live Mission Log.
 *
 * `fetchGitHub` is injected so this same orchestration can be exercised in a
 * fast, deterministic unit test with a mocked transport, and re-run for real
 * against `gh api` by the CLI entry point.
 */
export async function runLiveProof(
  env,
  {
    fetchGitHub,
    missionRequest = githubMissionRequest,
    title = defaultLiveProofTitle(),
    now = () => new Date(),
    sleep = wait,
  },
) {
  const evidence = { title, steps: [] }
  const record = (step, detail) => evidence.steps.push({ step, ...detail })

  const idempotencyKey = `live-proof:${randomUUID()}`
  const requestFingerprint = sha256Hex(
    JSON.stringify({ action: 'fast_break', mission: { kind: 'new', title } }),
  )
  const requestedAtUtc = now().toISOString()

  const dispatch = await missionRequest(
    env,
    {
      operation: 'dispatch',
      action: 'fast_break',
      mission: { kind: 'new', title },
      idempotencyKey,
      requestFingerprint,
      reason: title,
      requestedAtUtc,
      source: 'owner_console',
    },
    fetchGitHub,
  )
  assert(dispatch.ok, `dispatch failed: ${dispatch.error ?? 'unknown error'}`)
  assert(dispatch.body?.accepted === true, 'dispatch did not report accepted:true')
  assert(dispatch.body.mission?.title === title, 'created mission title does not match the requested title')
  assert(
    dispatch.body.mission?.status === 'queued',
    `new mission started in status "${dispatch.body.mission?.status}", expected "queued"`,
  )
  const missionId = dispatch.body.mission.id
  const issueUrl = dispatch.body.externalUrl
  parseIssueUrl(issueUrl)
  record('dispatch', { missionId, issueUrl, idempotencyKey })

  const afterCreate = await pollListMissions(
    env,
    missionRequest,
    fetchGitHub,
    (missions) => missions.some((mission) => mission.id === missionId),
    { sleep },
  )
  assert(afterCreate.ok, `list_missions failed after create: ${afterCreate.error ?? 'unknown error'}`)
  const matches = afterCreate.body.missions.filter((mission) => mission.id === missionId)
  assert(
    matches.length === 1,
    `expected exactly one mission with id ${missionId} in the live Mission Log, found ${matches.length}`,
  )
  assert(
    matches[0].title === title && matches[0].status === 'queued',
    'the mission round-tripped through list_missions with a different shape than it was created with',
  )
  record('bounded_at_creation', { missionCount: matches.length })

  const single = await missionRequest(
    env,
    { operation: 'get_mission', missionId, source: 'owner_console' },
    fetchGitHub,
  )
  assert(single.ok, `get_mission failed: ${single.error ?? 'unknown error'}`)
  assert(single.body.mission?.id === missionId, 'get_mission returned a different mission id')
  assert(
    single.body.mission?.issueUrl === issueUrl,
    'get_mission returned a different issue url than dispatch reported',
  )
  record('single_mission_fetch', { missionId })

  const { owner, repo, number } = parseIssueUrl(issueUrl)
  const retire = await fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
    method: 'PATCH',
    body: JSON.stringify(retireIssuePayload(issueUrl)),
  })
  assert(retire.ok, `could not retire the test mission issue (status ${retire.status})`)
  record('retired', { issueUrl })

  const afterRetire = await pollListMissions(
    env,
    missionRequest,
    fetchGitHub,
    (missions) => !missions.some((mission) => mission.id === missionId),
    { sleep },
  )
  assert(afterRetire.ok, `list_missions failed after retiring: ${afterRetire.error ?? 'unknown error'}`)
  assert(
    !afterRetire.body.missions.some((mission) => mission.id === missionId),
    'the retired test mission is still visible in the live Mission Log — it is not actually bounded',
  )
  record('bounded_after_retirement', { missionId })

  return evidence
}

/**
 * Turns `gh api -i <path>` output (status line, headers, blank line, body)
 * into the minimal Response-shaped object `githubMissionRequest()` expects:
 * `.ok`, `.status`, `.headers.get()`, and an async `.json()`.
 */
export function parseGhApiOutput(stdout) {
  const lines = stdout.split('\n')
  const statusMatch = /^HTTP\/\S+\s+(\d{3})/.exec(lines[0] ?? '')
  assert(statusMatch, `unrecognized gh api response, no HTTP status line: ${JSON.stringify(lines[0] ?? '')}`)
  const status = Number(statusMatch[1])

  const headers = new Headers()
  let index = 1
  for (; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === '' || line === '\r') {
      index += 1
      break
    }
    const separator = line.indexOf(':')
    if (separator < 0) continue
    headers.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }
  const bodyText = lines.slice(index).join('\n').trim()

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    async json() {
      return bodyText.length > 0 ? JSON.parse(bodyText) : null
    },
  }
}
