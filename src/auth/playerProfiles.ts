import { newId } from '@contracts/v1'
import {
  GUEST_NAME_KEY,
  GUEST_TOKEN_KEY,
  getGuestDisplayName,
  getOrCreateGuestToken,
} from './guestIdentity'

/**
 * Named players on one device.
 *
 * The case this exists for is a shared classroom tablet: two or three kids use
 * the same iPad across a period, and each wants to come back to their own
 * progress. A single guest token cannot express that — whoever played last owns
 * everything.
 *
 * ## Still not identity
 *
 * A profile is a device-local handle plus its own guest token. It is not an
 * account, it is not verified, and it never leaves the device. Nothing here is
 * sent to a backend as proof of who someone is — the token stays what
 * `guestIdentity.ts` says it is: a correlation hint.
 *
 * That is the whole reason progress can be tied to a name at all. A handle that
 * lives only in this browser is not retained data about a child; the same handle
 * saved server-side beside scores is. See
 * `docs/coordination/DECISION-PLAYERS-NOT-STUDENTS.md`.
 *
 * ## Never a gate
 *
 * Nothing in this module may be required before play. Opening a share link and
 * playing must work with no profile chosen, no handle typed, and localStorage
 * unavailable (CLAUDE.md non-negotiable 3). Every function here degrades to a
 * working anonymous player rather than throwing.
 */

export const PROFILES_KEY = 'sal0mander.players'
export const ACTIVE_PROFILE_KEY = 'sal0mander.players.active'

/** Presets offered first, so a blank box never invites a real name. */
export const PRESET_HANDLES = [
  'Player 1',
  'Player 2',
  'Player 3',
  'Player 4',
  'Player 5',
  'Player 6',
] as const

/** Matches `setGuestDisplayName`, so a handle cannot mean two lengths. */
export const MAX_HANDLE_LENGTH = 40

/**
 * Enough for a shared tablet, not enough to become a roster.
 *
 * A cap is a feature here: an unbounded list on a class device drifts into
 * something that looks like a class list, which is the thing this design is
 * built to avoid.
 */
export const MAX_PROFILES = 8

export type PlayerProfile = {
  /** The profile's guest token. Sessions correlate to this, so progress follows it. */
  token: string
  /** Self-chosen. A preset, or whatever they typed. Never verified. */
  handle: string
}

type ProfileStore = {
  profiles: PlayerProfile[]
  activeToken?: string
}

/* Storage can be blocked (private mode, embedded frame). Players still play. */
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
    /* non-fatal — an unnamed player is a working player */
  }
}

function isProfile(value: unknown): value is PlayerProfile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PlayerProfile>
  return (
    typeof candidate.token === 'string' &&
    candidate.token.length >= 8 &&
    typeof candidate.handle === 'string' &&
    candidate.handle.trim().length > 0
  )
}

/**
 * Read the stored list, tolerating anything.
 *
 * Deliberately forgiving: this is localStorage, which another tab, an extension,
 * or a half-finished write can corrupt. A parse failure must cost a player their
 * saved handles, never their ability to play, so a bad store reads as empty.
 */
function readStore(): ProfileStore {
  const raw = safeGet(PROFILES_KEY)
  if (!raw) return { profiles: [] }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { profiles: [] }
    return {
      profiles: parsed.filter(isProfile).slice(0, MAX_PROFILES),
      activeToken: safeGet(ACTIVE_PROFILE_KEY) ?? undefined,
    }
  } catch {
    return { profiles: [] }
  }
}

function writeProfiles(profiles: PlayerProfile[]): void {
  safeSet(PROFILES_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES)))
}

/**
 * Adopt an existing single-token guest as the first profile.
 *
 * Without this, shipping profiles silently orphans every player already mid-way
 * through something: their sessions correlate to the old token, a fresh profile
 * mints a new one, and their progress becomes unreachable while appearing to
 * have been deleted. Runs once — after the first migration the profile list is
 * non-empty, so this does nothing.
 */
function migrateLegacyGuest(): PlayerProfile[] {
  const legacyToken = safeGet(GUEST_TOKEN_KEY)
  if (!legacyToken || legacyToken.length < 8) return []
  return [{ token: legacyToken, handle: getGuestDisplayName() ?? PRESET_HANDLES[0] }]
}

export function listProfiles(): PlayerProfile[] {
  const { profiles } = readStore()
  if (profiles.length > 0) return profiles

  const migrated = migrateLegacyGuest()
  if (migrated.length > 0) writeProfiles(migrated)
  return migrated
}

/**
 * Who is playing right now, or `undefined` if nobody has chosen.
 *
 * `undefined` is a legitimate steady state, not an error to resolve: a player
 * who never opens the picker plays anonymously against the plain guest token,
 * exactly as before this module existed.
 */
export function getActiveProfile(): PlayerProfile | undefined {
  const profiles = listProfiles()
  if (profiles.length === 0) return undefined
  const activeToken = safeGet(ACTIVE_PROFILE_KEY)
  return profiles.find((p) => p.token === activeToken)
}

/** A handle already in use, so two players cannot both be "Player 2". */
export function isHandleTaken(handle: string, profiles = listProfiles()): boolean {
  const normalized = handle.trim().toLowerCase()
  return profiles.some((p) => p.handle.trim().toLowerCase() === normalized)
}

/** The first preset nobody on this device has taken. */
export function suggestHandle(profiles = listProfiles()): string {
  return PRESET_HANDLES.find((h) => !isHandleTaken(h, profiles)) ?? ''
}

export type CreateResult =
  | { ok: true; profile: PlayerProfile }
  | { ok: false; reason: 'empty' | 'taken' | 'full' }

/**
 * Add a player and make them active.
 *
 * Returns a reason rather than throwing: every failure here is something a
 * child typed, and the picker needs to say what happened in words, not crash.
 */
export function createProfile(handle: string): CreateResult {
  const trimmed = handle.trim().slice(0, MAX_HANDLE_LENGTH)
  if (!trimmed) return { ok: false, reason: 'empty' }

  const profiles = listProfiles()
  if (profiles.length >= MAX_PROFILES) return { ok: false, reason: 'full' }
  if (isHandleTaken(trimmed, profiles)) return { ok: false, reason: 'taken' }

  /*
    Adoption of an existing guest happens in `migrateLegacyGuest`, on read — by
    the time anyone creates a profile, a legacy player is already in the list and
    holding their original token. This branch only fires when the device has no
    usable guest token at all, where `getOrCreateGuestToken` mints one; it is
    kept over a bare `newId()` so the device's single-token key and the first
    profile agree rather than drifting apart from the start.
  */
  const token = profiles.length === 0 ? getOrCreateGuestToken() : newId()
  const profile: PlayerProfile = { token, handle: trimmed }

  const next = [...profiles, profile]
  writeProfiles(next)
  setActiveProfile(token)
  return { ok: true, profile }
}

/**
 * Switch players.
 *
 * Also rewrites the legacy single-name key so anything still reading
 * `getGuestDisplayName()` sees the player who is actually playing, rather than
 * whoever set it last.
 */
export function setActiveProfile(token: string): PlayerProfile | undefined {
  const profile = listProfiles().find((p) => p.token === token)
  if (!profile) return undefined
  safeSet(ACTIVE_PROFILE_KEY, token)
  safeSet(GUEST_NAME_KEY, profile.handle)
  return profile
}

/**
 * Rename in place, keeping the token.
 *
 * Keeping the token is the point: the handle is a label on progress, so
 * changing it must not orphan what has been played.
 */
export function renameProfile(token: string, handle: string): CreateResult {
  const trimmed = handle.trim().slice(0, MAX_HANDLE_LENGTH)
  if (!trimmed) return { ok: false, reason: 'empty' }

  const profiles = listProfiles()
  const others = profiles.filter((p) => p.token !== token)
  if (isHandleTaken(trimmed, others)) return { ok: false, reason: 'taken' }

  const target = profiles.find((p) => p.token === token)
  if (!target) return { ok: false, reason: 'empty' }

  const renamed: PlayerProfile = { ...target, handle: trimmed }
  writeProfiles(profiles.map((p) => (p.token === token ? renamed : p)))
  if (safeGet(ACTIVE_PROFILE_KEY) === token) safeSet(GUEST_NAME_KEY, trimmed)
  return { ok: true, profile: renamed }
}
