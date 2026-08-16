import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { GuestPlayPage } from './GuestPlayPage'

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/play/:activityId" element={<GuestPlayPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('Guest Play', () => {
  it('reaches a playable stage with no sign-in, account, or name prompt', async () => {
    renderAt(`/play/${MOCK_DEMO_ACTIVITY_ID}`)

    expect(screen.getByRole('region', { name: /game stage/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in|log in|create account/i })).toBeNull()

    expect(await screen.findByText(/Sample SAL0MANder Activity/i)).toBeInTheDocument()
  })

  it('still renders the stage when the activity fails to load', async () => {
    renderAt('/play/does-not-exist')
    expect(await screen.findByText(/Activity unavailable/i)).toBeInTheDocument()
    // The companion failing must never take the game surface with it.
    expect(screen.getByRole('region', { name: /game stage/i })).toBeInTheDocument()
  })

  it('announces the failure to a screen reader', async () => {
    renderAt('/play/does-not-exist')
    expect(await screen.findByRole('alert')).toHaveTextContent(/activity unavailable/i)
  })

  it('offers no retry for a dead link, which retrying cannot fix', async () => {
    // A 404 is terminal. A button that re-runs it teaches a student the app is
    // broken rather than that the link is.
    renderAt('/play/does-not-exist')
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('shows the student the plain-language reason, never a server string', async () => {
    renderAt('/play/does-not-exist')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn't find that activity/i)
    expect(alert.textContent).not.toMatch(/404|No activity/)
  })
})
