import { createRemoteJWKSet, jwtVerify } from 'jose'

const ACTIONS = new Set(['fast_break', 'championship'])
const STATUSES = new Set([
  'queued',
  'active',
  'awaiting_verification',
  'verified',
  'rebound',
  'blocked',
])
const ACTIVE_STATUSES = new Set(['queued', 'active', 'awaiting_verification'])
const RATE_WINDOW_MS = 300_000
const RATE_MAX = 10
const IDEMPOTENCY_TTL_MS = 86_400_000
const PENDING_TTL_MS = 60_000
const POSSESSION_PROPAGATION_GRACE_MS = 300_000
const MISSION_LOG_CLOCK_SKEW_MS = 30_000
const GATE_NAME = 'owner-mission-control'
const DEFAULT_PUBLIC_SITE_URL = 'https://samco1983.github.io/SAL0MANder-Web'
const FORM_ACTION_PATH = '/ops/actions/form'
const FORM_CSRF_COOKIE = 'sal0_mc_csrf'
const FORM_TOKEN_PATTERN = /^[a-f0-9]{48}$/
const DEFAULT_GITHUB_REPOSITORY = 'Samco1983/SAL0MANder-Web'
const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_MAX_ISSUE_PAGES = 100
const GITHUB_MAX_MISSIONS = GITHUB_MAX_ISSUE_PAGES * 100
const MISSION_MARKER_PREFIX = '<!-- sal0-mission-control:v1'
const MISSION_MARKER_START = '<!-- sal0-mission-control:v1\n'
const MISSION_MARKER_END = '\n-->'
const jwksByDomain = new Map()

export default { fetch: handleRequest }

export async function handleRequest(request, env, dependencies = {}) {
  const url = new URL(request.url)
  const publicAppRequest = isPublicAppRequest(request, url, env)
  const cors = corsHeaders(request, env)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (!publicAppRequest && !isAllowedOrigin(request, env)) {
    return json({ error: 'origin_not_allowed' }, 403, cors)
  }

  const identity = await authenticateAccess(
    request,
    env,
    dependencies.verifyAccessToken ?? verifyAccessToken,
  )
  if (!identity) return json({ error: 'authentication_required' }, 401, cors)

  if (publicAppRequest) {
    return servePublicApp(
      request,
      env,
      dependencies.fetchPublicApp ?? fetch,
      dependencies.missionRequest ?? githubMissionRequest,
    )
  }

  if (request.method === 'POST' && url.pathname.endsWith(FORM_ACTION_PATH)) {
    return handleFormAction(request, env, identity)
  }

  if (request.method === 'GET' && url.pathname.endsWith('/ops/missions')) {
    const missionRequest = dependencies.missionRequest ?? githubMissionRequest
    const upstream = await missionRequest(env, {
      operation: 'list_missions',
      source: 'owner_console',
    })
    if (!upstream.ok) return json({ error: upstream.error }, upstream.status, cors)
    const log = normalizeMissionLog(upstream.body)
    return log ? json(log, 200, cors) : json({ error: 'invalid_upstream_contract' }, 502, cors)
  }

  if (request.method !== 'POST' || !url.pathname.endsWith('/ops/actions')) {
    return json({ error: 'not_found' }, 404, cors)
  }

  const gateResponse = await dispatchThroughGate(
    env,
    identity,
    await request.text(),
    request.headers.get('Idempotency-Key')?.trim() ?? '',
  )
  return withHeaders(gateResponse, cors)
}

async function dispatchThroughGate(env, identity, body, idempotencyKey) {
  if (!env.MISSION_GATE) return json({ error: 'dispatcher_unavailable' }, 503)
  const gateId = env.MISSION_GATE.idFromName(GATE_NAME)
  const gate = env.MISSION_GATE.get(gateId)
  return gate.fetch(
    new Request('https://mission-gate.internal/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Verified-Owner': identity,
      },
      body,
    }),
  )
}

async function handleFormAction(request, env, identity) {
  const requestUrl = new URL(request.url)
  if (request.headers.get('Origin') !== requestUrl.origin) {
    return formError('This launch must start from the protected Mission Control page.', 403, env)
  }

  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return formError('Mission Control could not read that launch request.', 415, env)
  }

  const encoded = await request.text()
  if (encoded.length > 2_048) {
    return formError('That launch request was too large.', 413, env)
  }

  const form = new URLSearchParams(encoded)
  const csrf = form.get('csrf') ?? ''
  const idempotencyKey = form.get('idempotencyKey') ?? ''
  const csrfCookie = readCookie(request.headers.get('Cookie') ?? '', FORM_CSRF_COOKIE)
  if (
    !FORM_TOKEN_PATTERN.test(csrf) ||
    !FORM_TOKEN_PATTERN.test(csrfCookie) ||
    !constantTimeEqual(csrf, csrfCookie)
  ) {
    return formError('Mission Control expired. Return to the console and try again.', 403, env)
  }
  if (!FORM_TOKEN_PATTERN.test(idempotencyKey)) {
    return formError('Mission Control rejected that launch request.', 400, env)
  }

  const missionReference = parseMissionReference(form.get('mission'))

  const action = normalizeAction({
    action: form.get('action'),
    mission:
      form.get('missionKind') === 'new'
        ? { kind: 'new', title: form.get('title') }
        : {
            kind: 'existing',
            id: form.get('id') || missionReference?.id,
            revision: form.get('revision') || missionReference?.revision,
          },
  })
  if (!action) return formError('Mission Control rejected that launch request.', 400, env)

  const gateResponse = await dispatchThroughGate(
    env,
    identity,
    JSON.stringify(action),
    `form:${idempotencyKey}:${action.action}`,
  )
  const result = await gateResponse.json().catch(() => null)
  const receiptUrl = result?.receipt?.url
  if (!gateResponse.ok || !isHttpUrl(receiptUrl)) {
    return formError(formFailureMessage(result?.error), gateResponse.status, env)
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: receiptUrl,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

function parseMissionReference(value) {
  try {
    const parsed = JSON.parse(value ?? '')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function formFailureMessage(error) {
  if (error === 'verification_required') {
    return 'Championship still needs fresh independent verification.'
  }
  if (error === 'possession_active' || error === 'possession_in_progress') {
    return 'Another mission already has possession.'
  }
  if (error === 'rate_limited') return 'Mission Control needs a short timeout before another shot.'
  if (error === 'mission_changed')
    return 'That mission changed. Return to the console to reload it.'
  return 'The dispatcher did not accept this launch.'
}

function formError(message, status, env) {
  const publicPath = normalizePublicSiteUrl(env.PUBLIC_SITE_URL)?.pathname ?? '/'
  const consoleUrl = `${publicPath}${publicPath.endsWith('/') ? '' : '/'}console`
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mission not launched</title><body><main><h1>Mission not launched</h1><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(consoleUrl)}">Return to Mission Control</a></p></main></body></html>`
  return new Response(body, {
    status: Math.max(400, Math.min(status || 500, 599)),
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export class MissionGate {
  constructor(state, env, dependencies = {}) {
    this.state = state
    this.env = env
    this.missionRequest = dependencies.missionRequest ?? githubMissionRequest
  }

  fetch(request) {
    return handleGateRequest(request, this.env, this.state.storage, this.missionRequest)
  }
}

export async function handleGateRequest(
  request,
  env,
  storage,
  missionRequest = githubMissionRequest,
) {
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404)
  const payload = await request.json().catch(() => null)
  const action = normalizeAction(payload)
  if (!action) return json({ error: 'invalid_action' }, 400)

  const owner = request.headers.get('X-Verified-Owner')?.trim() ?? ''
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? ''
  if (!owner || owner.length > 200) return json({ error: 'authentication_required' }, 401)
  if (!idempotencyKey || idempotencyKey.length > 300) {
    return json({ error: 'invalid_idempotency_key' }, 400)
  }

  const fingerprint = await sha256(JSON.stringify(action))
  const now = Date.now()
  let reservation = await reserveAction(storage, {
    fingerprint,
    idempotencyKey,
    now,
    owner,
    countRate: true,
  })

  if (reservation.kind === 'check_possession') {
    if (!reservation.possession.missionId) {
      return json({ error: 'possession_in_progress' }, 409)
    }
    const reconciliation = await reconcilePossession(
      reservation.possession,
      env,
      storage,
      now,
      missionRequest,
    )
    if (!reconciliation.ok) {
      return json(
        { error: reconciliation.error, ...(reconciliation.details ?? {}) },
        reconciliation.status,
      )
    }
    if (!reconciliation.cleared) {
      return json(
        {
          error: 'possession_in_progress',
          missionId: reservation.possession.missionId,
        },
        409,
      )
    }
    reservation = await reserveAction(storage, {
      fingerprint,
      idempotencyKey,
      now: Date.now(),
      owner,
      countRate: false,
    })
  }

  if (reservation.kind === 'conflict') return json({ error: 'idempotency_conflict' }, 409)
  if (reservation.kind === 'pending') return json({ error: 'request_in_progress' }, 409)
  if (reservation.kind === 'rate_limited') return json({ error: 'rate_limited' }, 429)
  if (reservation.kind === 'check_possession') {
    return json(
      {
        error: 'possession_in_progress',
        missionId: reservation.possession.missionId,
      },
      409,
    )
  }
  if (reservation.kind === 'duplicate') {
    return json({ ...reservation.result, outcome: 'duplicate' }, 200)
  }

  const cleanup = async () => {
    await storage.transaction(async (transaction) => {
      const possession = await transaction.get('possession')
      if (possession?.idempotencyKey === idempotencyKey) {
        await transaction.delete('possession')
      }
      await transaction.delete(`idem:${idempotencyKey}`)
    })
  }

  const execution = await executeAction(
    action,
    idempotencyKey,
    fingerprint,
    reservation.reservedAt,
    env,
    missionRequest,
  )
  if (!execution.ok) {
    await cleanup()
    return json({ error: execution.error, ...(execution.details ?? {}) }, execution.status)
  }

  const result = execution.result
  await storage.transaction(async (transaction) => {
    const completedAt = Date.now()
    await transaction.put(`idem:${idempotencyKey}`, {
      state: 'complete',
      fingerprint,
      result,
      createdAt: completedAt,
    })
    await transaction.put('possession', {
      idempotencyKey,
      missionId: result.mission.id,
      startedAt: completedAt,
    })
  })
  return json(result, 200)
}

async function reserveAction(storage, { fingerprint, idempotencyKey, now, owner, countRate }) {
  return storage.transaction(async (transaction) => {
    const idempotencyStorageKey = `idem:${idempotencyKey}`
    const existing = await transaction.get(idempotencyStorageKey)
    const existingTtl = existing?.state === 'pending' ? PENDING_TTL_MS : IDEMPOTENCY_TTL_MS
    if (existing && now - existing.createdAt < existingTtl) {
      if (existing.fingerprint !== fingerprint) return { kind: 'conflict' }
      if (existing.state === 'complete') return { kind: 'duplicate', result: existing.result }
      return { kind: 'pending' }
    }
    if (existing) await transaction.delete(idempotencyStorageKey)

    const rateKey = `rate:${owner}`
    const rate = await transaction.get(rateKey)
    const currentRate =
      rate && now - rate.windowStartedAt < RATE_WINDOW_MS
        ? rate
        : { count: 0, windowStartedAt: now }
    if (countRate && currentRate.count >= RATE_MAX) return { kind: 'rate_limited' }
    if (countRate) {
      await transaction.put(rateKey, {
        count: currentRate.count + 1,
        windowStartedAt: currentRate.windowStartedAt,
      })
    }

    const possession = await transaction.get('possession')
    if (possession) {
      const abandonedReservation =
        !possession.missionId && now - possession.startedAt >= PENDING_TTL_MS
      if (abandonedReservation) await transaction.delete('possession')
      else return { kind: 'check_possession', possession }
    }

    await transaction.put(idempotencyStorageKey, {
      state: 'pending',
      fingerprint,
      createdAt: now,
    })
    await transaction.put('possession', { idempotencyKey, startedAt: now })
    return { kind: 'reserved', reservedAt: now }
  })
}

async function reconcilePossession(possession, env, storage, now, missionRequest) {
  const current = await missionRequest(env, {
    operation: 'list_missions',
    source: 'owner_console',
  })
  const log = current.ok ? normalizeMissionLog(current.body, now) : null
  if (!log) {
    return {
      ok: false,
      error: current.ok ? 'invalid_upstream_contract' : current.error,
      status: current.ok ? 502 : current.status,
    }
  }

  const active = log.missions.find((mission) => ACTIVE_STATUSES.has(mission.status))
  const observed = log.missions.find((mission) => mission.id === possession.missionId)
  const withinPropagationGrace = now - possession.startedAt < POSSESSION_PROPAGATION_GRACE_MS
  if (active || (!observed && withinPropagationGrace)) {
    return {
      ok: true,
      cleared: false,
      details: { missionId: active?.id ?? possession.missionId },
    }
  }

  await storage.transaction(async (transaction) => {
    const latest = await transaction.get('possession')
    if (
      latest?.idempotencyKey === possession.idempotencyKey &&
      latest?.missionId === possession.missionId
    ) {
      await transaction.delete('possession')
    }
  })
  return { ok: true, cleared: true }
}

async function executeAction(
  action,
  idempotencyKey,
  requestFingerprint,
  reservedAt,
  env,
  missionRequest,
) {
  let mission
  if (action.mission.kind === 'existing') {
    const current = await missionRequest(env, {
      operation: 'get_mission',
      missionId: action.mission.id,
      source: 'owner_console',
    })
    mission = current.ok ? normalizeMission(current.body?.mission) : null
    if (!mission) {
      return {
        ok: false,
        error: current.ok ? 'invalid_upstream_contract' : current.error,
        status: current.ok ? 502 : current.status,
      }
    }
    if (mission.updatedAtUtc !== action.mission.revision) {
      return { ok: false, error: 'mission_changed', status: 409 }
    }
  }

  if (action.action === 'championship' && !championshipReady(mission)) {
    return { ok: false, error: 'verification_required', status: 409 }
  }

  if (action.action === 'fast_break') {
    const current = await missionRequest(env, {
      operation: 'list_missions',
      source: 'owner_console',
    })
    const log = current.ok ? normalizeMissionLog(current.body, reservedAt) : null
    if (!log) {
      return {
        ok: false,
        error: current.ok ? 'invalid_upstream_contract' : current.error,
        status: current.ok ? 502 : current.status,
      }
    }
    const active = log.missions.find((item) => ACTIVE_STATUSES.has(item.status))
    if (active && active.id !== mission?.id) {
      return {
        ok: false,
        error: 'possession_active',
        status: 409,
        details: { missionId: active.id },
      }
    }
  }

  const requestedAtUtc = new Date().toISOString()
  const reason =
    action.mission.kind === 'new'
      ? action.mission.title
      : `${action.action} for mission ${action.mission.id}`
  const dispatched = await missionRequest(env, {
    operation: 'dispatch',
    action: action.action,
    mission: action.mission,
    idempotencyKey,
    requestFingerprint,
    reason,
    requestedAtUtc,
    source: 'owner_console',
  })
  if (!dispatched.ok) return { ok: false, error: dispatched.error, status: dispatched.status }

  const receipt = normalizeReceipt(dispatched.body, {
    action,
    currentMission: mission,
    idempotencyKey,
    requestFingerprint,
  })
  if (!receipt) return { ok: false, error: 'invalid_upstream_receipt', status: 502 }
  return {
    ok: true,
    result: {
      outcome: 'queued',
      action: action.action,
      mission: receipt.mission,
      receipt: receipt.receipt,
    },
  }
}

export function normalizeAction(payload) {
  if (!payload || typeof payload !== 'object' || !ACTIONS.has(payload.action)) return null
  const mission = payload.mission
  if (!mission || typeof mission !== 'object') return null

  if (mission.kind === 'new') {
    const title = typeof mission.title === 'string' ? mission.title.trim() : ''
    if (payload.action !== 'fast_break' || title.length < 3 || title.length > 160) return null
    return { action: payload.action, mission: { kind: 'new', title } }
  }

  if (mission.kind === 'existing') {
    const id = typeof mission.id === 'string' ? mission.id.trim() : ''
    const revision = typeof mission.revision === 'string' ? mission.revision : ''
    if (!id || id.length > 80 || !isIsoDate(revision)) return null
    return { action: payload.action, mission: { kind: 'existing', id, revision } }
  }

  return null
}

export function championshipReady(mission) {
  const proof = mission?.proof
  return Boolean(
    mission?.status === 'verified' &&
    proof?.command &&
    proof?.artifact &&
    proof?.builder &&
    proof?.verifier &&
    proof.builder !== proof.verifier &&
    proof.missionRevision === mission.updatedAtUtc &&
    Date.parse(proof.verifiedAtUtc) >= Date.parse(mission.updatedAtUtc),
  )
}

function normalizeMissionLog(body, minimumFetchedAt = 0) {
  if (
    !body ||
    body.source !== 'github' ||
    !Array.isArray(body.missions) ||
    body.missions.length > GITHUB_MAX_MISSIONS ||
    !isIsoDate(body.fetchedAtUtc) ||
    Date.parse(body.fetchedAtUtc) < minimumFetchedAt - MISSION_LOG_CLOCK_SKEW_MS
  ) {
    return null
  }
  const missionValues = body.missions.filter((mission) => !isEmptyRecord(mission))
  const missions = missionValues.map(normalizeMission)
  if (missions.some((mission) => mission === null)) return null
  return { missions, fetchedAtUtc: body.fetchedAtUtc, source: 'github' }
}

function isEmptyRecord(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
}

function normalizeMission(value) {
  if (!value || typeof value !== 'object') return null
  const id = boundedString(value.id, 1, 80)
  const title = boundedString(value.title, 1, 160)
  if (
    !id ||
    !title ||
    !STATUSES.has(value.status) ||
    !isIsoDate(value.updatedAtUtc) ||
    !isHttpUrl(value.issueUrl)
  ) {
    return null
  }
  const mission = {
    id,
    title,
    status: value.status,
    updatedAtUtc: value.updatedAtUtc,
    issueUrl: value.issueUrl,
  }
  const proof = value.proof ? normalizeProof(value.proof) : null
  if (value.proof && !proof) return null
  if (proof) mission.proof = proof
  if (mission.status === 'verified' && !championshipReady(mission)) return null
  return mission
}

function normalizeProof(value) {
  if (!value || typeof value !== 'object') return null
  const command = boundedString(value.command, 1, 500)
  const artifact = boundedString(value.artifact, 1, 200)
  const builder = boundedString(value.builder, 1, 80)
  const verifier = boundedString(value.verifier, 1, 80)
  if (
    !command ||
    !artifact ||
    !builder ||
    !verifier ||
    builder === verifier ||
    !isIsoDate(value.missionRevision) ||
    !isIsoDate(value.verifiedAtUtc)
  ) {
    return null
  }
  return {
    command,
    artifact,
    builder,
    verifier,
    missionRevision: value.missionRevision,
    verifiedAtUtc: value.verifiedAtUtc,
  }
}

function normalizeReceipt(body, { action, currentMission, idempotencyKey, requestFingerprint }) {
  const externalId = boundedString(body?.externalId, 1, 200)
  if (
    body?.accepted !== true ||
    body?.idempotencyKey !== idempotencyKey ||
    body?.requestFingerprint !== requestFingerprint ||
    !externalId ||
    !isHttpUrl(body.externalUrl) ||
    !isIsoDate(body.receivedAt)
  ) {
    return null
  }
  const mission = normalizeMission(body.mission)
  if (!mission) return null
  if (body.externalUrl !== mission.issueUrl) return null
  if (action.mission.kind === 'existing') {
    if (
      !currentMission ||
      mission.id !== action.mission.id ||
      mission.title !== currentMission.title ||
      mission.issueUrl !== currentMission.issueUrl ||
      action.mission.revision !== currentMission.updatedAtUtc ||
      Date.parse(mission.updatedAtUtc) < Date.parse(currentMission.updatedAtUtc)
    ) {
      return null
    }
  } else if (mission.title !== action.mission.title) {
    return null
  }
  return {
    mission: { id: mission.id, title: mission.title, status: mission.status },
    receipt: { id: externalId, url: body.externalUrl, receivedAtUtc: body.receivedAt },
  }
}

export async function githubMissionRequest(env, body, fetchGitHub = fetch) {
  const config = githubConfig(env)
  if (!config) return { ok: false, status: 503, error: 'dispatcher_unavailable' }

  if (body.operation === 'list_missions') {
    const response = await listGithubIssues(config, fetchGitHub)
    if (!response.ok) return response
    const missions = []
    for (const issue of response.body) {
      if (issue?.pull_request || !hasMissionMarker(issue?.body)) continue
      const mission = missionFromIssue(issue)
      if (!mission) return { ok: false, status: 502, error: 'invalid_upstream_contract' }
      missions.push(mission)
    }
    return {
      ok: true,
      status: 200,
      body: { missions, fetchedAtUtc: new Date().toISOString(), source: 'github' },
    }
  }

  if (body.operation === 'get_mission') {
    const issueNumber = missionIssueNumber(body.missionId)
    if (!issueNumber) return { ok: false, status: 404, error: 'mission_not_found' }
    const response = await githubRequest(
      config,
      `/repos/${config.repository}/issues/${issueNumber}`,
      {},
      fetchGitHub,
    )
    if (!response.ok) return response
    const mission = missionFromIssue(response.body)
    return mission
      ? { ok: true, status: 200, body: { mission } }
      : { ok: false, status: 502, error: 'invalid_upstream_contract' }
  }

  if (body.operation !== 'dispatch') {
    return { ok: false, status: 400, error: 'invalid_operation' }
  }

  const dispatchedAt = isIsoDate(body.requestedAtUtc)
    ? body.requestedAtUtc
    : new Date().toISOString()
  let issueNumber = null
  let currentMission = null
  if (body.mission?.kind === 'existing') {
    issueNumber = missionIssueNumber(body.mission.id)
    if (!issueNumber) return { ok: false, status: 404, error: 'mission_not_found' }
    const current = await githubRequest(
      config,
      `/repos/${config.repository}/issues/${issueNumber}`,
      {},
      fetchGitHub,
    )
    if (!current.ok) return current
    currentMission = missionFromIssue(current.body)
    if (!currentMission) {
      return { ok: false, status: 502, error: 'invalid_upstream_contract' }
    }
    if (currentMission.updatedAtUtc !== body.mission.revision) {
      return { ok: false, status: 409, error: 'mission_changed' }
    }
  }

  const title = currentMission?.title ?? boundedString(body.mission?.title, 3, 160)
  if (!title) return { ok: false, status: 400, error: 'invalid_mission' }
  const envelope = {
    action: body.action,
    idempotencyKey: body.idempotencyKey,
    requestFingerprint: body.requestFingerprint,
    requestedAtUtc: dispatchedAt,
    source: 'owner_console',
    mission: {
      title,
      status: 'queued',
      updatedAtUtc: dispatchedAt,
    },
  }
  const issueInput = {
    title: missionIssueTitle(body.action, title),
    body: missionIssueBody(envelope),
    ...(issueNumber ? { state: 'open' } : {}),
  }
  const response = await githubRequest(
    config,
    issueNumber
      ? `/repos/${config.repository}/issues/${issueNumber}`
      : `/repos/${config.repository}/issues`,
    { method: issueNumber ? 'PATCH' : 'POST', body: JSON.stringify(issueInput) },
    fetchGitHub,
  )
  if (!response.ok) return response
  if (!Number.isSafeInteger(response.body?.id) || response.body.id < 1) {
    return { ok: false, status: 502, error: 'invalid_upstream_contract' }
  }
  const mission = missionFromIssue(response.body)
  if (!mission) return { ok: false, status: 502, error: 'invalid_upstream_contract' }
  return {
    ok: true,
    status: 200,
    body: {
      accepted: true,
      idempotencyKey: body.idempotencyKey,
      requestFingerprint: body.requestFingerprint,
      externalId: String(response.body.id),
      externalUrl: mission.issueUrl,
      receivedAt: dispatchedAt,
      mission,
    },
  }
}

async function listGithubIssues(config, fetchGitHub) {
  let path = `/repos/${config.repository}/issues?state=all&per_page=100&sort=updated&direction=desc`
  const issues = []
  for (let page = 0; page < GITHUB_MAX_ISSUE_PAGES; page += 1) {
    const response = await githubRequest(config, path, {}, fetchGitHub)
    if (!response.ok) return response
    if (!Array.isArray(response.body)) {
      return { ok: false, status: 502, error: 'invalid_upstream_contract' }
    }
    issues.push(...response.body)
    const pagination = nextGithubIssuePage(
      response.headers?.get('Link'),
      config.repository,
    )
    if (pagination.kind === 'invalid') {
      return { ok: false, status: 502, error: 'invalid_upstream_contract' }
    }
    if (pagination.kind === 'none') return { ok: true, status: 200, body: issues }
    path = pagination.path
  }
  return { ok: false, status: 502, error: 'invalid_upstream_contract' }
}

function nextGithubIssuePage(linkHeader, repository) {
  if (!linkHeader) return { kind: 'none' }
  for (const part of linkHeader.split(',')) {
    const match = /^\s*<([^>]+)>;\s*rel="([^"]+)"\s*$/.exec(part)
    if (!match) return { kind: 'invalid' }
    if (!match[2].split(/\s+/).includes('next')) continue
    try {
      const url = new URL(match[1])
      if (
        url.origin !== GITHUB_API_ROOT ||
        url.pathname !== `/repos/${repository}/issues` ||
        !url.searchParams.has('page')
      ) {
        return { kind: 'invalid' }
      }
      return { kind: 'next', path: `${url.pathname}${url.search}` }
    } catch {
      return { kind: 'invalid' }
    }
  }
  return { kind: 'none' }
}

function githubConfig(env) {
  const token = boundedString(env.GITHUB_TOKEN, 1, 500)
  const repository = boundedString(
    env.GITHUB_REPOSITORY || DEFAULT_GITHUB_REPOSITORY,
    3,
    200,
  )
  if (!token || !repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return null
  }
  return { token, repository }
}

async function githubRequest(config, path, init, fetchGitHub) {
  try {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/vnd.github+json')
    headers.set('Authorization', `Bearer ${config.token}`)
    headers.set('X-GitHub-Api-Version', GITHUB_API_VERSION)
    headers.set('User-Agent', 'SAL0MANder-Mission-Control')
    if (init.body) headers.set('Content-Type', 'application/json')
    const response = await fetchGitHub(`${GITHUB_API_ROOT}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const status = response.status === 404 ? 404 : 502
      return {
        ok: false,
        status,
        error: response.status === 404 ? 'mission_not_found' : 'upstream_failed',
      }
    }
    return { ok: true, status: 200, body: await response.json(), headers: response.headers }
  } catch {
    return { ok: false, status: 504, error: 'upstream_unreachable' }
  }
}

function hasMissionMarker(value) {
  return typeof value === 'string' && value.includes(MISSION_MARKER_PREFIX)
}

function missionFromIssue(issue) {
  if (
    !issue ||
    typeof issue !== 'object' ||
    issue.pull_request ||
    !Number.isInteger(issue.number) ||
    issue.number < 1 ||
    !isHttpUrl(issue.html_url)
  ) {
    return null
  }
  const envelope = missionEnvelope(issue.body)
  if (!envelope?.mission) return null
  const missionValue = {
    id: `mission-${issue.number}`,
    title: envelope.mission.title,
    status:
      issue.state === 'closed' && ['queued', 'active'].includes(envelope.mission.status)
        ? 'awaiting_verification'
        : envelope.mission.status,
    updatedAtUtc:
      issue.state === 'closed' && ['queued', 'active'].includes(envelope.mission.status)
        ? issue.updated_at
        : envelope.mission.updatedAtUtc,
    issueUrl: issue.html_url,
    ...(envelope.mission.proof ? { proof: envelope.mission.proof } : {}),
  }
  return normalizeMission(missionValue)
}

function missionEnvelope(value) {
  if (typeof value !== 'string') return null
  const start = value.indexOf(MISSION_MARKER_START)
  if (start < 0) return null
  const contentStart = start + MISSION_MARKER_START.length
  const end = value.indexOf(MISSION_MARKER_END, contentStart)
  if (end < 0) return null
  try {
    const envelope = JSON.parse(value.slice(contentStart, end))
    return envelope && typeof envelope === 'object' ? envelope : null
  } catch {
    return null
  }
}

function missionIssueBody(envelope) {
  const actionLabel = envelope.action === 'championship' ? 'Championship' : 'Fast Break'
  return [
    '## SAL0MANder mission',
    '',
    `**Play:** ${actionLabel}`,
    `**Outcome:** ${envelope.mission.title}`,
    `**Status:** ${envelope.mission.status}`,
    '',
    'This issue is the durable mission ledger. The builder must leave rerunnable evidence,',
    'and an independent verifier must confirm the exact artifact before Championship.',
    '',
    `${MISSION_MARKER_START}${JSON.stringify(envelope)}${MISSION_MARKER_END}`,
  ].join('\n')
}

function missionIssueTitle(action, title) {
  return action === 'championship'
    ? `[CHAMPIONSHIP][WEB] ${title}`
    : `[OVERNIGHT][WEB] ${title}`
}

function missionIssueNumber(missionId) {
  const match = typeof missionId === 'string' ? /^mission-(\d+)$/.exec(missionId) : null
  const number = match ? Number(match[1]) : 0
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

async function authenticateAccess(request, env, verifier) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) return null
  try {
    const claims = await verifier(token, env)
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : ''
    const owners = (env.OWNER_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    if (email && owners.includes(email)) return `user:${email}`
    if (env.ALLOW_SERVICE_TOKENS === 'true' && !email) {
      const serviceIdentity = boundedString(claims.common_name ?? claims.sub, 1, 160)
      if (serviceIdentity) return `service:${serviceIdentity}`
    }
  } catch {
    return null
  }
  return null
}

async function verifyAccessToken(token, env) {
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN)
  if (!teamDomain) throw new Error('invalid team domain')
  let jwks = jwksByDomain.get(teamDomain)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    jwksByDomain.set(teamDomain, jwks)
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: teamDomain,
    audience: env.POLICY_AUD,
  })
  return payload
}

function normalizeTeamDomain(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudflareaccess.com')) return null
    return url.origin
  } catch {
    return null
  }
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  if (!origin) return request.method === 'GET'
  if (origin === new URL(request.url).origin) return true
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin)
}

function isPublicAppRequest(request, url, env) {
  if (request.method !== 'GET') return false
  const publicSiteUrl = normalizePublicSiteUrl(env.PUBLIC_SITE_URL)
  return Boolean(publicSiteUrl && url.pathname.startsWith(`${publicSiteUrl.pathname}/`))
}

async function servePublicApp(request, env, fetchPublicApp, missionRequest) {
  const publicSiteUrl = normalizePublicSiteUrl(env.PUBLIC_SITE_URL)
  if (!publicSiteUrl) return json({ error: 'console_unavailable' }, 503)

  const requestUrl = new URL(request.url)
  const lastSegment = requestUrl.pathname.split('/').pop() ?? ''
  const isDocumentRoute = !lastSegment.includes('.')
  const isConsoleRoute = isDocumentRoute && requestUrl.pathname.endsWith('/console')
  const upstreamUrl = new URL(
    isDocumentRoute ? `${publicSiteUrl.href}/` : `${publicSiteUrl.origin}${requestUrl.pathname}`,
  )
  if (!isDocumentRoute) upstreamUrl.search = requestUrl.search

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let upstream
  try {
    upstream = await fetchPublicApp(upstreamUrl, {
      headers: { Accept: request.headers.get('Accept') ?? '*/*' },
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch {
    return json({ error: 'console_unreachable' }, 504)
  } finally {
    clearTimeout(timeout)
  }

  const headers = new Headers(upstream.headers)
  headers.delete('Set-Cookie')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  if (isDocumentRoute) headers.set('Cache-Control', 'private, no-store')

  if (isConsoleRoute && upstream.ok) {
    const current = await missionRequest(env, {
      operation: 'list_missions',
      source: 'owner_console',
    })
    const missionLog = current.ok ? normalizeMissionLog(current.body) : null
    const contentType = headers.get('Content-Type') ?? ''
    if (missionLog && contentType.includes('text/html')) {
      const csrf = createFormToken()
      const idempotencyKey = createFormToken()
      const html = injectMissionBootstrap(await upstream.text(), {
        missionLog,
        actionForm: { url: FORM_ACTION_PATH, csrf, idempotencyKey },
      })
      headers.delete('Content-Length')
      headers.delete('Content-Encoding')
      headers.delete('ETag')
      headers.delete('Last-Modified')
      headers.set(
        'Set-Cookie',
        `${FORM_CSRF_COOKIE}=${csrf}; Path=${FORM_ACTION_PATH}; Max-Age=600; Secure; HttpOnly; SameSite=Strict`,
      )
      return new Response(html, { status: upstream.status, headers })
    }
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}

function createFormToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function injectMissionBootstrap(html, bootstrap) {
  const serialized = JSON.stringify(bootstrap)
    .replaceAll('<', '\\u003c')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
  const element = `${renderNativeConsole(bootstrap)}<script id="sal0-mission-control-bootstrap" type="application/json">${serialized}</script>`
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${element}</body>`)
    : `${html}${element}`
}

function renderNativeConsole({ missionLog, actionForm }) {
  const missions = missionLog.missions
  const verified = missions.filter((mission) => championshipReady(mission))
  const options = missions.map((mission) => missionOption(mission)).join('')
  const verifiedOptions = verified.map((mission) => missionOption(mission)).join('')
  const common = `<input type="hidden" name="csrf" value="${actionForm.csrf}"><input type="hidden" name="idempotencyKey" value="${actionForm.idempotencyKey}">`
  const hasMissions = missions.length > 0

  return `<section id="sal0-mission-control-native" class="sal0-native" aria-labelledby="sal0-native-title"><style>.sal0-native{box-sizing:border-box;max-width:52rem;margin:2rem auto;padding:1.25rem;font-family:system-ui,sans-serif;color:#171717;background:#fff;border:1px solid #d4d4d4;border-radius:8px}.sal0-native *{box-sizing:border-box;letter-spacing:0}.sal0-native h1{margin:0 0 1rem;font-size:1.5rem}.sal0-native form{display:grid;gap:.75rem;margin-top:1rem}.sal0-native label{font-weight:650}.sal0-native select,.sal0-native input[type=text]{width:100%;min-height:2.75rem;padding:.55rem .7rem;border:1px solid #737373;border-radius:6px;background:#fff;color:#171717;font:inherit}.sal0-native .choice{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:.5rem}.sal0-native button{min-height:2.75rem;padding:.55rem .9rem;border:1px solid #171717;border-radius:6px;background:#171717;color:#fff;font:700 1rem system-ui,sans-serif;cursor:pointer}.sal0-native button.secondary{background:#fff;color:#171717}.sal0-native button:disabled{cursor:not-allowed;opacity:.55}@media(max-width:40rem){.sal0-native{margin:1rem;padding:1rem}}</style><h1 id="sal0-native-title">Mission Control</h1><form action="${actionForm.url}" method="post">${common}<label class="choice"><input type="radio" name="missionKind" value="existing"${hasMissions ? ' checked' : ' disabled'}><span>Existing mission</span></label><select name="mission" aria-label="Existing mission"${hasMissions ? '' : ' disabled'}>${options}</select><label class="choice"><input type="radio" name="missionKind" value="new"${hasMissions ? '' : ' checked'}><span>New mission</span></label><label for="sal0-native-title-input">Outcome</label><input id="sal0-native-title-input" type="text" name="title" maxlength="160" autocomplete="off"><button type="submit" name="action" value="fast_break">Run Fast Break</button></form><form action="${actionForm.url}" method="post">${common}<input type="hidden" name="missionKind" value="existing"><label for="sal0-native-championship">Verified mission</label><select id="sal0-native-championship" name="mission"${verified.length ? '' : ' disabled'}>${verifiedOptions}</select><button class="secondary" type="submit" name="action" value="championship"${verified.length ? '' : ' disabled'}>Championship</button></form></section>`
}

function missionOption(mission) {
  const value = escapeHtml(JSON.stringify({ id: mission.id, revision: mission.updatedAtUtc }))
  const status = mission.status.replaceAll('_', ' ')
  return `<option value="${value}">${escapeHtml(mission.title)} - ${escapeHtml(status)}</option>`
}

function normalizePublicSiteUrl(value) {
  try {
    const url = new URL(value || DEFAULT_PUBLIC_SITE_URL)
    if (url.protocol !== 'https:') return null
    url.hash = ''
    url.search = ''
    url.pathname = url.pathname.replace(/\/$/, '')
    return url
  } catch {
    return null
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(request, env) ? origin : 'null',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, X-SAL0MANder-Contract',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function withHeaders(response, additionalHeaders) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(additionalHeaders)) headers.set(key, value)
  return new Response(response.body, { status: response.status, headers })
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function isIsoDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

function boundedString(value, min, max) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length >= min && normalized.length <= max ? normalized : null
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function readCookie(header, name) {
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return ''
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
