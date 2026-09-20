import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { parseDraftBackup } from '@studio/draftBackup'
import { LearnPage } from './LearnPage'
import { LESSONS } from './lessonCatalog'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function show() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
async function choose(user: ReturnType<typeof userEvent.setup>, index = 0) {
  await user.click(screen.getByRole('button', { name: new RegExp(LESSONS[index]!.title) }))
}

it('offers only four sample courses with no questions, Unity, network or persisted answers on load', () => {
  const fetcher = vi.spyOn(window, 'fetch')
  const save = vi.spyOn(Storage.prototype, 'setItem')
  show()
  expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4)
  expect(screen.getByText(/not a complete grades 6–12 curriculum/)).toBeVisible()
  expect(screen.queryByRole('radio')).toBeNull()
  expect(document.querySelector('canvas')).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})

it('shows hints only on request and choice-specific feedback only after an attempt; next question resets both', async () => {
  const user = userEvent.setup()
  show()
  await choose(user)
  const lesson = LESSONS[0]!,
    question = lesson.activityDraft.questions[0]!,
    notes = lesson.questionNotes[0]!
  expect(screen.getByRole('heading', { name: lesson.title })).toHaveFocus()
  expect(screen.getByText(lesson.teacherGuide.miniLesson)).toBeVisible()
  expect(screen.queryByText(notes.explanation)).toBeNull()
  expect(screen.queryByText(question.hintText, { exact: false })).toBeNull()
  expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Show a hint' }))
  expect(screen.getByText(question.hintText, { exact: false })).toBeVisible()
  const wrong = question.choices.find((entry) => !entry.isCorrect)!
  await user.click(screen.getByRole('radio', { name: wrong.text }))
  expect(screen.queryByRole('status')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(screen.getByRole('status')).toHaveTextContent(
    notes.choiceReasoning.find((entry) => entry.choiceId === wrong.id)!.reason,
  )
  expect(screen.getByRole('status')).not.toHaveTextContent(notes.explanation)
  await user.click(
    screen.getByRole('radio', { name: question.choices.find((entry) => entry.isCorrect)!.text }),
  )
  expect(screen.queryByRole('status')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(screen.getByRole('status')).toHaveTextContent(notes.explanation)
  await user.click(screen.getByRole('button', { name: 'Next question' }))
  expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('button', { name: 'Show a hint' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(screen.getByText(lesson.activityDraft.questions[1]!.questionText)).toHaveFocus()
})

it('keeps the independent check separate from supported practice and its rubric hidden until finished', async () => {
  const user = userEvent.setup()
  show()
  await choose(user)
  await user.click(screen.getByRole('button', { name: 'Show a hint' }))
  const lesson = LESSONS[0]!
  expect(screen.queryByText(lesson.teacherGuide.independentExit.prompt)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Start independent check' }))
  expect(screen.getByText(lesson.teacherGuide.independentExit.prompt)).toHaveFocus()
  expect(screen.queryByRole('radio')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Show a hint' })).toBeNull()
  expect(screen.queryByText(lesson.teacherGuide.performanceRubric[0]!)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'I finished — show the review guide' }))
  expect(screen.getByText(lesson.teacherGuide.performanceRubric[0]!)).toBeVisible()
  expect(screen.getByText(/does not grade or save/)).toBeVisible()
  await choose(user, 1)
  expect(screen.queryByText(lesson.teacherGuide.performanceRubric[0]!)).toBeNull()
  expect(screen.getByRole('button', { name: 'Start independent check' })).toBeVisible()
})

it('prepares an exact Studio-compatible file only on request and releases it on changing lessons', async () => {
  const user = userEvent.setup()
  const blobs: Blob[] = []
  const create = vi.fn((blob: Blob) => {
    blobs.push(blob)
    return 'blob:lesson-test'
  })
  const revoke = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create
      static revokeObjectURL = revoke
    },
  )
  const view = show()
  await choose(user)
  expect(create).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: 'Download Studio activity' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Prepare Studio download' }))
  const download = screen.getByRole('link', { name: 'Download Studio activity' })
  expect(download).toHaveFocus()
  expect(download).toHaveAttribute('download', `${LESSONS[0]!.id}.studio-backup.json`)
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blobs[0]!)
  })
  expect(parseDraftBackup(text)).toEqual([LESSONS[0]!.activityDraft])
  await choose(user, 1)
  expect(revoke).toHaveBeenCalledWith('blob:lesson-test')
  expect(screen.queryByRole('link', { name: 'Download Studio activity' })).toBeNull()
  view.unmount()
  vi.unstubAllGlobals()
})

it('shows the exact authoritative standard link and honest Algebra I course scope', async () => {
  const user = userEvent.setup()
  show()
  await choose(user, 3)
  await user.click(screen.getByText('Standards and pilot scope'))
  const scope = screen.getByText('Standards and pilot scope').parentElement!
  expect(within(scope).getByRole('link', { name: 'California A-REI.3' })).toHaveAttribute(
    'href',
    LESSONS[3]!.standards[0]!.url,
  )
  expect(scope).toHaveTextContent(/not a CDE endorsement/)
  expect(screen.queryByText('Grade null')).toBeNull()
})

it('keeps q01 answers and full-solution history through closing and question navigation', async () => {
  const user = userEvent.setup()
  const save = vi.spyOn(Storage.prototype, 'setItem')
  const fetcher = vi.spyOn(window, 'fetch')
  show()
  await choose(user, 1)
  await user.click(screen.getByRole('radio', { name: 'x = 9' }))
  await user.click(screen.getByRole('button', { name: 'Check answer' }))
  await user.click(screen.getByRole('button', { name: 'Question help' }))
  await user.click(screen.getByRole('button', { name: 'Read the story in three parts' }))
  expect(screen.getByText(/\$6 for delivery, \$4 per kit, \$30 in total/)).toBeVisible()
  await user.selectOptions(screen.getByLabelText('Help level'), '5')
  await user.click(screen.getByRole('button', { name: 'Explain my problem' }))
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  expect(screen.getByRole('radio', { name: 'x = 9' })).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent('Take another look.')
  await user.click(screen.getByRole('button', { name: 'Next question' }))
  expect(screen.getByRole('button', { name: 'Show a hint' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Question help' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Previous question' }))
  expect(screen.getByRole('radio', { name: 'x = 9' })).toBeChecked()
  expect(screen.getByText(/Full solution used\. Closing help/)).toHaveAttribute(
    'data-help-category',
    'tier5_full_solution',
  )
  await user.click(screen.getByRole('button', { name: 'Question help' }))
  expect(screen.getByRole('heading', { name: 'Your full solution' })).toBeVisible()
  expect(save).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  expect(document.querySelector('canvas')).toBeNull()
})

it('hides surrounding worked examples and original answer explanations during a fresh check', async () => {
  const user = userEvent.setup()
  show()
  await choose(user, 1)
  const lesson = LESSONS[1]!
  await user.click(screen.getByRole('radio', { name: 'x = 6' }))
  await user.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(screen.getByText(lesson.questionNotes[0]!.explanation)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Question help' }))
  await user.selectOptions(screen.getByLabelText('Help level'), '4')
  await user.selectOptions(screen.getByLabelText('Help level'), '5')
  expect(screen.queryByRole('button', { name: 'Explain my problem' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Try a fresh check' }))
  expect(screen.getByText('5x + 7 = 42')).toBeVisible()
  expect(screen.queryByText(lesson.teacherGuide.miniLesson)).toBeNull()
  expect(screen.queryByText(lesson.questionNotes[0]!.explanation)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Your full solution' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Close help' }))
  expect(screen.queryByText(lesson.teacherGuide.miniLesson)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Question help' }))
  await user.type(screen.getByLabelText('Fresh check: x ='), '7{Enter}')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Correct on a fresh check without opening help.',
  )
  expect(screen.getByText(/Full solution used\. Closing help/)).toHaveAttribute(
    'data-help-category',
    'tier5_full_solution',
  )
})
