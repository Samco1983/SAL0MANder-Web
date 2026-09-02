import { z } from 'zod'

/**
 * A teacher's activity, as Teacher Studio holds it while they work.
 *
 * ## The shape mirrors Unity's `ActivityData`, deliberately and exactly
 *
 * Unity is the runtime; it owns what an activity *is*. Everything under
 * {@link ActivityConfigSchema} is a field Unity already reads, with the same
 * name and the same default. That is not tidiness — a second, subtly different
 * description of an activity is the failure mode this project has already paid
 * for twice, and it surfaces as a student seeing the wrong puzzle rather than as
 * a build error.
 *
 * Studio-only fields — subject, grade level, description, notes — are kept in a
 * separate object so the boundary is visible. They are for the teacher and for
 * the listing; Unity neither needs nor receives them.
 *
 * ## The option lists are constrained to what the engine can actually render
 *
 * `BoardShape` in `PuzzleManager.cs` is `{ Square, Portrait, Landscape }`, and
 * the cols/rows selection recognises only `{4, 6, 9, 12, 16}` pieces — with no
 * `else`, so an unrecognised count silently renders a 3x3 board and tells
 * nobody.
 *
 * So Teacher Studio offers exactly those. Offering a fourth shape or a 24-piece
 * board because the wireframe mentions one would let a teacher build an activity
 * that renders wrong, silently, in front of a class. When Unity gains a shape,
 * this list grows in the same change.
 */

/** Piece counts `PuzzleManager` has an explicit cols/rows case for. */
export const PIECE_COUNTS = [4, 6, 9, 12, 16] as const

/** `PuzzleManager.cs:12` — the complete enum. */
export const BOARD_SHAPES = ['Square', 'Portrait', 'Landscape'] as const

/** Mirrors Unity's `ActivityType`. */
export const ACTIVITY_TYPES = ['Learning', 'MysteryReveal', 'Classic', 'Both'] as const

export const ActivityConfigSchema = z.object({
  schemaVersion: z.literal(2),
  activityId: z.string().min(1),
  title: z.string(),
  activityType: z.enum(ACTIVITY_TYPES),
  /** `-1` is a custom upload, `-2` blank; 0+ selects a built-in picture. */
  imagePresetIndex: z.number().int().min(-2),
  pieceCountPreset: z.union([z.literal(4), z.literal(6), z.literal(9), z.literal(12), z.literal(16)]),
  boardShape: z.enum(BOARD_SHAPES),
  showBoardGuide: z.boolean(),
  enableCameraZoomAndPan: z.boolean(),
  allowRestart: z.boolean(),
  allowResumeLater: z.boolean(),
  allowHints: z.boolean(),
  allowCompletedPictureView: z.boolean(),
  /** True is Mystery Reveal: the earned piece places itself, no drag. */
  autoPlaceCorrectPieces: z.boolean(),
})
export type ActivityConfig = z.infer<typeof ActivityConfigSchema>

export const DraftQuestionSchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  hintText: z.string(),
  choices: z.array(z.object({ id: z.string().min(1), text: z.string(), isCorrect: z.boolean() })),
})
export type DraftQuestion = z.infer<typeof DraftQuestionSchema>

/** For the teacher and the listing. Never sent to Unity. */
export const StudioMetaSchema = z.object({
  subject: z.string(),
  gradeLevel: z.string(),
  description: z.string(),
  /** "Only you can see these notes" — the wireframe's Activity Notes panel. */
  notes: z.string(),
  /** Set once the teacher has been through Student Options — see readiness. */
  optionsReviewed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ActivityDraftSchema = z.object({
  config: ActivityConfigSchema,
  meta: StudioMetaSchema,
  questions: z.array(DraftQuestionSchema),
})
export type ActivityDraft = z.infer<typeof ActivityDraftSchema>

/**
 * Unity's own defaults, from `ActivityData` and `CreateDemoActivity`.
 *
 * Nine pieces and a square board because that is what all three shipped demo
 * activities use. `autoPlaceCorrectPieces` is false — Unity's field default —
 * even though the demos set it true; a teacher starting fresh gets the
 * drag-and-place experience unless they choose Mystery Reveal.
 */
export function newDraft(activityId: string, now: string): ActivityDraft {
  return {
    config: {
      schemaVersion: 2,
      activityId,
      title: '',
      activityType: 'Learning',
      imagePresetIndex: 0,
      pieceCountPreset: 9,
      boardShape: 'Square',
      showBoardGuide: true,
      enableCameraZoomAndPan: false,
      allowRestart: true,
      allowResumeLater: true,
      allowHints: true,
      allowCompletedPictureView: false,
      autoPlaceCorrectPieces: false,
    },
    meta: {
      subject: '',
      gradeLevel: '',
      description: '',
      notes: '',
      optionsReviewed: false,
      createdAt: now,
      updatedAt: now,
    },
    questions: [],
  }
}

/**
 * How many correct answers this puzzle costs.
 *
 * One per piece today, because Unity releases exactly one piece per correct
 * answer (`ReleaseNextPiece`). When the release schedule in
 * `PROPOSAL-PIECE-COST.md` lands, this becomes the sum of the schedule and
 * nothing else here changes.
 */
export function puzzlePrice(draft: ActivityDraft): number {
  if (draft.config.activityType === 'Classic') return 0
  return draft.config.pieceCountPreset
}

/**
 * Spare questions — how many a student may skip or get wrong and still finish.
 *
 * Answers are currency: a correct answer earns one, each release costs one.
 * Write exactly enough and every student must get every single question right,
 * which is a harsh activity and not usually what a teacher means.
 */
export function missAllowance(draft: ActivityDraft): number {
  return draft.questions.length - puzzlePrice(draft)
}

export type ReadinessRow = {
  id: 'basics' | 'image' | 'questions' | 'options' | 'publish'
  label: string
  complete: boolean
  /** Shown when incomplete: what the teacher has to do, not what is wrong. */
  todo: string
}

/**
 * The Readiness Checklist — the most valuable element in the owner's wireframe.
 *
 * It answers "why can't I publish yet?" *before* the teacher asks, which is the
 * question authoring tools usually leave people to work out for themselves.
 *
 * `publish` is derived and can never be set by hand: it is true exactly when
 * every row above it is true. The Publish control reads this and nothing else,
 * so the checklist is not a summary of the gate — it *is* the gate, and the two
 * cannot disagree.
 *
 * The questions row checks against the puzzle's price rather than a fixed count.
 * The wireframe says "Questions (10+)", but ten is arbitrary: too many for a
 * 4-piece board and too few for a 16-piece one.
 */
export function readiness(draft: ActivityDraft): ReadinessRow[] {
  const { config, meta, questions } = draft
  const price = puzzlePrice(draft)

  const basics = config.title.trim() !== '' && meta.subject !== '' && meta.gradeLevel !== ''
  const image = config.imagePresetIndex !== -2
  const enough = questions.length >= price
  const answered = questions.every(
    (q) => q.questionText.trim() !== '' && q.choices.filter((c) => c.isCorrect).length === 1,
  )
  const questionsReady = enough && answered
  const options = meta.optionsReviewed

  const rows: ReadinessRow[] = [
    {
      id: 'basics',
      label: 'Basic info',
      complete: basics,
      todo: 'Add a title, subject and grade level',
    },
    {
      id: 'image',
      label: 'Puzzle picture',
      complete: image,
      todo: 'Choose a picture for the puzzle',
    },
    {
      id: 'questions',
      label: price > 0 ? `Questions (${questions.length} of ${price} needed)` : 'Questions',
      complete: questionsReady,
      todo: !enough
        ? `Add ${price - questions.length} more question${price - questions.length === 1 ? '' : 's'}`
        : 'Give every question some text and exactly one correct answer',
    },
    {
      id: 'options',
      label: 'Student options',
      complete: options,
      todo: 'Look through the student options once',
    },
  ]

  rows.push({
    id: 'publish',
    label: 'Ready to publish',
    complete: rows.every((r) => r.complete),
    todo: 'Finish the steps above',
  })

  return rows
}

/** True only when every readiness row is complete. The Publish gate. */
export function canPublish(draft: ActivityDraft): boolean {
  return readiness(draft).every((r) => r.complete)
}
