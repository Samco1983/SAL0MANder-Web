import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { PrivacyPage } from './PrivacyPage'

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('privacy page', () => {
  it('states the claims a district actually asks about', () => {
    renderPage()
    expect(screen.getByText(/no advertising anywhere/i)).toBeInTheDocument()
    expect(screen.getByText(/no analytics services/i)).toBeInTheDocument()
    expect(screen.getByText(/never ask a student for their real name/i)).toBeInTheDocument()
    expect(screen.getByText(/there is no sign-up/i)).toBeInTheDocument()
  })

  /**
   * The guardrail, asserted rather than trusted to review.
   *
   * A compliance claim is a statement about legal or audit status, and nothing
   * in this repository establishes one. A district that checks a COPPA or WCAG
   * claim and finds nothing behind it has learned something far worse than
   * "this page is short".
   */
  it('claims no compliance it cannot evidence', () => {
    const { container } = renderPage()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/COPPA/i)
    expect(text).not.toMatch(/FERPA/i)
    expect(text).not.toMatch(/WCAG/i)
    expect(text).not.toMatch(/\bcompliant\b/i)
    expect(text).not.toMatch(/certified/i)
    expect(text).not.toMatch(/standards[- ]aligned/i)
  })

  /**
   * A privacy page whose contact route is a dead end is exactly what a filter
   * reviewer reads as a bad sign. Both audience labels are load-bearing even
   * while they route to the same monitored mailbox.
   */
  it('gives teachers and district staff a working contact route', () => {
    renderPage()
    const contacts = screen.getAllByRole('link', { name: 'samco1983@gmail.com' })
    expect(contacts).toHaveLength(2)
    contacts.forEach((contact) => {
      expect(contact).toHaveAttribute('href', 'mailto:samco1983@gmail.com')
    })
  })

  it('tells a filtering district exactly who to write to', () => {
    renderPage()
    expect(screen.getByText(/filters web traffic/i)).toBeInTheDocument()
    expect(screen.getByText(/allow list/i)).toBeInTheDocument()
  })

  it('no longer carries the unfilled-contact placeholder', () => {
    const { container } = renderPage()
    expect(container.querySelector('[data-placeholder="contact"]')).toBeNull()
  })

  it('reads as a classroom tool, which is what it is', () => {
    renderPage()
    // Also what a categorization crawler looks for. Accurate first, findable second.
    expect(screen.getByText(/practice tool for classrooms/i)).toBeInTheDocument()
  })

  it('lists what is stored rather than describing it vaguely', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /what is stored on the device/i })).toBeInTheDocument()
    expect(screen.getByText(/the nickname a player chose/i)).toBeInTheDocument()
  })
})
