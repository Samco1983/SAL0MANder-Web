import { PlayBundleSchema, type PlayBundle } from '@contracts/v1'
import type { Transport } from '../transport'

/**
 * Share-link resolution — `GET /v1/play/{shareCode}`.
 *
 * DRAFT: adopts the shape in `API_CONTRACT.md`. P-002 (shareCode distinct from
 * activityId) is still Proposed, so this runs alongside the existing
 * `activityId` path rather than replacing it.
 *
 * The highest-traffic read on the platform — one per student per shared link —
 * and deliberately auth-free and cacheable at the edge. It returns no PII and
 * is identical for every student on a link.
 */
export function playApi(transport: Transport) {
  return {
    /** Resolve a share code to the immutable bundle it currently points at. */
    resolve(shareCode: string, signal?: AbortSignal): Promise<PlayBundle> {
      return transport.request(
        {
          method: 'GET',
          // Codes are case-insensitive on the wire; normalizing here keeps a
          // teacher reading one aloud from producing a cache miss per casing.
          path: `/v1/play/${encodeURIComponent(shareCode.trim().toUpperCase())}`,
          ...(signal ? { signal } : {}),
        },
        PlayBundleSchema,
      )
    },
  }
}
