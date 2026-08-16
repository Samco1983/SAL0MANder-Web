import { newId, type GuestIdentity } from '@contracts/v1'

/**
 * Guest identity — the distribution-critical path.
 *
 * A student who opens a teacher's share link must be able to play immediately:
 * no email, no password, no account, no name prompt. The guest token is a
 * device-local random string that exists only so a session can be resumed on
 * the same device and, if the student later signs up, claimed by a real profile.
 *
 * It is NOT authentication. It carries no PII, is never sent as a bearer token,
 * and grants no access to anything beyond a session the same device created.
 * Any future backend must treat it as a correlation hint, never as identity.
 */

export const GUEST_TOKEN_KEY = 'sal0mander.guest.token'
export const GUEST_NAME_KEY = 'sal0mander.guest.displayName'

/** Storage can be blocked (private mode, embedded frame). Guests still play. */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* non-fatal: the session simply won't survive a reload */
  }
}

/** Returns the device's guest token, minting one on first use. */
export function getOrCreateGuestToken(): string {
  const existing = safeGet(GUEST_TOKEN_KEY)
  if (existing && existing.length >= 8) return existing
  const token = newId()
  safeSet(GUEST_TOKEN_KEY, token)
  return token
}

export function getGuestDisplayName(): string | undefined {
  return safeGet(GUEST_NAME_KEY) ?? undefined
}

/** Optional, cosmetic, student-chosen. Never verified, never required. */
export function setGuestDisplayName(name: string): void {
  safeSet(GUEST_NAME_KEY, name.slice(0, 40))
}

export function getGuestIdentity(): GuestIdentity {
  const displayName = getGuestDisplayName()
  return {
    kind: 'guest',
    guestToken: getOrCreateGuestToken(),
    ...(displayName ? { displayName } : {}),
  }
}

export function clearGuestIdentity(): void {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY)
    localStorage.removeItem(GUEST_NAME_KEY)
  } catch {
    /* non-fatal */
  }
}
