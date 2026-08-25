/**
 * SAL0MANder ops endpoint — the only thing standing between a public button
 * and the council's evidence trail.
 *
 *   browser  ->  THIS WORKER  ->  GitHub Issues API
 *
 * Make used to sit in the middle of that arrow. It was removed on 2026-08-24
 * after it failed closed with no diagnosis: the Worker's fetch threw instantly,
 * the catch discarded the error, and the console showed only "Mission Log
 * unavailable". A hop we cannot see into is a hop that costs hours the first
 * time it breaks. GitHub was already the durable record at the end of the
 * chain; Make was only carrying the request there.
 *
 * Deployed separately from the site. GitHub Pages is static and cannot host
 * this; that separation is the point. The GitHub token lives in Worker secrets
 * and is never sent to a browser.
 *
 * Deploy:
 *   npx wrangler deploy
 *   npx wrangler secret put GITHUB_TOKEN     # fine-grained PAT, Issues: write
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
const GITHUB_TIMEOUT_MS = 10_000

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

    // ---- configuration ----------------------------------------------------
    // Checked BEFORE any work, and reported as its own error code. The failure
    // this replaces was a missing secret that surfaced as a generic upstream
    // 504 one hop away from its cause. A misconfigured worker should say it is
    // misconfigured.
    const misconfigured = missingConfig(env)
    if (misconfigured.length > 0) {
      // Server-side only: names which binding is absent, never its value.
      console.error(`ops: refusing request, missing config: ${misconfigured.join(', ')}`)
      return json({ error: 'endpoint_misconfigured' }, 503, cors)
    }

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
    } catch (error) {
      console.error(`ops: rate limiter unavailable: ${describe(error)}`)
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

    // ---- write the durable record -----------------------------------------
    const receivedAtUtc = new Date().toISOString()
    const written = await createIssue(env, { action, reason, idempotencyKey, receivedAtUtc })
    if (!written.ok) {
      return json({ error: written.error }, written.status, cors)
    }

    // `queued` rather than a new outcome value: the issue is in fact already
    // written by this point, but OpsResultSchema in src/contracts/v1/ops.ts
    // does not carry a stronger word, and understating what happened is the
    // safe direction. Widening that enum is a contract change, not a bug fix.
    const result = {
      outcome: 'queued',
      action,
      idempotencyKey,
      receivedAtUtc,
      ...(written.issueUrl ? { issueUrl: written.issueUrl } : {}),
    }

    // Recorded only after GitHub accepted it. Recording earlier would make a
    // failed write look like a completed one on the caller's retry — the
    // "claimed DONE with nothing behind it" failure, rebuilt in a cache.
    await env.OPS_KV.put(`idem:${idempotencyKey}`, JSON.stringify(result), {
      expirationTtl: IDEMPOTENCY_TTL_SECONDS,
    })

    return json(result, 200, cors)
  },
}

/**
 * Names every binding this worker cannot run without.
 *
 * Exists because the failure it replaces was silent: a secret that was never
 * set produced `fetch(undefined)`, which throws instantly, which the old catch
 * turned into an indistinguishable "upstream unreachable" 504. Nothing about
 * that response pointed at the deploy step that actually went wrong.
 */
function missingConfig(env) {
  const missing = []
  if (!env.OPS_KV) missing.push('OPS_KV')
  if (typeof env.GITHUB_TOKEN !== 'string' || env.GITHUB_TOKEN.length === 0) missing.push('GITHUB_TOKEN')
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO ?? '')) missing.push('GITHUB_REPO')
  return missing
}

/**
 * POST one issue to the GitHub REST API.
 *
 * Returns a discriminated result rather than throwing, so the caller decides
 * the public status code while this function decides what gets logged. The two
 * are deliberately different: the log names the cause, the response does not.
 * An upstream error body can carry the repository path, and the repository path
 * is exactly what an anonymous caller should not learn from a failure.
 */
async function createIssue(env, { action, reason, idempotencyKey, receivedAtUtc }) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/issues`
  const labels = (env.GITHUB_LABELS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        // GitHub rejects an API request with no User-Agent outright. Omitting
        // it fails 403 with a body that looks nothing like an auth problem.
        'User-Agent': 'sal0mander-ops-worker',
      },
      body: JSON.stringify({
        title: issueTitle(action, reason),
        body: issueBody({ action, reason, idempotencyKey, receivedAtUtc }),
        ...(labels.length > 0 ? { labels } : {}),
      }),
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    })
  } catch (error) {
    // Reachable on DNS failure, TLS failure, or the abort timeout. Kept
    // distinct from every branch below so `wrangler tail` separates "GitHub did
    // not answer" from "GitHub said no".
    console.error(`ops: github unreachable within ${GITHUB_TIMEOUT_MS}ms: ${describe(error)}`)
    return { ok: false, error: 'upstream_unreachable', status: 504 }
  }

  if (!response.ok) {
    // Read the body for the log only. 401/403 means the token is wrong, missing
    // scopes, or expired; 404 on a repository that exists means the same thing,
    // since GitHub hides repositories a token cannot see rather than admitting
    // they are there. Those three are one operator action apart and were
    // previously one indistinguishable 502.
    const detail = (await response.text().catch(() => '')).slice(0, 500)
    console.error(`ops: github rejected issue create: HTTP ${response.status} ${detail}`)
    const credentialProblem =
      response.status === 401 || response.status === 403 || response.status === 404
    return {
      ok: false,
      error: credentialProblem ? 'upstream_rejected_credentials' : 'upstream_failed',
      status: 502,
    }
  }

  const body = await response.json().catch(() => ({}))
  return { ok: true, issueUrl: typeof body?.html_url === 'string' ? body.html_url : undefined }
}

function issueTitle(action, reason) {
  const firstLine = sanitize(reason).split('\n', 1)[0].trim()
  const trimmed = firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine
  return `ops(${action}): ${trimmed}`
}

/**
 * `reason` is public free text landing in a rendered Markdown document, so it
 * goes inside a fence rather than into the prose. Without that, 280 characters
 * from an anonymous caller can forge headings, links, and @-mentions in a
 * document the council reads as evidence.
 *
 * The fence is four backticks and sanitize() strips any run of three or more
 * from the text, so the caller cannot close the fence early and climb back out
 * into Markdown. Either half alone is not enough.
 */
function issueBody({ action, reason, idempotencyKey, receivedAtUtc }) {
  return [
    `Filed by the website ops endpoint. Action: \`${action}\`.`,
    '',
    'Reason as submitted:',
    '````text',
    sanitize(reason),
    '````',
    '',
    `- idempotencyKey: \`${idempotencyKey}\``,
    `- receivedAtUtc: \`${receivedAtUtc}\``,
    '- source: `website`',
  ].join('\n')
}

/**
 * Drops control characters and any fence the caller could escape through.
 *
 * Newline survives: a reason legitimately spans lines, and inside the fence it
 * is only a line break. Every other C0 code point and DEL is removed, because
 * a terminal reading these logs will act on them.
 */
function sanitize(text) {
  let out = ''
  for (const character of text) {
    const code = character.codePointAt(0)
    if (character !== '\n' && (code < 0x20 || code === 0x7f)) continue
    out += character
  }
  return out.replace(/`{3,}/g, "'''")
}

/** Message and name only. An error's stack can carry the URL it was thrown for. */
function describe(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
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
