import { env, type Env } from '@config/env'
import { api } from '@api/client'
import type { Transport } from '@api/transport'
import { createMemoryStorage } from './providers/memoryStorage'
import { createHttpStorage } from './providers/httpStorage'
import type { MediaStorage } from './provider'

export * from './provider'

/**
 * Chooses a provider. Pure and exported so the fallback rule is testable —
 * asking for `http` without a configured API silently yields memory storage,
 * which is the right behavior but a surprising one to discover in production.
 */
export function selectStorage(config: Env, transport: Transport): MediaStorage {
  if (config.storage.provider === 'http' && config.api.isConfigured) {
    return createHttpStorage(transport, config.storage.cdnBaseUrl)
  }
  return createMemoryStorage()
}

/** The app's media storage. Swapping providers is a config change. */
export const mediaStorage: MediaStorage = selectStorage(env, api.transport)
