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
    return servePublicApp(request, env, dependencies.fetchPublicApp ?? fetch)
  }

  if (request.method === 'GET' && url.pathname.endsWith('/ops/missions')) {
    const upstream = await makeRequest(env, { operation: 'list_missions', source: 'owner_console' })
    if (!upstream.ok) return json({ error: upstream.error }, upstream.status, cors)
    const log = normalizeMissionLog(upstream.body)
    return log ? json(log, 200, cors) : json({ error: 'invalid_upstream_contract' }, 502, cors)
  }

  if (request.method !== 'POST' || !url.pathname.endsWith('/ops/actions')) {
    return json({ error: 'not_found' }, 404, cors)
  }

  if (!env.MISSION_GATE) return json({ error: 'dispatcher_unavailable' }, 503, cors)
  const gateId = env.MISSION_GATE.idFromName(GATE_NAME)
  const gate = env.MISSION_GATE.get(gateId)
  const headers = new Headers(request.headers)
  headers.set('X-Verified-Owner', identity)
  const gateResponse = await gate.fetch(
    new Request('https://mission-gate.internal/actions', {
      method: 'POST',
      headers,
      body: await request.text(),
    }),
  )
  return withHeaders(gateResponse, cors)
}

export class MissionGate {
  constructor(state, env) {
    this.state = state
    this.env = env
  }

  fetch(request) {
    return handleGateRequest(request, this.env, this.state.storage)
  }
}

export async function handleGateRequest(request, env, storage) {
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
    const reconciliation = await reconcilePossession(reservation.possession, env, storage, now)
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

async function reconcilePossession(possession, env, storage, now) {
  const current = await makeRequest(env, {
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

async function executeAction(action, idempotencyKey, requestFingerprint, reservedAt, env) {
  let mission
  if (action.mission.kind === 'existing') {
    const current = await makeRequest(env, {
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
    const current = await makeRequest(env, {
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
  const dispatched = await makeRequest(env, {
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
    body.missions.length > 100 ||
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

async function makeRequest(env, body) {
  try {
    const response = await fetch(env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return { ok: false, status: 502, error: 'upstream_failed' }
    return { ok: true, status: 200, body: await response.json() }
  } catch {
    return { ok: false, status: 504, error: 'upstream_unreachable' }
  }
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

async function servePublicApp(request, env, fetchPublicApp) {
  const publicSiteUrl = normalizePublicSiteUrl(env.PUBLIC_SITE_URL)
  if (!publicSiteUrl) return json({ error: 'console_unavailable' }, 503)

  const requestUrl = new URL(request.url)
  const lastSegment = requestUrl.pathname.split('/').pop() ?? ''
  const isDocumentRoute = !lastSegment.includes('.')
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
  return new Response(upstream.body, { status: upstream.status, headers })
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

async function sha256(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
