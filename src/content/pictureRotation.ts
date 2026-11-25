import { PUZZLE_LIBRARY, type PuzzlePicture } from './puzzleLibrary'

/**
 * Device-local memory of the last rotated library picture so consecutive games
 * on the same device never open with the exact same picture twice in a row.
 */
export const LAST_PUZZLE_PICTURE_STORAGE_KEY = 'sal0mander.lastPuzzlePictureKey.v1'

/**
 * Device-local memory of the most recent rotated pictures (newest first).
 * A page load can pick more than once (a bundle refetch, React StrictMode in dev),
 * so remembering only the last key let the picture actually on screen come back
 * the very next game. Remembering several keys closes that gap.
 */
export const RECENT_PUZZLE_PICTURES_STORAGE_KEY = 'sal0mander.recentPuzzlePictureKeys.v1'

/**
 * Samuel's choice (Nov 25 2026): a device's FIRST jigsaw / Picture Reveal game opens on
 * the SAL0MANder rover expedition picture. Every game after that rotates as usual.
 */
export const FIRST_GAME_PICTURE_KEY = 'sal0mander-rover-expedition'

/** Device-local flag set once the first-game picture has been shown. */
export const FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY = 'sal0mander.firstGamePictureShown.v1'

/** How many recent picks to avoid when the pool is large enough. */
export const RECENT_PICTURE_MEMORY = 10

/**
 * Old hard-coded default pictures retired from default/fallback use in PJ-B.
 * Their image files remain untouched on disk so existing Gift links stay valid.
 */
export const RETIRED_DEFAULT_PICTURES = [
  'Unity built-in preset index 0 (PuzzleImages/SalamanderForest, sal0mander-space-default-v1, Dog, Cat, Lotus)',
  'public/images/library/square/fantasy/salamander_forest.webp (previously hard-coded as HomePage HERO_PICTURE)',
  'media_demo_1024 / https://cdn.example.invalid/puzzles/media_demo_1024/display_1024.png (previously hard-coded in mockTransport demoPlayBundle)',
] as const

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

let memoryLastPictureKey: string | null = null
let memoryRecentPictureKeys: string[] = []
let memoryFirstGamePictureShown = false
const gameLoadPictures = new Map<string, PuzzlePicture>()

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export function findLibraryPicture(
  key: string | null | undefined,
  pool: readonly PuzzlePicture[] = PUZZLE_LIBRARY,
): PuzzlePicture | undefined {
  if (!key) return undefined
  const trimmed = key.trim()
  if (!trimmed) return undefined
  return pool.find((picture) => picture.key === trimmed)
}

export function findLibraryPictureBySrc(
  urlOrPath: string | null | undefined,
  pool: readonly PuzzlePicture[] = PUZZLE_LIBRARY,
): PuzzlePicture | undefined {
  if (!urlOrPath) return undefined
  const normalized = urlOrPath.trim()
  if (!normalized) return undefined
  return pool.find((picture) => normalized === picture.src || normalized.endsWith(picture.src))
}

export function readLastPuzzlePictureKey(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): string | null {
  if (storage) {
    try {
      const value = storage.getItem(LAST_PUZZLE_PICTURE_STORAGE_KEY)
      if (value) return value
    } catch {
      // Storage unavailable (private browsing / quota / restricted iframe)
    }
  }
  return memoryLastPictureKey
}

export function writeLastPuzzlePictureKey(
  key: string,
  storage: Pick<Storage, 'setItem'> | null = defaultStorage(),
): void {
  memoryLastPictureKey = key
  if (!storage) return
  try {
    storage.setItem(LAST_PUZZLE_PICTURE_STORAGE_KEY, key)
  } catch {
    // Keep memory fallback only when localStorage refuses writes
  }
}

/**
 * Recent rotated picture keys on this device, newest first. The last-played key
 * (which explicit writes may set on its own) is always first.
 */
export function readRecentPuzzlePictureKeys(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): string[] {
  let keys: string[] | null = null
  if (storage) {
    try {
      const raw = storage.getItem(RECENT_PUZZLE_PICTURES_STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          keys = parsed.filter((k): k is string => typeof k === 'string' && k.length > 0)
        }
      }
    } catch {
      // Unreadable or corrupt history: fall back to memory
    }
  }
  if (!keys) keys = [...memoryRecentPictureKeys]
  const last = readLastPuzzlePictureKey(storage)
  if (last) keys = [last, ...keys.filter((k) => k !== last)]
  return keys.slice(0, RECENT_PICTURE_MEMORY)
}

function recordPickedPicture(key: string, storage: StorageLike | null): void {
  const previous = readRecentPuzzlePictureKeys(storage)
  const next = [key, ...previous.filter((k) => k !== key)].slice(0, RECENT_PICTURE_MEMORY)
  memoryRecentPictureKeys = next
  writeLastPuzzlePictureKey(key, storage)
  if (!storage) return
  try {
    storage.setItem(RECENT_PUZZLE_PICTURES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Keep memory fallback only when localStorage refuses writes
  }
}

function firstGamePictureShown(storage: Pick<Storage, 'getItem'> | null): boolean {
  if (memoryFirstGamePictureShown) return true
  if (!storage) return false
  try {
    return storage.getItem(FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markFirstGamePictureShown(storage: Pick<Storage, 'setItem'> | null): void {
  memoryFirstGamePictureShown = true
  if (!storage) return
  try {
    storage.setItem(FIRST_GAME_PICTURE_SHOWN_STORAGE_KEY, '1')
  } catch {
    // Keep memory fallback only when localStorage refuses writes
  }
}

/** Clear per-load memoized picks (mirrors a real browser page reload). */
export function resetPictureRotationLoadCache(): void {
  gameLoadPictures.clear()
}

/** Test-only helper to clear the in-memory fallback alongside localStorage. */
export function resetPictureRotationMemory(): void {
  memoryLastPictureKey = null
  memoryRecentPictureKeys = []
  memoryFirstGamePictureShown = false
  gameLoadPictures.clear()
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value >= 1) return 0.999999999
  return value
}

export type PickPictureOptions = {
  /** Restrict candidates to a board shape when a surface has a fixed frame. */
  shape?: PuzzlePicture['shape']
  /** Extra key to exclude in addition to the device's recent keys. */
  excludeKey?: string | null
  /** Override pool (defaults to PUZZLE_LIBRARY). */
  pool?: readonly PuzzlePicture[]
  /** Override storage (defaults to window.localStorage). */
  storage?: StorageLike | null
  /** Override RNG (defaults to Math.random). */
  random?: () => number
  /**
   * Open a device's first game on FIRST_GAME_PICTURE_KEY (default true). Surfaces that
   * are not a game, such as the home page hero, pass false so they do not use it up.
   */
  firstGamePicture?: boolean
  /**
   * Override which picture key opens a device's first game (defaults to FIRST_GAME_PICTURE_KEY).
   * Pass `null` to skip the fixed first picture and rotate immediately.
   */
  firstPictureKey?: string | null
}

/**
 * Pick a picture from PUZZLE_LIBRARY at the start of a new game. A device's first game
 * opens on FIRST_GAME_PICTURE_KEY (unless firstGamePicture is false); after that it picks
 * at random. It avoids
 * the device's recent pictures (up to RECENT_PICTURE_MEMORY) and never repeats the
 * last picture played (as long as at least two eligible pictures exist). In a small
 * pool the oldest recent keys are allowed back first.
 */
export function pickNextLibraryPicture(options: PickPictureOptions = {}): PuzzlePicture {
  const pool = options.pool ?? PUZZLE_LIBRARY
  if (pool.length === 0) {
    throw new Error('PUZZLE_LIBRARY must contain at least one picture.')
  }

  const shaped = options.shape ? pool.filter((picture) => picture.shape === options.shape) : pool
  const eligible = shaped.length > 0 ? shaped : pool

  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const recent = readRecentPuzzlePictureKeys(storage)
  const forced = options.excludeKey ?? null

  // First game on this device: open on Samuel's chosen picture, then rotate.
  const firstKey =
    options.firstPictureKey === undefined ? FIRST_GAME_PICTURE_KEY : options.firstPictureKey
  if (
    options.firstGamePicture !== false &&
    firstKey &&
    !forced &&
    !firstGamePictureShown(storage)
  ) {
    const first = eligible.find((picture) => picture.key === firstKey)
    if (first && recent[0] !== first.key) {
      markFirstGamePictureShown(storage)
      recordPickedPicture(first.key, storage)
      return first
    }
  }

  const without = (keys: readonly string[], extra: string | null) => {
    const excluded = new Set(keys)
    if (extra) excluded.add(extra)
    return eligible.filter((picture) => !excluded.has(picture.key))
  }

  let candidates: PuzzlePicture[] = []
  // Widest exclusion first, then let the oldest recent keys back in.
  for (let size = recent.length; size >= 1 && candidates.length === 0; size -= 1) {
    candidates = without(recent.slice(0, size), forced)
  }
  // Tiny pool: avoiding the last-played key matters more than excludeKey.
  if (candidates.length === 0 && recent.length > 0) candidates = without(recent.slice(0, 1), null)
  if (candidates.length === 0) candidates = without([], forced)
  if (candidates.length === 0) candidates = [...eligible]

  const rng = options.random ?? Math.random
  const index = Math.floor(clampUnitInterval(rng()) * candidates.length)
  const chosen = candidates[index]!
  recordPickedPicture(chosen.key, storage)
  return chosen
}

export type PickPictureForLoadOptions = PickPictureOptions & {
  /**
   * Optional already-rotated picture key returned by the initial bundle fetch.
   * When present on the first pick for `loadKey`, it is latched and recorded
   * rather than rolling a second time; subsequent calls for the same `loadKey`
   * always return the latched picture.
   */
  preferredKey?: string | null
}

/**
 * Pick once per activity page load.
 *
 * Keying by a per-load identifier (such as `${activityId}:${attemptKey}:${loadToken}`)
 * ensures StrictMode double-mounts and refetches inside the same load reuse the
 * already-chosen picture instead of re-picking and advancing the rotation window.
 */
export function pickPictureForGameLoad(
  loadKey: string,
  options: PickPictureForLoadOptions = {},
): PuzzlePicture {
  const cached = gameLoadPictures.get(loadKey)
  if (cached) return cached

  const pool = options.pool ?? PUZZLE_LIBRARY
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const preferred = findLibraryPicture(options.preferredKey, pool)
  const chosen = preferred ?? pickNextLibraryPicture(options)
  if (preferred) {
    recordPickedPicture(preferred.key, storage)
  }
  gameLoadPictures.set(loadKey, chosen)
  return chosen
}

/** Replace the memoized picture for an active load (e.g., user taps "New picture"). */
export function rotatePictureForGameLoad(
  loadKey: string,
  options: PickPictureOptions = {},
): PuzzlePicture {
  const current = gameLoadPictures.get(loadKey)
  const next = pickNextLibraryPicture({
    ...options,
    excludeKey: options.excludeKey ?? current?.key,
  })
  gameLoadPictures.set(loadKey, next)
  return next
}

export type ResolveActivityPictureOptions = PickPictureOptions & {
  /** Teacher or parent explicit picture key; always wins when valid. */
  explicitKey?: string | null
}

/**
 * Resolve the picture for a jigsaw activity:
 * - If a teacher or parent explicitly chose a valid library picture, honor it.
 * - Otherwise rotate randomly across PUZZLE_LIBRARY, avoiding this device's recent
 *   pictures (never falling back to the old salamander default).
 */
export function resolveActivityPicture(options: ResolveActivityPictureOptions = {}): {
  picture: PuzzlePicture
  source: 'explicit' | 'rotated'
} {
  const pool = options.pool ?? PUZZLE_LIBRARY
  const explicit = findLibraryPicture(options.explicitKey, pool)
  if (explicit) {
    return { picture: explicit, source: 'explicit' }
  }
  return {
    picture: pickNextLibraryPicture(options),
    source: 'rotated',
  }
}
