import type {
  CommandResult,
  FictionalLearnerProfile,
  HostControlCommand,
  JigsawPieceState,
  LearnerBoardCommand,
  LessonQuestion,
  ParentPostLessonSummary,
  PrivateLearnerWork,
  PrivateWorkBySeat,
  PublicSeatState,
  SeatId,
  SharedBoardState,
} from './types'

export const SEAT_ORDER: readonly SeatId[] = ['seat-1', 'seat-2', 'seat-3']

/**
 * Fictional demo learners matching Claude 4's one-page lesson script
 * (`jigsaw-multiplayer-lesson-20261125.md`):
 *   - Maya (14): family said Yes in Section 3.21 -> shows as "Maya"
 *   - Leo (13): family said No in Section 3.21 -> shows ONLY as "Player 2"
 *   - Priya (15): family said Yes in Section 3.21 -> shows as "Priya"
 */
export const FICTIONAL_LEARNERS: Readonly<Record<SeatId, FictionalLearnerProfile>> = {
  'seat-1': {
    seatId: 'seat-1',
    realFirstName: 'Maya',
    anonymousLabel: 'Player 1',
    age: 14,
    consent321: true,
    parentEmailSimulated: 'maya.family@example.invalid',
  },
  'seat-2': {
    seatId: 'seat-2',
    realFirstName: 'Leo',
    anonymousLabel: 'Player 2',
    age: 13,
    consent321: false,
    parentEmailSimulated: 'leo.family@example.invalid',
  },
  'seat-3': {
    seatId: 'seat-3',
    realFirstName: 'Priya',
    anonymousLabel: 'Player 3',
    age: 15,
    consent321: true,
    parentEmailSimulated: 'priya.family@example.invalid',
  },
}

export interface PreviewPuzzleArtwork {
  readonly key: string
  readonly label: string
  /** Lightweight Chromebook-optimized WebP export already in public/; full masters live in Google Drive. */
  readonly src: string
  readonly alt: string
}

export const PREVIEW_PUZZLE_ARTWORKS: readonly PreviewPuzzleArtwork[] = [
  {
    key: 'sal0mander-rover-expedition',
    label: 'Rover Expedition',
    src: '/images/library/square/fantasy/sal0mander_rover_expedition.webp',
    alt: 'SAL0MANder hero riding a purple rover across an alien desert toward a spaceship.',
  },
  {
    key: 'salamander-forest',
    label: 'Forest Guardian',
    src: '/images/library/square/fantasy/salamander_forest.webp',
    alt: 'Black salamander with lime markings perched on a mossy log by glowing mushrooms.',
  },
  {
    key: 'red-panda',
    label: 'Red Panda Forest',
    src: '/images/library/square/wildlife/red_panda_forest.webp',
    alt: 'Red panda resting on a mossy tree above a mountain forest.',
  },
]

export const INTEGER_LESSON_QUESTIONS: readonly LessonQuestion[] = [
  {
    id: 'int-q1',
    index: 0,
    prompt: 'Evaluate −8 + 5',
    expectedAnswer: '-3',
    hint: 'Start at −8 on the number line and move 5 units right toward zero.',
    teacherQuestion: 'Before you type: is the answer above or below zero? How do you know?',
    workedExampleSteps: [
      'Start at −8 on the number line.',
      'Adding +5 moves 5 units to the right.',
      'You stop 3 units left of zero → −3.',
    ],
  },
  {
    id: 'int-q2',
    index: 1,
    prompt: 'Evaluate −4 − 7',
    expectedAnswer: '-11',
    hint: 'Subtracting a positive number moves further left on the number line.',
    teacherQuestion: 'Maya’s piece fits the top edge. What would a quarter turn do to it?',
    workedExampleSteps: [
      'Start at −4 on the number line.',
      'Subtracting 7 moves 7 more units left.',
      '4 + 7 = 11 units below zero → −11.',
    ],
  },
  {
    id: 'int-q3',
    index: 2,
    prompt: 'Evaluate 6 − (−4)',
    expectedAnswer: '10',
    hint: 'Subtracting a negative is the same as adding its opposite.',
    teacherQuestion: 'Player 2, two 45° turns: where will the piece point?',
    workedExampleSteps: [
      'Rewrite subtracting −4 as adding +4.',
      '6 + 4 = 10.',
    ],
  },
  {
    id: 'int-q4',
    index: 3,
    prompt: 'Evaluate −3 × 6',
    expectedAnswer: '-18',
    hint: 'A negative times a positive is negative.',
    teacherQuestion: 'Passing is a strategy. Watch this move and notice the sign rule.',
    workedExampleSteps: [
      'Multiply magnitudes: 3 × 6 = 18.',
      'Different signs give a negative product → −18.',
    ],
  },
  {
    id: 'int-q5',
    index: 4,
    prompt: 'Evaluate (−5) × (−4)',
    expectedAnswer: '20',
    hint: 'The opposite of a negative product is positive.',
    teacherQuestion: 'Board’s still ours. Which piece fits next to the top-left corner?',
    workedExampleSteps: [
      'Multiply magnitudes: 5 × 4 = 20.',
      'Two negative factors give a positive product → 20.',
    ],
  },
  {
    id: 'int-q6',
    index: 5,
    prompt: 'Evaluate −24 ÷ 6',
    expectedAnswer: '-4',
    hint: 'Ask what times 6 equals −24.',
    teacherQuestion: 'Here is one way to solve it. What happens first?',
    workedExampleSteps: [
      '24 ÷ 6 = 4.',
      'Negative divided by positive is negative → −4.',
    ],
  },
  {
    id: 'int-q7',
    index: 6,
    prompt: 'Evaluate −9 + 14',
    expectedAnswer: '5',
    hint: 'How many steps past zero do you travel from −9 when moving 14 right?',
    teacherQuestion: 'Which corner piece is rotated by 90° right now?',
    workedExampleSteps: [
      'From −9 to 0 takes 9 steps right.',
      '14 − 9 = 5 steps left to move past zero → 5.',
    ],
  },
  {
    id: 'int-q8',
    index: 7,
    prompt: 'Evaluate (−36) ÷ (−9)',
    expectedAnswer: '4',
    hint: 'Same signs in division give a positive quotient.',
    teacherQuestion: 'Two pieces left — check the rotation before placing.',
    workedExampleSteps: [
      '36 ÷ 9 = 4.',
      'Negative divided by negative is positive → 4.',
    ],
  },
  {
    id: 'int-q9',
    index: 8,
    prompt: 'Evaluate −12 + 12',
    expectedAnswer: '0',
    hint: 'Opposite integers combine to make zero.',
    teacherQuestion: 'Which turn taught you the most, yours or someone else’s? Answer in the activity.',
    workedExampleSteps: [
      '−12 and +12 are additive inverses.',
      'Moving 12 right from −12 lands right at 0.',
    ],
  },
]

/** Deterministic starting rotations (multiples of 45°) so every turn has real geometry talk. */
const INITIAL_ROTATIONS: readonly number[] = [90, 45, 270, 135, 315, 180, 45, 225, 90]

export const DEFAULT_HEARTBEAT_TTL_MS = 4500

/**
 * Returns the ONLY group-visible label allowed under Enrollment Agreement Section 3.21 & 3.22A.
 * Leo (consent321 === false) ALWAYS maps to "Player 2" so his first name never leaks to the group.
 */
export function publicLabelForSeat(seatId: SeatId): string {
  const learner = FICTIONAL_LEARNERS[seatId]
  return learner.consent321 ? learner.realFirstName : learner.anonymousLabel
}

export function normalizeRotation(deg: number): number {
  const mod = ((Math.round(deg / 45) * 45) % 360 + 360) % 360
  return mod
}

export function isPieceSolved(piece: JigsawPieceState): boolean {
  return piece.placedSlot === piece.correctSlot && normalizeRotation(piece.rotationDeg) === 0
}

export function isPuzzleComplete(pieces: readonly JigsawPieceState[]): boolean {
  return pieces.length === 9 && pieces.every(isPieceSolved)
}

export function createInitialPieces(): readonly JigsawPieceState[] {
  return INITIAL_ROTATIONS.map((rot, index) => ({
    id: index,
    correctSlot: index,
    placedSlot: null,
    rotationDeg: rot,
    lastMovedByLabel: null,
  }))
}

export function createInitialSharedState(roomId: string, nowMs = Date.now()): SharedBoardState {
  const seats: PublicSeatState[] = SEAT_ORDER.map((seatId) => ({
    seatId,
    publicLabel: publicLabelForSeat(seatId),
    connected: false,
    lastSeenMs: 0,
    passedLastTurn: false,
  }))

  return {
    schemaVersion: 1,
    roomId,
    lessonTitle: 'Integer Operations · 9 pieces · 45° Rotation',
    activeImageKey: PREVIEW_PUZZLE_ARTWORKS[0]!.key,
    boardLocked: true,
    paused: false,
    activeSeatId: 'seat-1',
    turnRevision: 1,
    updatedAtMs: nowMs,
    seats,
    answeredCount: 0,
    currentQuestionIndex: 0,
    classTotal: null,
    workedExample: null,
    spotlight: null,
    pieces: createInitialPieces(),
    eventBanner: 'Waiting for Mr. Sam',
    celebrationActive: false,
  }
}

export function normalizeMathAnswer(raw: string): string {
  return raw
    .trim()
    .replace(/\u2212|\u2013|\u2014/g, '-')
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
}

export function gradePrivateAnswer(questionIndex: number, typedAnswer: string): boolean {
  const q = INTEGER_LESSON_QUESTIONS[questionIndex]
  if (!q) return false
  return normalizeMathAnswer(typedAnswer) === normalizeMathAnswer(q.expectedAnswer)
}

export function buildPrivateWorkRecord(
  seatId: SeatId,
  questionIndex: number,
  typedAnswer: string,
  scratchWork: string,
  previousAttempts: number,
  nowMs = Date.now(),
): PrivateLearnerWork {
  return {
    seatId,
    questionIndex,
    typedAnswer: typedAnswer.trim(),
    scratchWork: scratchWork.trim(),
    isCorrect: gradePrivateAnswer(questionIndex, typedAnswer),
    attempts: previousAttempts + 1,
    submittedAtMs: nowMs,
  }
}

/**
 * Counts how many learners have submitted an answer for the current question.
 * Returns ONLY an integer count — zero names, zero answers, zero correctness flags.
 */
export function countAnsweredForQuestion(
  privateWork: PrivateWorkBySeat,
  questionIndex: number,
): number {
  let count = 0
  for (const seatId of SEAT_ORDER) {
    const entry = privateWork[seatId]
    if (entry && entry.questionIndex === questionIndex && entry.typedAnswer.length > 0) {
      count += 1
    }
  }
  return count
}

/**
 * Picks the next connected seat after `fromSeatId` in circular order.
 * Returns null if no other seat is connected.
 */
export function findNextConnectedSeat(
  seats: readonly PublicSeatState[],
  fromSeatId: SeatId | null,
  excludeSeatId?: SeatId,
): SeatId | null {
  const startIndex = fromSeatId ? Math.max(0, SEAT_ORDER.indexOf(fromSeatId)) : -1
  for (let offset = 1; offset <= SEAT_ORDER.length; offset += 1) {
    const candidateId = SEAT_ORDER[(startIndex + offset) % SEAT_ORDER.length]!
    if (candidateId === excludeSeatId) continue
    const seat = seats.find((s) => s.seatId === candidateId)
    if (seat?.connected) return candidateId
  }
  return null
}

/**
 * Enforces Single-Turn Control (Gate 1):
 * Only the currently active, connected learner seat may rotate/place/pass a piece,
 * and ONLY while the board is unlocked and unpaused by Mr. Sam.
 */
export function applyLearnerBoardCommand(
  state: SharedBoardState,
  cmd: LearnerBoardCommand,
  nowMs = Date.now(),
): CommandResult {
  if (state.paused) {
    return {
      ok: false,
      code: 'BOARD_PAUSED',
      message: 'Board is paused by Mr. Sam for teaching.',
      state,
    }
  }
  if (state.boardLocked) {
    return {
      ok: false,
      code: 'BOARD_LOCKED',
      message: 'Board is locked — waiting for Mr. Sam.',
      state,
    }
  }
  if (state.activeSeatId !== cmd.actorSeatId) {
    const activeLabel = state.activeSeatId ? publicLabelForSeat(state.activeSeatId) : 'Mr. Sam'
    return {
      ok: false,
      code: 'NOT_ACTIVE_TURN',
      message: `Controls are locked — it is ${activeLabel}’s turn.`,
      state,
    }
  }
  const actorSeat = state.seats.find((s) => s.seatId === cmd.actorSeatId)
  if (!actorSeat?.connected) {
    return {
      ok: false,
      code: 'SEAT_DISCONNECTED',
      message: 'Your seat is currently disconnected.',
      state,
    }
  }

  const label = publicLabelForSeat(cmd.actorSeatId)

  if (cmd.type === 'pass_turn') {
    const nextSeat = findNextConnectedSeat(state.seats, cmd.actorSeatId, cmd.actorSeatId)
    const updatedSeats = state.seats.map((s) =>
      s.seatId === cmd.actorSeatId ? { ...s, passedLastTurn: true } : s,
    )
    const nextLabel = nextSeat ? publicLabelForSeat(nextSeat) : null
    return {
      ok: true,
      state: {
        ...state,
        seats: updatedSeats,
        activeSeatId: nextSeat ?? cmd.actorSeatId,
        boardLocked: nextSeat === null ? true : state.boardLocked,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: nextLabel
          ? `${label} passed · Now ${nextLabel}’s turn`
          : `${label} passed · Waiting for Mr. Sam`,
      },
    }
  }

  const targetPiece = state.pieces.find((p) => p.id === cmd.pieceId)
  if (!targetPiece) {
    return { ok: false, code: 'INVALID_PIECE', message: 'Piece not found.', state }
  }

  let nextPieces: JigsawPieceState[]
  let banner: string

  if (cmd.type === 'rotate_piece') {
    const nextRot = normalizeRotation(targetPiece.rotationDeg + cmd.deltaDeg)
    nextPieces = state.pieces.map((p) =>
      p.id === cmd.pieceId ? { ...p, rotationDeg: nextRot, lastMovedByLabel: label } : p,
    )
    const snapped =
      targetPiece.placedSlot === targetPiece.correctSlot && nextRot === 0
    banner = snapped
      ? `${label} rotated piece #${cmd.pieceId + 1} into place (0°)!`
      : `${label} rotated piece #${cmd.pieceId + 1} to ${nextRot}°`
  } else if (cmd.type === 'place_piece') {
    if (!Number.isInteger(cmd.targetSlot) || cmd.targetSlot < 0 || cmd.targetSlot > 8) {
      return { ok: false, code: 'INVALID_SLOT', message: 'Invalid board slot.', state }
    }
    const occupant = state.pieces.find(
      (p) => p.placedSlot === cmd.targetSlot && p.id !== cmd.pieceId,
    )
    if (occupant) {
      return {
        ok: false,
        code: 'SLOT_OCCUPIED',
        message: 'That board slot already holds another piece.',
        state,
      }
    }
    nextPieces = state.pieces.map((p) =>
      p.id === cmd.pieceId
        ? { ...p, placedSlot: cmd.targetSlot, lastMovedByLabel: label }
        : p,
    )
    const updatedPiece = nextPieces.find((p) => p.id === cmd.pieceId)!
    banner = isPieceSolved(updatedPiece)
      ? `${label} snapped piece #${cmd.pieceId + 1} into slot ${cmd.targetSlot + 1}!`
      : `${label} moved piece #${cmd.pieceId + 1} to slot ${cmd.targetSlot + 1} (${updatedPiece.rotationDeg}°)`
  } else {
    nextPieces = state.pieces.map((p) =>
      p.id === cmd.pieceId ? { ...p, placedSlot: null, lastMovedByLabel: label } : p,
    )
    banner = `${label} returned piece #${cmd.pieceId + 1} to the tray`
  }

  const complete = isPuzzleComplete(nextPieces)
  const updatedSeats = state.seats.map((s) =>
    s.seatId === cmd.actorSeatId ? { ...s, passedLastTurn: false } : s,
  )

  return {
    ok: true,
    state: {
      ...state,
      seats: updatedSeats,
      pieces: nextPieces,
      turnRevision: state.turnRevision + 1,
      updatedAtMs: nowMs,
      celebrationActive: complete,
      boardLocked: complete ? true : state.boardLocked,
      eventBanner: complete ? 'Puzzle complete! Great teamwork!' : banner,
    },
  }
}

/**
 * Teacher Host Controls (Mr. Sam only).
 */
export function applyHostCommand(
  state: SharedBoardState,
  cmd: HostControlCommand,
  privateWork: PrivateWorkBySeat,
  nowMs = Date.now(),
): CommandResult {
  if (cmd.type === 'unlock_board') {
    const active =
      state.activeSeatId &&
      state.seats.find((s) => s.seatId === state.activeSeatId)?.connected
        ? state.activeSeatId
        : findNextConnectedSeat(state.seats, null)

    const targetSeat = active ?? state.activeSeatId ?? 'seat-1'
    const label = publicLabelForSeat(targetSeat)
    return {
      ok: true,
      state: {
        ...state,
        boardLocked: false,
        paused: false,
        activeSeatId: targetSeat,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: `${label}’s turn — board unlocked by Mr. Sam`,
      },
    }
  }

  if (cmd.type === 'lock_board') {
    return {
      ok: true,
      state: {
        ...state,
        boardLocked: true,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: cmd.reason ?? 'Board locked by Mr. Sam',
      },
    }
  }

  if (cmd.type === 'toggle_pause') {
    const nextPaused = !state.paused
    const activeLabel = state.activeSeatId ? publicLabelForSeat(state.activeSeatId) : 'Mr. Sam'
    return {
      ok: true,
      state: {
        ...state,
        paused: nextPaused,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: nextPaused
          ? 'Mr. Sam paused the board to teach'
          : state.boardLocked
            ? 'Unpaused · Waiting for Mr. Sam to unlock'
            : `Resumed · ${activeLabel}’s turn`,
      },
    }
  }

  if (cmd.type === 'assign_turn') {
    const label = publicLabelForSeat(cmd.seatId)
    return {
      ok: true,
      state: {
        ...state,
        activeSeatId: cmd.seatId,
        boardLocked: false,
        paused: false,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: `Mr. Sam passed control to ${label}`,
      },
    }
  }

  if (cmd.type === 'advance_turn') {
    const nextSeat = findNextConnectedSeat(state.seats, state.activeSeatId)
    const fallbackSeat: SeatId =
      nextSeat ??
      SEAT_ORDER[(SEAT_ORDER.indexOf(state.activeSeatId ?? 'seat-3') + 1) % SEAT_ORDER.length]!
    const label = publicLabelForSeat(fallbackSeat)
    return {
      ok: true,
      state: {
        ...state,
        activeSeatId: fallbackSeat,
        boardLocked: false,
        paused: false,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: `Next turn: ${label}`,
      },
    }
  }

  if (cmd.type === 'set_question') {
    const clamped = Math.max(0, Math.min(INTEGER_LESSON_QUESTIONS.length - 1, cmd.questionIndex))
    const answeredCount = countAnsweredForQuestion(privateWork, clamped)
    const nextQuestion = INTEGER_LESSON_QUESTIONS[clamped]!
    return {
      ok: true,
      state: {
        ...state,
        currentQuestionIndex: clamped,
        answeredCount,
        classTotal: null,
        workedExample: null,
        spotlight: null,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: `Prompt #${clamped + 1}: ${nextQuestion.prompt}`,
      },
    }
  }

  if (cmd.type === 'toggle_worked_example') {
    const q = INTEGER_LESSON_QUESTIONS[state.currentQuestionIndex] ?? INTEGER_LESSON_QUESTIONS[0]!
    const showing = !(state.workedExample?.shown && state.workedExample.questionIndex === q.index)
    return {
      ok: true,
      state: {
        ...state,
        workedExample: showing
          ? {
              shown: true,
              questionIndex: q.index,
              title: `Mr. Sam’s worked example: ${q.prompt}`,
              steps: q.workedExampleSteps,
            }
          : null,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
      },
    }
  }

  if (cmd.type === 'toggle_class_total') {
    if (state.classTotal?.shown) {
      return {
        ok: true,
        state: {
          ...state,
          classTotal: null,
          turnRevision: state.turnRevision + 1,
          updatedAtMs: nowMs,
        },
      }
    }
    let correctCount = 0
    let totalCount = 0
    for (const seatId of SEAT_ORDER) {
      const entry = privateWork[seatId]
      if (entry && entry.questionIndex === state.currentQuestionIndex && entry.typedAnswer) {
        totalCount += 1
        if (entry.isCorrect) correctCount += 1
      }
    }
    return {
      ok: true,
      state: {
        ...state,
        classTotal: { shown: true, correctCount, totalCount },
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
      },
    }
  }

  if (cmd.type === 'spotlight_learner_work') {
    const profile = FICTIONAL_LEARNERS[cmd.seatId]
    if (!profile.consent321) {
      return {
        ok: false,
        code: 'CONSENT_321_REQUIRED',
        message: `${profile.anonymousLabel}’s family chose No under Section 3.21 — their work can never be shown to the group.`,
        state,
      }
    }
    if (!cmd.familyConfirmed) {
      return {
        ok: false,
        code: 'FAMILY_CONFIRMATION_REQUIRED',
        message: 'Confirm that you asked this family before showing this specific example (Section 3.21).',
        state,
      }
    }
    const sanitizedSummary = cmd.summary.trim().slice(0, 160)
    return {
      ok: true,
      state: {
        ...state,
        spotlight: {
          seatId: cmd.seatId,
          publicLabel: publicLabelForSeat(cmd.seatId),
          summary: sanitizedSummary,
          consentedConfirmed: true,
        },
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
        eventBanner: `Mr. Sam shared one consented strategy (${publicLabelForSeat(cmd.seatId)})`,
      },
    }
  }

  if (cmd.type === 'clear_spotlight') {
    return {
      ok: true,
      state: {
        ...state,
        spotlight: null,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
      },
    }
  }

  if (cmd.type === 'set_puzzle_image') {
    const found = PREVIEW_PUZZLE_ARTWORKS.find((a) => a.key === cmd.imageKey)
    if (!found) return { ok: true, state }
    return {
      ok: true,
      state: {
        ...state,
        activeImageKey: found.key,
        turnRevision: state.turnRevision + 1,
        updatedAtMs: nowMs,
      },
    }
  }

  // reset_lesson
  const fresh = createInitialSharedState(state.roomId, nowMs)
  return {
    ok: true,
    state: {
      ...fresh,
      activeImageKey: state.activeImageKey,
      seats: state.seats.map((s) => ({ ...s, passedLastTurn: false })),
      turnRevision: state.turnRevision + 1,
      eventBanner: 'Puzzle reset · Waiting for Mr. Sam',
    },
  }
}

/**
 * Handles join / heartbeat / disconnect for a learner seat (Gate 3: Disconnect Resilience).
 * If the currently active learner drops mid-turn, the turn lock AUTOMATICALLY releases
 * and hands control to the next connected seat (or safely returns to Mr. Sam if none remain).
 */
export function handleSeatPresence(
  state: SharedBoardState,
  seatId: SeatId,
  connected: boolean,
  nowMs = Date.now(),
): SharedBoardState {
  const existing = state.seats.find((s) => s.seatId === seatId)
  if (!existing) return state

  const nextSeats = state.seats.map((s) =>
    s.seatId === seatId
      ? { ...s, connected, lastSeenMs: connected ? nowMs : s.lastSeenMs }
      : s,
  )

  if (connected) {
    // Heartbeat / join update without unnecessary revision churn if already connected
    const justJoined = !existing.connected
    return {
      ...state,
      seats: nextSeats,
      turnRevision: justJoined ? state.turnRevision + 1 : state.turnRevision,
      updatedAtMs: justJoined ? nowMs : state.updatedAtMs,
      eventBanner: justJoined
        ? `${publicLabelForSeat(seatId)} joined the lesson`
        : state.eventBanner,
    }
  }

  // Disconnecting
  const wasActive = state.activeSeatId === seatId
  const departedLabel = publicLabelForSeat(seatId)

  if (!wasActive) {
    return {
      ...state,
      seats: nextSeats,
      turnRevision: existing.connected ? state.turnRevision + 1 : state.turnRevision,
      updatedAtMs: nowMs,
      eventBanner: existing.connected
        ? `${departedLabel} stepped away`
        : state.eventBanner,
    }
  }

  // Active learner disconnected mid-turn -> AUTO-RELEASE turn lock so group & Mr. Sam are never stranded!
  const nextSeat = findNextConnectedSeat(nextSeats, seatId, seatId)
  if (nextSeat) {
    const nextLabel = publicLabelForSeat(nextSeat)
    return {
      ...state,
      seats: nextSeats,
      activeSeatId: nextSeat,
      turnRevision: state.turnRevision + 1,
      updatedAtMs: nowMs,
      eventBanner: `${departedLabel} stepped away · Turn moved to ${nextLabel}`,
    }
  }

  return {
    ...state,
    seats: nextSeats,
    activeSeatId: null,
    boardLocked: true,
    turnRevision: state.turnRevision + 1,
    updatedAtMs: nowMs,
    eventBanner: `${departedLabel} stepped away · Waiting for Mr. Sam`,
  }
}

/**
 * Sweeps any learner seat whose heartbeat is older than `ttlMs`, automatically
 * releasing an orphaned active turn lock if a tab crashed or lost Wi-Fi.
 */
export function sweepStaleSeats(
  state: SharedBoardState,
  nowMs = Date.now(),
  ttlMs = DEFAULT_HEARTBEAT_TTL_MS,
): SharedBoardState {
  let next = state
  for (const seat of state.seats) {
    if (seat.connected && seat.lastSeenMs > 0 && nowMs - seat.lastSeenMs > ttlMs) {
      next = handleSeatPresence(next, seat.seatId, false, nowMs)
    }
  }
  return next
}

/**
 * Updates ONLY the aggregate answeredCount inside SharedBoardState.
 * Never copies answers, scratch text, or names into SharedBoardState.
 */
export function syncAnsweredCount(
  state: SharedBoardState,
  privateWork: PrivateWorkBySeat,
  nowMs = Date.now(),
): SharedBoardState {
  const answeredCount = countAnsweredForQuestion(privateWork, state.currentQuestionIndex)
  if (answeredCount === state.answeredCount) return state
  return {
    ...state,
    answeredCount,
    turnRevision: state.turnRevision + 1,
    updatedAtMs: nowMs,
  }
}

/**
 * Verification helper (Gate 2): asserts that a serialized SharedBoardState contains
 * NO private typed answers, NO private scratch text, NO non-consented real names ("Leo"),
 * and NO simulated parent emails.
 */
export function findPrivacyLeaks(
  sharedState: SharedBoardState,
  privateWork: PrivateWorkBySeat,
): string[] {
  const serialized = JSON.stringify(sharedState)
  const leaks: string[] = []

  // Non-consented learner real name (Leo, consent321 === false) must NEVER appear in shared state.
  for (const seatId of SEAT_ORDER) {
    const profile = FICTIONAL_LEARNERS[seatId]
    if (!profile.consent321 && new RegExp(`\\b${profile.realFirstName}\\b`, 'i').test(serialized)) {
      leaks.push(`Non-consented learner name "${profile.realFirstName}" leaked into SharedBoardState`)
    }
    if (serialized.includes(profile.parentEmailSimulated)) {
      leaks.push(`Parent email "${profile.parentEmailSimulated}" leaked into SharedBoardState`)
    }
  }

  // Private answers & scratch text must NEVER appear in shared state.
  for (const seatId of SEAT_ORDER) {
    const work = privateWork[seatId]
    if (!work) continue
    if (work.scratchWork.length >= 3 && serialized.includes(work.scratchWork)) {
      leaks.push(`Private scratch work for ${seatId} leaked into SharedBoardState`)
    }
    // Check typedAnswer when it's distinctive (length >= 3 so tiny digits like "0" or "1" from slot indices don't false-positive)
    if (work.typedAnswer.length >= 3 && serialized.includes(work.typedAnswer)) {
      leaks.push(`Private typed answer "${work.typedAnswer}" for ${seatId} leaked into SharedBoardState`)
    }
    if (serialized.includes('typedAnswer') || serialized.includes('scratchWork')) {
      leaks.push('Private field name found in SharedBoardState')
    }
  }

  return leaks
}

/**
 * Step 9 (After the lesson): builds isolated per-family parent summaries.
 * Each parent receives ONLY their own learner's results — never another child's.
 */
export function buildPostLessonParentSummaries(
  privateWork: PrivateWorkBySeat,
): readonly ParentPostLessonSummary[] {
  return SEAT_ORDER.map((seatId) => {
    const profile = FICTIONAL_LEARNERS[seatId]
    const work = privateWork[seatId]
    const q = work ? INTEGER_LESSON_QUESTIONS[work.questionIndex] : undefined
    const detail = work && q
      ? `Latest prompt (${q.prompt}): typed "${work.typedAnswer}" (${work.isCorrect ? 'correct' : 'still practicing'}, ${work.attempts} ${work.attempts === 1 ? 'try' : 'tries'}).`
      : 'Participated in the shared puzzle lesson; no written answer submitted yet.'

    return {
      seatId,
      learnerFirstName: profile.realFirstName,
      parentEmailSimulated: profile.parentEmailSimulated,
      subject: `SAL0MANder Math lesson note for ${profile.realFirstName} (preview — simulated email)`,
      body: `${profile.realFirstName} joined today's Integer Operations turn-taking puzzle with Mr. Sam. ${detail} Recording stayed off, and no other family saw ${profile.realFirstName}'s typed work.`,
    }
  })
}
