/**
 * SAL0MANder ops endpoint — the only thing standing between a public button
 * and the council's evidence trail.
 *
 *   browser  ->  THIS WORKER  ->  Make webhook  ->  GitHub issue
 *
 * Deployed separately from the site. GitHub Pages is static and cannot host
 * this; that separation is the point. The Make hook URL and any token live in
 * Worker secrets and are never sent to a browser.
 *
 * Deploy:
 *   npx wrangler deploy
 *   npx wrangler secret put MAKE_WEBHOOK_URL
 *   npx wrangler kv namespace create OPS_KV
 *
 * Everything a browser sends is re-validated here. The client-side checks in
 * src/api/endpoints/ops.ts are a courtesy to honest callers; anything shipped
 * to a browser can be edited in a browser, so this file trusts none of it.
 */

const ALLOWED_ACTIONS = new Set(['nudge', 'status'])
const MAX_REASON = 280
const RATE_LIMIT = { max: 5, windowSeconds: 300 } // 5 per IP per 5 minutes
const IDEMPOTENCY_TTL_SECONDS = 86_400

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)

    // Origin allowlist. Not a security boundary on its own — a non-browser
    // client sets any Origin it likes — but it stops the button being embedded
    // on someone else's page and fired by their visitors.
    const origin = request.headers.get('Origin') ?? ''
    if (!allowedOrigin(origin, env)) return json({ error: 'origin_not_allowed' }, 403, cors)

    let payload
    try {
      payload = await request.json()
    } catch {
      return json({ error: 'invalid_json' }, 400, cors)
    }

    // ---- validation -------------------------------------------------------
    const action = payload?.action
    if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
      // Deliberately does not echo the rejected value: this response is public.
      return json({ error: 'action_not_allowed' }, 400, cors)
    }
    const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : ''
    if (reason.length === 0 || reason.length > MAX_REASON) {
      return json({ error: 'invalid_reason' }, 400, cors)
    }

    // ---- rate limit -------------------------------------------------------
    // Keyed on the connecting IP. Fails CLOSED: if KV is unavailable we refuse
    // rather than forward, because the failure this guards against is exactly
    // a flood, and a flood is when KV is most likely to be struggling.
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const rateKey = `rate:${ip}`
    try {
      const used = Number((await env.OPS_KV.get(rateKey)) ?? '0')
      if (used >= RATE_LIMIT.max) {
        return json({ outcome: 'rate_limited', action, retryAfterSeconds: RATE_LIMIT.windowSeconds }, 429, cors)
      }
      await env.OPS_KV.put(rateKey, String(used + 1), { expirationTtl: RATE_LIMIT.windowSeconds })
    } catch {
      return json({ error: 'rate_limiter_unavailable' }, 503, cors)
    }

    // ---- idempotency ------------------------------------------------------
    // The header is advisory; we recompute server-side so a caller cannot force
    // two identical writes by sending a fresh key, nor collapse two distinct
    // intents by reusing one.
    const idempotencyKey = await deriveKey(action, reason)
    const seen = await env.OPS_KV.get(`idem:${idempotencyKey}`, { type: 'json' })
    if (seen) {
      return json({ ...seen, outcome: 'duplicate' }, 200, cors)
    }

    // ---- forward to Make --------------------------------------------------
    const receivedAtUtc = new Date().toISOString()
    let issueUrl
    try {
      const upstream = await fetch(env.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason, idempotencyKey, receivedAtUtc, source: 'website' }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!upstream.ok) {
        // Do not surface upstream status text: it can contain the hook path.
        return json({ error: 'upstream_failed' }, 502, cors)
      }
      const body = await upstream.json().catch(() => ({}))
      if (typeof body?.issueUrl === 'string') issueUrl = body.issueUrl
    } catch {
      return json({ error: 'upstream_unreachable' }, 504, cors)
    }

    const result = { outcome: 'queued', action, idempotencyKey, receivedAtUtc, ...(issueUrl ? { issueUrl } : {}) }

    // Recorded only after Make accepted it. Recording earlier would make a
    // failed forward look like a completed one on the caller's retry — the
    // "claimed DONE with nothing behind it" failure, rebuilt in a cache.
    await env.OPS_KV.put(`idem:${idempotencyKey}`, JSON.stringify(result), {
      expirationTtl: IDEMPOTENCY_TTL_SECONDS,
    })

    return json(result, 200, cors)
  },
}

/**
 * Must match opsIdempotencyKey() in src/api/endpoints/ops.ts byte for byte.
 *
 * This is deliberately duplicated rather than imported: the worker deploys to
 * Cloudflare on its own and cannot reach into the site's source tree at deploy
 * time. Duplication is the price of that separation, so the agreement is held
 * by a test instead — src/api/endpoints/ops.test.ts imports BOTH and asserts
 * they produce identical output. Without that test this is two functions that
 * merely look alike, and a drift between them silently splits one write into
 * two. Exported for exactly that test.
 */
export async function deriveKey(action, reason) {
  const minute = new Date().toISOString().slice(0, 16)
  const normalized = reason.toLowerCase().replace(/\s+/g, ' ')
  let hash = 0x811c9dc5
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${action}:${minute}:${hash.toString(16).padStart(8, '0')}`
}

function allowedOrigin(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return allowed.includes(origin)
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origin, env) ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
