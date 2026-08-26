import { z } from 'zod'

export const AUTHORING_CONTRACT_VERSION = 1 as const
export const DEFAULT_PUZZLE_ROWS = 3 as const
export const DEFAULT_PUZZLE_COLUMNS = 3 as const
export const DEFAULT_PIECE_COUNT = DEFAULT_PUZZLE_ROWS * DEFAULT_PUZZLE_COLUMNS

export const AuthoringQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().trim().min(1).max(240),
  answer: z.string().trim().min(1).max(120),
  pieceIndex: z
    .number()
    .int()
    .min(0)
    .max(DEFAULT_PIECE_COUNT - 1),
})

export type AuthoringQuestion = z.infer<typeof AuthoringQuestionSchema>

export const ActivityDraftSchema = z.object({
  contractVersion: z.literal(AUTHORING_CONTRACT_VERSION),
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  title: z.string().trim().max(120),
  puzzle: z.object({
    rows: z.literal(DEFAULT_PUZZLE_ROWS),
    columns: z.literal(DEFAULT_PUZZLE_COLUMNS),
  }),
  questions: z.array(AuthoringQuestionSchema).max(DEFAULT_PIECE_COUNT),
  updatedAt: z.string().datetime(),
})

export type ActivityDraft = z.infer<typeof ActivityDraftSchema>

export const PublishableActivityDraftSchema = ActivityDraftSchema.superRefine((draft, context) => {
  if (draft.questions.length !== DEFAULT_PIECE_COUNT) {
    context.addIssue({
      code: 'custom',
      path: ['questions'],
      message: `A 3 x 3 puzzle requires exactly ${DEFAULT_PIECE_COUNT} questions.`,
    })
  }

  const pieceIndexes = new Set<number>()
  const normalizedPrompts = new Set<string>()

  for (const [index, question] of draft.questions.entries()) {
    if (pieceIndexes.has(question.pieceIndex)) {
      context.addIssue({
        code: 'custom',
        path: ['questions', index, 'pieceIndex'],
        message: 'Each puzzle piece must be unlocked by one question.',
      })
    }
    pieceIndexes.add(question.pieceIndex)

    const normalizedPrompt = question.prompt.toLocaleLowerCase()
    if (normalizedPrompts.has(normalizedPrompt)) {
      context.addIssue({
        code: 'custom',
        path: ['questions', index, 'prompt'],
        message: 'Question prompts must be unique.',
      })
    }
    normalizedPrompts.add(normalizedPrompt)
  }

  for (let pieceIndex = 0; pieceIndex < DEFAULT_PIECE_COUNT; pieceIndex += 1) {
    if (!pieceIndexes.has(pieceIndex)) {
      context.addIssue({
        code: 'custom',
        path: ['questions'],
        message: `Puzzle piece ${pieceIndex + 1} does not have a question.`,
      })
    }
  }
})

export type PublishableActivityDraft = z.infer<typeof PublishableActivityDraftSchema>
