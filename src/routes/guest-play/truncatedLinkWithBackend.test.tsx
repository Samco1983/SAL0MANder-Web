import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { GuestPlayIndexPage } from './GuestPlayPage'

/**
 * The same page once a backend exists.
 *
 * The sample activity lives in the mock transport. Offering it against a real
 * API would promise an activity that may not be there — a worse dead end than
 * the one this page was built to fix, because a link that looks like it works
 * and then fails sends the student back to the teacher with the wrong problem.
 *
 * Separate file because `vi.mock('@config/env')` is hoisted per module, so the
 * two environments cannot be exercised in one.
 */

vi.mock('@config/env', async (orig) => {
  const actual = await orig<typeof import('@config/env')>()
  return {
    ...actual,
    env: { ...actual.env, api: { ...actual.env.api, isConfigured: true } },
  }
})

const renderIndex = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <GuestPlayIndexPage />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('with a real API configured', () => {
  it('does not offer the mock sample activity', () => {
    renderIndex()
    expect(screen.queryByRole('link', { name: /Play this activity/i })).toBeNull()
  })

  it('offers an ordinary practice entry and independent lessons without promising missing API activities', () => {
    // Independent lesson content is available without the external activity catalog.
    renderIndex()
    expect(screen.getByRole('heading', { name: 'Puzzle Practice' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Try a math lesson' })).toHaveAttribute(
      'href',
      '/learn',
    )
    expect(screen.getByRole('link', { name: 'Make a puzzle gift' })).toHaveAttribute(
      'href',
      '/gifts',
    )
  })

  it('still offers a way back', () => {
    renderIndex()
    expect(screen.getByRole('link', { name: /back to home/i })).toBeVisible()
  })
})
