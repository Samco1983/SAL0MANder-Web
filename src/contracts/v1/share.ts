import { z } from 'zod'
import { ActivityIdSchema, ActivityVersionIdSchema, MediaIdSchema } from './ids'
import { TimestampSchema } from './common'

/**
 * DRAFT — share-link resolution, mirroring `API_CONTRACT.md` §GET /v1/play/{shareCode}.
 *
 * Adopted from Codex's contract rather than invented here, per AGENT_WORKFLOW's
 * allowance for additive draft work that does not create a competing contract.
 * P-002 (shareCode) is still *Proposed*, so nothing here is frozen and the
 * existing `activityId` path keeps working alongside it.
 *
 * These are **wire** types. `activity.ts` holds the app's internal model; the
 * two are joined by an explicit adapter, which is what Codex's D-004 asks for
 * ("public DTOs are adapters").
 */

/**
 * A share code is not an activity id.
 *
 * Distinct branded types because they have incompatible lifetimes: an
 * `ActivityId` is permanent and non-revocable by design, while a share link
 * must be killable without destroying the activity behind it. Making them the
 * same string makes revocation impossible by construction.
 *
 * Its own alphabet, too. `ID_PATTERN` permits `O`/`0` and `I`/`l`/`1`, which is
 * fine for a machine-copied id and wrong for something a student retypes off a
 * whiteboard. This is Crockford base32 — no `I`, `L`, `O`, or `U` (the last
 * dropped so codes cannot spell unfortunate words).
 */
declare const shareBrand: unique symbol
export type ShareCode = string & { readonly [shareBrand]: 'ShareCode' }

export const SHARE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/** 8 chars over a 32-symbol alphabet is 40 bits — safe only with a resolve-rate limit. */
const SHARE_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6,16}$/

export const ShareCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase())
  .refine((v) => SHARE_CODE_PATTERN.test(v), {
    message: 'Invalid SAL0MANder share code',
  }) as unknown as z.ZodType<ShareCode>

/** Supported piece counts, per `API_CONTRACT.md` contract constraints. */
export const PIECE_COUNTS = [4, 6, 9, 12, 16] as const

export const PlayModeSchema = z.enum(['learning-puzzle', 'classic-puzzle'])
export type PlayMode = z.infer<typeof PlayModeSchema>

export const PuzzleConfigSchema = z.object({
  pieceCount: z.union(PIECE_COUNTS.map((n) => z.literal(n)) as [z.ZodLiteral<4>, z.ZodLiteral<6>, z.ZodLiteral<9>, z.ZodLiteral<12>, z.ZodLiteral<16>]),
  boardShape: z.string(),
  showBoardGuide: z.boolean().default(true),
  enableCameraZoomAndPan: z.boolean().default(false),
  allowRestart: z.boolean().default(true),
  allowResumeLater: z.boolean().default(true),
  allowHints: z.boolean().default(true),
  allowCompletedPictureView: z.boolean().default(false),
  allowClassicCustomization: z.boolean().default(false),
})
export type PuzzleConfig = z.infer<typeof PuzzleConfigSchema>

export const ChecksumSchema = z.object({
  algorithm: z.literal('sha256'),
  /** Lowercase hex over the exact delivered bytes (ASSET_PIPELINE §Integrity). */
  value: z.string().regex(/^[0-9a-f]{64}$/, 'checksum must be lowercase sha256 hex'),
})

/**
 * The runtime derivative the resolver picked.
 *
 * `downloadUrl` is transport, never identity: it may rotate and it expires.
 * Cache identity is `assetId + checksum` (D-007), which is why both are here
 * and why the URL is not something to key anything on.
 */
export const PuzzleAssetSchema = z.object({
  assetId: MediaIdSchema,
  variant: z.string(),
  downloadUrl: z.url(),
  downloadUrlExpiresAt: TimestampSchema.optional(),
  contentType: z.string(),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  checksum: ChecksumSchema,
})
export type PuzzleAsset = z.infer<typeof PuzzleAssetSchema>

export const ChoiceSchema = z.object({
  choiceId: z.string().min(1),
  text: z.string(),
  isCorrect: z.boolean(),
})

export const QuestionSchema = z.object({
  questionId: z.string().min(1),
  prompt: z.string().min(1),
  hint: z.string().optional(),
  /** `-1` is queue-driven; otherwise a zero-based piece index. */
  linkedPieceIndex: z.number().int().min(-1).optional(),
  choices: z
    .array(ChoiceSchema)
    .min(2, 'a question needs at least two choices')
    .refine((cs) => cs.filter((c) => c.isCorrect).length === 1, {
      message: 'a question needs exactly one correct choice',
    }),
})
export type Question = z.infer<typeof QuestionSchema>

export const QuizSchema = z.object({
  quizId: z.string().min(1),
  releaseMode: z.string(),
  questions: z.array(QuestionSchema),
})

/**
 * What `GET /v1/play/{shareCode}` returns.
 *
 * Cross-field rules below are enforced here rather than trusted, because this
 * is the boundary a mistake would cross into gameplay. A Learning activity
 * arriving with fewer questions than pieces would strand a student mid-puzzle
 * with no way to release the rest.
 */
export const PlayBundleSchema = z
  .object({
    activityId: ActivityIdSchema,
    activityVersionId: ActivityVersionIdSchema,
    versionNumber: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().default(''),
    authorDisplayName: z.string().optional(),
    allowedPlayModes: z.array(PlayModeSchema).min(1),
    defaultPlayMode: PlayModeSchema,
    puzzle: PuzzleConfigSchema,
    puzzleAsset: PuzzleAssetSchema,
    /** Absent for a Classic-only activity, which needs no questions. */
    quiz: QuizSchema.nullable().default(null),
  })
  .refine((b) => b.allowedPlayModes.includes(b.defaultPlayMode), {
    message: 'defaultPlayMode must be one of allowedPlayModes',
    path: ['defaultPlayMode'],
  })
  .refine(
    (b) =>
      !b.allowedPlayModes.includes('learning-puzzle') ||
      (b.quiz?.questions.length ?? 0) >= b.puzzle.pieceCount,
    {
      message: 'a Learning activity needs at least pieceCount questions',
      path: ['quiz', 'questions'],
    },
  )
  .refine(
    (b) =>
      (b.quiz?.questions ?? []).every(
        (q) => q.linkedPieceIndex === undefined || q.linkedPieceIndex < b.puzzle.pieceCount,
      ),
    {
      message: 'linkedPieceIndex must be less than pieceCount',
      path: ['quiz', 'questions'],
    },
  )
export type PlayBundle = z.infer<typeof PlayBundleSchema>

/** "Student Choice" is derived, never a stored third mode (D-005). */
export function isStudentChoice(bundle: Pick<PlayBundle, 'allowedPlayModes'>): boolean {
  return bundle.allowedPlayModes.length > 1
}
