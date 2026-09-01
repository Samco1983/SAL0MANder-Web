import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
    const guestPlay = screen.getByRole('link', { name: /try a sample activity/i })
    expect(guestPlay).toBeVisible()

    /*
      Within the hero only — the shell nav has its own links, and matching those
      made an earlier version of this test fail against a page that was correct.

      It used to compare against the WebGL host button's position. That button
      is gone from the public page on purpose, so the assertion is now the
      simpler and stronger one: playing is the FIRST thing offered.
    */
    const hero = guestPlay.closest('section')
    expect(hero).not.toBeNull()
    const heroLinks = [...hero!.querySelectorAll('a')]
    expect(heroLinks.indexOf(guestPlay as HTMLAnchorElement)).toBe(0)
  })

  it('sends Guest Play to a real activity path, not a placeholder', () => {
    renderHome()
    const href = screen.getByRole('link', { name: /try a sample activity/i }).getAttribute('href')
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

  it('routes the data question to the privacy page, and still gates nothing', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /what we collect/i })).toHaveAttribute(
      'href',
      paths.privacy,
    )
    expect(document.body.textContent ?? '').not.toMatch(/\b(sign (in|up)|log in|create an account) to\b/i)
  })

  /**
   * The page a district reviewer reads must say what this is.
   *
   * It used to open "Cloud companion platform / The SAL0MANder application owns
   * the gameplay... cloud companion around it", and report "Mock backend" and
   * "Contract version v1 · Draft". Accurate to an engineer, and the reason a
   * filter had nothing to categorise: no mathematics, no classroom, no
   * students, and two words that say unfinished.
   */
  it('reads as a classroom math tool, not as internal architecture', () => {
    renderHome()
    const text = document.querySelector('main')?.textContent ?? ''

    expect(text).toMatch(/classroom/i)
    expect(text).toMatch(/question/i)
    expect(text).toMatch(/teacher/i)
    expect(text).toMatch(/student/i)

    expect(text).not.toMatch(/cloud companion platform/i)
    expect(text).not.toMatch(/mock backend/i)
    expect(text).not.toMatch(/contract version/i)
    expect(text).not.toMatch(/foundation|unfinished|placeholder|pending product approval/i)
  })

  /**
   * Claims a district checks first. None of them are established anywhere in
   * this repository, and an unsupported one costs more than silence.
   */
  it('claims no compliance it cannot evidence', () => {
    renderHome()
    const text = document.body.textContent ?? ''
    for (const word of [/COPPA/i, /FERPA/i, /WCAG/i, /\bcompliant\b/i, /certified/i]) {
      expect(text).not.toMatch(word)
    }
  })
})

describe('the demo share panel', () => {
  it('lets a teacher copy the same demo activity that the primary action opens', () => {
    renderHome()
    const playHref = screen.getByRole('link', { name: /try a sample activity/i }).getAttribute('href')
    const shareInput = screen.getByLabelText(/share link/i) as HTMLInputElement

    expect(playHref).toBe(`/play/${MOCK_DEMO_ACTIVITY_ID}`)
    expect(new URL(shareInput.value).pathname).toBe(playHref)
  })

  it('lets a teacher preview the same student link they are sharing', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /see what a student sees/i })).toHaveAttribute(
      'href',
      `/play/${MOCK_DEMO_ACTIVITY_ID}`,
    )
  })

  /**
   * Inverted deliberately. The WebGL host is an internal smoke-test route; it
   * stays reachable by URL (see `visibleNav` in AppShell) but offering it on
   * the public front page tells a teacher — and a filter reviewer — that this
   * is a developer build rather than a classroom product.
   */
  it('does not advertise the internal WebGL host on the public page', () => {
    renderHome()

    // Scoped to the page content: the shell nav is gated separately by
    // `visibleNav(env.isProd)`, and tests render with isProd false.
    const main = document.querySelector('main')
    expect(main).not.toBeNull()
    expect(within(main!).queryByRole('link', { name: /webgl/i })).not.toBeInTheDocument()
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
    const guestPlay = screen.getByRole('link', { name: /try a sample activity/i })

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
