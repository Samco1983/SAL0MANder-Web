import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { HomePage } from './HomePage'
import { paths } from '@config/routes'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'

/**
 * The entry surface.
 *
 * Home is where a teacher lands from a search, and where a student lands when
 * a share link is mistyped. The acceptance criteria for this route are mostly
 * about *not* lying: the primary action must work, nothing may look clickable
 * and lead nowhere, and no path to play may ask for an account.
 *
 * The test that earns its place is the dead-link one. Every `to=` on this page
 * is checked against the canonical route table, so a link to a route that does
 * not exist fails here rather than 404-ing a teacher.
 */

/** Every path the router actually serves, as a matcher. */
const ROUTE_PATTERNS = Object.values(paths)
  .filter((p) => p !== '*')
  .map((p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+') + '$'))

const renderHome = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('the primary action', () => {
  it('offers Guest Play as the first thing a visitor can act on', async () => {
    renderHome()
    const guestPlay = screen.getByRole('link', { name: /guest play/i })
    expect(guestPlay).toBeVisible()

    // Compare within the hero only. The shell nav also has a WebGL Host entry,
    // and matching that instead made this fail against a page that was correct —
    // the first version of this test was the bug, not the page.
    const hero = guestPlay.closest('section')
    expect(hero).not.toBeNull()
    const heroLinks = [...hero!.querySelectorAll('a')]
    const playIndex = heroLinks.indexOf(guestPlay as HTMLAnchorElement)
    const hostIndex = heroLinks.findIndex((l) => /webgl/i.test(l.textContent ?? ''))
    expect(playIndex).toBeGreaterThanOrEqual(0)
    expect(playIndex).toBeLessThan(hostIndex)
  })

  it('sends Guest Play to a real activity path, not a placeholder', () => {
    renderHome()
    const href = screen.getByRole('link', { name: /guest play/i }).getAttribute('href')
    expect(href).toMatch(/^\/play\/.+/)
    expect(href).not.toMatch(/undefined|null|:activityId/)
  })

  it('asks nobody to sign in on the way to playing', () => {
    // Non-negotiable #3: no account, email, password, or name prompt between a
    // share link and playable content. Home is on that path.
    renderHome()
    expect(screen.queryByLabelText(/name|email|password/i)).toBeNull()
    expect(screen.queryByText(/sign in|log in|create an account|enter your (name|email)/i)).toBeNull()
  })
})

describe('no dead links', () => {
  it('every link resolves to a route the router actually serves', () => {
    renderHome()
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')
      .filter((h) => h.startsWith('/'))

    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      const served = ROUTE_PATTERNS.some((pattern) => pattern.test(href))
      expect(served, `${href} is not a route this app serves`).toBe(true)
    }
  })

  it('renders unavailable work as text, never as something clickable', () => {
    // "Do not create dead primary actions." Deferred features are listed in the
    // placeholder notice; none of them may be a link or a button.
    renderHome()
    for (const el of [...screen.getAllByRole('link'), ...screen.queryAllByRole('button')]) {
      const text = el.textContent ?? ''
      expect(text).not.toMatch(/credits|badges|classes|reports|collaboration/i)
    }
  })
})

describe('the demo share panel', () => {
  it('lets a teacher copy the same demo activity that the primary action opens', () => {
    renderHome()
    const playHref = screen.getByRole('link', { name: /guest play/i }).getAttribute('href')
    const shareInput = screen.getByLabelText(/share link/i) as HTMLInputElement

    expect(playHref).toBe(`/play/${MOCK_DEMO_ACTIVITY_ID}`)
    expect(new URL(shareInput.value).pathname).toBe(playHref)
  })

  it('lets a teacher preview the same student link they are sharing', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /preview student link/i })).toHaveAttribute(
      'href',
      `/play/${MOCK_DEMO_ACTIVITY_ID}`,
    )
  })

  it('keeps the QR work hidden until a teacher asks for it', () => {
    renderHome()

    expect(screen.getByRole('button', { name: /show qr code/i })).toBeVisible()
    expect(screen.queryByText(/point a phone camera/i)).toBeNull()
  })
})

describe('structure a screen reader can navigate', () => {
  it('has exactly one h1', () => {
    renderHome()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('does not skip from h1 straight past h2', () => {
    renderHome()
    const levels = screen
      .getAllByRole('heading')
      .map((h) => Number(h.tagName[1]))
      .sort((a, b) => a - b)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1)
    }
  })

  it('pairs each statistic term with its value, in that order', () => {
    // A screen reader announces "Demo activity: 1" — the sentence a person
    // would say. Value-first announces backwards and is invalid markup.
    renderHome()
    const terms = document.querySelectorAll('dl dt')
    expect(terms.length).toBeGreaterThan(0)
    for (const dt of terms) {
      expect(dt.nextElementSibling?.tagName).toBe('DD')
    }
  })
})

describe('keyboard', () => {
  it('reaches the primary action without a mouse', async () => {
    const user = userEvent.setup()
    renderHome()
    const guestPlay = screen.getByRole('link', { name: /guest play/i })

    // Bounded: if the primary action is more than a dozen stops in, it is
    // buried, whatever it looks like on screen.
    for (let i = 0; i < 12 && document.activeElement !== guestPlay; i += 1) {
      await user.tab()
    }
    expect(guestPlay).toHaveFocus()
  })

  it('leaves every interactive element focusable', async () => {
    renderHome()
    for (const el of screen.getAllByRole('link')) {
      expect(el.getAttribute('tabindex')).not.toBe('-1')
    }
  })
})
