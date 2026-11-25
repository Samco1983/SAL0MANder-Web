import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import { newId } from '@contracts/v1'
import {
  FALLBACK_MUSIC_PLAYLIST,
  loadMusicPlaylist,
  resolveGamePlaylist,
  type ResolvedGamePlaylist,
  type ResolvedMusicTrack,
} from '@content/musicPlaylist'
import {
  pickTrackForGameLoad,
  readMusicEnabled,
  rotateTrackForGameLoad,
  writeMusicEnabled,
} from '@content/musicRotation'
import styles from './GameMusicControl.module.css'

/**
 * Background music control for React-hosted games (Jigsaw / Picture Reveal,
 * Puzzle Gifts).
 *
 * - Reads the editable `public/audio/music-playlist.json` at runtime.
 * - Rotates once per page load without repeating until all songs for that game
 *   have played.
 * - Provides a single clear Music On / Off toggle (`aria-pressed`) plus an
 *   optional Next song button when multiple tracks are configured.
 * - Respects browser autoplay gates cleanly: if autoplay is blocked on mount,
 *   music begins automatically on the student's first tap or keypress.
 */
export function GameMusicControl({
  gameId,
  persist = true,
  className,
}: {
  gameId: string
  /** When false (e.g. transient Puzzle Gifts), keep rotation and mute state in memory only. */
  persist?: boolean
  className?: string
}) {
  const storageOpt = persist ? undefined : null
  const [loadToken] = useState(() => newId())
  const [playlist, setPlaylist] = useState<ResolvedGamePlaylist | null>(() =>
    resolveGamePlaylist(FALLBACK_MUSIC_PLAYLIST, gameId),
  )

  useEffect(() => {
    let active = true
    void loadMusicPlaylist().then((loaded) => {
      if (!active || loaded === FALLBACK_MUSIC_PLAYLIST) return
      const resolved = resolveGamePlaylist(loaded, gameId)
      if (resolved) setPlaylist(resolved)
    })
    return () => {
      active = false
    }
  }, [gameId])

  const defaultEnabled = playlist?.defaultEnabled ?? true
  const [enabled, setEnabled] = useState(() =>
    readMusicEnabled(gameId, defaultEnabled, storageOpt),
  )
  const [activeTrack, setActiveTrack] = useState<ResolvedMusicTrack | null>(() =>
    playlist && playlist.enabled
      ? pickTrackForGameLoad(gameId, loadToken, playlist.tracks, { storage: storageOpt })
      : null,
  )

  const tracksSignature = useMemo(
    () => (playlist ? playlist.tracks.map((t) => `${t.id}:${t.src}`).join('|') : ''),
    [playlist],
  )

  // Re-sync chosen track if runtime JSON changed the list from the fallback.
  useEffect(() => {
    if (!playlist || !playlist.enabled || playlist.tracks.length === 0) {
      setActiveTrack(null)
      return
    }
    setActiveTrack((current) => {
      if (current && playlist.tracks.some((t) => t.id === current.id && t.src === current.src)) {
        return current
      }
      return pickTrackForGameLoad(gameId, loadToken, playlist.tracks, { storage: storageOpt })
    })
  }, [gameId, loadToken, playlist, tracksSignature, storageOpt])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const volume = playlist?.volume ?? 0.28

  // Create one detached HTMLAudioElement for instrumental background music.
  useEffect(() => {
    const audio = typeof Audio === 'function' ? new Audio() : null
    if (!audio) return
    audio.loop = true
    audio.preload = 'none'
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  const tryPlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !enabled || !activeTrack || document.hidden) return
    if (audio.getAttribute('src') !== activeTrack.src) {
      audio.src = activeTrack.src
    }
    audio.volume = volume
    audio.muted = false
    const promise = audio.play()
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {
        // Browser autoplay gate: first pointer or key interaction will unlock playback.
      })
    }
  }, [enabled, activeTrack, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!enabled || !activeTrack) {
      audio.pause()
      return
    }
    tryPlay()
  }, [enabled, activeTrack, tryPlay])

  // Unlock playback on first user gesture if autoplay was deferred, and pause when hidden.
  useEffect(() => {
    const onGesture = () => {
      const audio = audioRef.current
      if (audio && audio.paused && enabled && activeTrack && !document.hidden) {
        tryPlay()
      }
    }
    const onVisibility = () => {
      const audio = audioRef.current
      if (!audio) return
      if (document.hidden) audio.pause()
      else if (enabled && activeTrack) tryPlay()
    }
    window.addEventListener('pointerdown', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, activeTrack, tryPlay])

  if (!playlist || !playlist.enabled || playlist.tracks.length === 0) {
    return null
  }

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    writeMusicEnabled(gameId, next, defaultEnabled, storageOpt)
  }

  function handleNextSong() {
    if (!playlist) return
    const next = rotateTrackForGameLoad(gameId, loadToken, playlist.tracks, {
      storage: storageOpt,
    })
    if (next) setActiveTrack(next)
  }

  return (
    <div
      className={className ? `${styles.controls} ${className}` : styles.controls}
      data-music-game={gameId}
      data-music-track={activeTrack?.id ?? ''}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={handleToggle}
        aria-pressed={enabled}
        aria-label={
          enabled
            ? `Music on${activeTrack ? `: ${activeTrack.title}` : ''}. Turn music off`
            : 'Music off. Turn music on'
        }
      >
        {enabled ? 'Music: On' : 'Music: Off'}
      </Button>
      {enabled && activeTrack && playlist.tracks.length > 1 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextSong}
          aria-label={`Next song (currently ${activeTrack.title})`}
          title={`Now playing: ${activeTrack.title} (${activeTrack.source})`}
        >
          Next song
        </Button>
      ) : null}
      {enabled && activeTrack ? (
        <span className={styles.trackTitle} aria-live="polite">
          {activeTrack.title}
        </span>
      ) : null}
    </div>
  )
}
