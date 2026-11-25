import type { ResolvedMusicTrack } from './musicPlaylist'

/** Device-local storage keys (prefixed `sal0mander.` so "Delete saved data" clears them). */
export const MUSIC_ENABLED_STORAGE_KEY = 'sal0mander.music.enabled'
export const MUSIC_PLAYED_STORAGE_PREFIX = 'sal0mander.music.played.'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

type PlayedCycleState = {
  played: string[]
  last: string | null
}

const memoryPlayedByGame = new Map<string, PlayedCycleState>()
const memoryEnabledByKey = new Map<string, boolean>()
const gameLoadTracks = new Map<string, ResolvedMusicTrack>()

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value >= 1) return 0.999999999
  return value
}

export function readPlayedCycle(
  gameId: string,
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): PlayedCycleState {
  if (storage) {
    try {
      const raw = storage.getItem(`${MUSIC_PLAYED_STORAGE_PREFIX}${gameId}`)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && 'played' in parsed) {
          const obj = parsed as { played?: unknown; last?: unknown }
          if (Array.isArray(obj.played)) {
            return {
              played: obj.played.filter((id): id is string => typeof id === 'string' && id.length > 0),
              last: typeof obj.last === 'string' && obj.last.length > 0 ? obj.last : null,
            }
          }
        }
      }
    } catch {
      // Corrupt or blocked storage: fall back to memory
    }
  }
  return memoryPlayedByGame.get(gameId) ?? { played: [], last: null }
}

function writePlayedCycle(
  gameId: string,
  state: PlayedCycleState,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  memoryPlayedByGame.set(gameId, state)
  if (!storage) return
  try {
    storage.setItem(`${MUSIC_PLAYED_STORAGE_PREFIX}${gameId}`, JSON.stringify(state))
  } catch {
    // Keep memory fallback only when localStorage refuses writes
  }
}

export function readMusicEnabled(
  gameId: string,
  defaultEnabled = true,
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): boolean {
  const key = defaultEnabled ? MUSIC_ENABLED_STORAGE_KEY : `${MUSIC_ENABLED_STORAGE_KEY}.${gameId}`
  if (storage) {
    try {
      const raw = storage.getItem(key)
      if (raw === 'on' || raw === '1' || raw === 'true') return true
      if (raw === 'off' || raw === '0' || raw === 'false') return false
    } catch {
      // Fall through to memory / default
    }
  }
  return memoryEnabledByKey.get(key) ?? defaultEnabled
}

export function writeMusicEnabled(
  gameId: string,
  enabled: boolean,
  defaultEnabled = true,
  storage: Pick<Storage, 'setItem'> | null = defaultStorage(),
): void {
  const key = defaultEnabled ? MUSIC_ENABLED_STORAGE_KEY : `${MUSIC_ENABLED_STORAGE_KEY}.${gameId}`
  memoryEnabledByKey.set(key, enabled)
  if (!storage) return
  try {
    storage.setItem(key, enabled ? 'on' : 'off')
  } catch {
    // Keep memory fallback only
  }
}

export function resetMusicRotationLoadCache(): void {
  gameLoadTracks.clear()
}

export function resetMusicRotationMemory(): void {
  memoryPlayedByGame.clear()
  memoryEnabledByKey.clear()
  gameLoadTracks.clear()
}

export type PickTrackOptions = {
  excludeId?: string | null
  storage?: StorageLike | null
  random?: () => number
}

/**
 * Pick the next song for `gameId` from `tracks` using an exhaustion cycle:
 * no song repeats until every enabled song for that game has played once.
 * When a new cycle begins, the immediately previous song is excluded first so
 * consecutive loads never repeat across a cycle boundary either.
 */
export function pickNextGameTrack(
  gameId: string,
  tracks: readonly ResolvedMusicTrack[],
  options: PickTrackOptions = {},
): ResolvedMusicTrack | null {
  if (tracks.length === 0) return null
  const storage = options.storage === undefined ? defaultStorage() : options.storage

  if (tracks.length === 1) {
    const sole = tracks[0]!
    writePlayedCycle(gameId, { played: [sole.id], last: sole.id }, storage)
    return sole
  }

  const validIds = new Set(tracks.map((track) => track.id))
  const state = readPlayedCycle(gameId, storage)
  const played = state.played.filter((id) => validIds.has(id))
  const playedSet = new Set(played)
  const excludeId = options.excludeId ?? null

  let candidates = tracks.filter((track) => !playedSet.has(track.id))
  let startingNewCycle = false

  if (candidates.length === 0) {
    startingNewCycle = true
    candidates = tracks.filter((track) => track.id !== state.last && track.id !== excludeId)
    if (candidates.length === 0) {
      candidates = tracks.filter((track) => track.id !== state.last)
    }
    if (candidates.length === 0) {
      candidates = [...tracks]
    }
  } else if (excludeId && candidates.length > 1) {
    candidates = candidates.filter((track) => track.id !== excludeId)
  }

  const rng = options.random ?? Math.random
  const index = Math.floor(clampUnitInterval(rng()) * candidates.length)
  const chosen = candidates[index]!
  const nextPlayed = startingNewCycle ? [chosen.id] : [...played, chosen.id]
  writePlayedCycle(gameId, { played: nextPlayed, last: chosen.id }, storage)
  return chosen
}

/**
 * Memoize one song pick per game load so React StrictMode double-mounts or
 * re-renders reuse the active song rather than advancing the cycle twice.
 */
export function pickTrackForGameLoad(
  gameId: string,
  loadKey: string,
  tracks: readonly ResolvedMusicTrack[],
  options: PickTrackOptions = {},
): ResolvedMusicTrack | null {
  const cacheKey = `${gameId}:${loadKey}`
  const cached = gameLoadTracks.get(cacheKey)
  if (cached && tracks.some((track) => track.id === cached.id)) {
    return cached
  }
  const chosen = pickNextGameTrack(gameId, tracks, options)
  if (chosen) {
    gameLoadTracks.set(cacheKey, chosen)
  }
  return chosen
}

/** Advance to the next unplayed song inside an active page load. */
export function rotateTrackForGameLoad(
  gameId: string,
  loadKey: string,
  tracks: readonly ResolvedMusicTrack[],
  options: PickTrackOptions = {},
): ResolvedMusicTrack | null {
  const cacheKey = `${gameId}:${loadKey}`
  const current = gameLoadTracks.get(cacheKey)
  const next = pickNextGameTrack(gameId, tracks, {
    ...options,
    excludeId: options.excludeId ?? current?.id,
  })
  if (next) {
    gameLoadTracks.set(cacheKey, next)
  }
  return next
}
