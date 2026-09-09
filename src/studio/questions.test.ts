import { describe, expect, it } from 'vitest'
import { newDraft } from './activityDraft'
import {
  MAX_CHOICES,
  MIN_CHOICES,
  addChoice,
  addQuestion,
  blankQuestion,
  editChoice,
  editQuestion,
  moveQuestion,
  questionProblems,
  removeChoice,
  removeQuestion,
  setCorrectChoice,
} from './questions'

const NOW = '2026-09-02T00:00:00.000Z'
const base = () => addQuestion(newDraft('act_test', NOW))
const first = (d: ReturnType<typeof base>) => d.questions[0]!

/**
 * `QuestionSchema` in `contracts/v1/share.ts` requires at least two choices and
 * refines that **exactly one** is correct. A question that breaks either rule is
 * rejected at the play boundary — in front of a class, at the worst moment. So
 * the editor must be unable to author one.
 */
describe('exactly one correct answer, always', () => {
  it('starts a new question with one correct answer already set', () => {
    // Never passes through the invalid "nothing correct yet" state.
    expect(blankQuestion().choices.filter((c) => c.isCorrect)).toHaveLength(1)
  })

  it('moves the correct answer rather than adding a second one', () => {
    const d = base()
    const q = first(d)
    const after = setCorrectChoice(d, q.id, q.choices[2]!.id)

    const correct = first(after).choices.filter((c) => c.isCorrect)
    expect(correct).toHaveLength(1)
    expect(correct[0]!.id).toBe(q.choices[2]!.id)
  })

  it('promotes another choice when the correct one is deleted', () => {
    // Otherwise deleting the right answer silently produces a question the
    // contract rejects, and nothing says so until a student opens it.
    const d = base()
    const q = first(d)
    const after = removeChoice(d, q.id, q.choices.find((c) => c.isCorrect)!.id)

    expect(first(after).choices.filter((c) => c.isCorrect)).toHaveLength(1)
  })

  it('keeps the correct answer when a different choice is deleted', () => {
    const d = base()
    const q = first(d)
    const correctId = q.choices.find((c) => c.isCorrect)!.id
    const after = removeChoice(d, q.id, q.choices.find((c) => !c.isCorrect)!.id)

    expect(first(after).choices.find((c) => c.isCorrect)!.id).toBe(correctId)
  })
})

describe('choice count stays inside what the contract allows', () => {
  it('refuses to go below the minimum', () => {
    let d = base()
    const q = first(d)
    // Strip down to the minimum, then try once more.
    for (const c of q.choices.slice(MIN_CHOICES)) d = removeChoice(d, q.id, c.id)
    const atMin = first(d).choices.length
    d = removeChoice(d, q.id, first(d).choices[0]!.id)

    expect(atMin).toBe(MIN_CHOICES)
    expect(first(d).choices).toHaveLength(MIN_CHOICES)
  })

  it('refuses to go above the maximum', () => {
    let d = base()
    const q = first(d)
    for (let i = 0; i < 10; i += 1) d = addChoice(d, q.id)
    expect(first(d).choices.length).toBe(MAX_CHOICES)
  })
})

describe('editing', () => {
  it('edits the question text without touching the choices', () => {
    const d = base()
    const q = first(d)
    const after = editQuestion(d, q.id, { questionText: 'Solve for x' })

    expect(first(after).questionText).toBe('Solve for x')
    expect(first(after).choices).toEqual(q.choices)
  })

  it('edits one choice and leaves the rest alone', () => {
    const d = base()
    const q = first(d)
    const after = editChoice(d, q.id, q.choices[1]!.id, 'x = 6')

    expect(first(after).choices[1]!.text).toBe('x = 6')
    expect(first(after).choices[0]!.text).toBe('')
  })

  it('removes a question', () => {
    const d = addQuestion(base())
    const after = removeQuestion(d, first(d).id)
    expect(after.questions).toHaveLength(1)
  })
})

describe('reordering', () => {
  it('moves a question down and back', () => {
    const d = addQuestion(addQuestion(newDraft('a', NOW)))
    const ids = d.questions.map((q) => q.id)

    expect(moveQuestion(d, ids[0]!, 1).questions.map((q) => q.id)).toEqual([ids[1], ids[0]])
    expect(moveQuestion(moveQuestion(d, ids[0]!, 1), ids[0]!, -1).questions.map((q) => q.id)).toEqual(ids)
  })

  it('does nothing at the ends rather than wrapping or throwing', () => {
    const d = addQuestion(addQuestion(newDraft('a', NOW)))
    const ids = d.questions.map((q) => q.id)

    expect(moveQuestion(d, ids[0]!, -1).questions.map((q) => q.id)).toEqual(ids)
    expect(moveQuestion(d, ids[1]!, 1).questions.map((q) => q.id)).toEqual(ids)
  })
})

/**
 * Problems are returned per question so the editor can point at the row that
 * needs work, rather than declaring the activity invalid and leaving a teacher
 * to hunt through thirty questions for the one that is wrong.
 */
describe('what is unfinished about a question', () => {
  it('reports a blank question and blank choices', () => {
    expect(questionProblems(blankQuestion())).toEqual(['no-text', 'blank-choice'])
  })

  it('reports nothing once the question is complete', () => {
    const q = blankQuestion()
    const filled = {
      ...q,
      questionText: '2x + 5 = 17',
      choices: q.choices.map((c, i) => ({ ...c, text: `x = ${i + 4}` })),
    }
    expect(questionProblems(filled)).toEqual([])
  })

  it('reports a missing correct answer', () => {
    const q = blankQuestion()
    const none = {
      ...q,
      questionText: 'q',
      choices: q.choices.map((c, i) => ({ ...c, text: `${i}`, isCorrect: false })),
    }
    expect(questionProblems(none)).toEqual(['no-correct-answer'])
  })
})
