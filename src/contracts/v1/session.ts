import { z } from 'zod'
import { ActivityIdSchema, ActivityVersionIdSchema, ProfileIdSchema, SessionIdSchema } from './ids'
import { TimestampSchema } from './common'

/**
 * DRAFT. Play sessions and their results.
 *
 * Scale note: Unity does NOT stream piece movement to the backend. A session
 * produces a small number of writes — start, optional checkpoints, completion —
 * so 1,000 concurrent players is a low-volume write workload, not a firehose.
 * Anything finer-grained belongs in Unity's local state.
 */

/**
 * Guest identity: a device-local, self-minted token with no PII.
 *
 * A student opening a teacher's link must not create an account, enter an
 * email, or be asked for a name to start playing. The guest token exists only
 * so a session can be resumed on the same device and later *claimed* by a real
 * profile if the student chooses to sign up.
 */
export const GuestIdentitySchema = z.object({
  kind: z.literal('guest'),
  /** Device-local token. Not an account. Never treated as authentication. */
  guestToken: z.string().min(8),
  /** Optional, student-chosen, non-verified. Purely cosmetic. */
  displayName: z.string().max(40).optional(),
})
export type GuestIdentity = z.infer<typeof GuestIdentitySchema>

export const PlayerIdentitySchema = z.discriminatedUnion('kind', [
  GuestIdentitySchema,
  z.object({
    kind: z.literal('profile'),
    profileId: ProfileIdSchema,
  }),
])
export type PlayerIdentity = z.infer<typeof PlayerIdentitySchema>

export const SessionStatusSchema = z.enum(['in-progress', 'completed', 'abandoned'])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

export const PlaySessionSchema = z.object({
  id: SessionIdSchema,
  activityId: ActivityIdSchema,
  /** Pinned at start: a mid-session publish by the teacher must not swap it. */
  activityVersionId: ActivityVersionIdSchema,
  identity: PlayerIdentitySchema,
  status: SessionStatusSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable().default(null),
})
export type PlaySession = z.infer<typeof PlaySessionSchema>

/**
 * Coarse outcome summary reported by Unity at the end of a session.
 * Aggregate counts only — not a per-interaction event log.
 */
export const SessionResultSchema = z.object({
  sessionId: SessionIdSchema,
  status: SessionStatusSchema,
  durationMs: z.number().int().nonnegative(),
  questionsAnswered: z.number().int().nonnegative().default(0),
  questionsCorrect: z.number().int().nonnegative().default(0),
  piecesPlaced: z.number().int().nonnegative().default(0),
  piecesTotal: z.number().int().nonnegative().default(0),
  completedAt: TimestampSchema,
})
export type SessionResult = z.infer<typeof SessionResultSchema>

/**
 * Client-generated key making a submit retry-safe.
 *
 * Flaky classroom wifi means the same result may be POSTed several times. The
 * server must treat a repeat key as the same write, not a second attempt —
 * otherwise a student's completion is double-counted.
 */
export const SubmitResultRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  result: SessionResultSchema,
})
export type SubmitResultRequest = z.infer<typeof SubmitResultRequestSchema>
