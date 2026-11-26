/**
 * Teacher-led multiplayer Jigsaw lesson preview — core types.
 *
 * PRIVATE PREVIEW ONLY (fictional learners, non-live).
 * Enforces Enrollment Agreement v2 Sections 3.21, 3.22, 3.22A, and 4:
 *   - Shared group state NEVER carries typed math answers, scratch work,
 *     individual correctness, parent emails, or a learner's real first name
 *     when 3.21 consent is No.
 *   - Private learner work travels ONLY on a seat-scoped private channel
 *     between that learner and Mr. Sam (teacher host).
 */

export type SeatId = 'seat-1' | 'seat-2' | 'seat-3'
export type ParticipantRole = 'host' | 'learner'

/**
 * Fictional learner roster visible ONLY to Mr. Sam (host) and to each learner
 * for their own seat. Never serialized into SharedBoardState.
 */
export interface FictionalLearnerProfile {
  readonly seatId: SeatId
  readonly realFirstName: string
  readonly anonymousLabel: string
  readonly age: number
  /** Section 3.21 family consent to show first name on moves & share consented examples. */
  readonly consent321: boolean
  readonly parentEmailSimulated: string
}

/**
 * Public seat projection carried in SharedBoardState.
 * Contains NO realFirstName when consent321 is false, NO typedAnswer, NO scratchWork,
 * NO correctness flags, and NO email.
 */
export interface PublicSeatState {
  readonly seatId: SeatId
  readonly publicLabel: string
  readonly connected: boolean
  readonly lastSeenMs: number
  readonly passedLastTurn: boolean
}

export interface JigsawPieceState {
  readonly id: number
  readonly correctSlot: number
  /** Null while in the tray; 0..8 when placed on the 3x3 board. */
  readonly placedSlot: number | null
  /** Multiple of 45 degrees: 0, 45, 90, 135, 180, 225, 270, 315. */
  readonly rotationDeg: number
  /** Public label of whoever last moved/rotated this piece (respects 3.21). */
  readonly lastMovedByLabel: string | null
}

export interface LessonQuestion {
  readonly id: string
  readonly index: number
  readonly prompt: string
  readonly expectedAnswer: string
  readonly hint: string
  readonly teacherQuestion: string
  readonly workedExampleSteps: readonly string[]
}

export interface SharedClassTotal {
  readonly shown: boolean
  readonly correctCount: number
  readonly totalCount: number
}

export interface SharedWorkedExample {
  readonly shown: boolean
  readonly questionIndex: number
  readonly title: string
  readonly steps: readonly string[]
}

/**
 * Section 3.21 spotlight: shown from Mr. Sam's screen ONLY for a learner whose
 * family said Yes in 3.21 AND after confirming permission for this specific example.
 */
export interface SharedSpotlight {
  readonly seatId: SeatId
  readonly publicLabel: string
  readonly summary: string
  readonly consentedConfirmed: true
}

export interface SharedBoardState {
  readonly schemaVersion: 1
  readonly roomId: string
  readonly lessonTitle: string
  readonly activeImageKey: string
  readonly boardLocked: boolean
  readonly paused: boolean
  readonly activeSeatId: SeatId | null
  readonly turnRevision: number
  readonly updatedAtMs: number
  readonly seats: readonly PublicSeatState[]
  /** Group sees ONLY an aggregate answered count (e.g. "3 of 3 answered"), never who or what. */
  readonly answeredCount: number
  readonly currentQuestionIndex: number
  readonly classTotal: SharedClassTotal | null
  readonly workedExample: SharedWorkedExample | null
  readonly spotlight: SharedSpotlight | null
  readonly pieces: readonly JigsawPieceState[]
  readonly eventBanner: string
  readonly celebrationActive: boolean
}

/**
 * Strictly private learner answer + scratch work (Sections 3.22 / 3.22A).
 * Stored and transmitted ONLY on the seat-isolated private channel to Mr. Sam.
 */
export interface PrivateLearnerWork {
  readonly seatId: SeatId
  readonly questionIndex: number
  readonly typedAnswer: string
  readonly scratchWork: string
  readonly isCorrect: boolean
  readonly attempts: number
  readonly submittedAtMs: number
}

export type PrivateWorkBySeat = Partial<Record<SeatId, PrivateLearnerWork>>

export type LearnerBoardCommand =
  | {
      readonly type: 'rotate_piece'
      readonly actorSeatId: SeatId
      readonly pieceId: number
      readonly deltaDeg: -45 | 45 | 90
    }
  | {
      readonly type: 'place_piece'
      readonly actorSeatId: SeatId
      readonly pieceId: number
      readonly targetSlot: number
    }
  | {
      readonly type: 'return_piece_to_tray'
      readonly actorSeatId: SeatId
      readonly pieceId: number
    }
  | {
      readonly type: 'pass_turn'
      readonly actorSeatId: SeatId
    }

export type HostControlCommand =
  | { readonly type: 'unlock_board' }
  | { readonly type: 'lock_board'; readonly reason?: string }
  | { readonly type: 'toggle_pause' }
  | { readonly type: 'assign_turn'; readonly seatId: SeatId }
  | { readonly type: 'advance_turn' }
  | { readonly type: 'set_question'; readonly questionIndex: number }
  | { readonly type: 'toggle_worked_example' }
  | { readonly type: 'toggle_class_total' }
  | {
      readonly type: 'spotlight_learner_work'
      readonly seatId: SeatId
      readonly summary: string
      readonly familyConfirmed: boolean
    }
  | { readonly type: 'clear_spotlight' }
  | { readonly type: 'set_puzzle_image'; readonly imageKey: string }
  | { readonly type: 'reset_lesson' }

export type DenialCode =
  | 'BOARD_LOCKED'
  | 'BOARD_PAUSED'
  | 'NOT_ACTIVE_TURN'
  | 'SEAT_DISCONNECTED'
  | 'INVALID_PIECE'
  | 'INVALID_SLOT'
  | 'SLOT_OCCUPIED'
  | 'CONSENT_321_REQUIRED'
  | 'FAMILY_CONFIRMATION_REQUIRED'
  | 'NO_CONNECTED_LEARNERS'

export type CommandResult =
  | { readonly ok: true; readonly state: SharedBoardState }
  | { readonly ok: false; readonly code: DenialCode; readonly message: string; readonly state: SharedBoardState }

export interface ParentPostLessonSummary {
  readonly seatId: SeatId
  readonly learnerFirstName: string
  readonly parentEmailSimulated: string
  readonly subject: string
  readonly body: string
}
