import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MusicPlaylistSchema,
  resolveGamePlaylist,
  type MusicPlaylist,
} from './musicPlaylist'
import {
  MUSIC_ENABLED_STORAGE_KEY,
  MUSIC_PLAYED_STORAGE_PREFIX,
  pickNextGameTrack,
  pickTrackForGameLoad,
  readMusicEnabled,
  resetMusicRotationLoadCache,
  resetMusicRotationMemory,
  rotateTrackForGameLoad,
  writeMusicEnabled,
} from './musicRotation'

const ROOT = process.cwd()
const PLAYLIST_PATH = resolve(ROOT, 'public', 'audio', 'music-playlist.json')
const SHARED_PLAYER_PATH = resolve(ROOT, 'public', 'arcade', 'shared', 'music-player.js')

function loadDiskPlaylist(): MusicPlaylist {
  const raw: unknown = JSON.parse(readFileSync(PLAYLIST_PATH, 'utf8'))
  return MusicPlaylistSchema.parse(raw)
}

beforeEach(() => {
  localStorage.clear()
  resetMusicRotationMemory()
})

describe('editable public/audio/music-playlist.json', () => {
  it('parses cleanly, gives every game 3-5 songs, and every MP3 exists on disk', () => {
    const rawText = readFileSync(PLAYLIST_PATH, 'utf8')
    expect(rawText).not.toMatch(/kings\s*river/i)

    const playlist = loadDiskPlaylist()
    const requiredGames = [
      'jigsaw',
      'puzzle-gifts',
      'moon-gate',
      'neon-dash',
      'mystery-graph',
      'laser-lab',
      'origin-defenders',
    ]

    for (const gameId of requiredGames) {
      const resolved = resolveGamePlaylist(playlist, gameId, '/')
      expect(resolved, `missing game ${gameId}`).not.toBeNull()
      if (gameId === 'neon-dash') {
        // Rhythm runner: the course is timed to its original song, so it plays ONLY HYPERJUMP (Samuel, Nov 26).
        expect(resolved!.tracks.map((t) => t.id), 'neon-dash plays only its original song').toEqual(['hyperjump'])
      } else {
        expect(resolved!.tracks.length, `${gameId} should have 3-5 songs`).toBeGreaterThanOrEqual(3)
        expect(resolved!.tracks.length, `${gameId} should have 3-5 songs`).toBeLessThanOrEqual(5)
      }
      // Every song ID in a game's list is distinct.
      expect(new Set(resolved!.tracks.map((t) => t.id)).size).toBe(resolved!.tracks.length)

      for (const track of resolved!.tracks) {
        const diskPath = resolve(ROOT, 'public', track.rawSrc)
        const stats = statSync(diskPath)
        expect(stats.isFile(), `missing audio file ${diskPath}`).toBe(true)
        expect(stats.size, `empty audio file ${diskPath}`).toBeGreaterThan(100_000)
      }
    }

    for (const [id, track] of Object.entries(playlist.tracks)) {
      expect(track.instrumental, `track ${id} must be marked instrumental`).toBe(true)
      expect(track.source).toBe('Google Flow Music')
    }
  })

  it('supports editing tracks without code (inline songs and enabled: false)', () => {
    const custom = MusicPlaylistSchema.parse({
      schemaVersion: 1,
      tracks: {
        a: { title: 'Track A', src: 'audio/tracks/a.mp3', enabled: false },
        b: { title: 'Track B', src: 'audio/tracks/b.mp3' },
      },
      games: {
        demo: {
          name: 'Demo',
          genre: 'Puzzle',
          songs: [
            'a',
            'b',
            { id: 'c', title: 'Track C', src: 'audio/tracks/c.mp3' },
          ],
        },
      },
    })

    const resolved = resolveGamePlaylist(custom, 'demo', '/SAL0MANder-Web/')
    expect(resolved?.tracks.map((t) => t.id)).toEqual(['b', 'c'])
    expect(resolved?.tracks[0]?.src).toBe('/SAL0MANder-Web/audio/tracks/b.mp3')
    expect(resolved?.tracks[1]?.src).toBe('/SAL0MANder-Web/audio/tracks/c.mp3')
  })
})

describe('music rotation — no repeat until every song for a game has played', () => {
  it('plays all 5 Jigsaw songs once across 5 loads with zero repeats, and never repeats across cycle boundary', () => {
    const playlist = loadDiskPlaylist()
    const jigsaw = resolveGamePlaylist(playlist, 'jigsaw', '/')!
    const n = jigsaw.tracks.length
    expect(n).toBe(5)

    const cycle1: string[] = []
    for (let load = 0; load < n; load += 1) {
      const picked = pickNextGameTrack('jigsaw', jigsaw.tracks, { random: () => 0.37 })
      expect(picked).not.toBeNull()
      cycle1.push(picked!.id)
    }
    expect(new Set(cycle1).size).toBe(n)

    // Cycle 2 begins: first song must not repeat the last song of cycle 1,
    // and all n songs again play without repeat across loads n+1..2n.
    const cycle2: string[] = []
    for (let load = 0; load < n; load += 1) {
      const picked = pickNextGameTrack('jigsaw', jigsaw.tracks, { random: () => 0.11 })
      expect(picked).not.toBeNull()
      cycle2.push(picked!.id)
    }
    expect(cycle2[0]).not.toBe(cycle1[n - 1])
    expect(new Set(cycle2).size).toBe(n)
  })

  it('tracks rotation history independently per game', () => {
    const playlist = loadDiskPlaylist()
    const jigsaw = resolveGamePlaylist(playlist, 'jigsaw', '/')!
    const moonGate = resolveGamePlaylist(playlist, 'moon-gate', '/')!

    const j1 = pickNextGameTrack('jigsaw', jigsaw.tracks, { random: () => 0 })!
    const m1 = pickNextGameTrack('moon-gate', moonGate.tracks, { random: () => 0 })!
    expect(localStorage.getItem(`${MUSIC_PLAYED_STORAGE_PREFIX}jigsaw`)).toContain(j1.id)
    expect(localStorage.getItem(`${MUSIC_PLAYED_STORAGE_PREFIX}moon-gate`)).toContain(m1.id)
  })

  it('memoizes once per game load so refetches/StrictMode reuse the song, while reload rotates', () => {
    const playlist = loadDiskPlaylist()
    const jigsaw = resolveGamePlaylist(playlist, 'jigsaw', '/')!

    const first = pickTrackForGameLoad('jigsaw', 'load-1', jigsaw.tracks, { random: () => 0 })!
    const strictModeRetry = pickTrackForGameLoad('jigsaw', 'load-1', jigsaw.tracks, {
      random: () => 0,
    })!
    expect(strictModeRetry.id).toBe(first.id)

    resetMusicRotationLoadCache()
    const nextLoad = pickTrackForGameLoad('jigsaw', 'load-2', jigsaw.tracks, { random: () => 0 })!
    expect(nextLoad.id).not.toBe(first.id)

    const skipped = rotateTrackForGameLoad('jigsaw', 'load-2', jigsaw.tracks, { random: () => 0 })!
    expect(skipped.id).not.toBe(nextLoad.id)
    expect(skipped.id).not.toBe(first.id)
  })

  it('persists device-local on/off preference under sal0mander.music.* keys', () => {
    expect(readMusicEnabled('jigsaw', true)).toBe(true)
    writeMusicEnabled('jigsaw', false, true)
    expect(localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY)).toBe('off')
    expect(readMusicEnabled('jigsaw', true)).toBe(false)

    // Games whose defaultEnabled is false (like Mystery Graph) keep an independent toggle.
    expect(readMusicEnabled('mystery-graph', false)).toBe(false)
    writeMusicEnabled('mystery-graph', true, false)
    expect(readMusicEnabled('mystery-graph', false)).toBe(true)
    expect(readMusicEnabled('jigsaw', true)).toBe(false)
  })
})

describe('shared vanilla JS arcade player (public/arcade/shared/music-player.js)', () => {
  it('rotates through all Moon Gate and Mystery Graph songs (Neon Dash stays on HYPERJUMP) without repeat until all have played', () => {
    const code = readFileSync(SHARED_PLAYER_PATH, 'utf8')
    const run = new Function(code)
    run()

    const sal0Music = (
      window as unknown as {
        Sal0Music?: {
          resolveGameConfig: (
            playlist: MusicPlaylist,
            gameId: string,
            siteRoot: string,
          ) => { tracks: Array<{ id: string; title: string; src: string }> } | null
          pickNextTrack: (
            gameId: string,
            tracks: Array<{ id: string; title: string; src: string }>,
            opts?: { random?: () => number },
          ) => { id: string; title: string; src: string } | null
        }
      }
    ).Sal0Music

    expect(sal0Music).toBeDefined()
    const playlist = loadDiskPlaylist()

    // Neon Dash is a rhythm runner timed to one song: it never rotates.
    const neon = sal0Music!.resolveGameConfig(playlist, 'neon-dash', 'https://sal0mander.com/')
    expect(neon!.tracks.map((t) => t.id)).toEqual(['hyperjump'])
    expect(neon!.tracks[0]?.src).toMatch(/^https:\/\/sal0mander\.com\/arcade\/neon-dash\/hyperjump\.mp3$/)

    for (const gameId of ['moon-gate', 'mystery-graph']) {
      const cfg = sal0Music!.resolveGameConfig(playlist, gameId, 'https://sal0mander.com/')
      expect(cfg).not.toBeNull()
      const n = cfg!.tracks.length
      expect(n).toBeGreaterThanOrEqual(3)

      const seen: string[] = []
      for (let i = 0; i < n; i += 1) {
        const picked = sal0Music!.pickNextTrack(gameId, cfg!.tracks, { random: () => 0.25 })
        expect(picked).not.toBeNull()
        expect(picked!.src).toMatch(/^https:\/\/sal0mander\.com\/audio\/tracks\/.+\.mp3$/)
        seen.push(picked!.id)
      }
      expect(new Set(seen).size).toBe(n)

      // Next cycle does not repeat the previous load's song.
      const nextCycleFirst = sal0Music!.pickNextTrack(gameId, cfg!.tracks, { random: () => 0 })
      expect(nextCycleFirst!.id).not.toBe(seen[n - 1])
    }
  })
})
