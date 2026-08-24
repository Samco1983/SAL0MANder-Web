import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleRequest } from '../../../edge/mission-control/worker.js'

const origin = 'https://samco1983.github.io'
const verifiedMission = {
  id: 'mission-55',
  title: 'Public lesson is live',
  status: 'verified',
  updatedAtUtc: '2026-08-23T19:31:00.000Z',
  issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/55',
  proof: {
    command: 'npm run verify:deployed',
    artifact: 'd7b9956',
    builder: 'Claude',
    verifier: 'Codex',
    verifiedAtUtc: '2026-08-23T19:32:00.000Z',
  },
}

afterEach(() => vi.unstubAllGlobals())

function environment() {
  const values = new Map<string, string>()
  return {
    MAKE_WEBHOOK_URL: 'https://hook.example.invalid/secret',
    ALLOWED_ORIGINS: origin,
    OWNER_EMAILS: 'samuel@example.com',
    ALLOW_SERVICE_TOKENS: 'true',
    OPS_KV: {
      async get(key: string, options?: { type?: string }) {
        const value = values.get(key) ?? null
        return options?.type === 'json' && value ? JSON.parse(value) : value
      },
      async put(key: string, value: string) {
        values.set(key, value)
      },
    },
  }
}

function request(
  path: string,
  init: RequestInit = {},
  authenticated = true,
) {
  const headers = new Headers(init.headers)
  headers.set('Origin', origin)
  if (authenticated) {
    headers.set('Cf-Access-Jwt-Assertion', 'verified-upstream-by-access')
    headers.set('Cf-Access-Authenticated-User-Email', 'samuel@example.com')
  }
  return new Request(`https://ops.example.com${path}`, { ...init, headers })
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('mission-control edge boundary', () => {
  it('requires an identity already authenticated by the access layer', async () => {
    const result = await handleRequest(request('/ops/missions', {}, false), environment())
    expect(result.status).toBe(401)
  })

  it('returns GitHub mission state without treating Make as the source', async () => {
    const upstream = vi.fn().mockResolvedValue(
      response({
        missions: [verifiedMission],
        fetchedAtUtc: '2026-08-23T19:33:00.000Z',
        source: 'github',
      }),
    )
    vi.stubGlobal('fetch', upstream)

    const result = await handleRequest(request('/ops/missions'), environment())
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ source: 'github', missions: [verifiedMission] })
    expect(JSON.parse(upstream.mock.calls[0]?.[1]?.body)).toMatchObject({
      operation: 'list_missions',
    })
  })

  it('rechecks independent proof before accepting Championship', async () => {
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'get_mission') return response({ mission: verifiedMission })
      return response({
        accepted: true,
        externalId: 'receipt-55',
        externalUrl: verifiedMission.issueUrl,
        receivedAt: '2026-08-23T19:34:00.000Z',
        mission: verifiedMission,
      })
    })
    vi.stubGlobal('fetch', upstream)
    const body = {
      action: 'championship',
      mission: {
        kind: 'existing',
        id: verifiedMission.id,
        revision: verifiedMission.updatedAtUtc,
      },
    }
    const result = await handleRequest(
      request('/ops/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'championship:55:v1' },
        body: JSON.stringify(body),
      }),
      environment(),
    )

    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({
      outcome: 'queued',
      action: 'championship',
      receipt: { id: 'receipt-55', url: verifiedMission.issueUrl },
    })
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('rejects Championship when GitHub has no independent proof', async () => {
    const unverified = { ...verifiedMission, status: 'active', proof: undefined }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ mission: unverified })))
    const result = await handleRequest(
      request('/ops/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'championship:55:v1' },
        body: JSON.stringify({
          action: 'championship',
          mission: {
            kind: 'existing',
            id: unverified.id,
            revision: unverified.updatedAtUtc,
          },
        }),
      }),
      environment(),
    )

    expect(result.status).toBe(409)
    expect(await result.json()).toEqual({ error: 'verification_required' })
  })

  it('rejects malformed proof at the edge instead of lending it a verified label', async () => {
    const malformed = {
      ...verifiedMission,
      proof: { ...verifiedMission.proof, verifiedAtUtc: 'not-a-date' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ mission: malformed })))
    const result = await handleRequest(
      request('/ops/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'championship:55:bad' },
        body: JSON.stringify({
          action: 'championship',
          mission: {
            kind: 'existing',
            id: malformed.id,
            revision: malformed.updatedAtUtc,
          },
        }),
      }),
      environment(),
    )

    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_contract' })
  })

  it('blocks a second Fast Break while another possession is active', async () => {
    const active = { ...verifiedMission, id: 'mission-active', status: 'active', proof: undefined }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          missions: [active],
          fetchedAtUtc: '2026-08-23T19:33:00.000Z',
          source: 'github',
        }),
      ),
    )
    const result = await handleRequest(
      request('/ops/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fast-break:new:1' },
        body: JSON.stringify({
          action: 'fast_break',
          mission: { kind: 'new', title: 'Start another product change' },
        }),
      }),
      environment(),
    )

    expect(result.status).toBe(409)
    expect(await result.json()).toEqual({ error: 'possession_active', missionId: active.id })
  })

  it('replays one real receipt and rejects same-key/different-payload reuse', async () => {
    const env = environment()
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'list_missions') {
        return response({ missions: [], fetchedAtUtc: '2026-08-23T19:33:00.000Z', source: 'github' })
      }
      return response({
        accepted: true,
        externalId: 'receipt-new',
        externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
        receivedAt: '2026-08-23T19:34:00.000Z',
        mission: {
          id: 'mission-57',
          title: 'Student sees the console',
          status: 'queued',
          updatedAtUtc: '2026-08-23T19:34:00.000Z',
          issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
        },
      })
    })
    vi.stubGlobal('fetch', upstream)
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fast-break:new:1' },
      body: JSON.stringify({
        action: 'fast_break',
        mission: { kind: 'new', title: 'Student sees the console' },
      }),
    }

    const first = await handleRequest(request('/ops/actions', init), env)
    const duplicate = await handleRequest(request('/ops/actions', init), env)
    const conflict = await handleRequest(
      request('/ops/actions', {
        ...init,
        body: JSON.stringify({
          action: 'fast_break',
          mission: { kind: 'new', title: 'Different mission' },
        }),
      }),
      env,
    )

    expect(first.status).toBe(200)
    expect(await duplicate.json()).toMatchObject({ outcome: 'duplicate' })
    expect(conflict.status).toBe(409)
    expect(upstream).toHaveBeenCalledTimes(2)
  })
})
