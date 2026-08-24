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
const RATE_WINDOW_SECONDS = 300
const RATE_MAX = 10
const IDEMPOTENCY_TTL_SECONDS = 86_400

export default { fetch: handleRequest }

export async function handleRequest(request, env) {
  const cors = corsHeaders(request, env)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (!isAllowedOrigin(request, env)) return json({ error: 'origin_not_allowed' }, 403, cors)
  if (!hasAccessIdentity(request, env)) return json({ error: 'authentication_required' }, 401, cors)

  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname.endsWith('/ops/missions')) {
    const upstream = await makeRequest(env, { operation: 'list_missions', source: 'owner_console' })
    if (!upstream.ok) return json({ error: upstream.error }, upstream.status, cors)
    const log = normalizeMissionLog(upstream.body)
    return log ? json(log, 200, cors) : json({ error: 'invalid_upstream_contract' }, 502, cors)
  }

  if (request.method !== 'POST' || !url.pathname.endsWith('/ops/actions')) {
    return json({ error: 'not_found' }, 404, cors)
  }

  const payload = await request.json().catch(() => null)
  const action = normalizeAction(payload)
  if (!action) return json({ error: 'invalid_action' }, 400, cors)

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? ''
  if (!idempotencyKey || idempotencyKey.length > 300) {
    return json({ error: 'invalid_idempotency_key' }, 400, cors)
  }

  const fingerprint = await sha256(JSON.stringify(action))
  const existing = await env.OPS_KV.get(`idem:${idempotencyKey}`, { type: 'json' })
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return json({ error: 'idempotency_conflict' }, 409, cors)
    }
    return json({ ...existing.result, outcome: 'duplicate' }, 200, cors)
  }

  const limited = await rateLimited(request, env)
  if (limited) return json({ error: 'rate_limited' }, 429, cors)

  let mission
  if (action.mission.kind === 'existing') {
    const current = await makeRequest(env, {
      operation: 'get_mission',
      missionId: action.mission.id,
      source: 'owner_console',
    })
    mission = current.ok ? normalizeMission(current.body?.mission) : null
    if (!mission) {
      return json(
        { error: current.ok ? 'invalid_upstream_contract' : current.error },
        current.ok ? 502 : current.status,
        cors,
      )
    }
    if (mission.updatedAtUtc !== action.mission.revision) {
      return json({ error: 'mission_changed' }, 409, cors)
    }
  }

  if (action.action === 'championship' && !championshipReady(mission)) {
    return json({ error: 'verification_required' }, 409, cors)
  }

  if (action.action === 'fast_break') {
    const current = await makeRequest(env, {
      operation: 'list_missions',
      source: 'owner_console',
    })
    const log = current.ok ? normalizeMissionLog(current.body) : null
    if (!log) {
      return json(
        { error: current.ok ? 'invalid_upstream_contract' : current.error },
        current.ok ? 502 : current.status,
        cors,
      )
    }
    const active = log.missions.find((item) => ACTIVE_STATUSES.has(item.status))
    if (active && active.id !== mission?.id) {
      return json({ error: 'possession_active', missionId: active.id }, 409, cors)
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
    reason,
    requestedAtUtc,
    source: 'owner_console',
  })
  if (!dispatched.ok) return json({ error: dispatched.error }, dispatched.status, cors)

  const receipt = normalizeReceipt(dispatched.body, action.action)
  if (!receipt) return json({ error: 'invalid_upstream_receipt' }, 502, cors)

  const result = {
    outcome: 'queued',
    action: action.action,
    mission: receipt.mission,
    receipt: receipt.receipt,
  }
  await env.OPS_KV.put(
    `idem:${idempotencyKey}`,
    JSON.stringify({ fingerprint, result }),
    { expirationTtl: IDEMPOTENCY_TTL_SECONDS },
  )
  return json(result, 200, cors)
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
  return Boolean(
    mission?.status === 'verified' &&
      mission.proof?.command &&
      mission.proof?.artifact &&
      mission.proof?.builder &&
      mission.proof?.verifier &&
      mission.proof.builder !== mission.proof.verifier,
  )
}

function normalizeMissionLog(body) {
  if (!body || body.source !== 'github' || !Array.isArray(body.missions)) return null
  const missions = body.missions.map(normalizeMission)
  if (missions.some((mission) => mission === null)) return null
  return {
    missions,
    fetchedAtUtc: isIsoDate(body.fetchedAtUtc) ? body.fetchedAtUtc : new Date().toISOString(),
    source: 'github',
  }
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
    !isIsoDate(value.verifiedAtUtc)
  ) {
    return null
  }
  return { command, artifact, builder, verifier, verifiedAtUtc: value.verifiedAtUtc }
}

function normalizeReceipt(body, action) {
  if (!body?.accepted || !body.externalId || !isHttpUrl(body.externalUrl) || !isIsoDate(body.receivedAt)) {
    return null
  }
  const mission = normalizeMission(body.mission)
  if (!mission) return null
  return {
    mission: { id: mission.id, title: mission.title, status: mission.status },
    receipt: { id: body.externalId, url: body.externalUrl, receivedAtUtc: body.receivedAt },
    action,
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

async function rateLimited(request, env) {
  const key = `rate:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`
  try {
    const used = Number((await env.OPS_KV.get(key)) ?? '0')
    if (used >= RATE_MAX) return true
    await env.OPS_KV.put(key, String(used + 1), { expirationTtl: RATE_WINDOW_SECONDS })
    return false
  } catch {
    return true
  }
}

function hasAccessIdentity(request, env) {
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return false
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.toLowerCase()
  const owners = (env.OWNER_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  if (email) return owners.includes(email)
  return env.ALLOW_SERVICE_TOKENS === 'true'
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin)
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(request, env) ? origin : 'null',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
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

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
