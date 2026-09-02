import { describe, expect, it } from 'vitest'
import {
  BOARD_SHAPES,
  PIECE_COUNTS,
  canPublish,
  missAllowance,
  newDraft,
  puzzlePrice,
  readiness,
  type ActivityDraft,
} from './activityDraft'

const NOW = '2026-09-02T00:00:00.000Z'

function draftWith(patch: Partial<ActivityDraft>): ActivityDraft {
  const base = newDraft('act_test', NOW)
  return { ...base, ...patch, config: { ...base.config, ...patch.config } }
}

function questions(n: number, valid = true) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    questionText: valid ? `Question ${i}` : '',
    hintText: '',
    choices: [
      { id: 'a', text: '1', isCorrect: valid },
      { id: 'b', text: '2', isCorrect: false },
    ],
  }))
}

/**
 * The engine renders what it can render, and nothing warns when it cannot.
 *
 * `PuzzleManager.cs:2189` selects cols/rows with an if/else-if chain and **no
 * `else`** — an unrecognised piece count silently produces a 3x3 board. So an
 * option offered here that Unity does not recognise is an activity that renders
 * wrong in front of a class, with no error anywhere.
 */
describe('the options Teacher Studio is allowed to offer', () => {
  it('offers only piece counts the engine has a case for', () => {
    expect([...PIECE_COUNTS]).toEqual([4, 6, 9, 12, 16])
  })

  it('offers only the board shapes the engine defines', () => {
    // PuzzleManager.cs:12 — public enum BoardShape { Square, Portrait, Landscape }
    expect([...BOARD_SHAPES]).toEqual(['Square', 'Portrait', 'Landscape'])
  })

  it('does not offer the wireframe piece counts the engine cannot render', () => {
    // The Teacher Studio wireframe says 24; Student Play says 12. Neither has a
    // case in PuzzleManager, so both would render a 3x3 board silently.
    expect(PIECE_COUNTS).not.toContain(24 as never)
    expect(PIECE_COUNTS).not.toContain(20 as never)
  })
})

describe('a new draft', () => {
  it("starts from Unity's own defaults", () => {
    const d = newDraft('act_x', NOW)
    expect(d.config.pieceCountPreset).toBe(9)
    expect(d.config.boardShape).toBe('Square')
    expect(d.config.schemaVersion).toBe(2)
  })

  it('starts with drag-and-place, not Mystery Reveal', () => {
    // Unity's field default is false. The demos set it true, but a teacher
    // starting fresh should get the mode they did not have to ask for.
    expect(newDraft('act_x', NOW).config.autoPlaceCorrectPieces).toBe(false)
  })
})

/**
 * Answers are currency: a correct answer earns one, a release costs one.
 */
describe('what the puzzle costs', () => {
  it('costs one answer per piece', () => {
    expect(puzzlePrice(draftWith({ config: { pieceCountPreset: 16 } as never }))).toBe(16)
  })

  it('costs nothing in Classic, which has no questions', () => {
    expect(puzzlePrice(draftWith({ config: { activityType: 'Classic' } as never }))).toBe(0)
  })

  it('reports how many a student may miss', () => {
    // 12 questions on a 9-piece board: three can be skipped or failed.
    const d = draftWith({ questions: questions(12) })
    expect(missAllowance(d)).toBe(3)
  })

  it('reports a negative allowance when the puzzle cannot be finished', () => {
    // The failure this catches: a teacher builds a 16-piece board, writes 8
    // questions, and every student stalls half-finished with nothing to answer.
    const d = draftWith({ config: { pieceCountPreset: 16 } as never, questions: questions(8) })
    expect(missAllowance(d)).toBe(-8)
  })
})

/**
 * The checklist answers "why can't I publish yet?" before the teacher asks.
 */
describe('the readiness checklist', () => {
  const complete = () =>
    draftWith({
      config: { title: 'Solar System' } as never,
      meta: { ...newDraft('a', NOW).meta, subject: 'Science', gradeLevel: '5', optionsReviewed: true },
      questions: questions(9),
    })

  it('blocks publishing on a brand-new draft', () => {
    expect(canPublish(newDraft('act_x', NOW))).toBe(false)
  })

  it('allows publishing once every row is complete', () => {
    expect(canPublish(complete())).toBe(true)
  })

  it('derives Ready to publish — it is never set by hand', () => {
    const rows = readiness(complete())
    const publish = rows.find((r) => r.id === 'publish')!
    expect(publish.complete).toBe(true)

    const blocked = readiness(draftWith({ ...complete(), questions: questions(2) }))
    expect(blocked.find((r) => r.id === 'publish')!.complete).toBe(false)
  })

  it('counts questions against the puzzle price, not a fixed number', () => {
    // The wireframe says "Questions (10+)". Ten is arbitrary — too many for a
    // 4-piece board, too few for a 16-piece one.
    const small = draftWith({
      ...complete(),
      config: { ...complete().config, pieceCountPreset: 4 },
      questions: questions(4),
    })
    expect(readiness(small).find((r) => r.id === 'questions')!.complete).toBe(true)

    const large = draftWith({
      ...complete(),
      config: { ...complete().config, pieceCountPreset: 16 },
      questions: questions(10),
    })
    expect(readiness(large).find((r) => r.id === 'questions')!.complete).toBe(false)
  })

  it('rejects a question with no text or without exactly one correct answer', () => {
    const d = draftWith({ ...complete(), questions: questions(9, false) })
    expect(readiness(d).find((r) => r.id === 'questions')!.complete).toBe(false)
  })

  it('tells the teacher what to do, not what is wrong', () => {
    const rows = readiness(draftWith({ ...complete(), questions: questions(6) }))
    const q = rows.find((r) => r.id === 'questions')!
    // "Add 3 more questions" — an instruction, not "invalid question count".
    expect(q.todo).toMatch(/add 3 more questions/i)
  })

  it('never says "1 more questions"', () => {
    const rows = readiness(draftWith({ ...complete(), questions: questions(8) }))
    expect(rows.find((r) => r.id === 'questions')!.todo).toMatch(/add 1 more question\b/i)
  })
})
