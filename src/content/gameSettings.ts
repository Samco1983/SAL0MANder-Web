import { useEffect, useState } from 'react'
import { z } from 'zod'
import { PUZZLE_LIBRARY, type PuzzlePicture } from './puzzleLibrary'
import { FIRST_GAME_PICTURE_KEY } from './pictureRotation'

export const SITE_GAME_SETTINGS_PATH = 'config/games-settings.json'

const InlineSongSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  src: z.string().min(1),
  enabled: z.boolean().optional(),
})

export const GameSongEntrySchema = z.union([z.string().min(1), InlineSongSchema])
export type GameSongEntry = z.infer<typeof GameSongEntrySchema>

export const GameSettingsEntrySchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  /** "all" uses the entire PUZZLE_LIBRARY; string[] restricts to those keys; null means non-puzzle game. */
  picturePool: z.union([z.literal('all'), z.array(z.string().min(1)), z.null()]).default(null),
  /** First picture key shown on a new device, or null to rotate immediately. */
  firstPicture: z.string().min(1).nullable().default(null),
  musicDefaultEnabled: z.boolean().default(true),
  musicVolume: z.number().min(0).max(1).default(0.32),
  musicSongs: z.array(GameSongEntrySchema).default([]),
})
export type GameSettingsEntry = z.infer<typeof GameSettingsEntrySchema>

export const SiteGameSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string().min(1),
  site: z.string().min(1),
  musicPlaylistPath: z.string().min(1).default('audio/music-playlist.json'),
  _howToEdit: z.array(z.string()).optional(),
  games: z.record(z.string().min(1), GameSettingsEntrySchema),
})
export type SiteGameSettings = z.infer<typeof SiteGameSettingsSchema>

export const DEFAULT_SITE_GAME_SETTINGS: SiteGameSettings = {
  schemaVersion: 1,
  updatedAt: '2026-11-25',
  site: 'sal0mander.com',
  musicPlaylistPath: 'audio/music-playlist.json',
  games: {
    jigsaw: {
      name: 'Jigsaw & Picture Reveal',
      enabled: true,
      picturePool: 'all',
      firstPicture: FIRST_GAME_PICTURE_KEY,
      musicDefaultEnabled: true,
      musicVolume: 0.28,
      musicSongs: [
        'window-seat-logic',
        'button-trail',
        'woven-light',
        'letters-in-the-rain',
        'ocean-breeze-village',
      ],
    },
    'puzzle-gifts': {
      name: 'Puzzle Gifts',
      enabled: true,
      picturePool: 'all',
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.28,
      musicSongs: [
        'woven-light',
        'ocean-breeze-village',
        'harbor-of-memories',
        'whispering-breeze-village',
        'window-seat-logic',
      ],
    },
    'moon-gate': {
      name: 'Moon Gate: The Last Dumpling',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.37,
      musicSongs: [
        'iron-lantern',
        'clash-of-fate',
        'final-gambit',
        'tactical-encounter',
        'foundry-flank',
      ],
    },
    'neon-dash': {
      name: 'Neon Dash',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.55,
      musicSongs: [
        'midnight-rider-groove',
        'midnight-rider-variant',
        'tactical-strike',
        'frontline-deployment',
        'quiet-acceleration',
      ],
    },
    'mystery-graph': {
      name: 'Mystery Graph: X–Y Plane',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: false,
      musicVolume: 0.32,
      musicSongs: [
        'constellation-orchard',
        'boundless-realm',
        'boundless-horizon',
        'octopus-at-the-observatory',
        'shadow-phase',
      ],
    },
    'laser-lab': {
      name: 'Laser Lab: Graphing Equations',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.28,
      musicSongs: [
        'invisible-conveyor',
        'quiet-acceleration',
        'clockwork-trench',
        'shadows-and-gears',
      ],
    },
    'space-rescue': {
      name: 'Space Rescue',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.32,
      musicSongs: [],
    },
    'origin-defenders': {
      name: 'Origin Defenders',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.34,
      musicSongs: ['green-zone-council', 'foundry-flank', 'tactical-breach', 'tactical-strike'],
    },
    'bunker-strike': {
      name: 'Bunker Strike',
      enabled: true,
      picturePool: null,
      firstPicture: null,
      musicDefaultEnabled: true,
      musicVolume: 0.34,
      musicSongs: [],
    },
  },
}

let cachedSettings: SiteGameSettings | null = null
let inflightSettings: Promise<SiteGameSettings> | null = null

export function parseSiteGameSettings(raw: unknown): SiteGameSettings {
  const parsed = SiteGameSettingsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_SITE_GAME_SETTINGS
}

export function isGameEnabled(settings: SiteGameSettings, gameId: string): boolean {
  const entry = settings.games[gameId]
  return entry ? entry.enabled : true
}

export function resolveGamePicturePool(
  settings: SiteGameSettings,
  gameId: string,
  library: readonly PuzzlePicture[] = PUZZLE_LIBRARY,
): readonly PuzzlePicture[] {
  const poolSetting = settings.games[gameId]?.picturePool
  if (!poolSetting || poolSetting === 'all') return library
  const allowed = new Set(poolSetting)
  const filtered = library.filter((picture) => allowed.has(picture.key))
  return filtered.length > 0 ? filtered : library
}

export function resolveGameFirstPictureKey(
  settings: SiteGameSettings,
  gameId: string,
): string | null {
  const entry = settings.games[gameId]
  if (!entry) return gameId === 'jigsaw' ? FIRST_GAME_PICTURE_KEY : null
  return entry.firstPicture
}

export function resolveGameMusicSongs(
  settings: SiteGameSettings,
  gameId: string,
): readonly GameSongEntry[] {
  const entry = settings.games[gameId]
  if (!entry) return []
  return entry.musicSongs.filter((song) =>
    typeof song === 'string' ? true : song.enabled !== false,
  )
}

export function resetSiteGameSettingsCache(): void {
  cachedSettings = null
  inflightSettings = null
}

export function setSiteGameSettingsForTests(settings: SiteGameSettings | null): void {
  cachedSettings = settings
  inflightSettings = null
}

function settingsUrl(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/${SITE_GAME_SETTINGS_PATH}`
}

export async function loadSiteGameSettings(): Promise<SiteGameSettings> {
  if (cachedSettings) return cachedSettings
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return DEFAULT_SITE_GAME_SETTINGS
  }
  if (!inflightSettings) {
    inflightSettings = fetch(settingsUrl(), { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const parsed = parseSiteGameSettings(json)
        cachedSettings = parsed
        return parsed
      })
      .catch(() => DEFAULT_SITE_GAME_SETTINGS)
      .finally(() => {
        inflightSettings = null
      })
  }
  return inflightSettings
}

/**
 * Loads `public/config/games-settings.json` once per page session, falling back
 * immediately to DEFAULT_SITE_GAME_SETTINGS so pages render without waiting.
 */
export function useSiteGameSettings(): SiteGameSettings {
  const [settings, setSettings] = useState<SiteGameSettings>(
    () => cachedSettings ?? DEFAULT_SITE_GAME_SETTINGS,
  )

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings)
      return
    }
    // Skip unrequested network fetches during jsdom unit tests unless a test
    // explicitly sets up settings or calls loadSiteGameSettings() directly.
    if (import.meta.env.MODE === 'test') return
    let active = true
    void loadSiteGameSettings().then((loaded) => {
      if (active) setSettings(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  return settings
}
