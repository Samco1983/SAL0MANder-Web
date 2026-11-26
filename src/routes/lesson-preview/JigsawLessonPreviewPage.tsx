import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { readBasePath } from '@config/routes'
import {
  applyHostCommand,
  applyLearnerBoardCommand,
  buildPostLessonParentSummaries,
  buildPrivateWorkRecord,
  createInitialSharedState,
  DEFAULT_HEARTBEAT_TTL_MS,
  FICTIONAL_LEARNERS,
  handleSeatPresence,
  INTEGER_LESSON_QUESTIONS,
  isPieceSolved,
  PREVIEW_PUZZLE_ARTWORKS,
  publicLabelForSeat,
  SEAT_ORDER,
  sweepStaleSeats,
  syncAnsweredCount,
} from '@/lessonPreview/lessonEngine'
import {
  createLessonSyncTransport,
  LocalMultiTabTransport,
  resolveFirebasePreviewUrl,
  type LessonSyncTransport,
  type SharedWireMessage,
} from '@/lessonPreview/syncTransport'
import type {
  HostControlCommand,
  LearnerBoardCommand,
  ParticipantRole,
  PrivateLearnerWork,
  PrivateWorkBySeat,
  SeatId,
  SharedBoardState,
} from '@/lessonPreview/types'
import styles from './JigsawLessonPreviewPage.module.css'

const VALID_SEATS = new Set<string>(SEAT_ORDER)
const LOW_VOLUME_DEFAULT = 0.12
const VOICE_FRIENDLY_AUDIO_PATH = 'audio/tracks/letters-in-the-rain.mp3'

function parseSeatParam(raw: string | null): SeatId | null {
  if (raw && VALID_SEATS.has(raw)) return raw as SeatId
  return null
}

function parseRoomParam(raw: string | null): string {
  const cleaned = (raw ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned.length >= 3 ? cleaned.slice(0, 32) : 'demo-room-1'
}

function pieceBgPosition(pieceId: number): string {
  const col = pieceId % 3
  const row = Math.floor(pieceId / 3)
  return `${col * 50}% ${row * 50}%`
}

export function JigsawLessonPreviewPage() {
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])

  const roomId = useMemo(() => parseRoomParam(params.get('room')), [params])
  const role: ParticipantRole = params.get('role') === 'learner' ? 'learner' : 'host'
  const mySeatId: SeatId | null =
    role === 'learner' ? (parseSeatParam(params.get('seat')) ?? 'seat-1') : null
  const firebaseUrl = useMemo(() => resolveFirebasePreviewUrl(location.search), [location.search])

  const [sharedState, setSharedState] = useState<SharedBoardState>(() =>
    createInitialSharedState(roomId),
  )
  const [privateWorkBySeat, setPrivateWorkBySeat] = useState<PrivateWorkBySeat>({})
  const [myPrivateWork, setMyPrivateWork] = useState<PrivateLearnerWork | null>(null)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [scratchWork, setScratchWork] = useState('')
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(0)
  const [actionNotice, setActionNotice] = useState('')
  const [manualOffline, setManualOffline] = useState(false)
  const [confirm321BySeat, setConfirm321BySeat] = useState<Partial<Record<SeatId, boolean>>>({})
  const [syncLabel, setSyncLabel] = useState('Multi-tab live sync (this browser)')

  // Low-volume voice-friendly background audio audition (Letters in the Rain, 74 BPM felt piano)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [musicOn, setMusicOn] = useState(false)
  const [musicVolume, setMusicVolume] = useState(LOW_VOLUME_DEFAULT)

  const sharedRef = useRef(sharedState)
  sharedRef.current = sharedState
  const privateWorkRef = useRef(privateWorkBySeat)
  privateWorkRef.current = privateWorkBySeat
  const transportRef = useRef<LessonSyncTransport | null>(null)

  const basePath = readBasePath()
  const artwork =
    PREVIEW_PUZZLE_ARTWORKS.find((a) => a.key === sharedState.activeImageKey) ??
    PREVIEW_PUZZLE_ARTWORKS[0]!
  const artworkSrc = `${basePath}${artwork.src.replace(/^\/+/, '')}`
  const audioSrc = `${basePath}${VOICE_FRIENDLY_AUDIO_PATH}`
  const question =
    INTEGER_LESSON_QUESTIONS[sharedState.currentQuestionIndex] ?? INTEGER_LESSON_QUESTIONS[0]!

  const broadcastState = useCallback((next: SharedBoardState) => {
    sharedRef.current = next
    setSharedState(next)
    transportRef.current?.publishSharedState(next)
  }, [])

  const runHostCommand = useCallback(
    (cmd: HostControlCommand) => {
      const res = applyHostCommand(sharedRef.current, cmd, privateWorkRef.current)
      if (!res.ok) {
        setActionNotice(res.message)
        return
      }
      setActionNotice('')
      broadcastState(res.state)
    },
    [broadcastState],
  )

  const runLearnerCommand = useCallback(
    (cmd: LearnerBoardCommand) => {
      if (role !== 'learner' || !mySeatId) return
      // Local guard + immediate denial feedback; host also enforces authoritatively.
      const check = applyLearnerBoardCommand(sharedRef.current, cmd)
      if (!check.ok) {
        setActionNotice(check.message)
        return
      }
      setActionNotice('')
      // Optimistically show move locally and broadcast command + state for instant feel.
      sharedRef.current = check.state
      setSharedState(check.state)
      transportRef.current?.publishShared({ kind: 'learner_command', command: cmd })
      transportRef.current?.publishSharedState(check.state)
    },
    [role, mySeatId],
  )

  useEffect(() => {
    const handleSharedMessage = (msg: SharedWireMessage) => {
      if (msg.kind === 'state_sync') {
        if (msg.state.roomId !== roomId) return
        if (msg.state.turnRevision >= sharedRef.current.turnRevision) {
          sharedRef.current = msg.state
          setSharedState(msg.state)
        }
        return
      }

      if (role === 'host') {
        if (msg.kind === 'request_sync') {
          transportRef.current?.publishSharedState(sharedRef.current)
          return
        }
        if (msg.kind === 'seat_presence') {
          const updated = handleSeatPresence(
            sharedRef.current,
            msg.seatId,
            msg.connected,
            msg.atMs,
          )
          if (updated !== sharedRef.current) {
            broadcastState(updated)
          }
          return
        }
        if (msg.kind === 'learner_command') {
          const res = applyLearnerBoardCommand(sharedRef.current, msg.command)
          if (res.ok) {
            broadcastState(res.state)
          } else {
            // Re-sync authoritative state to reject any out-of-turn command.
            transportRef.current?.publishSharedState(sharedRef.current)
          }
        }
      }
    }

    const handlePrivateWork = (work: PrivateLearnerWork) => {
      if (role !== 'host') return
      const nextMap: PrivateWorkBySeat = {
        ...privateWorkRef.current,
        [work.seatId]: work,
      }
      privateWorkRef.current = nextMap
      setPrivateWorkBySeat(nextMap)
      // Broadcast ONLY the integer answeredCount into shared group state — NEVER the answer text!
      const nextShared = syncAnsweredCount(sharedRef.current, nextMap)
      if (nextShared !== sharedRef.current) {
        broadcastState(nextShared)
      }
    }

    const transport = createLessonSyncTransport({
      roomId,
      role,
      mySeatId,
      firebaseUrl,
      callbacks: {
        onSharedMessage: handleSharedMessage,
        onPrivateWork: role === 'host' ? handlePrivateWork : undefined,
      },
    })
    transportRef.current = transport
    setSyncLabel(transport.endpointLabel)

    if (transport instanceof LocalMultiTabTransport) {
      const cached = transport.loadCachedSharedState()
      if (cached && cached.roomId === roomId) {
        sharedRef.current = cached
        setSharedState(cached)
      } else if (role === 'host') {
        transport.publishSharedState(sharedRef.current)
      }
      if (role === 'host') {
        const cachedPriv = transport.loadCachedPrivateWorkForHost()
        privateWorkRef.current = cachedPriv
        setPrivateWorkBySeat(cachedPriv)
      }
    }

    if (role === 'learner' && mySeatId) {
      transport.publishShared({ kind: 'request_sync' })
      transport.publishShared({
        kind: 'seat_presence',
        seatId: mySeatId,
        connected: true,
        atMs: Date.now(),
      })
    }

    const handleUnload = () => {
      if (role === 'learner' && mySeatId) {
        transport.sendDisconnectBeacon(mySeatId)
      }
    }
    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('pagehide', handleUnload)
      window.removeEventListener('beforeunload', handleUnload)
      if (role === 'learner' && mySeatId) {
        transport.sendDisconnectBeacon(mySeatId)
      }
      transport.close()
      transportRef.current = null
    }
  }, [roomId, role, mySeatId, firebaseUrl, broadcastState])

  // Presence heartbeat (learner) + stale-seat auto-release sweep (host)
  useEffect(() => {
    if (role === 'learner' && mySeatId) {
      if (manualOffline) return
      const timer = window.setInterval(() => {
        transportRef.current?.publishShared({
          kind: 'seat_presence',
          seatId: mySeatId,
          connected: true,
          atMs: Date.now(),
        })
      }, 1500)
      return () => window.clearInterval(timer)
    }

    if (role === 'host') {
      const timer = window.setInterval(() => {
        const swept = sweepStaleSeats(sharedRef.current, Date.now(), DEFAULT_HEARTBEAT_TTL_MS)
        if (swept !== sharedRef.current) {
          broadcastState(swept)
        }
      }, 1500)
      return () => window.clearInterval(timer)
    }
    return undefined
  }, [role, mySeatId, manualOffline, broadcastState])

  // Clear local typed fields when Mr. Sam advances to a new math prompt
  useEffect(() => {
    setTypedAnswer('')
    setScratchWork('')
    setMyPrivateWork(null)
  }, [sharedState.currentQuestionIndex])

  // Sync audio element volume
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = musicVolume
  }, [musicVolume])

  const toggleMusic = () => {
    const el = audioRef.current
    if (!el) return
    if (musicOn) {
      el.pause()
      setMusicOn(false)
    } else {
      el.volume = musicVolume
      void el.play().catch(() => {})
      setMusicOn(true)
    }
  }

  const handlePrivateSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (role !== 'learner' || !mySeatId || !typedAnswer.trim()) return
    const prevAttempts =
      myPrivateWork && myPrivateWork.questionIndex === sharedState.currentQuestionIndex
        ? myPrivateWork.attempts
        : 0
    const record = buildPrivateWorkRecord(
      mySeatId,
      sharedState.currentQuestionIndex,
      typedAnswer,
      scratchWork,
      prevAttempts,
    )
    setMyPrivateWork(record)
    // Strictly transmitted on this learner's isolated private channel -> Mr. Sam ONLY!
    transportRef.current?.publishPrivateWork(record)
  }

  const toggleManualDisconnect = () => {
    if (role !== 'learner' || !mySeatId) return
    const nextOffline = !manualOffline
    setManualOffline(nextOffline)
    if (nextOffline) {
      transportRef.current?.sendDisconnectBeacon(mySeatId)
    } else {
      transportRef.current?.publishShared({
        kind: 'seat_presence',
        seatId: mySeatId,
        connected: true,
        atMs: Date.now(),
      })
    }
  }

  const buildParticipantUrl = (targetRole: ParticipantRole, seat?: SeatId): string => {
    const next = new URLSearchParams()
    next.set('room', roomId)
    next.set('role', targetRole)
    if (targetRole === 'learner' && seat) next.set('seat', seat)
    if (firebaseUrl) next.set('fb', firebaseUrl)
    return `${basePath}preview/jigsaw-lesson?${next.toString()}`
  }

  const myProfile = mySeatId ? FICTIONAL_LEARNERS[mySeatId] : null
  const isMyActiveTurn =
    role === 'learner' &&
    mySeatId !== null &&
    !manualOffline &&
    !sharedState.boardLocked &&
    !sharedState.paused &&
    sharedState.activeSeatId === mySeatId

  const activeSeatLabel = sharedState.activeSeatId
    ? publicLabelForSeat(sharedState.activeSeatId)
    : 'Waiting for Mr. Sam'

  const trayPieces = sharedState.pieces.filter((p) => p.placedSlot === null)
  const solvedCount = sharedState.pieces.filter(isPieceSolved).length
  const connectedCount = sharedState.seats.filter((s) => s.connected).length
  const selectedPiece =
    selectedPieceId !== null
      ? (sharedState.pieces.find((p) => p.id === selectedPieceId) ?? null)
      : null

  const parentSummaries = useMemo(
    () => (role === 'host' ? buildPostLessonParentSummaries(privateWorkBySeat) : []),
    [role, privateWorkBySeat],
  )

  return (
    <div className={styles.page}>
      <div className={styles.privateBanner} role="region" aria-label="Preview safety notice">
        <span className={styles.bannerTag}>
          PRIVATE NON-LIVE PREVIEW · Fictional test learners only
        </span>
        <span>
          Enrollment Agreement 3.21 / 3.22 / 3.22A · Cameras &amp; mics off · Recording off · No
          chat
        </span>
      </div>

      <header className={styles.topBar}>
        <span className={styles.brandMark}>
          SAL<span className={styles.brandZero}>0</span>MANder Lesson Preview
        </span>
        <span
          className={`${styles.roleBadge} ${role === 'host' ? styles.roleBadgeHost : ''}`}
          data-testid="participant-role-badge"
        >
          {role === 'host'
            ? 'Mr. Sam (Teacher Host)'
            : `${myProfile?.realFirstName} · ${
                myProfile?.consent321
                  ? 'Shown as ' + myProfile.realFirstName + ' (3.21 Yes)'
                  : 'Shown to group as ' + myProfile?.anonymousLabel + ' (3.21 No)'
              }`}
        </span>
        <span className={styles.syncBadge} data-testid="sync-mode-badge">
          {syncLabel} · Room: {roomId}
        </span>

        <div className={styles.topActions}>
          <div className={styles.audioControl} aria-label="Background music audition">
            <button
              type="button"
              className={styles.btn}
              onClick={toggleMusic}
              aria-pressed={musicOn}
            >
              {musicOn ? 'Music: On' : 'Music: Off'}
            </button>
            <label htmlFor="lesson-music-volume" style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
              Letters in the Rain ({Math.round(musicVolume * 100)}%)
            </label>
            <input
              id="lesson-music-volume"
              className={styles.volumeSlider}
              type="range"
              min={0}
              max={0.35}
              step={0.01}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              aria-label="Background music volume"
            />
            <audio ref={audioRef} src={audioSrc} preload="metadata" loop>
              <track kind="captions" label="Instrumental music (no vocals)" />
            </audio>
          </div>

          {role === 'host' ? (
            <>
              <a
                className={styles.btn}
                href={buildParticipantUrl('learner', 'seat-1')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Maya tab
              </a>
              <a
                className={styles.btn}
                href={buildParticipantUrl('learner', 'seat-2')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Leo (Player 2) tab
              </a>
              <a
                className={styles.btn}
                href={buildParticipantUrl('learner', 'seat-3')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Priya tab
              </a>
            </>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${manualOffline ? styles.btnTeal : styles.btnDanger}`}
              onClick={toggleManualDisconnect}
              data-testid="toggle-disconnect-btn"
            >
              {manualOffline ? 'Rejoin lesson' : 'Step away (disconnect)'}
            </button>
          )}
        </div>
      </header>

      <main className={styles.mainGrid}>
        <section className={styles.boardColumn} aria-label="Shared turn-taking Jigsaw board">
          <div
            className={`${styles.turnMarker} ${
              isMyActiveTurn
                ? styles.turnMarkerYourTurn
                : sharedState.boardLocked || sharedState.paused
                  ? styles.turnMarkerLocked
                  : ''
            }`}
            role="status"
            aria-live="polite"
            data-testid="turn-marker"
          >
            <div>
              <h1 className={styles.turnMarkerTitle}>
                {sharedState.paused
                  ? 'Paused by Mr. Sam'
                  : sharedState.boardLocked
                    ? 'Board locked · Waiting for Mr. Sam'
                    : isMyActiveTurn
                      ? `Your turn (${publicLabelForSeat(mySeatId!)}) — controls unlocked`
                      : `Active turn: ${activeSeatLabel}${role === 'learner' ? ' (your board controls are locked)' : ''}`}
              </h1>
              <p className={styles.turnMarkerSub} data-testid="event-banner">
                {sharedState.eventBanner}
              </p>
            </div>

            <div className={styles.seatPills} aria-label="Connected learners">
              {sharedState.seats.map((seat) => {
                const isActive =
                  !sharedState.boardLocked &&
                  !sharedState.paused &&
                  sharedState.activeSeatId === seat.seatId
                return (
                  <span
                    key={seat.seatId}
                    className={`${styles.seatPill} ${isActive ? styles.seatPillActive : ''} ${
                      !seat.connected ? styles.seatPillOffline : ''
                    }`}
                    data-testid={`seat-pill-${seat.seatId}`}
                  >
                    <span
                      className={`${styles.dot} ${seat.connected ? styles.dotOnline : ''}`}
                      aria-hidden="true"
                    />
                    {seat.publicLabel}
                    {isActive ? ' · Controls' : seat.connected ? '' : ' · Away'}
                  </span>
                )
              })}
            </div>
          </div>

          {sharedState.celebrationActive ? (
            <div className={styles.celebrationBanner} role="status" data-testid="celebration-banner">
              Puzzle complete! All 9 pieces snapped cleanly at 0° — class total only, individual
              scores stay private (Section 3.22).
            </div>
          ) : null}

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{sharedState.lessonTitle}</h2>
              <span className={styles.metaPill}>
                Solved: {solvedCount}/9 · Online: {connectedCount}/3
              </span>
            </div>

            <div className={styles.boardWorkspace}>
              <div className={styles.boardGrid} role="grid" aria-label="3 by 3 puzzle board">
                {Array.from({ length: 9 }, (_, slotIdx) => {
                  const occupant = sharedState.pieces.find((p) => p.placedSlot === slotIdx) ?? null
                  const solved = occupant ? isPieceSolved(occupant) : false
                  const isSelected = occupant !== null && occupant.id === selectedPieceId
                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      className={`${styles.boardSlot} ${solved ? styles.boardSlotSolved : ''} ${
                        isSelected ? styles.boardSlotSelected : ''
                      }`}
                      disabled={!isMyActiveTurn}
                      data-testid={`board-slot-${slotIdx}`}
                      aria-label={
                        occupant
                          ? `Slot ${slotIdx + 1}: Piece ${occupant.id + 1}, rotated ${occupant.rotationDeg} degrees${
                              solved ? ', snapped' : ''
                            }`
                          : `Empty board slot ${slotIdx + 1}`
                      }
                      onClick={() => {
                        if (!isMyActiveTurn || !mySeatId) return
                        if (occupant) {
                          setSelectedPieceId(occupant.id)
                          return
                        }
                        if (selectedPieceId !== null) {
                          runLearnerCommand({
                            type: 'place_piece',
                            actorSeatId: mySeatId,
                            pieceId: selectedPieceId,
                            targetSlot: slotIdx,
                          })
                        }
                      }}
                    >
                      {occupant ? (
                        <>
                          <div
                            className={styles.pieceArt}
                            style={{
                              backgroundImage: `url(${artworkSrc})`,
                              backgroundPosition: pieceBgPosition(occupant.id),
                              transform: `rotate(${occupant.rotationDeg}deg)`,
                            }}
                          />
                          {occupant.lastMovedByLabel ? (
                            <span className={styles.pieceMoverTag}>
                              {occupant.lastMovedByLabel}
                            </span>
                          ) : null}
                          <span className={styles.pieceBadge}>
                            #{occupant.id + 1} · {occupant.rotationDeg}°
                          </span>
                        </>
                      ) : (
                        <span>Slot {slotIdx + 1}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className={styles.trayArea}>
                <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
                  <h3 className={styles.cardTitle}>
                    Piece Tray ({trayPieces.length} left)
                  </h3>
                  <span className={styles.metaPill}>
                    {selectedPiece
                      ? `Selected #${selectedPiece.id + 1} (${selectedPiece.rotationDeg}°)`
                      : 'Select a piece'}
                  </span>
                </div>

                <div className={styles.trayGrid} role="group" aria-label="Unplaced puzzle pieces">
                  {trayPieces.map((piece) => (
                    <button
                      key={piece.id}
                      type="button"
                      className={`${styles.trayPieceBtn} ${
                        selectedPieceId === piece.id ? styles.trayPieceSelected : ''
                      }`}
                      disabled={!isMyActiveTurn}
                      data-testid={`tray-piece-${piece.id}`}
                      aria-label={`Select piece ${piece.id + 1}, rotated ${piece.rotationDeg} degrees`}
                      aria-pressed={selectedPieceId === piece.id}
                      onClick={() => setSelectedPieceId(piece.id)}
                    >
                      <div
                        className={styles.pieceArt}
                        style={{
                          backgroundImage: `url(${artworkSrc})`,
                          backgroundPosition: pieceBgPosition(piece.id),
                          transform: `rotate(${piece.rotationDeg}deg)`,
                        }}
                      />
                      <span className={styles.pieceBadge}>
                        #{piece.id + 1} · {piece.rotationDeg}°
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.controlStrip} aria-label="Turn controls">
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!isMyActiveTurn || selectedPiece === null}
                    data-testid="rotate-ccw-btn"
                    onClick={() => {
                      if (!mySeatId || selectedPiece === null) return
                      runLearnerCommand({
                        type: 'rotate_piece',
                        actorSeatId: mySeatId,
                        pieceId: selectedPiece.id,
                        deltaDeg: -45,
                      })
                    }}
                  >
                    ↺ −45°
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!isMyActiveTurn || selectedPiece === null}
                    data-testid="rotate-cw-btn"
                    onClick={() => {
                      if (!mySeatId || selectedPiece === null) return
                      runLearnerCommand({
                        type: 'rotate_piece',
                        actorSeatId: mySeatId,
                        pieceId: selectedPiece.id,
                        deltaDeg: 45,
                      })
                    }}
                  >
                    ↻ +45°
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!isMyActiveTurn || selectedPiece === null}
                    data-testid="rotate-quarter-btn"
                    onClick={() => {
                      if (!mySeatId || selectedPiece === null) return
                      runLearnerCommand({
                        type: 'rotate_piece',
                        actorSeatId: mySeatId,
                        pieceId: selectedPiece.id,
                        deltaDeg: 90,
                      })
                    }}
                  >
                    ↻ +90° quarter turn
                  </button>
                  {selectedPiece && selectedPiece.placedSlot !== null ? (
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={!isMyActiveTurn}
                      onClick={() => {
                        if (!mySeatId) return
                        runLearnerCommand({
                          type: 'return_piece_to_tray',
                          actorSeatId: mySeatId,
                          pieceId: selectedPiece.id,
                        })
                      }}
                    >
                      Return to tray
                    </button>
                  ) : null}
                  {role === 'learner' ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnWarn}`}
                      disabled={!isMyActiveTurn}
                      data-testid="pass-turn-btn"
                      onClick={() => {
                        if (!mySeatId) return
                        runLearnerCommand({ type: 'pass_turn', actorSeatId: mySeatId })
                      }}
                    >
                      Pass my turn
                    </button>
                  ) : null}
                </div>

                {actionNotice ? (
                  <p className={styles.errorNote} role="alert" data-testid="action-notice">
                    {actionNotice}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {sharedState.workedExample?.shown ? (
            <div className={styles.sharedCallout} data-testid="shared-worked-example">
              <strong>{sharedState.workedExample.title}</strong>
              <ol>
                {sharedState.workedExample.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {sharedState.spotlight ? (
            <div className={styles.sharedCallout} data-testid="shared-spotlight">
              <strong>
                Consented example ({sharedState.spotlight.publicLabel}, Section 3.21):
              </strong>{' '}
              {sharedState.spotlight.summary}
            </div>
          ) : null}
        </section>

        <aside className={styles.sideColumn} aria-label="Math prompt and controls">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                Prompt #{question.index + 1} of {INTEGER_LESSON_QUESTIONS.length}
              </h2>
              <span className={styles.metaPill} data-testid="shared-answered-count">
                {sharedState.answeredCount} of {Math.max(connectedCount, 3)} answered
              </span>
            </div>
            <p className={styles.promptText}>{question.prompt}</p>
            {role === 'host' ? (
              <p className={styles.teacherCue}>
                <strong>Mr. Sam’s teaching question:</strong> “{question.teacherQuestion}”
              </p>
            ) : null}
            {sharedState.classTotal?.shown ? (
              <div className={styles.sharedCallout} data-testid="shared-class-total">
                <strong>Class total (anonymous, Section 3.22):</strong>{' '}
                {sharedState.classTotal.correctCount} of {sharedState.classTotal.totalCount} got it
              </div>
            ) : null}
          </div>

          {role === 'learner' && mySeatId ? (
            <form
              className={styles.privateBox}
              onSubmit={handlePrivateSubmit}
              aria-label="Private math answer form"
            >
              <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
                <h2 className={styles.cardTitle}>Your Private Answer</h2>
                <span className={styles.metaPill}>Private · 3.22 / 3.22A</span>
              </div>
              <p className={styles.privateNotice}>
                Only you and Mr. Sam see what you type here. It is never broadcast to the shared
                group board.
              </p>
              <label className={styles.fieldLabel}>
                Typed math answer
                <input
                  className={styles.input}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="Type your answer (e.g. -3)"
                  autoComplete="off"
                  data-testid="private-answer-input"
                />
              </label>
              <label className={styles.fieldLabel}>
                Private scratch work (optional)
                <textarea
                  className={styles.textarea}
                  value={scratchWork}
                  onChange={(e) => setScratchWork(e.target.value)}
                  placeholder="How did you think about it?"
                  data-testid="private-scratch-input"
                />
              </label>
              <div className={styles.controlStrip}>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={!typedAnswer.trim()}
                  data-testid="private-submit-btn"
                >
                  Submit private answer
                </button>
              </div>
              {myPrivateWork ? (
                <p
                  className={myPrivateWork.isCorrect ? styles.feedbackOk : styles.feedbackTry}
                  role="status"
                  data-testid="private-feedback"
                >
                  {myPrivateWork.isCorrect
                    ? `Correct (${myPrivateWork.typedAnswer})! Sent privately to Mr. Sam.`
                    : `Not quite yet — hint: ${question.hint}`}
                </p>
              ) : null}
            </form>
          ) : null}

          {role === 'host' ? (
            <>
              <div className={styles.card} aria-label="Mr. Sam teacher host controls">
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Mr. Sam Host Controls</h2>
                  <span className={styles.metaPill}>Host only</span>
                </div>
                <div className={styles.hostGrid}>
                  <button
                    type="button"
                    className={`${styles.btn} ${
                      sharedState.boardLocked ? styles.btnPrimary : styles.btnWarn
                    }`}
                    data-testid="host-lock-toggle"
                    onClick={() =>
                      runHostCommand(
                        sharedState.boardLocked ? { type: 'unlock_board' } : { type: 'lock_board' },
                      )
                    }
                  >
                    {sharedState.boardLocked ? 'Unlock board' : 'Lock board'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${sharedState.paused ? styles.btnTeal : ''}`}
                    data-testid="host-pause-toggle"
                    onClick={() => runHostCommand({ type: 'toggle_pause' })}
                  >
                    {sharedState.paused ? 'Resume board' : 'Pause to teach'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnTeal}`}
                    data-testid="host-advance-turn"
                    onClick={() => runHostCommand({ type: 'advance_turn' })}
                  >
                    Next / skip turn →
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => runHostCommand({ type: 'toggle_worked_example' })}
                  >
                    {sharedState.workedExample?.shown ? 'Hide worked example' : 'Show worked example'}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => runHostCommand({ type: 'toggle_class_total' })}
                  >
                    {sharedState.classTotal?.shown ? 'Hide class total' : 'Show class total'}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => runHostCommand({ type: 'reset_lesson' })}
                  >
                    Reset puzzle
                  </button>
                </div>

                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  <span className={styles.fieldLabel}>Pass controls directly to a seat:</span>
                  <div className={styles.hostGrid}>
                    {SEAT_ORDER.map((seatId) => {
                      const p = FICTIONAL_LEARNERS[seatId]
                      const seatState = sharedState.seats.find((s) => s.seatId === seatId)
                      return (
                        <button
                          key={seatId}
                          type="button"
                          className={`${styles.btn} ${
                            sharedState.activeSeatId === seatId && !sharedState.boardLocked
                              ? styles.btnPrimary
                              : ''
                          }`}
                          data-testid={`host-assign-${seatId}`}
                          onClick={() => runHostCommand({ type: 'assign_turn', seatId })}
                        >
                          {p.realFirstName}
                          {!p.consent321 ? ` (${p.anonymousLabel})` : ''}
                          {seatState?.connected ? '' : ' [away]'}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  <label className={styles.fieldLabel}>
                    Lesson prompt
                    <select
                      className={styles.select}
                      value={sharedState.currentQuestionIndex}
                      onChange={(e) =>
                        runHostCommand({
                          type: 'set_question',
                          questionIndex: Number(e.target.value),
                        })
                      }
                    >
                      {INTEGER_LESSON_QUESTIONS.map((q) => (
                        <option key={q.id} value={q.index}>
                          Q{q.index + 1}: {q.prompt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.fieldLabel}>
                    Puzzle picture
                    <select
                      className={styles.select}
                      value={sharedState.activeImageKey}
                      onChange={(e) =>
                        runHostCommand({
                          type: 'set_puzzle_image',
                          imageKey: e.target.value,
                        })
                      }
                    >
                      {PREVIEW_PUZZLE_ARTWORKS.map((art) => (
                        <option key={art.key} value={art.key}>
                          {art.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div
                className={styles.card}
                aria-label="Private learner answers visible only to Mr. Sam"
              >
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Mr. Sam’s Private Answer View</h2>
                  <span className={styles.metaPill}>Never shared with group</span>
                </div>

                <div className={styles.privateRoster}>
                  {SEAT_ORDER.map((seatId) => {
                    const p = FICTIONAL_LEARNERS[seatId]
                    const work = privateWorkBySeat[seatId]
                    const forCurrent = work && work.questionIndex === sharedState.currentQuestionIndex
                    const confirmed = Boolean(confirm321BySeat[seatId])
                    return (
                      <div
                        key={seatId}
                        className={styles.rosterCard}
                        data-testid={`host-private-${seatId}`}
                      >
                        <div className={styles.rosterHead}>
                          <strong>
                            {p.realFirstName} (age {p.age}) → group sees “{publicLabelForSeat(seatId)}”
                          </strong>
                          <span className={p.consent321 ? styles.consentYes : styles.consentNo}>
                            3.21: {p.consent321 ? 'Yes' : 'No (private only)'}
                          </span>
                        </div>
                        {forCurrent ? (
                          <>
                            <div>
                              Answer: <strong>{work.typedAnswer}</strong> ·{' '}
                              <span style={{ color: work.isCorrect ? '#bef264' : '#fda4af' }}>
                                {work.isCorrect ? 'Correct' : 'Needs coaching'}
                              </span>{' '}
                              (try #{work.attempts})
                            </div>
                            {work.scratchWork ? (
                              <div style={{ color: '#cbd5e1' }}>Scratch: {work.scratchWork}</div>
                            ) : null}
                            {p.consent321 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label className={styles.checkboxRow}>
                                  <input
                                    type="checkbox"
                                    checked={confirmed}
                                    onChange={(e) =>
                                      setConfirm321BySeat((prev) => ({
                                        ...prev,
                                        [seatId]: e.target.checked,
                                      }))
                                    }
                                  />
                                  Asked family before showing this specific example (3.21)
                                </label>
                                <div className={styles.hostGrid}>
                                  <button
                                    type="button"
                                    className={styles.btn}
                                    disabled={!confirmed}
                                    data-testid={`spotlight-btn-${seatId}`}
                                    onClick={() =>
                                      runHostCommand({
                                        type: 'spotlight_learner_work',
                                        seatId,
                                        summary: work.scratchWork || `Typed answer: ${work.typedAnswer}`,
                                        familyConfirmed: confirmed,
                                      })
                                    }
                                  >
                                    Show example on shared board
                                  </button>
                                  {sharedState.spotlight?.seatId === seatId ? (
                                    <button
                                      type="button"
                                      className={styles.btn}
                                      onClick={() => runHostCommand({ type: 'clear_spotlight' })}
                                    >
                                      Hide example
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.74rem', color: '#fda4af' }}>
                                Work sharing disabled: family chose No under Section 3.21.
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ color: '#94a3b8' }}>No answer submitted for this prompt yet.</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <details className={styles.detailsBox} style={{ marginTop: 10 }}>
                  <summary>After-lesson parent email summaries (Step 9 · simulated)</summary>
                  {parentSummaries.map((summary) => (
                    <div key={summary.seatId} className={styles.emailCard}>
                      <div>
                        <strong>To:</strong> {summary.parentEmailSimulated}
                      </div>
                      <div>
                        <strong>Subject:</strong> {summary.subject}
                      </div>
                      <div style={{ marginTop: 3 }}>{summary.body}</div>
                    </div>
                  ))}
                </details>
              </div>
            </>
          ) : null}
        </aside>
      </main>
    </div>
  )
}
