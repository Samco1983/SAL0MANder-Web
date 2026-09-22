import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { TutoringLandingPage } from './TutoringLandingPage'
import { paths } from '@config/routes'

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <TutoringLandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('advertising-ready tutoring landing page', () => {
  it('shows the offer, prices, capacity, and Pacific availability', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { name: /help with the math your student is actually doing/i }),
    ).toBeVisible()
    expect(screen.getByText('$20')).toBeVisible()
    expect(screen.getByText('$45')).toBeVisible()
    expect(screen.getByText(/hard maximum of 6 students/i)).toBeVisible()
    expect(screen.getByText(/Wednesday/i)).toBeVisible()
    expect(screen.getByText(/7:30–10:00 PM/)).toBeVisible()
    expect(screen.getAllByText(/pre-approval required/i)).toHaveLength(2)
  })

  it('keeps booking and free puzzle practice as distinct next steps', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /book a one-on-one time/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\//),
    )
    expect(screen.getByRole('link', { name: /try puzzle practice/i })).toHaveAttribute(
      'href',
      paths.guestPlayIndex,
    )
  })

  it('collects the required request details without pretending to upload or confirm', () => {
    renderPage()
    const form = screen.getByRole('form')
    for (const name of [
      /tutoring type/i,
      /requested day\/time/i,
      /student name/i,
      /parent\/guardian name/i,
      /contact email/i,
      /^grade$/i,
      /^course$/i,
      /^state$/i,
      /school \/ district/i,
      /current topic/i,
      /upcoming quiz/i,
      /biggest struggle/i,
      /worksheet \/ homework/i,
    ]) {
      expect(within(form).getByLabelText(name)).toBeVisible()
    }
    expect(screen.getByText(/does not create a paid booking/i)).toBeVisible()
    expect(screen.getByText(/file selection stays on this device/i)).toBeVisible()
  })
})
