import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { MOCK_DEMO_ACTIVITY_ID, MOCK_LINKS } from '@api/mockTransport'
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
    expect(screen.getByRole('button', { name: /show companion/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in|log in|create account/i })).toBeNull()

    expect(await screen.findByText(/Sample SAL0MANder Activity/i)).toBeInTheDocument()
  })

  it('still renders the stage when the activity fails to load', async () => {
    renderAt('/play/does-not-exist')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    // The companion failing must never take the game surface with it.
    expect(screen.getByRole('region', { name: /game stage/i })).toBeInTheDocument()
  })

  it('offers no retry for a dead link, which retrying cannot fix', async () => {
    // A 404 is terminal. A button that re-runs it teaches a student the app is
    // broken rather than that the link is.
    renderAt('/play/does-not-exist')
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('gives a dead link a recovery path without asking for an account', async () => {
    renderAt('/play/does-not-exist')
    await screen.findByRole('alert')

    expect(screen.getByRole('link', { name: /open guest play/i })).toHaveAttribute(
      'href',
      '/play',
    )
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in|log in|create account/i })).toBeNull()
  })

  it('shows the student the plain-language reason, never a server string', async () => {
    renderAt('/play/does-not-exist')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn't find that activity/i)
    expect(alert.textContent).not.toMatch(/404|No activity/)
  })
})

describe('link states a student can tell apart', () => {
  it('says a revoked link was turned off, not mistyped', async () => {
    // Sending a student to retype a revoked code wastes their time and sends
    // the teacher a support message they cannot act on.
    renderAt(`/play/${MOCK_LINKS.revoked}`)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/turned off this share link/i)
    expect(alert).toHaveTextContent(/ask them for a new one/i)
    expect(alert.textContent).not.toMatch(/double-check|wrong character/i)
  })

  it('says an unpublished activity may come back', async () => {
    renderAt(`/play/${MOCK_LINKS.unpublished}`)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/unpublished this activity/i)
    expect(alert).toHaveTextContent(/may come back/i)
  })

  it('tells a mistyped link to check the characters', async () => {
    renderAt('/play/typo-here')
    expect(await screen.findByRole('alert')).toHaveTextContent(/double-check the link/i)
  })

  it('offers no retry for any deliberate link state', async () => {
    for (const code of [MOCK_LINKS.revoked, MOCK_LINKS.unpublished]) {
      const { unmount } = renderAt(`/play/${code}`)
      await screen.findByRole('alert')
      expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
      expect(screen.getByRole('link', { name: /open guest play/i })).toHaveAttribute(
        'href',
        '/play',
      )
      unmount()
    }
  })

  it('never leaks the server message for a deliberate state', async () => {
    renderAt(`/play/${MOCK_LINKS.revoked}`)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toMatch(/revoked by its owner|SHARE_LINK_REVOKED/)
  })
})

describe('sharing', () => {
  it('offers the share link once the activity resolves', async () => {
    renderAt(`/play/${MOCK_DEMO_ACTIVITY_ID}`)
    const input = await screen.findByLabelText(/share link/i)
    expect(input).toHaveValue(`http://localhost:3000/play/${MOCK_DEMO_ACTIVITY_ID}`)
    expect(input).toHaveAttribute('readonly')
  })

  it('does not offer sharing for a link that does not resolve', async () => {
    renderAt('/play/does-not-exist')
    await screen.findByRole('alert')
    expect(screen.queryByLabelText(/share link/i)).toBeNull()
  })
})
