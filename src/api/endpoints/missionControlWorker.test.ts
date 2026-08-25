import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MissionGate,
  githubMissionRequest,
  handleRequest,
} from '../../../edge/mission-control/worker.js'

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
    missionRevision: '2026-08-23T19:31:00.000Z',
    verifiedAtUtc: '2026-08-23T19:32:00.000Z',
  },
}

afterEach(() => vi.unstubAllGlobals())

class FakeStorage {
  private readonly values = new Map<string, unknown>()
  private tail: Promise<unknown> = Promise.resolve()

  async get(key: string) {
    return this.values.get(key)
  }

  async put(key: string, value: unknown) {
    this.values.set(key, value)
  }

  async delete(key: string) {
    this.values.delete(key)
  }

  transaction<T>(callback: (transaction: FakeStorage) => Promise<T>): Promise<T> {
    const run = this.tail.then(() => callback(this))
    this.tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

function environment() {
  const storage = new FakeStorage()
  const env = {
    GITHUB_TOKEN: 'test-token',
    GITHUB_REPOSITORY: 'Samco1983/SAL0MANder-Web',
    ALLOWED_ORIGINS: origin,
    OWNER_EMAILS: 'samuel@example.com',
    ALLOW_SERVICE_TOKENS: 'true',
    TEAM_DOMAIN: 'https://sal0.cloudflareaccess.com',
    POLICY_AUD: 'mission-control-audience',
    PUBLIC_SITE_URL: 'https://samco1983.github.io/SAL0MANder-Web',
    _storage: storage,
    MISSION_GATE: {} as {
      idFromName(name: string): string
      get(id: string): { fetch(request: Request): Promise<Response> }
    },
  }
  const gate = new MissionGate({ storage }, env, { missionRequest: testMissionRequest })
  env.MISSION_GATE = {
    idFromName: (name: string) => name,
    get: () => gate,
  }
  return env
}

async function actionFingerprint(body: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(body))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function freshMissionLogTime() {
  return new Date(Date.now() + 1_000).toISOString()
}

function dispatchEcho(body: Record<string, unknown>) {
  return {
    idempotencyKey: body.idempotencyKey,
    requestFingerprint: body.requestFingerprint,
  }
}

function request(path: string, init: RequestInit = {}, authenticated = true) {
  const headers = new Headers(init.headers)
  headers.set('Origin', origin)
  if (authenticated) headers.set('Cf-Access-Jwt-Assertion', 'signed-access-jwt')
  return new Request(`https://ops.example.com${path}`, { ...init, headers })
}

function response(body: unknown, status = 200, headersValue: HeadersInit = {}) {
  const headers = new Headers(headersValue)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

const verifiedAccess = {
  verifyAccessToken: vi.fn().mockResolvedValue({ email: 'samuel@example.com' }),
  missionRequest: testMissionRequest,
}

async function testMissionRequest(_env: unknown, body: unknown) {
  try {
    const result = await fetch('https://mission-backend.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!result.ok) return { ok: false, status: 502, error: 'upstream_failed' }
    return { ok: true, status: 200, body: await result.json() }
  } catch {
    return { ok: false, status: 504, error: 'upstream_unreachable' }
  }
}

function run(requestValue: Request, env = environment()) {
  return handleRequest(requestValue, env, verifiedAccess)
}

function actionRequest(body: unknown, idempotencyKey = 'fast-break:new:1') {
  return request('/ops/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  })
}

describe('mission-control edge boundary', () => {
  it('allows the browser transport contract header during preflight', async () => {
    const result = await run(
      request('/ops/actions', {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Headers': 'content-type,idempotency-key,x-sal0mander-contract',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    )

    expect(result.status).toBe(204)
    expect(result.headers.get('Access-Control-Allow-Headers')).toContain('X-SAL0MANder-Contract')
  })

  it('serves a protected console route from the public app without weakening Access', async () => {
    const fetchPublicApp = vi.fn().mockResolvedValue(
      new Response('<!doctype html><title>SAL0MANder</title>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    )
    const protectedConsole = request('/SAL0MANder-Web/console')
    protectedConsole.headers.delete('Origin')

    const result = await handleRequest(protectedConsole, environment(), {
      ...verifiedAccess,
      fetchPublicApp,
    })

    expect(result.status).toBe(200)
    expect(await result.text()).toContain('<title>SAL0MANder</title>')
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(result.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(String(fetchPublicApp.mock.calls[0]?.[0])).toBe(
      'https://samco1983.github.io/SAL0MANder-Web/',
    )
  })

  it('forwards a protected console asset by its exact public path', async () => {
    const fetchPublicApp = vi.fn().mockResolvedValue(
      new Response('console.log("loaded")', {
        headers: { 'Content-Type': 'text/javascript' },
      }),
    )

    const result = await handleRequest(
      request('/SAL0MANder-Web/assets/index-current.js?v=1'),
      environment(),
      { ...verifiedAccess, fetchPublicApp },
    )

    expect(result.status).toBe(200)
    expect(String(fetchPublicApp.mock.calls[0]?.[0])).toBe(
      'https://samco1983.github.io/SAL0MANder-Web/assets/index-current.js?v=1',
    )
  })

  it('still requires a Cloudflare Access JWT for the protected console', async () => {
    const result = await handleRequest(
      request('/SAL0MANder-Web/console', {}, false),
      environment(),
      { ...verifiedAccess, fetchPublicApp: vi.fn() },
    )

    expect(result.status).toBe(401)
  })

  it('allows authenticated same-origin API requests from the protected console', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({ missions: [], fetchedAtUtc: freshMissionLogTime(), source: 'github' }),
      ),
    )
    const sameOriginRequest = new Request('https://ops.example.com/ops/missions', {
      headers: {
        Origin: 'https://ops.example.com',
        'Cf-Access-Jwt-Assertion': 'signed-access-jwt',
      },
    })

    const result = await run(sameOriginRequest)

    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ source: 'github', missions: [] })
  })

  it('requires a Cloudflare Access JWT', async () => {
    const result = await run(request('/ops/missions', {}, false))
    expect(result.status).toBe(401)
  })

  it('rejects forwarded identity headers when JWT verification fails', async () => {
    const forged = request('/ops/missions')
    forged.headers.set('Cf-Access-Authenticated-User-Email', 'samuel@example.com')
    const result = await handleRequest(forged, environment(), {
      verifyAccessToken: vi.fn().mockRejectedValue(new Error('bad signature')),
    })
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

    const result = await run(request('/ops/missions'))
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ source: 'github', missions: [verifiedMission] })
  })

  it('treats an empty backend record as an empty GitHub mission list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          missions: [{}],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        }),
      ),
    )

    const result = await run(request('/ops/missions'))

    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ source: 'github', missions: [] })
  })

  it('still rejects a partially populated mission record', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          missions: [{ id: 'mission-1' }],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        }),
      ),
    )

    const result = await run(request('/ops/missions'))

    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_contract' })
  })

  it('rejects a mission log whose claimed fetch time is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ missions: [], fetchedAtUtc: 'not-a-date', source: 'github' }),
        ),
    )
    const result = await run(request('/ops/missions'))
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_contract' })
  })

  it('accepts a mission log beyond one GitHub page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          missions: Array.from({ length: 101 }, (_, index) => ({
            ...verifiedMission,
            id: `mission-${index}`,
          })),
          fetchedAtUtc: '2026-08-23T19:33:00.000Z',
          source: 'github',
        }),
      ),
    )
    const result = await run(request('/ops/missions'))
    expect(result.status).toBe(200)
    expect((await result.json()).missions).toHaveLength(101)
  })

  it('rejects a mission log larger than the bounded GitHub scan permits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          missions: Array.from({ length: 10_001 }, () => ({})),
          fetchedAtUtc: '2026-08-23T19:33:00.000Z',
          source: 'github',
        }),
      ),
    )
    const result = await run(request('/ops/missions'))
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_contract' })
  })

  it('rechecks current independent proof before accepting Championship', async () => {
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'get_mission') return response({ mission: verifiedMission })
      return response({
        accepted: true,
        ...dispatchEcho(body),
        externalId: 'receipt-55',
        externalUrl: verifiedMission.issueUrl,
        receivedAt: '2026-08-23T19:34:00.000Z',
        mission: verifiedMission,
      })
    })
    vi.stubGlobal('fetch', upstream)
    const result = await run(
      actionRequest(
        {
          action: 'championship',
          mission: {
            kind: 'existing',
            id: verifiedMission.id,
            revision: verifiedMission.updatedAtUtc,
          },
        },
        'championship:55:v1',
      ),
    )

    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({
      outcome: 'queued',
      action: 'championship',
      receipt: { id: 'receipt-55', url: verifiedMission.issueUrl },
    })
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('rejects Championship when proof names an older mission revision', async () => {
    const stale = {
      ...verifiedMission,
      proof: {
        ...verifiedMission.proof,
        missionRevision: '2026-08-23T19:30:00.000Z',
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ mission: stale })))
    const result = await run(
      actionRequest(
        {
          action: 'championship',
          mission: { kind: 'existing', id: stale.id, revision: stale.updatedAtUtc },
        },
        'championship:55:stale',
      ),
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
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        }),
      ),
    )
    const result = await run(
      actionRequest({
        action: 'fast_break',
        mission: { kind: 'new', title: 'Start another product change' },
      }),
    )

    expect(result.status).toBe(409)
    expect(await result.json()).toEqual({ error: 'possession_active', missionId: active.id })
  })

  it('replays one real receipt and rejects same-key/different-payload reuse', async () => {
    const env = environment()
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'list_missions') {
        return response({
          missions: [],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        })
      }
      return response({
        accepted: true,
        ...dispatchEcho(body),
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
    const body = {
      action: 'fast_break',
      mission: { kind: 'new', title: 'Student sees the console' },
    }

    const first = await run(actionRequest(body), env)
    const duplicate = await run(actionRequest(body), env)
    const conflict = await run(
      actionRequest({
        action: 'fast_break',
        mission: { kind: 'new', title: 'Different mission' },
      }),
      env,
    )

    expect(first.status).toBe(200)
    expect(await duplicate.json()).toMatchObject({ outcome: 'duplicate' })
    expect(conflict.status).toBe(409)
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('keeps the possession locked while a queued mission has not reached GitHub yet', async () => {
    const env = environment()
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'list_missions') {
        return response({
          missions: [],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        })
      }
      return response({
        accepted: true,
        ...dispatchEcho(body),
        externalId: 'receipt-first',
        externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
        receivedAt: '2026-08-23T19:34:00.000Z',
        mission: {
          id: 'mission-57',
          title: 'First mission',
          status: 'queued',
          updatedAtUtc: '2026-08-23T19:34:00.000Z',
          issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
        },
      })
    })
    vi.stubGlobal('fetch', upstream)

    const first = await run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'First mission' } },
        'first-sequential',
      ),
      env,
    )
    const second = await run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'Second mission' } },
        'second-sequential',
      ),
      env,
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({
      error: 'possession_in_progress',
      missionId: 'mission-57',
    })
    expect(upstream).toHaveBeenCalledTimes(3)
  })

  it('does not release an old possession from a cached post-dispatch mission log', async () => {
    const env = environment()
    const startedAt = Date.now() - 301_000
    const possession = {
      idempotencyKey: 'existing-possession',
      missionId: 'mission-existing',
      startedAt,
    }
    await env._storage.put('possession', possession)
    const upstream = vi.fn().mockResolvedValue(
      response({
        missions: [],
        fetchedAtUtc: new Date(startedAt + 1_000).toISOString(),
        source: 'github',
      }),
    )
    vi.stubGlobal('fetch', upstream)

    const result = await run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'Do not unlock from stale data' } },
        'stale-log-lock',
      ),
      env,
    )

    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_contract' })
    expect(await env._storage.get('possession')).toEqual(possession)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('releases a possession only after GitHub reports it terminal', async () => {
    const env = environment()
    let firstDispatched = false
    const terminalFirst = {
      ...verifiedMission,
      id: 'mission-first',
      title: 'First mission',
      issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
    }
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'list_missions') {
        return response({
          missions: firstDispatched ? [terminalFirst] : [],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        })
      }
      if (!firstDispatched) {
        firstDispatched = true
        return response({
          accepted: true,
          ...dispatchEcho(body),
          externalId: 'receipt-first',
          externalUrl: terminalFirst.issueUrl,
          receivedAt: '2026-08-23T19:34:00.000Z',
          mission: {
            id: terminalFirst.id,
            title: terminalFirst.title,
            status: 'queued',
            updatedAtUtc: '2026-08-23T19:34:00.000Z',
            issueUrl: terminalFirst.issueUrl,
          },
        })
      }
      return response({
        accepted: true,
        ...dispatchEcho(body),
        externalId: 'receipt-second',
        externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/58',
        receivedAt: '2026-08-23T19:36:00.000Z',
        mission: {
          id: 'mission-second',
          title: 'Second mission',
          status: 'queued',
          updatedAtUtc: '2026-08-23T19:36:00.000Z',
          issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/58',
        },
      })
    })
    vi.stubGlobal('fetch', upstream)

    const first = await run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'First mission' } },
        'first-terminal',
      ),
      env,
    )
    const second = await run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'Second mission' } },
        'second-terminal',
      ),
      env,
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({
      mission: { id: 'mission-second' },
      receipt: { id: 'receipt-second' },
    })
    expect(upstream).toHaveBeenCalledTimes(5)
  })

  it('expires an abandoned pending idempotency reservation after one minute', async () => {
    const env = environment()
    const body = {
      action: 'fast_break',
      mission: { kind: 'new', title: 'Recover abandoned reservation' },
    }
    await env._storage.put('idem:abandoned', {
      state: 'pending',
      fingerprint: await actionFingerprint(body),
      createdAt: Date.now() - 61_000,
    })
    await env._storage.put('possession', {
      idempotencyKey: 'abandoned',
      startedAt: Date.now() - 61_000,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const upstreamBody = JSON.parse(String(init.body))
        if (upstreamBody.operation === 'list_missions') {
          return response({
            missions: [],
            fetchedAtUtc: freshMissionLogTime(),
            source: 'github',
          })
        }
        return response({
          accepted: true,
          ...dispatchEcho(upstreamBody),
          externalId: 'receipt-recovered',
          externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/59',
          receivedAt: '2026-08-23T19:34:00.000Z',
          mission: {
            id: 'mission-recovered',
            title: body.mission.title,
            status: 'queued',
            updatedAtUtc: '2026-08-23T19:34:00.000Z',
            issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/59',
          },
        })
      }),
    )

    const result = await run(actionRequest(body, 'abandoned'), env)
    expect(result.status).toBe(200)
  })

  it('serializes concurrent Fast Breaks before either can dispatch', async () => {
    const env = environment()
    let releaseFirst: (() => void) | undefined
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let firstList = true
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'list_missions') {
        if (firstList) {
          firstList = false
          await holdFirst
        }
        return response({
          missions: [],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        })
      }
      return response({
        accepted: true,
        ...dispatchEcho(body),
        externalId: 'receipt-new',
        externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
        receivedAt: '2026-08-23T19:34:00.000Z',
        mission: {
          id: 'mission-57',
          title: 'First mission',
          status: 'queued',
          updatedAtUtc: '2026-08-23T19:34:00.000Z',
          issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
        },
      })
    })
    vi.stubGlobal('fetch', upstream)

    const first = run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'First mission' } },
        'first',
      ),
      env,
    )
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1))
    const second = await run(
      actionRequest(
        { action: 'fast_break', mission: { kind: 'new', title: 'Second mission' } },
        'second',
      ),
      env,
    )
    releaseFirst?.()
    const firstResult = await first

    expect(firstResult.status).toBe(200)
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: 'possession_in_progress' })
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('rejects string false instead of recording it as an accepted receipt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body))
        if (body.operation === 'list_missions') {
          return response({
            missions: [],
            fetchedAtUtc: freshMissionLogTime(),
            source: 'github',
          })
        }
        return response({
          accepted: 'false',
          ...dispatchEcho(body),
          externalId: 'not-a-receipt',
          externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
          receivedAt: '2026-08-23T19:34:00.000Z',
          mission: {
            id: 'mission-57',
            title: 'Not accepted',
            status: 'queued',
            updatedAtUtc: '2026-08-23T19:34:00.000Z',
            issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
          },
        })
      }),
    )
    const result = await run(
      actionRequest({
        action: 'fast_break',
        mission: { kind: 'new', title: 'Reject malformed receipt' },
      }),
    )
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_receipt' })
  })

  it('rejects and does not cache a receipt for a different mission', async () => {
    const env = environment()
    let wrongMission = true
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'list_missions') {
        return response({
          missions: [],
          fetchedAtUtc: freshMissionLogTime(),
          source: 'github',
        })
      }
      const title = wrongMission ? 'Different mission' : 'Requested mission'
      const id = wrongMission ? 'mission-wrong' : 'mission-right'
      return response({
        accepted: true,
        ...dispatchEcho(body),
        externalId: `receipt-${id}`,
        externalUrl: `https://github.com/Samco1983/SAL0MANder-Web/issues/${id}`,
        receivedAt: '2026-08-23T19:34:00.000Z',
        mission: {
          id,
          title,
          status: 'queued',
          updatedAtUtc: '2026-08-23T19:34:00.000Z',
          issueUrl: `https://github.com/Samco1983/SAL0MANder-Web/issues/${id}`,
        },
      })
    })
    vi.stubGlobal('fetch', upstream)
    const body = {
      action: 'fast_break',
      mission: { kind: 'new', title: 'Requested mission' },
    }

    const rejected = await run(actionRequest(body, 'bind-receipt'), env)
    wrongMission = false
    const retried = await run(actionRequest(body, 'bind-receipt'), env)

    expect(rejected.status).toBe(502)
    expect(await rejected.json()).toEqual({ error: 'invalid_upstream_receipt' })
    expect(retried.status).toBe(200)
    expect(await retried.json()).toMatchObject({ mission: { id: 'mission-right' } })
    expect(upstream).toHaveBeenCalledTimes(4)
  })

  it('binds an existing-mission receipt to the independently fetched title and issue', async () => {
    const env = environment()
    let mismatchedReceipt = true
    const upstream = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      if (body.operation === 'get_mission') return response({ mission: verifiedMission })
      const mission = mismatchedReceipt
        ? {
            ...verifiedMission,
            title: 'Redirected mission',
            issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/999',
          }
        : verifiedMission
      return response({
        accepted: true,
        ...dispatchEcho(body),
        externalId: mismatchedReceipt ? 'receipt-wrong' : 'receipt-right',
        externalUrl: mission.issueUrl,
        receivedAt: freshMissionLogTime(),
        mission,
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

    const rejected = await run(actionRequest(body, 'bind-existing-receipt'), env)
    mismatchedReceipt = false
    const retried = await run(actionRequest(body, 'bind-existing-receipt'), env)

    expect(rejected.status).toBe(502)
    expect(await rejected.json()).toEqual({ error: 'invalid_upstream_receipt' })
    expect(retried.status).toBe(200)
    expect(await retried.json()).toMatchObject({
      mission: { id: verifiedMission.id, title: verifiedMission.title },
      receipt: { id: 'receipt-right', url: verifiedMission.issueUrl },
    })
    expect(upstream).toHaveBeenCalledTimes(4)
  })

  it('rate-limits repeated reconciliation attempts before calling the upstream', async () => {
    const env = environment()
    const active = {
      ...verifiedMission,
      id: 'mission-active',
      status: 'active',
      proof: undefined,
    }
    await env._storage.put('possession', {
      idempotencyKey: 'active-possession',
      missionId: active.id,
      startedAt: Date.now(),
    })
    const upstream = vi.fn().mockImplementation(async () =>
      response({
        missions: [active],
        fetchedAtUtc: freshMissionLogTime(),
        source: 'github',
      }),
    )
    vi.stubGlobal('fetch', upstream)

    const results = []
    for (let index = 0; index < 11; index += 1) {
      results.push(
        await run(
          actionRequest(
            {
              action: 'fast_break',
              mission: { kind: 'new', title: `Blocked attempt ${index}` },
            },
            `blocked-reconciliation-${index}`,
          ),
          env,
        ),
      )
    }

    expect(results.slice(0, 10).map((result) => result.status)).toEqual(Array(10).fill(409))
    const rateLimited = results.at(-1)
    expect(rateLimited?.status).toBe(429)
    expect(await rateLimited?.json()).toEqual({ error: 'rate_limited' })
    expect(upstream).toHaveBeenCalledTimes(10)
  })

  it('rejects a non-string upstream receipt identifier', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body))
        if (body.operation === 'list_missions') {
          return response({
            missions: [],
            fetchedAtUtc: freshMissionLogTime(),
            source: 'github',
          })
        }
        return response({
          accepted: true,
          ...dispatchEcho(body),
          externalId: 57,
          externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
          receivedAt: '2026-08-23T19:34:00.000Z',
          mission: {
            id: 'mission-57',
            title: 'Reject malformed identifier',
            status: 'queued',
            updatedAtUtc: '2026-08-23T19:34:00.000Z',
            issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/57',
          },
        })
      }),
    )
    const result = await run(
      actionRequest({
        action: 'fast_break',
        mission: { kind: 'new', title: 'Reject malformed receipt identifier' },
      }),
    )
    expect(result.status).toBe(502)
    expect(await result.json()).toEqual({ error: 'invalid_upstream_receipt' })
  })

  it('reads only marked mission issues through the scoped GitHub API', async () => {
    const issue = githubIssue(verifiedMission, 55)
    const fetchGitHub = vi.fn().mockResolvedValue(
      response([
        issue,
        { ...issue, number: 56, body: 'ordinary issue' },
        { ...issue, number: 57, pull_request: { url: 'https://api.github.com/pulls/57' } },
      ]),
    )

    const result = await githubMissionRequest(
      environment(),
      { operation: 'list_missions', source: 'owner_console' },
      fetchGitHub,
    )

    expect(result).toMatchObject({
      ok: true,
      body: { source: 'github', missions: [verifiedMission] },
    })
    expect(fetchGitHub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchGitHub.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://api.github.com/repos/Samco1983/SAL0MANder-Web/issues?state=all&per_page=100&sort=updated&direction=desc',
    )
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28')
  })

  it('follows GitHub pagination before deciding whether an active mission exists', async () => {
    const terminalIssues = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      number: index + 1,
      body: 'ordinary issue',
    }))
    const activeMission = { ...verifiedMission, status: 'active' }
    const fetchGitHub = vi
      .fn()
      .mockResolvedValueOnce(
        response(terminalIssues, 200, {
          Link: '<https://api.github.com/repos/Samco1983/SAL0MANder-Web/issues?state=all&per_page=100&page=2>; rel="next"',
        }),
      )
      .mockResolvedValueOnce(response([githubIssue(activeMission, 155)]))

    const result = await githubMissionRequest(
      environment(),
      { operation: 'list_missions', source: 'owner_console' },
      fetchGitHub,
    )

    expect(result).toMatchObject({
      ok: true,
      body: { missions: [{ id: 'mission-155', status: 'active' }] },
    })
    expect(fetchGitHub).toHaveBeenCalledTimes(2)
    expect(fetchGitHub.mock.calls[1]?.[0]).toContain('page=2')
  })

  it('fails closed when GitHub pagination points outside the scoped repository', async () => {
    const fetchGitHub = vi.fn().mockResolvedValue(
      response([], 200, {
        Link: '<https://evil.example/repos/Samco1983/SAL0MANder-Web/issues?page=2>; rel="next"',
      }),
    )

    const result = await githubMissionRequest(
      environment(),
      { operation: 'list_missions', source: 'owner_console' },
      fetchGitHub,
    )

    expect(result).toEqual({ ok: false, status: 502, error: 'invalid_upstream_contract' })
    expect(fetchGitHub).toHaveBeenCalledTimes(1)
  })

  it('fails closed when a marked mission issue has a malformed envelope', async () => {
    const fetchGitHub = vi.fn().mockResolvedValue(
      response([
        {
          id: 9123,
          number: 92,
          body: '<!-- sal0-mission-control:v1\n{"mission":',
          state: 'open',
          updated_at: '2026-08-24T05:00:00.000Z',
          html_url: 'https://github.com/Samco1983/SAL0MANder-Web/issues/92',
        },
      ]),
    )

    const result = await githubMissionRequest(
      environment(),
      { operation: 'list_missions', source: 'owner_console' },
      fetchGitHub,
    )

    expect(result).toEqual({ ok: false, status: 502, error: 'invalid_upstream_contract' })
  })

  it('rejects an existing-mission dispatch when its GitHub revision changed', async () => {
    const newerMission = {
      ...verifiedMission,
      updatedAtUtc: '2026-08-24T05:01:00.000Z',
      proof: {
        ...verifiedMission.proof,
        missionRevision: '2026-08-24T05:01:00.000Z',
        verifiedAtUtc: '2026-08-24T05:01:01.000Z',
      },
    }
    const fetchGitHub = vi.fn().mockResolvedValue(response(githubIssue(newerMission, 55)))

    const result = await githubMissionRequest(
      environment(),
      {
        operation: 'dispatch',
        action: 'championship',
        mission: { kind: 'existing', id: 'mission-55', revision: verifiedMission.updatedAtUtc },
        idempotencyKey: 'championship:55:proof',
        requestFingerprint: 'changed',
        requestedAtUtc: '2026-08-24T05:02:00.000Z',
        source: 'owner_console',
      },
      fetchGitHub,
    )

    expect(result).toEqual({ ok: false, status: 409, error: 'mission_changed' })
    expect(fetchGitHub).toHaveBeenCalledTimes(1)
    expect(fetchGitHub.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('creates one bounded Fast Break issue and returns its GitHub receipt', async () => {
    const fetchGitHub = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const input = JSON.parse(String(init.body))
      return response({
        id: 99123,
        number: 91,
        title: input.title,
        body: input.body,
        state: 'open',
        updated_at: '2026-08-24T05:00:00.000Z',
        html_url: 'https://github.com/Samco1983/SAL0MANder-Web/issues/91',
      })
    })
    const requestedAtUtc = '2026-08-24T05:00:00.000Z'

    const result = await githubMissionRequest(
      environment(),
      {
        operation: 'dispatch',
        action: 'fast_break',
        mission: { kind: 'new', title: 'Student can launch one lesson' },
        idempotencyKey: 'fast-break:new:proof',
        requestFingerprint: 'abc123',
        requestedAtUtc,
        source: 'owner_console',
      },
      fetchGitHub,
    )

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: {
        accepted: true,
        idempotencyKey: 'fast-break:new:proof',
        requestFingerprint: 'abc123',
        externalId: '99123',
        externalUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/91',
        receivedAt: requestedAtUtc,
        mission: {
          id: 'mission-91',
          title: 'Student can launch one lesson',
          status: 'queued',
          updatedAtUtc: requestedAtUtc,
          issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/91',
        },
      },
    })
    expect(fetchGitHub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchGitHub.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/Samco1983/SAL0MANder-Web/issues')
    expect(init.method).toBe('POST')
    const issueInput = JSON.parse(String(init.body))
    expect(issueInput.title).toBe('[OVERNIGHT][WEB] Student can launch one lesson')
    expect(issueInput.body).toContain('<!-- sal0-mission-control:v1')
    expect(issueInput.body).toContain('"idempotencyKey":"fast-break:new:proof"')
    expect(issueInput.body).not.toContain('test-token')
  })

  it('fails closed when the scoped GitHub token is absent', async () => {
    const env = environment()
    env.GITHUB_TOKEN = ''
    const fetchGitHub = vi.fn()

    const result = await githubMissionRequest(
      env,
      { operation: 'list_missions', source: 'owner_console' },
      fetchGitHub,
    )

    expect(result).toEqual({ ok: false, status: 503, error: 'dispatcher_unavailable' })
    expect(fetchGitHub).not.toHaveBeenCalled()
  })
})

function githubIssue(mission: typeof verifiedMission, number: number) {
  const envelope = {
    action: 'fast_break',
    idempotencyKey: 'test-key',
    requestFingerprint: 'test-fingerprint',
    requestedAtUtc: mission.updatedAtUtc,
    source: 'owner_console',
    mission: {
      title: mission.title,
      status: mission.status,
      updatedAtUtc: mission.updatedAtUtc,
      proof: mission.proof,
    },
  }
  return {
    id: 9000 + number,
    number,
    title: `[OVERNIGHT][WEB] ${mission.title}`,
    body: `Mission\n\n<!-- sal0-mission-control:v1\n${JSON.stringify(envelope)}\n-->`,
    state: 'open',
    updated_at: mission.updatedAtUtc,
    html_url: mission.issueUrl,
  }
}
