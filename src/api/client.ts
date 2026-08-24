import { env } from '@config/env'
import { createHttpTransport, type Transport } from './transport'
import { createMockTransport } from './mockTransport'
import { activitiesApi } from './endpoints/activities'
import { playApi } from './endpoints/play'
import { sessionsApi } from './endpoints/sessions'
import { missionControlApi } from './endpoints/missionControl'

/**
 * The app's single entry point to the backend.
 *
 * Feature code imports `api` and never constructs a transport, so which backend
 * is in play (mock today, a chosen provider later) is a one-line decision here.
 */
export function createApiClient(transport: Transport, opsTransport: Transport | null = null) {
  return {
    transport,
    activities: activitiesApi(transport),
    /** Share-link resolution (draft; runs alongside `activities`). */
    play: playApi(transport),
    sessions: sessionsApi(transport),
    missionControl: opsTransport ? missionControlApi(opsTransport) : null,
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

function defaultTransport(): Transport {
  if (!env.api.isConfigured) return createMockTransport()
  return createHttpTransport({
    baseUrl: env.api.baseUrl,
    contractVersion: env.api.contractVersion,
    timeoutMs: env.api.timeoutMs,
  })
}

function defaultOpsTransport(): Transport | null {
  if (!env.ops.isConfigured) return null
  return createHttpTransport({
    baseUrl: env.ops.baseUrl,
    contractVersion: env.api.contractVersion,
    timeoutMs: env.api.timeoutMs,
    credentials: 'include',
  })
}

export const api = createApiClient(defaultTransport(), defaultOpsTransport())
