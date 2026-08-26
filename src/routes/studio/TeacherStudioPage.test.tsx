import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { TeacherStudioPage } from './TeacherStudioPage'

const validNine = Array.from(
  { length: 9 },
  (_, index) => `Question ${index + 1}? | ${index + 1}`,
).join('\n')

function renderStudio() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/studio']}>
        <Routes>
          <Route path="/studio" element={<TeacherStudioPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('Teacher Studio questions fast break', () => {
  beforeEach(() => localStorage.clear())

  it('imports nine questions and unlocks the puzzle step', async () => {
    const user = userEvent.setup()
    renderStudio()

    const continueButton = await screen.findByRole('button', { name: /continue to puzzle/i })
    expect(continueButton).toBeDisabled()

    await user.type(screen.getByLabelText(/questions and answers/i), validNine)
    await user.click(screen.getByRole('button', { name: /import questions/i }))

    expect(await screen.findByText('9 ready')).toBeInTheDocument()
    expect(screen.getByText('0 flagged')).toBeInTheDocument()
    expect(screen.getByText('0 missing')).toBeInTheDocument()
    expect(screen.getAllByText('Question ready')).toHaveLength(9)
    expect(continueButton).toBeEnabled()
  })

  it('keeps puzzle setup locked when import rows are invalid', async () => {
    const user = userEvent.setup()
    renderStudio()

    await user.type(
      screen.getByLabelText(/questions and answers/i),
      'Duplicate? | 1\nDuplicate? | 2',
    )
    await user.click(screen.getByRole('button', { name: /import questions/i }))

    expect(await screen.findByText('2 flagged')).toBeInTheDocument()
    expect(screen.getAllByText('Duplicate question.')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /continue to puzzle/i })).toBeDisabled()
  })

  it('repairs flagged rows without requiring another bulk import', async () => {
    const user = userEvent.setup()
    renderStudio()

    await user.type(
      screen.getByLabelText(/questions and answers/i),
      'Duplicate? | 1\nDuplicate? | 2',
    )
    await user.click(screen.getByRole('button', { name: /import questions/i }))

    const secondQuestion = await screen.findByLabelText('Question 2')
    await user.clear(secondQuestion)
    await user.type(secondQuestion, 'Different?')
    await user.tab()

    expect(await screen.findByText('0 flagged')).toBeInTheDocument()
    expect(screen.getByText('2 ready')).toBeInTheDocument()
    expect(screen.queryByText('Duplicate question.')).not.toBeInTheDocument()
  })

  it('reorders questions with keyboard-operable controls and undoes the change', async () => {
    const user = userEvent.setup()
    renderStudio()

    await user.type(screen.getByLabelText(/questions and answers/i), validNine)
    await user.click(screen.getByRole('button', { name: /import questions/i }))
    await user.click(await screen.findByRole('button', { name: /move question 2 up/i }))

    expect(screen.getByLabelText('Question 1')).toHaveValue('Question 2?')
    expect(screen.getByLabelText('Question 2')).toHaveValue('Question 1?')

    await user.click(screen.getByRole('button', { name: /undo last change/i }))
    expect(screen.getByLabelText('Question 1')).toHaveValue('Question 1?')
    expect(screen.getByLabelText('Question 2')).toHaveValue('Question 2?')
  })

  it('persists the activity title and imported questions on the device', async () => {
    const user = userEvent.setup()
    const { unmount } = renderStudio()

    await user.type(await screen.findByLabelText(/activity title/i), 'Integer warm-up')
    await user.type(screen.getByLabelText(/questions and answers/i), validNine)
    await user.click(screen.getByRole('button', { name: /import questions/i }))
    expect(screen.getByText(/draft saved/i)).toBeInTheDocument()

    unmount()
    renderStudio()

    expect(await screen.findByLabelText(/activity title/i)).toHaveValue('Integer warm-up')
    expect(screen.getAllByText('Question ready')).toHaveLength(9)
  })
})
