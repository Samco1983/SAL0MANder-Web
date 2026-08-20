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
export function buildShareLink(
  activityId: string,
  baseUrl: string,
  basePath: string = readBasePath(),
): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  // The base belongs HERE and not in `buildPath`. `buildPath` feeds <Link>,
  // and React Router prepends the router's basename itself — including it in
  // both produces `/SAL0MANder-Web/SAL0MANder-Web/play/x`. A share link is an
  // absolute string pasted into Classroom or printed on a QR code, so nothing
  // downstream will add the prefix for it.
  const prefix = basePath.replace(/\/+$/, '')
  return `${origin.replace(/\/+$/, '')}${prefix}${buildPath.guestPlay(activityId)}`
}

/** Where the app is mounted: '/' on a custom domain, '/SAL0MANder-Web/' on project Pages. */
export function readBasePath(): string {
  const raw = (import.meta.env?.BASE_URL as string | undefined) ?? '/'
  return raw || '/'
}
