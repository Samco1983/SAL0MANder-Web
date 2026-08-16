import { env } from '@config/env'
import { createHttpTransport, type Transport } from './transport'
import { createMockTransport } from './mockTransport'
import { activitiesApi } from './endpoints/activities'
import { sessionsApi } from './endpoints/sessions'

/**
 * The app's single entry point to the backend.
 *
 * Feature code imports `api` and never constructs a transport, so which backend
 * is in play (mock today, a chosen provider later) is a one-line decision here.
 */
export function createApiClient(transport: Transport) {
  return {
    transport,
    activities: activitiesApi(transport),
    sessions: sessionsApi(transport),
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

export const api = createApiClient(defaultTransport())
