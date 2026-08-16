import type { ApiError } from '@api/errors'

/**
 * What went wrong with a share link, in terms a student and a teacher can act
 * on differently.
 *
 * `not_found` alone conflates three situations that need three responses: a
 * mistyped or truncated code, a link the teacher deliberately revoked, and an
 * activity that is no longer published. Telling a student "check the link" when
 * their teacher unpublished it sends them to retype a code that will never
 * work, and sends the teacher a support message they can't act on.
 *
 * The distinction rides on `serverCode` rather than new `ApiErrorCode` members,
 * because the shared error vocabulary is still open (casing unresolved under
 * the envelope discussion). This needs no contract change to be useful.
 */
export type LinkState = 'revoked' | 'unpublished' | 'missing' | 'unavailable'

const BY_SERVER_CODE: Record<string, LinkState> = {
  SHARE_LINK_REVOKED: 'revoked',
  ACTIVITY_UNPUBLISHED: 'unpublished',
}

export function linkStateFrom(error: ApiError): LinkState {
  const known = error.serverCode ? BY_SERVER_CODE[error.serverCode.toUpperCase()] : undefined
  if (known) return known
  if (error.code === 'not_found') return 'missing'
  return 'unavailable'
}

type Copy = { title: string; body: string }

/**
 * Student-facing copy. Chosen from the state, never echoed from the server.
 * Each one tells the student whether *they* can do anything about it.
 */
export function linkCopy(state: LinkState, error: ApiError): Copy {
  switch (state) {
    case 'revoked':
      return {
        title: 'This link was turned off',
        body: 'Your teacher turned off this share link. Ask them for a new one — retyping this one will not help.',
      }
    case 'unpublished':
      return {
        title: 'This activity is not available right now',
        body: 'Your teacher unpublished this activity. It may come back, so it is worth checking with them before trying again.',
      }
    case 'missing':
      return {
        title: "We couldn't find that activity",
        body: 'Double-check the link or code — a single wrong character is enough to break it.',
      }
    default:
      return { title: 'Activity unavailable', body: error.userMessage }
  }
}

/** Retrying only makes sense when the failure might be transient. */
export function isRecoverable(state: LinkState, error: ApiError): boolean {
  return state === 'unavailable' && error.retryable
}
