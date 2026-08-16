import { GuestActivityBundleSchema, type GuestActivityBundle } from '@contracts/v1'
import type { Transport } from '../transport'

/**
 * Activity reads.
 *
 * The Guest Play fetch is the highest-traffic read on the platform (one per
 * student per shared link) and is intentionally auth-free and cacheable at the
 * CDN edge — it returns no PII and is identical for every student on a link.
 */
export function activitiesApi(transport: Transport) {
  return {
    /** Resolve a share link to the currently published version. */
    getGuestBundle(activityId: string, signal?: AbortSignal): Promise<GuestActivityBundle> {
      return transport.request(
        {
          method: 'GET',
          path: `/guest/activities/${encodeURIComponent(activityId)}`,
          ...(signal ? { signal } : {}),
        },
        GuestActivityBundleSchema,
      )
    },
  }
}
