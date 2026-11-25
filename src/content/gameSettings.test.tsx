import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { PUZZLE_LIBRARY } from './puzzleLibrary'
import { pickNextLibraryPicture, resetPictureRotationMemory } from './pictureRotation'
import {
  DEFAULT_SITE_GAME_SETTINGS,
  SiteGameSettingsSchema,
  isGameEnabled,
  parseSiteGameSettings,
  resetSiteGameSettingsCache,
  resolveGameFirstPictureKey,
  resolveGameMusicSongs,
  resolveGamePicturePool,
  setSiteGameSettingsForTests,
} from './gameSettings'
import { GuestPlayIndexPage } from '@routes/guest-play/GuestPlayPage'

const SETTINGS_FILE = resolve(__dirname, '../../public/config/games-settings.json')
const ARCADE_HTML_FILE = resolve(__dirname, '../../public/arcade/index.html')

afterEach(() => {
  cleanup()
  resetSiteGameSettingsCache()
  resetPictureRotationMemory()
  localStorage.clear()
})

describe('site game settings file (public/config/games-settings.json)', () => {
  it('validates against SiteGameSettingsSchema and references only real library pictures', () => {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    const parsed = SiteGameSettingsSchema.parse(raw)
    const libraryKeys = new Set(PUZZLE_LIBRARY.map((item) => item.key))

    expect(parsed._howToEdit?.length).toBeGreaterThanOrEqual(4)
    expect(parsed.games.jigsaw?.firstPicture).toBe('sal0mander-rover-expedition')

    for (const entry of Object.values(parsed.games)) {
      if (entry.firstPicture) {
        expect(libraryKeys.has(entry.firstPicture)).toBe(true)
      }
      if (Array.isArray(entry.picturePool)) {
        for (const key of entry.picturePool) {
          expect(libraryKeys.has(key)).toBe(true)
        }
      }
    }
  })

  it('covers every data-game-id card on public/arcade/index.html', () => {
    const settings = SiteGameSettingsSchema.parse(JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')))
    const html = readFileSync(ARCADE_HTML_FILE, 'utf8')
    const ids = [...html.matchAll(/data-game-id="([^"]+)"/g)].map((match) => match[1]!)

    expect(ids.length).toBeGreaterThanOrEqual(8)
    for (const id of ids) {
      expect(settings.games[id]).toBeDefined()
    }
  })
})

describe('game settings runtime controls without code edits', () => {
  it('hides games whose enabled flag is false on GuestPlayIndexPage', () => {
    const custom = {
      ...DEFAULT_SITE_GAME_SETTINGS,
      games: {
        ...DEFAULT_SITE_GAME_SETTINGS.games,
        'neon-dash': { ...DEFAULT_SITE_GAME_SETTINGS.games['neon-dash']!, enabled: false },
      },
    }
    expect(isGameEnabled(custom, 'neon-dash')).toBe(false)
    expect(isGameEnabled(custom, 'moon-gate')).toBe(true)

    setSiteGameSettingsForTests(custom)
    render(
      <ThemeProvider>
        <MemoryRouter>
          <GuestPlayIndexPage />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.queryByRole('heading', { name: 'Neon Dash' })).toBeNull()
    expect(screen.getByRole('heading', { name: /Moon Gate/i })).toBeVisible()
  })

  it('restricts the puzzle picture pool and overrides the first picture per game', () => {
    const custom = parseSiteGameSettings({
      ...DEFAULT_SITE_GAME_SETTINGS,
      games: {
        ...DEFAULT_SITE_GAME_SETTINGS.games,
        jigsaw: {
          ...DEFAULT_SITE_GAME_SETTINGS.games.jigsaw!,
          picturePool: ['sleeping-puppies', 'red-fox-snow'],
          firstPicture: 'red-fox-snow',
          musicSongs: ['window-seat-logic', { id: 'custom-1', title: 'Custom Track', src: 'audio/tracks/custom.mp3' }],
        },
      },
    })

    const pool = resolveGamePicturePool(custom, 'jigsaw')
    expect(pool.map((item) => item.key)).toEqual(['sleeping-puppies', 'red-fox-snow'])
    expect(resolveGameFirstPictureKey(custom, 'jigsaw')).toBe('red-fox-snow')

    const first = pickNextLibraryPicture({
      pool,
      firstPictureKey: resolveGameFirstPictureKey(custom, 'jigsaw'),
    })
    expect(first.key).toBe('red-fox-snow')

    const second = pickNextLibraryPicture({
      pool,
      firstPictureKey: resolveGameFirstPictureKey(custom, 'jigsaw'),
    })
    expect(second.key).toBe('sleeping-puppies')

    const songs = resolveGameMusicSongs(custom, 'jigsaw')
    expect(songs).toHaveLength(2)
    expect(songs[1]).toMatchObject({ id: 'custom-1', title: 'Custom Track' })
  })

  it('falls back safely when JSON is malformed or lists unknown picture keys', () => {
    expect(parseSiteGameSettings({ bad: true })).toEqual(DEFAULT_SITE_GAME_SETTINGS)

    const unknownPool = {
      ...DEFAULT_SITE_GAME_SETTINGS,
      games: {
        ...DEFAULT_SITE_GAME_SETTINGS.games,
        jigsaw: {
          ...DEFAULT_SITE_GAME_SETTINGS.games.jigsaw!,
          picturePool: ['not-a-real-picture'],
        },
      },
    }
    expect(resolveGamePicturePool(unknownPool, 'jigsaw')).toHaveLength(PUZZLE_LIBRARY.length)
  })
})
