import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { QuizPanel } from './QuizPanel'
import type { Quiz } from '@contracts/v1'

/**
 * Regression cover for three defects Codex found in the first cut of this
 * panel. All three shipped with 719 passing tests, because none of those tests
 * knew this component existed.
 */

const quiz: Quiz = {
  quizId: 'quiz_test',
  releaseMode: 'question-driven',
  questions: [
    {
      questionId: 'q1',
      prompt: '1 + 1 = ?',
      choices: [
        { choiceId: 'q1a', text: '2', isCorrect: true },
        { choiceId: 'q1b', text: '3', isCorrect: false },
      ],
    },
    {
      questionId: 'q2',
      prompt: '2 + 2 = ?',
      choices: [
        { choiceId: 'q2a', text: '4', isCorrect: true },
        { choiceId: 'q2b', text: '5', isCorrect: false },
      ],
    },
  ],
}

beforeEach(() => window.localStorage.clear())

const finishButton = () => screen.getByRole('button', { name: /finish/i })

describe('attempt isolation', () => {
  it('a second attempt does not inherit the first attempt answers', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <QuizPanel quiz={quiz} attemptId="attempt-A" onComplete={() => {}} />,
    )
    await user.click(screen.getByLabelText('2'))
    await user.click(screen.getByLabelText('4'))
    expect(finishButton()).toBeEnabled()
    unmount()

    // The renewed attempt is a fresh possession. Arriving pre-answered would
    // submit work the student never did, under their name.
    render(<QuizPanel quiz={quiz} attemptId="attempt-B" onComplete={() => {}} />)
    expect(screen.getByLabelText('2')).not.toBeChecked()
    expect(screen.getByLabelText('4')).not.toBeChecked()
    expect(finishButton()).toBeDisabled()
  })

  it('does not write the previous attempt answers under the new attempt key', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <QuizPanel quiz={quiz} attemptId="attempt-A" onComplete={() => {}} />,
    )
    await user.click(screen.getByLabelText('2'))
    unmount()

    render(<QuizPanel quiz={quiz} attemptId="attempt-B" onComplete={() => {}} />)
    const bKey = 'sal0:quiz:attempt-B:quiz_test'
    const stored = JSON.parse(window.localStorage.getItem(bKey) ?? '{}')
    expect(Object.keys(stored)).toHaveLength(0)
  })
})

describe('stored answers are validated against the live quiz', () => {
  it('ignores a choiceId that does not belong to that question', () => {
    // Storage is user-writable. A stale or hand-edited value must not count as
    // an answer, or Finish enables for a lesson that was never completed and
    // submits a count that overstates the student's work.
    window.localStorage.setItem(
      'sal0:quiz:attempt-X:quiz_test',
      JSON.stringify({ q1: 'not-a-real-choice', q2: 'q2a' }),
    )
    render(<QuizPanel quiz={quiz} attemptId="attempt-X" onComplete={() => {}} />)
    expect(screen.getByText(/1 of 2 answered/i)).toBeInTheDocument()
    expect(finishButton()).toBeDisabled()
  })

  it('survives corrupt storage rather than breaking the lesson', () => {
    window.localStorage.setItem('sal0:quiz:attempt-Y:quiz_test', '{not json')
    render(<QuizPanel quiz={quiz} attemptId="attempt-Y" onComplete={() => {}} />)
    expect(screen.getByText(/0 of 2 answered/i)).toBeInTheDocument()
  })
})

describe('completion is claimed only when the parent says it was delivered', () => {
  it('does not show Finished while submitted is false', async () => {
    const user = userEvent.setup()
    render(<QuizPanel quiz={quiz} attemptId="attempt-D" onComplete={() => {}} />)
    await user.click(screen.getByLabelText('2'))
    await user.click(screen.getByLabelText('4'))
    await user.click(finishButton())

    // The panel must not self-declare. `submitted` is owned by the page, which
    // derives it from the SESSION state — awaiting the submit call is not
    // evidence of delivery, because deliver() resolves on a held result too.
    expect(screen.queryByText(/You answered/i)).not.toBeInTheDocument()
  })

  it('shows Finished, and stops accepting answers, once delivery is confirmed', () => {
    render(
      <QuizPanel quiz={quiz} attemptId="attempt-E" onComplete={() => {}} submitted />,
    )
    expect(screen.getByText(/You answered/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finish/i })).not.toBeInTheDocument()
  })

  it('calls onComplete once even when Finish is pressed twice', async () => {
    const user = userEvent.setup()
    let calls = 0
    render(
      <QuizPanel quiz={quiz} attemptId="attempt-F" onComplete={() => { calls += 1 }} />,
    )
    await user.click(screen.getByLabelText('2'))
    await user.click(screen.getByLabelText('4'))
    const button = finishButton()
    await user.click(button)
    await user.click(button)
    expect(calls).toBe(1)
  })
})
