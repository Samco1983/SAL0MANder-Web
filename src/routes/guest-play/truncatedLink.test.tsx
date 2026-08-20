import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { GuestPlayIndexPage } from './GuestPlayPage'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'

/**
 * The student whose share link got cut off.
 *
 * routing.test.tsx proves a truncated `/play/` lands here rather than on the
 * 404, so this surface is reached by real students with damaged links — an LMS
 * or a chat app wrapping at the last slash produces exactly it.
 *
 * It used to show them `/play/<activity-id>`: URL syntax, angle brackets and
 * all, to a child — and one link back to the page they had just come from. A
 * dead end dressed as an explanation.
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

describe('what the student is told', () => {
  it('says the link arrived incomplete', () => {
    renderIndex()
    expect(screen.getByRole('heading', { name: /link looks incomplete/i })).toBeVisible()
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
    expect(text).toMatch(/nothing is wrong on your end/i)
    expect(text).not.toMatch(/invalid|you entered|you typed|bad link/i)
  })

  it('names who can fix it', () => {
    renderIndex()
    expect(screen.getByText(/teacher/i)).toBeVisible()
  })
})

describe('a way forward, not only a way back', () => {
  it('lets a student enter a class code and opens that play route', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/play']}>
          <Routes>
            <Route path="/play" element={<GuestPlayIndexPage />} />
            <Route path="/play/:activityId" element={<p>Activity opened</p>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    await user.type(screen.getByLabelText(/class code/i), 'sal0 demo')
    await user.click(screen.getByRole('button', { name: /open/i }))

    expect(screen.getByText(/activity opened/i)).toBeVisible()
  })

  it('offers a playable sample while there is no backend', () => {
    renderIndex()
    const demo = screen.getByRole('link', { name: /sample activity/i })
    expect(demo).toHaveAttribute('href', `/play/${MOCK_DEMO_ACTIVITY_ID}`)
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
    expect(input.getAttribute('name') ?? '').not.toMatch(/name|email|password|username/i)
  })
})
