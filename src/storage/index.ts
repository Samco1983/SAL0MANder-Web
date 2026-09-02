import { env, type Env } from '@config/env'
import { api } from '@api/client'
import type { Transport } from '@api/transport'
import { createMemoryStorage } from './providers/memoryStorage'
import { createHttpStorage } from './providers/httpStorage'
import { UploadsDisabledError, type MediaStorage } from './provider'
import { optimizeImages } from './optimizeImages'

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

/**
 * Fail-closed gate on custom photo upload (D-017).
 *
 * The upload path is fully built and tested; it is switched off until the
 * review workflow and disclaimer exist. Wrapping rather than branching means
 * the capability stays exercised by tests and cannot rot while it waits, and
 * turning it on is one environment variable rather than a code change.
 *
 * Only `upload` is gated. Reading and removing already-stored media stay
 * available, so nothing that exists becomes unreachable while the switch is
 * off.
 */
export function guardUploads(storage: MediaStorage, enabled: boolean): MediaStorage {
  if (enabled) return storage
  return {
    ...storage,
    upload() {
      return Promise.reject(new UploadsDisabledError())
    },
  }
}

/**
 * The app's media storage. Swapping providers is a config change.
 *
 * Wrapped rather than branched, in this order:
 *
 *   selectStorage  ->  optimizeImages  ->  guardUploads
 *
 * `optimizeImages` sits inside the gate so that turning uploads on cannot turn
 * optimisation on separately — there is no configuration in which an
 * unprocessed photo reaches a provider. Unity's own WebGL picker accepts up to
 * 12 MB and resizes nothing, and the art run on 2026-09-02 measured 13.9 MB of
 * source images coming out at 932 KB. The cost of skipping it is thirty
 * students opening the same activity at once on school wifi.
 */
export const mediaStorage: MediaStorage = guardUploads(
  optimizeImages(selectStorage(env, api.transport)),
  env.features.customMediaUpload,
)
