import { useReducer } from 'react'
import { expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  equationSupport,
  helpEvidenceReducer,
  initialHelpEvidence,
  type HelpEvidence,
  type HelpPolicy,
} from '@content/questionSupport'
import { LESSONS } from './lessonCatalog'
import { QuestionHelp } from './QuestionHelp'

const lesson = LESSONS[1]!
const support = equationSupport(lesson.activityDraft.questions[0]!, lesson.questionNotes[0]!)!
function Harness({
  policy,
  onAskTeacher,
}: {
  policy?: Partial<HelpPolicy>
  onAskTeacher?: () => void | Promise<void>
}) {
  const [evidence, dispatch] = useReducer(helpEvidenceReducer, support, initialHelpEvidence)
  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: 'original_answer', choiceId: 'wrong', correct: false })}
      >
        Record incorrect attempt
      </button>
      <QuestionHelp
        support={support}
        evidence={evidence}
        onAction={dispatch}
        policy={policy}
        onAskTeacher={onAskTeacher}
      />
      <pre data-testid="evidence">{JSON.stringify(evidence)}</pre>
    </>
  )
}
function evidence(): HelpEvidence {
  return JSON.parse(screen.getByTestId('evidence').textContent!)
}
const panel = () => screen.getByRole('dialog', { name: 'Question help' })
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Question help' }))
}
async function full(user: ReturnType<typeof userEvent.setup>) {
  await open(user)
  await user.selectOptions(screen.getByLabelText('Help level'), '5')
  await user.click(screen.getByRole('button', { name: 'Explain my problem' }))
}

it('opens answer-free light help and closes immediately with Escape and focus restoration', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.queryByRole('dialog', { name: 'Question help' })).toBeNull()
  await open(user)
  expect(within(panel()).getByText(support.hint)).toBeVisible()
  expect(panel()).not.toHaveTextContent(/x = 6/)
  expect(screen.getByRole('button', { name: 'Close help' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Question help' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Question help' })).toHaveFocus()
  expect(evidence().highestTier).toBe(1)
  expect(screen.queryByRole('button', { name: 'Ask teacher' })).toBeNull()
})

it('changes both sides of the balance and preserves the model after closing', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await open(user)
  await user.selectOptions(screen.getByLabelText('Help level'), '2')
  expect(screen.getByRole('img')).toHaveAccessibleName('4 x boxes and 6 units balance 30 units.')
  await user.click(screen.getByRole('button', { name: 'Remove 6 from both sides' }))
  expect(screen.getByRole('img')).toHaveAccessibleName('4 x boxes balance 24 units. 4x = 24.')
  expect(panel()).not.toHaveTextContent(/x = 6/)
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  await open(user)
  expect(screen.getByRole('img')).toHaveAccessibleName('4 x boxes balance 24 units. 4x = 24.')
  expect(evidence().highestTier).toBe(2)
})

it('reveals only the current guided step and requires a correct student response before advancing', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await open(user)
  await user.selectOptions(screen.getByLabelText('Help level'), '3')
  expect(screen.queryByLabelText('What should we divide both sides by?')).toBeNull()
  const first = screen.getByLabelText('What should we subtract from both sides?')
  await user.type(first, '4{Enter}')
  expect(evidence().guidedStepsCompleted).toBe(0)
  expect(screen.queryByLabelText('What should we divide both sides by?')).toBeNull()
  await user.clear(first)
  await user.type(first, '6')
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  await open(user)
  expect(screen.getByLabelText('What should we subtract from both sides?')).toHaveValue('6')
  await user.click(screen.getByRole('button', { name: 'Check this step' }))
  expect(screen.queryByLabelText('Complete the last step: x =')).toBeNull()
  await user.type(screen.getByLabelText('What should we divide both sides by?'), '4{Enter}')
  expect(panel()).not.toHaveTextContent(/x = 6/)
  await user.type(screen.getByLabelText('Complete the last step: x ='), '6{Enter}')
  expect(evidence().guidedStepsCompleted).toBe(3)
  expect(panel()).toHaveTextContent('You completed the steps: x = 6.')
  expect(evidence().originalAttempts).toEqual([])
})

it('shows a parallel example before a directly requested full solution and records only actual exposure', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await open(user)
  await user.selectOptions(screen.getByLabelText('Help level'), '5')
  expect(panel()).toHaveTextContent('3x + 5 = 20')
  expect(panel()).not.toHaveTextContent(/x = 6/)
  expect(evidence()).toMatchObject({
    highestTier: 4,
    exampleViewed: true,
    full_solution_used: false,
  })
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  await open(user)
  expect(evidence().full_solution_used).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Explain my problem' }))
  expect(panel()).toHaveTextContent('x = 6.')
  expect(evidence()).toMatchObject({ highestTier: 5, full_solution_used: true })
  await user.selectOptions(screen.getByLabelText('Help level'), '1')
  expect(evidence().highestTier).toBe(5)
})

it('hides worked solutions during a fresh check and preserves its partial answer across closing', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await full(user)
  await user.click(screen.getByRole('button', { name: 'Try a fresh check' }))
  expect(panel()).toHaveTextContent('5x + 7 = 42')
  expect(screen.queryByRole('heading', { name: 'Your full solution' })).toBeNull()
  expect(panel()).not.toHaveTextContent('Divide both sides')
  await user.type(screen.getByLabelText('Fresh check: x ='), '7')
  expect(evidence().freshChecks[0]?.attempts).toBe(0)
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  await open(user)
  expect(screen.getByLabelText('Fresh check: x =')).toHaveValue('7')
  expect(evidence().freshChecks[0]?.helpUsed).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Check fresh answer' }))
  expect(evidence().freshChecks[0]?.independentSuccess).toBe(true)
  expect(evidence()).toMatchObject({
    full_solution_used: true,
    highestTier: 5,
    mastery: 'not_assessed',
  })
})

it('records support reopened during a fresh check and provides a new same-standard problem', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await full(user)
  await user.click(screen.getByRole('button', { name: 'Try a fresh check' }))
  await user.selectOptions(screen.getByLabelText('Help level'), '1')
  expect(evidence().freshChecks[0]?.helpUsed).toBe(true)
  await user.selectOptions(screen.getByLabelText('Help level'), '5')
  await user.click(screen.getByRole('button', { name: 'Try a fresh check' }))
  expect(panel()).toHaveTextContent('6x + 8 = 56')
  expect(panel()).toHaveTextContent('7.EE.4.a')
  await user.type(screen.getByLabelText('Fresh check: x ='), '8{Enter}')
  expect(evidence().freshChecks[1]).toMatchObject({ independentSuccess: true, sequence: 2 })
})

it('suggests after repeated incorrect attempts without automatically opening help', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const attempt = screen.getByRole('button', { name: 'Record incorrect attempt' })
  await user.click(attempt)
  expect(screen.queryByRole('button', { name: 'Try the balance model' })).toBeNull()
  await user.click(attempt)
  expect(screen.getByRole('button', { name: 'Try the balance model' })).toBeVisible()
  expect(screen.queryByRole('dialog', { name: 'Question help' })).toBeNull()
  expect(evidence().highestTier).toBe(0)
  await user.click(attempt)
  await user.click(screen.getByRole('button', { name: 'Try one step together' }))
  expect(evidence().highestTier).toBe(3)
})

it('honors capability policy and a dismissible one-time threshold without inventing teacher delivery', async () => {
  const user = userEvent.setup()
  const ask = vi.fn()
  render(
    <Harness
      policy={{ diagrams: false, fullSolution: false, suggestAfterIncorrect: 1 }}
      onAskTeacher={ask}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Record incorrect attempt' }))
  expect(panel()).toBeVisible()
  expect(screen.queryByRole('option', { name: '2. Balance model' })).toBeNull()
  expect(screen.queryByRole('option', { name: '5. Full solution' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  await user.click(screen.getByRole('button', { name: 'Record incorrect attempt' }))
  expect(screen.queryByRole('dialog', { name: 'Question help' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Ask teacher' }))
  expect(ask).toHaveBeenCalledOnce()
  expect(screen.queryByText(/sent/i)).toBeNull()
})
