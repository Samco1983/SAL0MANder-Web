import { PUZZLE_LIBRARY, type PuzzlePicture } from './puzzleLibrary'

/**
 * Device-local memory of the last rotated library picture so consecutive games
 * on the same device never open with the exact same picture twice in a row.
 */
export const LAST_PUZZLE_PICTURE_STORAGE_KEY = 'sal0mander.lastPuzzlePictureKey.v1'

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

/** Test-only helper to clear the in-memory fallback alongside localStorage. */
export function resetPictureRotationMemory(): void {
  memoryLastPictureKey = null
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value >= 1) return 0.999999999
  return value
}

export type PickPictureOptions = {
  /** Restrict candidates to a board shape when a surface has a fixed frame. */
  shape?: PuzzlePicture['shape']
  /** Extra key to exclude in addition to the device's last-played key. */
  excludeKey?: string | null
  /** Override pool (defaults to PUZZLE_LIBRARY). */
  pool?: readonly PuzzlePicture[]
  /** Override storage (defaults to window.localStorage). */
  storage?: StorageLike | null
  /** Override RNG (defaults to Math.random). */
  random?: () => number
}

/**
 * Pick a random picture from PUZZLE_LIBRARY at the start of a new game,
 * guaranteed never to repeat the last picture played on this device (as long as
 * at least two eligible pictures exist).
 */
export function pickNextLibraryPicture(options: PickPictureOptions = {}): PuzzlePicture {
  const pool = options.pool ?? PUZZLE_LIBRARY
  if (pool.length === 0) {
    throw new Error('PUZZLE_LIBRARY must contain at least one picture.')
  }

  const shaped = options.shape ? pool.filter((picture) => picture.shape === options.shape) : pool
  const eligible = shaped.length > 0 ? shaped : pool

  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const lastKey = readLastPuzzlePictureKey(storage)
  const excluded = new Set<string>()
  if (lastKey) excluded.add(lastKey)
  if (options.excludeKey) excluded.add(options.excludeKey)

  let candidates = eligible.filter((picture) => !excluded.has(picture.key))
  if (candidates.length === 0 && lastKey) {
    // If excludeKey + lastKey exhausted a tiny pool, still avoid repeating lastKey first.
    candidates = eligible.filter((picture) => picture.key !== lastKey)
  }
  if (candidates.length === 0) {
    candidates = [...eligible]
  }

  const rng = options.random ?? Math.random
  const index = Math.floor(clampUnitInterval(rng()) * candidates.length)
  const chosen = candidates[index]!
  writeLastPuzzlePictureKey(chosen.key, storage)
  return chosen
}

export type ResolveActivityPictureOptions = PickPictureOptions & {
  /** Teacher or parent explicit picture key; always wins when valid. */
  explicitKey?: string | null
}

/**
 * Resolve the picture for a jigsaw activity:
 * - If a teacher or parent explicitly chose a valid library picture, honor it.
 * - Otherwise rotate randomly across PUZZLE_LIBRARY without repeating the last
 *   picture on this device (never falling back to the old salamander default).
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
