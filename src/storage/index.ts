import { env } from '@config/env'
import { api } from '@api/client'
import { createMemoryStorage } from './providers/memoryStorage'
import { createHttpStorage } from './providers/httpStorage'
import type { MediaStorage } from './provider'

export * from './provider'

function selectStorage(): MediaStorage {
  if (env.storage.provider === 'http' && env.api.isConfigured) {
    return createHttpStorage(api.transport, env.storage.cdnBaseUrl)
  }
  return createMemoryStorage()
}

/** The app's media storage. Swapping providers is a config change. */
export const mediaStorage: MediaStorage = selectStorage()
