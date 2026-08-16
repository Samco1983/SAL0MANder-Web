import type { z } from 'zod'
import type { RequestOptions, Transport } from './transport'
import { ApiError } from './errors'
import { newId } from '@contracts/v1'

/**
 * In-memory transport used when no backend is configured (`VITE_API_BASE_URL`
 * empty), which is the default for foundation work.
 *
 * Its job is to let the whole app — routes, loading states, error states — be
 * built and tested against the real contract before any backend provider is
 * chosen. It is NOT a persistence layer and deliberately forgets everything on
 * reload.
 */

const now = () => new Date().toISOString()

const DEMO_ACTIVITY_ID = 'demo-activity'
const DEMO_VERSION_ID = 'demo-version-1'

function demoBundle(activityId: string) {
  return {
    summary: {
      id: activityId,
      title: 'Sample SAL0MANder Activity',
      description:
        'A placeholder activity served by the local mock backend so Guest Play can be built and tested before a real backend exists.',
      mode: 'learning-puzzle' as const,
      thumbnail: null,
      authorDisplayName: 'Demo Teacher',
    },
    version: {
      id: DEMO_VERSION_ID,
      activityId,
      versionNumber: 1,
      payload: { schemaVersion: 1, body: { placeholder: true } },
      media: [],
      createdAt: now(),
    },
  }
}

export function createMockTransport(): Transport {
  const sessions = new Map<string, unknown>()
  /** Replays the stored result for a repeated key — mirrors server behavior. */
  const idempotency = new Map<string, unknown>()

  return {
    async request<T>(options: RequestOptions, schema: z.ZodType<T>): Promise<T> {
      await new Promise((r) => setTimeout(r, 120))

      if (options.idempotencyKey && idempotency.has(options.idempotencyKey)) {
        return schema.parse(idempotency.get(options.idempotencyKey))
      }

      const result = route(options, sessions)
      if (options.idempotencyKey) idempotency.set(options.idempotencyKey, result)

      const parsed = schema.safeParse(result)
      if (!parsed.success) {
        throw new ApiError({
          code: 'contract_mismatch',
          message: `Mock transport produced a payload that fails the contract for ${options.path}`,
          details: { issues: parsed.error.issues },
        })
      }
      return parsed.data
    },
  }
}

function route(options: RequestOptions, sessions: Map<string, unknown>): unknown {
  const { path, method = 'GET', body } = options

  const guestActivity = path.match(/^\/guest\/activities\/([^/]+)$/)
  if (guestActivity && method === 'GET') {
    const id = decodeURIComponent(guestActivity[1] ?? '')
    // Only the demo id resolves, so the not-found path is exercisable locally.
    if (id !== DEMO_ACTIVITY_ID) {
      throw new ApiError({ code: 'not_found', message: `No activity ${id}`, status: 404 })
    }
    return demoBundle(id)
  }

  if (path === '/sessions' && method === 'POST') {
    const input = (body ?? {}) as Record<string, unknown>
    const session = {
      id: newId(),
      activityId: input.activityId ?? DEMO_ACTIVITY_ID,
      activityVersionId: input.activityVersionId ?? DEMO_VERSION_ID,
      identity: input.identity ?? { kind: 'guest', guestToken: newId() },
      status: 'in-progress',
      startedAt: now(),
      completedAt: null,
    }
    sessions.set(session.id, session)
    return session
  }

  const sessionResult = path.match(/^\/sessions\/([^/]+)\/result$/)
  if (sessionResult && method === 'POST') {
    const id = decodeURIComponent(sessionResult[1] ?? '')
    const existing = sessions.get(id) as Record<string, unknown> | undefined
    if (!existing) {
      throw new ApiError({ code: 'not_found', message: `No session ${id}`, status: 404 })
    }
    const updated = { ...existing, status: 'completed', completedAt: now() }
    sessions.set(id, updated)
    return updated
  }

  throw new ApiError({
    code: 'not_found',
    message: `Mock transport has no route for ${method} ${path}`,
    status: 404,
  })
}

export const MOCK_DEMO_ACTIVITY_ID = DEMO_ACTIVITY_ID
