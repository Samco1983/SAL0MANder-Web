/**
 * Canonical route paths and link builders.
 *
 * Share links are a distribution-critical surface (TPT / Google Classroom /
 * LMS / QR). Their shape is defined here ONCE so it can be versioned and kept
 * stable — a teacher's printed QR code must not break when the site is
 * restructured.
 */

export const paths = {
  home: '/',
  /** Guest Play — opened from a teacher's share link. No account required. */
  guestPlay: '/play/:activityId',
  /** Guest Play with no activity yet (demo / picker). */
  guestPlayIndex: '/play',
  profile: '/profile',
  /** Bare Unity WebGL host, used for smoke-testing a build in isolation. */
  unity: '/unity',
  notFound: '*',
} as const

export const buildPath = {
  guestPlay: (activityId: string) => `/play/${encodeURIComponent(activityId)}`,
} as const

/**
 * Absolute, shareable URL for an activity. This is the string a teacher pastes
 * into TPT / Classroom / a QR code, so it must stay stable across releases.
 */
export function buildShareLink(activityId: string, baseUrl: string): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${origin.replace(/\/+$/, '')}${buildPath.guestPlay(activityId)}`
}
