import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { DemoGalleryPage } from './DemoGalleryPage'
import { DEMO_ACTIVITIES } from '@demo/demoActivities'

function renderGallery() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <DemoGalleryPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('demo gallery', () => {
  it('shows all three launch activities', () => {
    renderGallery()
    for (const activity of DEMO_ACTIVITIES) {
      expect(screen.getByRole('heading', { name: activity.title })).toBeInTheDocument()
    }
  })

  it('shows a grade tag and a topic for each', () => {
    renderGallery()
    expect(screen.getByText('Grades 6–7')).toBeInTheDocument()
    expect(screen.getByText('Grades 6–8')).toBeInTheDocument()
    expect(screen.getByText('Grades 7–9')).toBeInTheDocument()
    expect(screen.getByText('Number sense')).toBeInTheDocument()
  })

  /**
   * The load-bearing test for this whole surface.
   *
   * A demo card looks identical whether its link works or not — the student
   * gets a puzzle either way. If this page ever claims a launch it has not
   * measured, the honest failure (wrong activity, silently) becomes invisible.
   */
  it('never claims a launch it has not verified', () => {
    renderGallery()
    expect(screen.queryByText('Launch verified')).not.toBeInTheDocument()
    expect(screen.getAllByText('Not yet verified')).toHaveLength(DEMO_ACTIVITIES.length)
  })

  it('says plainly that nothing is playable yet, instead of offering a dead Play button', () => {
    renderGallery()
    // Scoped to the cards: the AppShell nav has its own "Play" link to the
    // student recovery route, which is unrelated and must keep working.
    for (const activity of DEMO_ACTIVITIES) {
      const card = screen.getByRole('article', { name: activity.title })
      expect(within(card).queryByRole('link', { name: 'Play' })).not.toBeInTheDocument()
      expect(within(card).getByText('Not available to play yet')).toBeInTheDocument()
    }
  })

  it('warns once at the top rather than repeating the caveat in every card', () => {
    renderGallery()
    expect(screen.getByText(/These are not live yet/)).toBeInTheDocument()
  })

  /**
   * Share links stay available while the activities are unbuilt on purpose: the
   * link shape is stable and printable, so a teacher preparing a worksheet is
   * not blocked. The status badge is what keeps that from being a false promise.
   */
  it('still offers a share link and QR for an activity that cannot be played yet', async () => {
    const user = userEvent.setup()
    renderGallery()

    const card = screen.getByRole('article', { name: 'Integer Operations' })
    await user.click(within(card).getByRole('button', { name: 'Share link & QR' }))

    const link = within(card).getByLabelText('Share link')
    expect(link).toHaveAttribute('value', expect.stringContaining('/play/act_integer_ops'))
  })

  it('collapses the share panel again', async () => {
    const user = userEvent.setup()
    renderGallery()

    const card = screen.getByRole('article', { name: 'Integer Operations' })
    const toggle = within(card).getByRole('button', { name: 'Share link & QR' })
    await user.click(toggle)
    expect(within(card).getByLabelText('Share link')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Hide share link' }))
    expect(within(card).queryByLabelText('Share link')).not.toBeInTheDocument()
  })
})
