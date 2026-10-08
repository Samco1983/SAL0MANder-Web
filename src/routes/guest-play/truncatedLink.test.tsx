import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { GuestPlayIndexPage } from './GuestPlayPage'

/**
 * A public Play visit is not an error. The same entry must still help a
 * student recover a teacher's truncated link, without introducing an account gate.
 */

vi.mock('@config/env', async (orig) => {
  const actual = await orig<typeof import('@config/env')>()
  return { ...actual, env: { ...actual.env, api: { ...actual.env.api, isConfigured: false } } }
})

const renderIndex = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <GuestPlayIndexPage />
      </MemoryRouter>
    </ThemeProvider>,
  )

afterEach(() => vi.clearAllMocks())

function ActivityDestination() {
  const { activityId } = useParams()
  return <p>Activity opened: {activityId}</p>
}

function renderRoutedIndex() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<GuestPlayIndexPage />} />
          <Route path="/play/:activityId" element={<ActivityDestination />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('what the student is told', () => {
  it('offers the separate gift recovery entry', () => {
    renderIndex()
    expect(screen.getByRole('link', { name: 'Open a gift' })).toHaveAttribute('href', '/gifts/play')
  })
  it('welcomes a public visit with the sample, its audience and instructions', () => {
    renderIndex()
    expect(screen.getByRole('heading', { level: 1, name: 'Try a sample puzzle' })).toBeVisible()
    expect(screen.getByText(/learners reviewing integer operations/i)).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'How to play' })).toBeVisible()
    expect(screen.getByText(/answer a question, check the feedback/i)).toBeVisible()
  })

  it('never shows URL syntax to a child', () => {
    // The specific regression: `/play/<activity-id>` rendered in a <code> tag.
    renderIndex()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/<activity-id>|\/play\/</)
    expect(document.querySelector('code')).toBeNull()
  })

  it('does not blame the student', () => {
    renderIndex()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/incomplete|invalid|you entered|you typed|bad link/i)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('names who can fix it', () => {
    renderIndex()
    expect(screen.getAllByText(/teacher/i).length).toBeGreaterThan(0)
  })
})

describe('a way forward, not only a way back', () => {
  it('lets a student enter a class code and opens that play route', async () => {
    const user = userEvent.setup()

    renderRoutedIndex()
    await user.type(screen.getByLabelText(/class code/i), '  a2b3c4d5  ')
    await user.click(screen.getByRole('button', { name: /open/i }))

    expect(screen.getByText('Activity opened: A2B3C4D5')).toBeVisible()
  })

  it('preserves a case-sensitive activity id pasted from a truncated link', async () => {
    const user = userEvent.setup()
    renderRoutedIndex()
    await user.type(screen.getByLabelText(/class code/i), '  act_integer_operations  ')
    await user.keyboard('{Enter}')
    expect(screen.getByText('Activity opened: act_integer_operations')).toBeVisible()
  })

  it('does not offer to open an empty or whitespace-only code', async () => {
    const user = userEvent.setup()
    renderIndex()
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
    await user.type(screen.getByLabelText(/class code/i), '   ')
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
  })

  it("explains that the class code comes from the teacher's link", () => {
    renderIndex()
    expect(screen.getByText(/class code from your teacher/i)).toBeVisible()
    expect(screen.getByText(/missing end of the link/i)).toBeVisible()
    expect(screen.getByLabelText(/class code/i)).toHaveAccessibleDescription(
      /class code from your teacher.*full link again/i,
    )
  })

  it('offers a playable sample while there is no backend', () => {
    renderIndex()
    const demo = screen.getByRole('link', { name: 'Start the sample puzzle' })
    expect(demo).toHaveAttribute('href', '/play/act_integer_operations')
  })

  it('starts the existing sample directly without submitting the teacher form', async () => {
    const user = userEvent.setup()
    renderRoutedIndex()
    await user.click(screen.getByRole('link', { name: 'Start the sample puzzle' }))
    expect(screen.getByText('Activity opened: act_integer_operations')).toBeVisible()
  })

  it('still offers home, so the page is not a one-way door either', () => {
    renderIndex()
    expect(screen.getByRole('link', { name: /back to home/i })).toBeVisible()
  })

  it('never asks for an account, a name, or an email', () => {
    renderIndex()
    expect(screen.queryByLabelText(/name|email|password/i)).toBeNull()
    expect(screen.queryByText(/sign in|sign up|your email|password/i)).toBeNull()
  })

  it('the class-code field is the only form and the only input on the page', () => {
    // A blunter, stronger guard than the label check above: even a field with an
    // innocuous label cannot smuggle in an identity prompt if it is the sole
    // form and the sole input, full stop. Restores the strength the previous
    // "no <input>/<form> at all" guardrail had, without blocking the legitimate
    // shareCode field it was loosened to allow.
    renderIndex()
    expect(document.querySelectorAll('form')).toHaveLength(1)
    expect(document.querySelectorAll('input')).toHaveLength(1)
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('textbox')).toBe(screen.getByLabelText(/class code/i))
  })

  it('the class-code input cannot double as an identity field', () => {
    renderIndex()
    const input = screen.getByLabelText(/class code/i) as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input.getAttribute('name') ?? '').not.toMatch(/name|email|password|username/i)
  })
})
