import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { DEMO_MATH_COURSES } from '@content/demoLevels'
import { GuestPlayIndexPage, GuestPlayPage } from './GuestPlayPage'

vi.mock('@config/env', async (orig) => {
  const actual = await orig<typeof import('@config/env')>()
  return { ...actual, env: { ...actual.env, api: { ...actual.env.api, isConfigured: false } } }
})

function renderIndex() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<GuestPlayIndexPage />} />
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('practice entry and shortened classroom links', () => {
  it('opens as a normal practice page with all three available activities', () => {
    renderIndex()
    expect(screen.getByRole('heading', { name: 'Puzzle Practice' })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/this link looks incomplete/i)).toBeNull()
    const choices = within(screen.getByRole('region', { name: 'Choose a math topic' }))
    expect(choices.getAllByRole('link')).toHaveLength(3)
    for (const activity of DEMO_MATH_COURSES)
      expect(choices.getByRole('link', { name: new RegExp(activity.title) })).toHaveAttribute(
        'href',
        `/play/${activity.id}`,
      )
  })

  it('resolves a pasted activity ID without changing its case', async () => {
    const user = userEvent.setup()
    renderIndex()
    await user.type(
      screen.getByLabelText(/class code or activity id/i),
      '  act_integer_operations  ',
    )
    await user.click(screen.getByRole('button', { name: 'Open activity' }))
    expect(await screen.findByText('Integer Operations')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('still resolves a lowercase class code through the real resolver', async () => {
    const user = userEvent.setup()
    renderIndex()
    await user.type(screen.getByLabelText(/class code or activity id/i), 'k7q4m2xp')
    await user.click(screen.getByRole('button', { name: 'Open activity' }))
    expect(await screen.findByText('Fractions Review')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps a truly unknown activity on the failure path', async () => {
    const user = userEvent.setup()
    renderIndex()
    await user.type(screen.getByLabelText(/class code or activity id/i), 'unknown-activity')
    await user.click(screen.getByRole('button', { name: 'Open activity' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t find that activity/i)
  })

  it('offers gift recovery, independent lessons, and home without an identity gate', () => {
    renderIndex()
    expect(screen.getByRole('link', { name: 'Open a gift' })).toHaveAttribute('href', '/gifts/play')
    expect(screen.getByRole('link', { name: 'Try a math lesson' })).toHaveAttribute(
      'href',
      '/learn',
    )
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(document.querySelectorAll('form')).toHaveLength(1)
    expect(document.querySelectorAll('input')).toHaveLength(1)
    expect(screen.queryByLabelText(/email|password|name/i)).toBeNull()
    expect(screen.getByLabelText(/class code or activity id/i)).toHaveAttribute(
      'autocapitalize',
      'none',
    )
    expect(screen.getByRole('button', { name: 'Open activity' })).toBeDisabled()
    expect(screen.getByText(/If a link was cut short/i)).toBeVisible()
  })
})
