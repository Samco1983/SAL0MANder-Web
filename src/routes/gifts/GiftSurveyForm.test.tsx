import { useState } from 'react'
import { expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GIFT_SURVEY } from '@/gifts/giftSurvey'
import { GiftSurveyForm } from './GiftSurveyForm'

function Survey({ initial = {} }: { initial?: Record<string, string> }) {
  const [answers, setAnswers] = useState(initial)
  return (
    <GiftSurveyForm
      answers={answers}
      onAnswer={(id, answer) => setAnswers((current) => ({ ...current, [id]: answer }))}
    />
  )
}

it('advances picks by default without opening the next typing field', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  expect(screen.getByRole('checkbox', { name: 'Move to next after a pick' })).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Teal' }))
  expect(screen.getByText('Question 2 of 9')).toBeVisible()
  expect(screen.getByText(GIFT_SURVEY[1].ask)).toHaveFocus()
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[1].ask })).not.toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent('1 of 9 answered')
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })).toHaveValue('Teal')
})

it('lets people turn off automatic progression and change a pick in place', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  await user.click(screen.getByRole('checkbox', { name: 'Move to next after a pick' }))
  const field = screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })
  expect(field).not.toHaveFocus()
  const teal = screen.getByRole('button', { name: 'Teal' })
  await user.click(teal)
  expect(teal).toHaveAttribute('aria-pressed', 'true')
  expect(teal).toHaveFocus()
  expect(field).toHaveValue('Teal')
  expect(screen.getByRole('status')).toHaveTextContent('1 of 9 answered')
  expect(screen.getByRole('progressbar', { name: 'Favorites answered' })).toHaveAttribute(
    'value',
    '1',
  )
  expect(screen.getByText('Question 1 of 9')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Gold' }))
  expect(teal).toHaveAttribute('aria-pressed', 'false')
  expect(field).toHaveValue('Gold')
  expect(screen.getByRole('status')).toHaveTextContent('1 of 9 answered')
})

it('supports keyboard picks and next/back without losing custom text', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  screen.getByRole('button', { name: 'Teal' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByText(GIFT_SURVEY[1].ask)).toHaveFocus()
  await user.type(screen.getByRole('textbox', { name: GIFT_SURVEY[1].ask }), '  Pistachio  ')
  expect(screen.getByText('Question 2 of 9')).toBeVisible()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[2].ask })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[1].ask })).toHaveValue('Pistachio')
})

it('does not advance invalid or composing text on Enter', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  const field = screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })
  await user.type(field, '<b>Teal</b>{Enter}')
  expect(field).toHaveFocus()
  expect(screen.getByText('Question 1 of 9')).toBeVisible()
  await user.clear(field)
  await user.type(field, 'Teal')
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
  expect(screen.getByText('Question 1 of 9')).toBeVisible()
})

it('lets people jump to any question without claiming skipped answers are finished', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  await user.click(screen.getByRole('button', { name: /^Question 9:/ }))
  expect(screen.getByRole('button', { name: /^Question 9:/ })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await user.click(screen.getByRole('button', { name: 'Beach day' }))
  expect(screen.getByRole('heading', { name: 'Review your favorites' })).toHaveFocus()
  expect(screen.getAllByText('Not answered yet')).toHaveLength(8)
  expect(screen.queryByText(/That’s you in nine answers/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Continue favorites' }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })).toHaveValue('')
  await user.click(screen.getByRole('button', { name: /^Question 9:/ }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[8].ask })).toHaveValue('Beach day')
})

it('completes all nine answers, normalizes text and lets every review answer be edited', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  for (const [index, item] of GIFT_SURVEY.entries()) {
    if (index === 0)
      await user.type(screen.getByRole('textbox', { name: item.ask }), '  Ｔｅａｌ  {Enter}')
    else await user.click(screen.getByRole('button', { name: item.suggestions[0] }))
  }
  expect(screen.getByRole('status')).toHaveTextContent('9 of 9 answered')
  expect(screen.getByText(/That’s you in nine answers/)).toBeVisible()
  for (const [index, item] of GIFT_SURVEY.entries()) {
    await user.click(screen.getByRole('button', { name: `Edit ${item.label.toLowerCase()}` }))
    const field = screen.getByRole('textbox', { name: item.ask })
    expect(field).toHaveFocus()
    expect(field).toHaveValue(index === 0 ? 'Teal' : item.suggestions[0])
    await user.click(screen.getByRole('button', { name: 'Review all favorites' }))
  }
})

it('fills all nine directly in review with labels, validation and Enter focus progression', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  await user.click(screen.getByRole('button', { name: 'Review all favorites' }))
  expect(screen.getAllByRole('textbox')).toHaveLength(9)
  const color = screen.getByRole('textbox', { name: GIFT_SURVEY[0].label })
  await user.type(color, '<red>{Enter}')
  expect(color).toHaveAttribute('aria-invalid', 'true')
  expect(color).toHaveAccessibleDescription('Use plain text without markup or control characters.')
  expect(color).toHaveFocus()
  await user.clear(color)
  for (const [index, item] of GIFT_SURVEY.entries()) {
    const field = screen.getByRole('textbox', { name: item.label })
    await user.type(field, `  ${item.suggestions[0]}  {Enter}`)
    expect(field).toHaveValue(item.suggestions[0])
    if (index < 8)
      expect(screen.getByRole('textbox', { name: GIFT_SURVEY[index + 1]!.label })).toHaveFocus()
  }
  expect(screen.getByRole('status')).toHaveTextContent('9 of 9 answered')
  expect(screen.queryByRole('alert')).toBeNull()
  await user.clear(screen.getByRole('textbox', { name: GIFT_SURVEY[2].label }))
  expect(screen.getByRole('status')).toHaveTextContent('8 of 9 answered')
  expect(screen.getByText('Not answered yet')).toBeVisible()
})

it('keeps invalid text during jumps and review and counts only valid answers', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  const invalid = '<b>Teal</b>'
  await user.type(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask }), invalid)
  expect(screen.getByRole('alert')).toHaveTextContent('Use plain text')
  expect(screen.getByRole('button', { name: 'Next favorite' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /^Question 4:/ }))
  await user.click(screen.getByRole('button', { name: 'Otter' }))
  await user.click(screen.getByRole('button', { name: 'Review all favorites' }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[0].label })).toHaveValue(invalid)
  expect(screen.getByRole('alert')).toHaveTextContent('Use plain text')
  expect(screen.getByRole('status')).toHaveTextContent('1 of 9 answered')
  await user.click(screen.getByRole('button', { name: 'Edit favorite color' }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })).toHaveValue(invalid)
  await user.click(screen.getByRole('button', { name: 'Teal' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('2 of 9 answered')
})

it('bounds the initial ideas and offers more flavors and animal choices', async () => {
  const user = userEvent.setup()
  render(<Survey />)
  expect(
    within(screen.getByRole('group', { name: 'Answer suggestions' })).getAllByRole('button'),
  ).toHaveLength(8)
  expect(screen.queryByRole('button', { name: 'Turquoise' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'More ideas' }))
  expect(screen.getByRole('button', { name: 'Turquoise' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Fewer ideas' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await user.click(screen.getByRole('button', { name: /^Question 2:/ }))
  expect(screen.getByRole('button', { name: 'Butter pecan' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Pistachio' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'More ideas' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await user.click(screen.getByRole('button', { name: /^Question 4:/ }))
  expect(screen.getByRole('button', { name: 'Pug' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Dachshund' })).toBeVisible()
})

it('recognizes normalized typed suggestions and respects Unicode byte limits without truncation', async () => {
  const user = userEvent.setup()
  render(<Survey initial={{ color: '  ＴＥＡＬ  ' }} />)
  expect(screen.getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true')
  const field = screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })
  await user.clear(field)
  await user.type(field, '🌲'.repeat(16))
  expect(screen.getByRole('button', { name: 'Next favorite' })).toBeEnabled()
  await user.type(field, '🌲')
  expect(field).toHaveValue('🌲'.repeat(17))
  expect(screen.getByRole('alert')).toHaveTextContent('Please use a shorter answer')
  expect(screen.getByRole('button', { name: 'Next favorite' })).toBeDisabled()
})
