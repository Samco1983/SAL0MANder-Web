import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildChildActor, buildMentorActor } from './access'
import { getCourseLadder } from './belts'
import {
  ANSWER_INPUT_MIN_CHARS,
  GRADE7_CURRICULUM,
  GRADE7_PRACTICE_SETS,
  checkCurriculumAnswer,
  getCurriculumSet,
  parseCurriculumUnit,
  selectProblemHint,
} from './curriculum'
import { sendWorkReviewReply } from './mentorActions'
import { LocalPortalStorageAdapter } from './storage'
import { openOrCreateWorkRecord, saveWorkDraft, startRedoAttempt, submitWorkRecord } from './workActions'

describe('portal Phase 1 — PR 8 curriculum loader, text-only answer check, and 7-unit stripe rules', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('loads and validates all 7 Grade 7 units (21 sets, 420 problems) with strict Zod schema', () => {
    expect(GRADE7_CURRICULUM).toHaveLength(7)
    expect(GRADE7_PRACTICE_SETS).toHaveLength(21)

    const seenAnswerTypes = new Set<string>()
    for (const unit of GRADE7_CURRICULUM) {
      expect(unit.sets).toHaveLength(3)
      for (const set of unit.sets) {
        expect(set.problems).toHaveLength(20)
        expect(set.openResponse.prompt.length).toBeGreaterThan(10)
        for (const problem of set.problems) {
          seenAnswerTypes.add(problem.answerType)
          expect(problem.hints.some((h) => h.ifAnswer === '*')).toBe(true)
          expect(checkCurriculumAnswer(problem.answer, problem)).toBe(true)
        }
      }
    }
    expect([...seenAnswerTypes].sort()).toEqual(['choice', 'decimal', 'expression', 'fraction', 'integer'])

    // Rejects invalid unit JSON (e.g. missing generic "*" hint)
    const badUnit = structuredClone(GRADE7_CURRICULUM[0]!)
    badUnit.sets[0]!.problems[0]!.hints = [{ ifAnswer: '999', say: 'Only specific hint' }]
    expect(() => parseCurriculumUnit(badUnit)).toThrow()
  })

  it('checks answers strictly as trimmed text ignoring case & spaces and NEVER evaluates expressions by value', () => {
    const u4a = getCurriculumSet('g7-u4-a')!
    const simplifyProb = u4a.problems.find((p) => p.id === 'g7-u4-a-01')! // 3x + 5x -> acceptedAnswers: ["8x"]
    const combineProb = u4a.problems.find((p) => p.id === 'g7-u4-a-02')! // acceptedAnswers includes "5y + 4", "4 + 5y"

    expect(checkCurriculumAnswer('  8X  ', simplifyProb)).toBe(true)
    expect(checkCurriculumAnswer('8 x', simplifyProb)).toBe(true)
    // Equivalent mathematical expression NOT in acceptedAnswers must be rejected (never evaluated by value)
    expect(checkCurriculumAnswer('3x + 5x', simplifyProb)).toBe(false)
    expect(checkCurriculumAnswer('4x + 4x', simplifyProb)).toBe(false)
    expect(checkCurriculumAnswer('   ', simplifyProb)).toBe(false)

    expect(checkCurriculumAnswer('  5Y+4 ', combineProb)).toBe(true)
    expect(checkCurriculumAnswer('4 + 5y', combineProb)).toBe(true)
    expect(checkCurriculumAnswer('2y + 3y + 4', combineProb)).toBe(false)

    // Matching specific hint vs "*" generic hint
    const u1a = getCurriculumSet('g7-u1-a')!
    const p1 = u1a.problems[0]! // -3 + 8 = 5; specific hints for "-11" and "-5"
    expect(selectProblemHint(' -11 ', p1)).toMatch(/kept the minus/i)
    expect(selectProblemHint('999', p1)).toMatch(/Picture a number line/i)
  })

  it('requires ALL 3 sets + open responses in a Grade 7 unit to pass review before crediting that unit stripe', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const leo = buildChildActor(seed, 'child_leo')
    const samuel = buildMentorActor(seed, 'mentor_samuel')

    const ladder = getCourseLadder('7th Grade Math')
    expect(ladder.units.map((u) => u.unitId)).toEqual(['g7-u1', 'g7-u2', 'g7-u3', 'g7-u4', 'g7-u5', 'g7-u6', 'g7-u7'])
    expect(ladder.units[4]?.requiredActivityIds).toEqual(['g7-u5-a', 'g7-u5-b', 'g7-u5-c'])

    // Leo starts at 4 stripes (green belt). Completing Unit 5 Set A and Set B alone does NOT grant a stripe.
    for (const setId of ['g7-u5-a', 'g7-u5-b'] as const) {
      const opened = openOrCreateWorkRecord(adapter, leo, 'child_leo', getCurriculumSet(setId)!)
      saveWorkDraft(adapter, leo, opened.record.id, opened.record.currentRevision, { answers: [], openResponse: `Explained ${setId}.` })
      submitWorkRecord(adapter, leo, opened.record.id)
      const rev = sendWorkReviewReply(adapter, samuel, opened.record.id, `Reviewed ${setId}.`)
      expect(rev.stripeEarned).toBe(false)
      expect(rev.state.children.find((c) => c.id === 'child_leo')?.stripesEarned).toBe(4)
    }

    // Set C reviewed WITHOUT open response still does NOT grant Unit 5's stripe
    const setC = openOrCreateWorkRecord(adapter, leo, 'child_leo', getCurriculumSet('g7-u5-c')!)
    submitWorkRecord(adapter, leo, setC.record.id)
    const revNoOpen = sendWorkReviewReply(adapter, samuel, setC.record.id, 'Please add your explanation.')
    expect(revNoOpen.stripeEarned).toBe(false)
    expect(revNoOpen.state.children.find((c) => c.id === 'child_leo')?.stripesEarned).toBe(4)

    // Redo Set C WITH open response -> Ask rail receives open response & mentor review credits Unit 5 stripe (4 -> 5), never auto-awarding purple belt
    const redo = startRedoAttempt(adapter, leo, setC.record.id)
    saveWorkDraft(adapter, leo, redo.record.id, redo.record.currentRevision, { answers: [], openResponse: 'I isolated the variable step by step.' })
    const subC = submitWorkRecord(adapter, leo, redo.record.id)
    expect(subC.state.askQuestions.some((q) => q.workRecordId === setC.record.id && q.source === 'worksheet_open_response')).toBe(true)
    const revC = sendWorkReviewReply(adapter, samuel, setC.record.id, 'Great explanation!')
    expect(revC.stripeEarned).toBe(true)
    const leoAfter = revC.state.children.find((c) => c.id === 'child_leo')!
    expect(leoAfter.stripesEarned).toBe(5)
    expect(leoAfter.currentBelt).toBe('green')

    // Redoing Set C again never double-credits Unit 5's stripe
    const redo2 = startRedoAttempt(adapter, leo, setC.record.id)
    saveWorkDraft(adapter, leo, redo2.record.id, redo2.record.currentRevision, { answers: [], openResponse: 'Extra practice check.' })
    submitWorkRecord(adapter, leo, redo2.record.id)
    const revAgain = sendWorkReviewReply(adapter, samuel, setC.record.id, 'Nice extra practice.')
    expect(revAgain.stripeEarned).toBe(false)
    expect(revAgain.state.children.find((c) => c.id === 'child_leo')?.stripesEarned).toBe(5)
  })

  it('lets a child pick any unit & set, enter 24+ char expressions, answer multiple-choice, and route open response through Ask rail', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    await user.click(await screen.findByRole('tab', { name: /^child profile$/i }, { timeout: 10_000 }))

    // Pick Unit 4: Expressions -> Set A as Leo (unstarted draft)
    await user.click(screen.getByRole('button', { name: /Leo \(green\)/i }))
    const picker = screen.getByTestId('unit-set-picker')
    await user.click(within(picker).getByRole('button', { name: /Unit 4: Expressions/i }))
    await user.click(within(screen.getByTestId('set-card-g7-u4-a')).getByRole('button', { name: /Set A/i }))

    // Answer input allows at least 24 characters & checks expressions by text only
    const p1 = screen.getByTestId('problem-g7-u4-a-01')
    const p1Input = within(p1).getByRole('textbox')
    expect(Number(p1Input.getAttribute('maxLength'))).toBeGreaterThanOrEqual(ANSWER_INPUT_MIN_CHARS)
    const longExpr = '3(3x + 4y - 1) + 2(x + y)'
    expect(longExpr.length).toBeGreaterThanOrEqual(24)
    await user.type(p1Input, longExpr)
    expect(p1Input).toHaveValue(longExpr)

    // Expression checked strictly as text ("3x + 5x" is wrong; " 8X " is correct)
    await user.clear(p1Input)
    await user.type(p1Input, '3x + 5x')
    await user.click(within(p1).getByRole('button', { name: /^check$/i }))
    expect(within(p1).getByText(/Teacher hint:/i)).toBeVisible()

    await user.clear(p1Input)
    await user.type(p1Input, '  8X ')
    await user.click(within(p1).getByRole('button', { name: /^check$/i }))
    expect(within(p1).getByText(/Correct!/i)).toBeVisible()

    // Switch to Marcus and open Unit 1 Set A to test multiple-choice problem (#4) and Ask-rail open response
    await user.click(screen.getByRole('button', { name: /back to profile/i }))
    await user.click(screen.getByRole('button', { name: /Marcus \(yellow\)/i }))
    await user.click(within(screen.getByTestId('unit-set-picker')).getByRole('button', { name: /Unit 1: Integers/i }))
    await user.click(within(screen.getByTestId('set-card-g7-u1-a')).getByRole('button', { name: /Set A/i }))

    const choiceProb = screen.getByTestId('problem-g7-u1-a-04')
    await user.click(within(choiceProb).getByRole('radio', { name: /c\) 7/i }))
    await user.click(within(choiceProb).getByRole('button', { name: /^check$/i }))
    expect(within(choiceProb).getByText(/Correct!/i)).toBeVisible()

    // Open response routes through Ask rail on Submit
    await user.type(screen.getByLabelText(/Open response \(Problem #16\)/i), 'I rewrote minus a negative as adding a positive.')
    await user.click(screen.getByRole('button', { name: /submit set/i }))
    await user.click(screen.getByRole('button', { name: /back to profile/i }))
    expect(screen.getByText(/I rewrote minus a negative as adding a positive\./i)).toBeVisible()
  }, 25_000)
})
