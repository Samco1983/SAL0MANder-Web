/* Shared per-game rotating music player for SAL0MANder HTML/JS games.
 * Reads one editable JSON (public/audio/music-playlist.json), rotates songs per
 * page load with no repeat until every song for that game has played, and
 * persists device-local music on/off state. No accounts, no tracking, same-origin. */
(() => {
  'use strict';

  const PLAYED_PREFIX = 'sal0mander.music.played.';
  const ENABLED_KEY = 'sal0mander.music.enabled';
  const PER_GAME_ENABLED_PREFIX = 'sal0mander.music.enabled.';

  const playlistCache = new Map();
  const loadPickCache = new Map();
  const memoryPlayed = new Map();
  const memoryEnabled = new Map();

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage unavailable (private browsing / restricted iframe) */
    }
  }

  function clampUnit(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    if (value >= 1) return 0.999999999;
    return value;
  }

  function readPlayedState(gameId) {
    const key = PLAYED_PREFIX + gameId;
    const raw = safeGet(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.played)) {
          return {
            played: parsed.played.filter((id) => typeof id === 'string' && id.length > 0),
            last: typeof parsed.last === 'string' && parsed.last.length > 0 ? parsed.last : null,
          };
        }
      } catch {
        /* Corrupt storage falls back to memory */
      }
    }
    return memoryPlayed.get(gameId) || { played: [], last: null };
  }

  function writePlayedState(gameId, state) {
    memoryPlayed.set(gameId, state);
    safeSet(PLAYED_PREFIX + gameId, JSON.stringify(state));
  }

  function readEnabled(gameId, defaultEnabled = true, options = {}) {
    const usePerGame = options.perGame === true || defaultEnabled === false;
    const storageKey = usePerGame ? PER_GAME_ENABLED_PREFIX + gameId : ENABLED_KEY;
    const raw = safeGet(storageKey);
    if (raw === 'on' || raw === '1' || raw === 'true') return true;
    if (raw === 'off' || raw === '0' || raw === 'false') return false;
    if (memoryEnabled.has(storageKey)) return memoryEnabled.get(storageKey);
    return Boolean(defaultEnabled);
  }

  function writeEnabled(gameId, enabled, options = {}) {
    const usePerGame = options.perGame === true || options.defaultEnabled === false;
    const storageKey = usePerGame ? PER_GAME_ENABLED_PREFIX + gameId : ENABLED_KEY;
    const bool = Boolean(enabled);
    memoryEnabled.set(storageKey, bool);
    safeSet(storageKey, bool ? 'on' : 'off');
  }

  function resolveUrl(src, siteRootUrl) {
    if (!src || typeof src !== 'string') return '';
    if (/^https?:\/\//i.test(src) || src.startsWith('/')) return src;
    const base = siteRootUrl || document.baseURI;
    try {
      return new URL(src, base).href;
    } catch {
      return src;
    }
  }

  function resolveGameConfig(playlist, gameId, siteRootUrl) {
    if (!playlist || typeof playlist !== 'object') return null;
    const games = playlist.games || {};
    const game = games[gameId];
    if (!game || typeof game !== 'object') return null;
    const trackMap = playlist.tracks || {};
    const songs = Array.isArray(game.songs) ? game.songs : [];
    const tracks = [];
    for (const entry of songs) {
      let id = '';
      let raw = null;
      if (typeof entry === 'string') {
        id = entry;
        raw = trackMap[entry];
      } else if (entry && typeof entry === 'object') {
        id = typeof entry.id === 'string' && entry.id ? entry.id : String(entry.src || '');
        const base = typeof entry.id === 'string' ? trackMap[entry.id] : null;
        raw = base ? { ...base, ...entry } : entry;
      }
      if (!raw || raw.enabled === false || typeof raw.src !== 'string' || !raw.src) continue;
      tracks.push({
        id,
        title: typeof raw.title === 'string' && raw.title ? raw.title : id,
        src: resolveUrl(raw.src, siteRootUrl),
        rawSrc: raw.src,
        genre: typeof raw.genre === 'string' ? raw.genre : '',
        mood: typeof raw.mood === 'string' ? raw.mood : '',
        bpm: typeof raw.bpm === 'number' && Number.isFinite(raw.bpm) && raw.bpm > 0 ? raw.bpm : undefined,
        durationSeconds: typeof raw.durationSeconds === 'number' && Number.isFinite(raw.durationSeconds) && raw.durationSeconds > 0 ? raw.durationSeconds : undefined,
        source: typeof raw.source === 'string' ? raw.source : 'Google Flow Music',
      });
    }
    let levels = null;
    if (game.levels && typeof game.levels === 'object') {
      levels = {};
      for (const [levelKey, levelEntry] of Object.entries(game.levels)) {
        const songId = typeof levelEntry === 'string' ? levelEntry : levelEntry && typeof levelEntry.song === 'string' ? levelEntry.song : '';
        if (!songId) continue;
        const raw = trackMap[songId];
        if (!raw || raw.enabled === false || typeof raw.src !== 'string' || !raw.src) continue;
        const levelBpm = levelEntry && typeof levelEntry === 'object' && typeof levelEntry.bpm === 'number' && Number.isFinite(levelEntry.bpm) && levelEntry.bpm > 0
          ? levelEntry.bpm
          : (typeof raw.bpm === 'number' && Number.isFinite(raw.bpm) && raw.bpm > 0 ? raw.bpm : undefined);
        levels[levelKey] = {
          level: levelKey,
          name: levelEntry && typeof levelEntry === 'object' && typeof levelEntry.name === 'string' ? levelEntry.name : undefined,
          feel: levelEntry && typeof levelEntry === 'object' && typeof levelEntry.feel === 'string' ? levelEntry.feel : undefined,
          track: {
            id: songId,
            title: typeof raw.title === 'string' && raw.title ? raw.title : songId,
            src: resolveUrl(raw.src, siteRootUrl),
            rawSrc: raw.src,
            genre: typeof raw.genre === 'string' ? raw.genre : '',
            mood: typeof raw.mood === 'string' ? raw.mood : '',
            bpm: levelBpm,
            durationSeconds: typeof raw.durationSeconds === 'number' && Number.isFinite(raw.durationSeconds) && raw.durationSeconds > 0 ? raw.durationSeconds : undefined,
            source: typeof raw.source === 'string' ? raw.source : 'Google Flow Music',
          },
        };
      }
    }
    return {
      gameId,
      name: typeof game.name === 'string' ? game.name : gameId,
      genre: typeof game.genre === 'string' ? game.genre : '',
      volume: typeof game.volume === 'number' && Number.isFinite(game.volume)
        ? Math.max(0, Math.min(1, game.volume))
        : 0.32,
      defaultEnabled: game.defaultEnabled !== false,
      enabled: game.enabled !== false,
      tracks,
      ...(levels ? { levels } : {}),
    };
  }

  function pickNextTrack(gameId, tracks, options = {}) {
    const list = Array.isArray(tracks) ? tracks.filter((t) => t && t.id && t.src) : [];
    if (list.length === 0) return null;
    if (list.length === 1) {
      writePlayedState(gameId, { played: [list[0].id], last: list[0].id });
      return list[0];
    }

    const validIds = new Set(list.map((t) => t.id));
    const state = readPlayedState(gameId);
    const played = state.played.filter((id) => validIds.has(id));
    const playedSet = new Set(played);
    const excludeId = typeof options.excludeId === 'string' ? options.excludeId : null;
    const rng = typeof options.random === 'function' ? options.random : Math.random;

    let candidates = list.filter((t) => !playedSet.has(t.id));
    let startingNewCycle = false;

    if (candidates.length === 0) {
      startingNewCycle = true;
      candidates = list.filter((t) => t.id !== state.last && t.id !== excludeId);
      if (candidates.length === 0) candidates = list.filter((t) => t.id !== state.last);
      if (candidates.length === 0) candidates = list;
    } else if (excludeId && candidates.length > 1) {
      candidates = candidates.filter((t) => t.id !== excludeId);
    }

    const index = Math.floor(clampUnit(rng()) * candidates.length);
    const chosen = candidates[index] || candidates[0];
    const nextPlayed = startingNewCycle ? [chosen.id] : [...played, chosen.id];
    writePlayedState(gameId, { played: nextPlayed, last: chosen.id });
    return chosen;
  }

  function pickTrackForLoad(gameId, tracks, options = {}) {
    const cacheKey = gameId + ':' + (options.loadKey || 'default');
    const cached = loadPickCache.get(cacheKey);
    if (cached && tracks.some((t) => t.id === cached.id)) return cached;
    const chosen = pickNextTrack(gameId, tracks, options);
    if (chosen) loadPickCache.set(cacheKey, chosen);
    return chosen;
  }

  function nextTrackForLoad(gameId, tracks, options = {}) {
    const cacheKey = gameId + ':' + (options.loadKey || 'default');
    const current = loadPickCache.get(cacheKey);
    const chosen = pickNextTrack(gameId, tracks, {
      ...options,
      excludeId: options.excludeId || (current ? current.id : null),
    });
    if (chosen) loadPickCache.set(cacheKey, chosen);
    return chosen;
  }

  function loadPlaylist(playlistUrl) {
    const url = playlistUrl || '/audio/music-playlist.json';
    if (!playlistCache.has(url)) {
      playlistCache.set(
        url,
        fetch(url, { cache: 'no-cache' })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      );
    }
    return playlistCache.get(url);
  }

  function createAudioController(opts) {
    const {
      gameId,
      playlistUrl,
      siteRootUrl,
      onChange,
      audioElement,
      autoStart = true,
      perGameEnabled,
    } = opts;

    const audio = audioElement || document.createElement('audio');
    audio.loop = true;
    audio.preload = 'none';

    let config = null;
    let activeTrack = null;
    let enabled = true;
    let active = false;
    let destroyed = false;

    const emit = () => {
      if (typeof onChange === 'function') {
        onChange({
          ready: Boolean(config && activeTrack),
          enabled,
          track: activeTrack,
          tracks: config ? config.tracks : [],
        });
      }
    };

    const tryPlay = () => {
      if (destroyed || !active || !enabled || !activeTrack || document.hidden) return;
      if (audio.src !== activeTrack.src) {
        audio.src = activeTrack.src;
      }
      audio.volume = config ? config.volume : 0.32;
      audio.muted = false;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          /* Autoplay blocked until first user gesture */
        });
      }
    };

    const onGesture = () => {
      if (active && enabled && activeTrack && audio.paused && !document.hidden) {
        tryPlay();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        audio.pause();
      } else if (active && enabled) {
        tryPlay();
      }
    };

    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    const ready = loadPlaylist(playlistUrl).then((playlist) => {
      if (destroyed) return null;
      config = resolveGameConfig(playlist, gameId, siteRootUrl);
      if (!config || !config.enabled || config.tracks.length === 0) {
        emit();
        return null;
      }
      enabled = readEnabled(gameId, config.defaultEnabled, { perGame: perGameEnabled });
      activeTrack = pickTrackForLoad(gameId, config.tracks);
      audio.volume = config.volume;
      emit();
      if (autoStart && active && enabled) tryPlay();
      return config;
    });

    return {
      ready,
      get enabled() {
        return enabled;
      },
      get track() {
        return activeTrack;
      },
      get tracks() {
        return config ? config.tracks : [];
      },
      start() {
        active = true;
        tryPlay();
        emit();
      },
      stop() {
        active = false;
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        emit();
      },
      setEnabled(next) {
        enabled = Boolean(next);
        if (config) {
          writeEnabled(gameId, enabled, {
            perGame: perGameEnabled,
            defaultEnabled: config.defaultEnabled,
          });
        }
        if (enabled && active) tryPlay();
        else audio.pause();
        emit();
      },
      toggle() {
        this.setEnabled(!enabled);
      },
      next() {
        if (!config || config.tracks.length === 0) return null;
        activeTrack = nextTrackForLoad(gameId, config.tracks);
        if (active && enabled) {
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            /* ignore */
          }
          tryPlay();
        }
        emit();
        return activeTrack;
      },
      destroy() {
        destroyed = true;
        active = false;
        audio.pause();
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
        document.removeEventListener('visibilitychange', onVisibility);
      },
    };
  }

  window.Sal0Music = Object.freeze({
    PLAYED_PREFIX,
    ENABLED_KEY,
    PER_GAME_ENABLED_PREFIX,
    loadPlaylist,
    resolveGameConfig,
    pickNextTrack,
    pickTrackForLoad,
    nextTrackForLoad,
    readEnabled,
    writeEnabled,
    createAudioController,
    resetLoadCache() {
      loadPickCache.clear();
    },
  });
})();
