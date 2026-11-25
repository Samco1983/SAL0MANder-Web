import { z } from 'zod'
import { readBasePath } from '@config/routes'

export const MusicTrackSchema = z.object({
  title: z.string().min(1),
  src: z.string().min(1),
  genre: z.string().optional(),
  mood: z.string().optional(),
  bpm: z.number().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  bytes: z.number().int().positive().optional(),
  instrumental: z.boolean().optional(),
  source: z.string().optional(),
  flowTitle: z.string().optional(),
  sourceSha256: z.string().optional(),
  enabled: z.boolean().optional(),
})

export const InlineSongEntrySchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  src: z.string().min(1).optional(),
  genre: z.string().optional(),
  mood: z.string().optional(),
  source: z.string().optional(),
  enabled: z.boolean().optional(),
})

export const GameLevelMusicSchema = z.union([
  z.string().min(1),
  z.object({
    song: z.string().min(1),
    name: z.string().min(1).optional(),
    feel: z.string().optional(),
    bpm: z.number().positive().optional(),
  }),
])

export const GameMusicEntrySchema = z.object({
  name: z.string().min(1),
  genre: z.string().min(1),
  volume: z.number().min(0).max(1).default(0.32),
  defaultEnabled: z.boolean().default(true),
  enabled: z.boolean().default(true),
  note: z.string().optional(),
  levels: z.record(z.string().min(1), GameLevelMusicSchema).optional(),
  songs: z.array(z.union([z.string().min(1), InlineSongEntrySchema])),
})

export const MusicPlaylistSchema = z.object({
  schemaVersion: z.number().int().positive(),
  updatedAt: z.string().optional(),
  licenseNote: z.string().optional(),
  _howToEdit: z.array(z.string()).optional(),
  tracks: z.record(z.string().min(1), MusicTrackSchema),
  games: z.record(z.string().min(1), GameMusicEntrySchema),
})

export type MusicPlaylist = z.infer<typeof MusicPlaylistSchema>

export type ResolvedMusicTrack = {
  id: string
  title: string
  /** Browser-ready path rooted at the deploy base path. */
  src: string
  /** Raw relative path from the JSON, e.g. `audio/tracks/window-seat-logic.mp3`. */
  rawSrc: string
  genre: string
  mood: string
  bpm?: number
  durationSeconds?: number
  source: string
}

export type ResolvedGameLevelMusic = {
  level: string
  name?: string
  feel?: string
  track: ResolvedMusicTrack
}

export type ResolvedGamePlaylist = {
  gameId: string
  name: string
  genre: string
  volume: number
  defaultEnabled: boolean
  enabled: boolean
  tracks: ResolvedMusicTrack[]
  levels?: Record<string, ResolvedGameLevelMusic>
}

/**
 * Fallback track catalog matching `public/audio/music-playlist.json` so React
 * pages still resolve music if an offline test environment mocks `fetch` or
 * before the runtime JSON fetch finishes. Editing `public/audio/music-playlist.json`
 * overrides this automatically at runtime with no code change.
 */
export const FALLBACK_MUSIC_PLAYLIST: MusicPlaylist = {
  schemaVersion: 1,
  licenseNote:
    'Original instrumental tracks created with Google Flow Music for SAL0MANder Studios (kid-safe, zero lyrics). Approved by Samuel for live sites.',
  tracks: {
    'window-seat-logic': {
      title: 'Window Seat Logic',
      src: 'audio/tracks/window-seat-logic.mp3',
      genre: 'cozy chamber soul',
      mood: 'warm, focused',
      instrumental: true,
      source: 'Google Flow Music',
    },
    'button-trail': {
      title: 'Button Trail',
      src: 'audio/tracks/button-trail.mp3',
      genre: 'acoustic kinetic folk',
      mood: 'playful, steady',
      instrumental: true,
      source: 'Google Flow Music',
    },
    'woven-light': {
      title: 'Woven Light',
      src: 'audio/tracks/woven-light.mp3',
      genre: 'harp & bass chamber',
      mood: 'elegant, calm',
      instrumental: true,
      source: 'Google Flow Music',
    },
    'letters-in-the-rain': {
      title: 'Letters in the Rain',
      src: 'audio/tracks/letters-in-the-rain.mp3',
      genre: 'felt-piano chamber',
      mood: 'gentle, reflective',
      instrumental: true,
      source: 'Google Flow Music',
    },
    'ocean-breeze-village': {
      title: 'Ocean Breeze Village',
      src: 'audio/tracks/ocean-breeze-village.mp3',
      genre: 'peaceful acoustic folk',
      mood: 'warm, breezy',
      instrumental: true,
      source: 'Google Flow Music',
    },
    'harbor-of-memories': {
      title: 'Harbor of Memories',
      src: 'audio/tracks/harbor-of-memories.mp3',
      genre: 'acoustic flute & guitar',
      mood: 'heartwarming, nostalgic',
      instrumental: true,
      source: 'Google Flow Music',
    },
    'whispering-breeze-village': {
      title: 'Whispering Breeze Village',
      src: 'audio/tracks/whispering-breeze-village.mp3',
      genre: 'peaceful acoustic folk',
      mood: 'gentle, welcoming',
      instrumental: true,
      source: 'Google Flow Music',
    },
  },
  games: {
    jigsaw: {
      name: 'Jigsaw & Picture Reveal',
      genre: 'Cozy acoustic & chamber puzzle',
      volume: 0.28,
      defaultEnabled: true,
      enabled: true,
      songs: [
        'window-seat-logic',
        'button-trail',
        'woven-light',
        'letters-in-the-rain',
        'ocean-breeze-village',
      ],
    },
    'puzzle-gifts': {
      name: 'Puzzle Gifts',
      genre: 'Warm acoustic celebration & puzzle',
      volume: 0.28,
      defaultEnabled: true,
      enabled: true,
      songs: [
        'woven-light',
        'ocean-breeze-village',
        'harbor-of-memories',
        'whispering-breeze-village',
        'window-seat-logic',
      ],
    },
  },
}

function resolveTrackSrc(rawSrc: string, basePath: string): string {
  if (/^https?:\/\//i.test(rawSrc) || rawSrc.startsWith('/')) return rawSrc
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${normalizedBase}${rawSrc.replace(/^\.?\//, '')}`
}

export function resolveGamePlaylist(
  playlist: MusicPlaylist,
  gameId: string,
  basePath = readBasePath(),
): ResolvedGamePlaylist | null {
  const game = playlist.games[gameId]
  if (!game) return null

  const tracks: ResolvedMusicTrack[] = []
  for (const entry of game.songs) {
    if (typeof entry === 'string') {
      const track = playlist.tracks[entry]
      if (!track || track.enabled === false) continue
      tracks.push({
        id: entry,
        title: track.title,
        src: resolveTrackSrc(track.src, basePath),
        rawSrc: track.src,
        genre: track.genre ?? '',
        mood: track.mood ?? '',
        ...(track.bpm !== undefined ? { bpm: track.bpm } : {}),
        ...(track.durationSeconds !== undefined ? { durationSeconds: track.durationSeconds } : {}),
        source: track.source ?? 'Google Flow Music',
      })
      continue
    }

    const base = entry.id ? playlist.tracks[entry.id] : undefined
    const merged = base ? { ...base, ...entry } : entry
    if (merged.enabled === false || !merged.src) continue
    const id = merged.id ?? merged.src
    tracks.push({
      id,
      title: merged.title ?? id,
      src: resolveTrackSrc(merged.src, basePath),
      rawSrc: merged.src,
      genre: merged.genre ?? '',
      mood: merged.mood ?? '',
      ...(base?.bpm !== undefined ? { bpm: base.bpm } : {}),
      ...(base?.durationSeconds !== undefined ? { durationSeconds: base.durationSeconds } : {}),
      source: merged.source ?? 'Google Flow Music',
    })
  }

  let resolvedLevels: Record<string, ResolvedGameLevelMusic> | undefined
  if (game.levels) {
    resolvedLevels = {}
    for (const [levelKey, levelEntry] of Object.entries(game.levels)) {
      const songId = typeof levelEntry === 'string' ? levelEntry : levelEntry.song
      const levelName = typeof levelEntry === 'string' ? undefined : levelEntry.name
      const levelFeel = typeof levelEntry === 'string' ? undefined : levelEntry.feel
      const levelBpm = typeof levelEntry === 'string' ? undefined : levelEntry.bpm
      const rawTrack = playlist.tracks[songId]
      if (!rawTrack || rawTrack.enabled === false) continue
      const bpm = levelBpm ?? rawTrack.bpm
      resolvedLevels[levelKey] = {
        level: levelKey,
        ...(levelName ? { name: levelName } : {}),
        ...(levelFeel ? { feel: levelFeel } : {}),
        track: {
          id: songId,
          title: rawTrack.title,
          src: resolveTrackSrc(rawTrack.src, basePath),
          rawSrc: rawTrack.src,
          genre: rawTrack.genre ?? '',
          mood: rawTrack.mood ?? '',
          ...(bpm !== undefined ? { bpm } : {}),
          ...(rawTrack.durationSeconds !== undefined
            ? { durationSeconds: rawTrack.durationSeconds }
            : {}),
          source: rawTrack.source ?? 'Google Flow Music',
        },
      }
    }
  }

  return {
    gameId,
    name: game.name,
    genre: game.genre,
    volume: game.volume,
    defaultEnabled: game.defaultEnabled,
    enabled: game.enabled,
    tracks,
    ...(resolvedLevels ? { levels: resolvedLevels } : {}),
  }
}

let cachedPlaylistPromise: Promise<MusicPlaylist> | null = null

export function resetMusicPlaylistCache(): void {
  cachedPlaylistPromise = null
}

/**
 * Load the editable `public/audio/music-playlist.json` at runtime, falling back
 * cleanly to `FALLBACK_MUSIC_PLAYLIST` if offline or unavailable.
 */
export function loadMusicPlaylist(
  basePath = readBasePath(),
  fetchImpl: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined,
): Promise<MusicPlaylist> {
  if (!cachedPlaylistPromise) {
    const url = resolveTrackSrc('audio/music-playlist.json', basePath)
    cachedPlaylistPromise = (async () => {
      if (!fetchImpl) return FALLBACK_MUSIC_PLAYLIST
      try {
        const response = await fetchImpl(url, { cache: 'no-cache' })
        if (!response.ok) return FALLBACK_MUSIC_PLAYLIST
        const raw: unknown = await response.json()
        const parsed = MusicPlaylistSchema.safeParse(raw)
        return parsed.success ? parsed.data : FALLBACK_MUSIC_PLAYLIST
      } catch {
        return FALLBACK_MUSIC_PLAYLIST
      }
    })()
  }
  return cachedPlaylistPromise
}
