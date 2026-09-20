import { expect, it } from 'vitest'
import { LESSONS } from '@routes/learn/lessonCatalog'
import {
  HelpEvidenceSchema,
  HelpPolicySchema,
  availableHelpTiers,
  equationSupport,
  exampleEquation,
  freshEquation,
  helpCategory,
  helpEvidenceReducer,
  initialHelpEvidence,
  sameNumber,
} from './questionSupport'

const lesson = LESSONS[1]!
const question = lesson.activityDraft.questions[0]!
const note = lesson.questionNotes[0]!
const support = equationSupport(question, note)!

it('derives the supported equation from retained canonical verification and standard metadata', () => {
  expect(support).toMatchObject({
    questionId: 'ca-g7-math-equations-q01',
    skill: 'fixed charge and equal groups',
    standardIds: ['7.EE.4.a'],
    coefficient: 4,
    constant: 6,
    total: 30,
    solution: 6,
  })
  expect(question.questionText).toContain('4x + 6 = 30')
  expect(equationSupport(question, { ...note, questionId: 'different' })).toBeNull()
  expect(
    equationSupport(question, {
      ...note,
      verification: { kind: 'equation', left: 'x/2', right: '30' },
    }),
  ).toBeNull()
  expect(
    equationSupport(question, {
      ...note,
      verification: { kind: 'equation', left: '4*x+6', right: '31' },
    }),
  ).toBeNull()
})

it('retains highest exposure and original attempts separately without awarding mastery', () => {
  let state = initialHelpEvidence(support)
  expect(helpCategory(state)).toBe('independent')
  state = helpEvidenceReducer(state, { type: 'original_answer', choiceId: 'wrong', correct: false })
  state = helpEvidenceReducer(state, { type: 'open_tier', tier: 4 })
  expect(state.full_solution_used).toBe(false)
  expect(state.exampleViewed).toBe(true)
  state = helpEvidenceReducer(state, { type: 'open_tier', tier: 5 })
  state = helpEvidenceReducer(state, { type: 'open_tier', tier: 1 })
  state = helpEvidenceReducer(state, {
    type: 'original_answer',
    choiceId: 'correct',
    correct: true,
  })
  expect(helpCategory(state)).toBe('tier5_full_solution')
  expect(state.originalAttempts).toEqual([
    { choiceId: 'wrong', correct: false, helpTier: 0 },
    { choiceId: 'correct', correct: true, helpTier: 5 },
  ])
  expect(state.full_solution_used).toBe(true)
  expect(state.mastery).toBe('not_assessed')
  expect(HelpEvidenceSchema.parse(state)).toEqual(state)
})

it('uses different numbers for the parallel example and each same-standard fresh check', () => {
  expect(exampleEquation(support)).toEqual({ coefficient: 3, constant: 5, total: 20, solution: 5 })
  expect(freshEquation(support, 1)).toEqual({ coefficient: 5, constant: 7, total: 42, solution: 7 })
  expect(freshEquation(support, 2)).toEqual({ coefficient: 6, constant: 8, total: 56, solution: 8 })
})

it('records an assisted check separately and requires a new check for an independent observation', () => {
  let state = helpEvidenceReducer(initialHelpEvidence(support), { type: 'open_tier', tier: 5 })
  state = helpEvidenceReducer(state, { type: 'begin_fresh_check' })
  state = helpEvidenceReducer(state, { type: 'open_tier', tier: 2 })
  state = helpEvidenceReducer(state, { type: 'fresh_answer', correct: true })
  expect(state.freshChecks[0]).toMatchObject({
    correct: true,
    helpUsed: true,
    independentSuccess: false,
  })
  state = helpEvidenceReducer(state, { type: 'begin_fresh_check' })
  state = helpEvidenceReducer(state, { type: 'fresh_answer', correct: false })
  state = helpEvidenceReducer(state, { type: 'fresh_answer', correct: true })
  state = helpEvidenceReducer(state, { type: 'open_tier', tier: 1 })
  expect(state.freshChecks[1]).toMatchObject({ sequence: 2, attempts: 2, independentSuccess: true })
  expect(state.full_solution_used).toBe(true)
  expect(state.highestTier).toBe(5)
  expect(state.mastery).toBe('not_assessed')
})

it('treats reopening original answer feedback during a fresh check as support', () => {
  let state = helpEvidenceReducer(initialHelpEvidence(support), { type: 'begin_fresh_check' })
  state = helpEvidenceReducer(state, {
    type: 'original_answer',
    choiceId: 'correct',
    correct: true,
  })
  state = helpEvidenceReducer(state, { type: 'fresh_answer', correct: true })
  expect(state.freshChecks[0]?.independentSuccess).toBe(false)
})

it('offers only allowed implemented capabilities and rejects partial/non-numeric input', () => {
  expect(availableHelpTiers(HelpPolicySchema.parse({}))).toEqual([1, 2, 3, 4, 5])
  expect(
    availableHelpTiers(
      HelpPolicySchema.parse({ diagrams: false, fullSolution: false, enabledTiers: [1, 2, 5] }),
    ),
  ).toEqual([1])
  expect(availableHelpTiers(HelpPolicySchema.parse({ enabledTiers: [] }))).toEqual([])
  for (const text of ['', ' ', '6x', '6junk', '0x6', '6e0', '-'])
    expect(sameNumber(text, 6)).toBe(false)
  expect(sameNumber(' 6.0 ', 6)).toBe(true)
})
