import { describe, expect, it } from 'vitest'
import {
  ActivityDraftSchema,
  DEFAULT_PIECE_COUNT,
  PublishableActivityDraftSchema,
} from './activityDraft'

const questions = Array.from({ length: DEFAULT_PIECE_COUNT }, (_, index) => ({
  id: `question-${index + 1}`,
  prompt: `Question ${index + 1}?`,
  answer: String(index + 1),
  pieceIndex: index,
}))

const draft = {
  contractVersion: 1,
  id: 'draft-local',
  revision: 1,
  title: 'Integer review',
  puzzle: { rows: 3, columns: 3 },
  questions,
  updatedAt: '2026-08-26T12:00:00.000Z',
}

describe('authoring activity draft', () => {
  it('allows an incomplete working draft', () => {
    expect(
      ActivityDraftSchema.safeParse({ ...draft, questions: questions.slice(0, 4) }).success,
    ).toBe(true)
  })

  it('requires one unique question for each puzzle piece before publish', () => {
    expect(PublishableActivityDraftSchema.safeParse(draft).success).toBe(true)

    const missing = PublishableActivityDraftSchema.safeParse({
      ...draft,
      questions: questions.slice(0, DEFAULT_PIECE_COUNT - 1),
    })
    expect(missing.success).toBe(false)
    if (!missing.success) {
      expect(missing.error.issues.map((issue) => issue.message)).toContain(
        'A 3 x 3 puzzle requires exactly 9 questions.',
      )
    }
  })

  it('rejects duplicate prompts and duplicate piece assignments', () => {
    const duplicate = PublishableActivityDraftSchema.safeParse({
      ...draft,
      questions: questions.map((question, index) =>
        index === 8 ? { ...question, prompt: questions[0]!.prompt, pieceIndex: 0 } : question,
      ),
    })

    expect(duplicate.success).toBe(false)
    if (!duplicate.success) {
      const messages = duplicate.error.issues.map((issue) => issue.message)
      expect(messages).toContain('Question prompts must be unique.')
      expect(messages).toContain('Each puzzle piece must be unlocked by one question.')
      expect(messages).toContain('Puzzle piece 9 does not have a question.')
    }
  })
})
