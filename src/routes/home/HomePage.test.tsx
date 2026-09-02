import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { HomePage } from './HomePage'
import { paths } from '@config/routes'
import { MOCK_DEMO_ACTIVITIES } from '@api/mockTransport'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'

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
    const guestPlay = screen.getByRole('link', { name: /try an activity/i })
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
    const href = screen.getByRole('link', { name: /try an activity/i }).getAttribute('href')
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

/**
 * The three activities, and the reason this block exists.
 *
 * Home previously offered ONE action, pointing at a generic demo id. Unity
 * ships three activities with three specific ids, and two separate drafts of
 * this work named those ids wrong in two different ways — neither of which
 * failed a single test, because a hardcoded string on a page is checked against
 * nothing.
 *
 * These tests check the page against `MOCK_DEMO_ACTIVITIES`, which
 * `threeDemoActivities.test.ts` in turn pins to Unity's literals. That is the
 * chain that makes a wrong id impossible to ship quietly, and a wrong id here
 * is a dead link on a teacher's printed worksheet.
 */
describe('the three activities', () => {
  it('offers every activity, by name', () => {
    renderHome()
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      expect(
        screen.getByRole('link', { name: new RegExp(`open ${activity.title}`, 'i') }),
        `${activity.title} is not offered on the home page`,
      ).toBeVisible()
    }
  })

  it('sends each one to its OWN activity, not all three to the same place', () => {
    renderHome()
    const hrefs = MOCK_DEMO_ACTIVITIES.map((activity) =>
      screen
        .getByRole('link', { name: new RegExp(`open ${activity.title}`, 'i') })
        .getAttribute('href'),
    )

    // The specific failure this catches: mapping the array for the labels but
    // leaving a single shared id in the `to=`. Every card looks right and two
    // of the three open the wrong puzzle.
    expect(new Set(hrefs).size).toBe(MOCK_DEMO_ACTIVITIES.length)

    MOCK_DEMO_ACTIVITIES.forEach((activity, i) => {
      expect(hrefs[i]).toBe(`/play/${activity.id}`)
    })
  })

  /**
   * The four ids that were proposed and are wrong. `act_integer_ops` came from
   * one draft; the other three are the OLD seeded Unity activities, read from
   * `main` instead of the reconciled branch. Naming them keeps either mistake
   * from returning by way of this page.
   */
  it('links to none of the ids that were proposed and turned out to be wrong', () => {
    renderHome()
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')
      .join(' ')

    for (const wrong of [
      'act_integer_ops',
      'act_quadratics',
      'act_cell_structure',
      'act_vocab_review',
    ]) {
      expect(hrefs, `${wrong} is not an activity Unity ships`).not.toContain(`/play/${wrong}`)
    }
  })
})

/**
 * The page described the mechanic in words and showed none of it.
 *
 * These check the rendering, not the library — `puzzleLibrary.test.ts` owns the
 * files, the sizes and the alt text. What matters here is that all six actually
 * reach the page, that none of them blocks first paint, and that none acquires
 * a caption tying it to an activity Unity might not use it for.
 */
describe('the pictures', () => {
  it('shows every picture in the library', () => {
    renderHome()
    for (const picture of PUZZLE_LIBRARY) {
      expect(
        screen.getByAltText(picture.alt),
        `${picture.src} is in the library but not on the page`,
      ).toBeVisible()
    }
  })

  /**
   * Six pictures above the fold on school wifi would delay the thing a teacher
   * came for. They sit below the activities, and the browser is told so.
   */
  it('loads them lazily, and reserves their space so nothing jumps', () => {
    renderHome()
    for (const picture of PUZZLE_LIBRARY) {
      const img = screen.getByAltText(picture.alt)
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('width')
      expect(img).toHaveAttribute('height')
    }
  })

  /**
   * The privacy page and the district summary both state that a browser
   * contacts exactly one domain. An image from a CDN would make both wrong, and
   * would be the easiest thing in the world to add without noticing.
   */
  it('loads no image from another company', () => {
    renderHome()
    for (const img of document.querySelectorAll('img')) {
      expect(img.getAttribute('src') ?? '', 'images must be same-origin').not.toMatch(/^https?:\/\//)
    }
  })

  /**
   * Unity owns which picture an activity uses. A caption pairing one of these
   * with "Integer Operations" would be unverifiable here and would go stale the
   * first time a preset changed.
   */
  it('does not claim a picture belongs to a particular activity', () => {
    renderHome()
    const gallery = document.querySelector('#pictures-title')?.closest('section')
    expect(gallery).not.toBeNull()
    for (const activity of MOCK_DEMO_ACTIVITIES) {
      expect(gallery!.textContent ?? '').not.toContain(activity.title)
    }
  })
})

describe('the demo share panel', () => {
  it('lets a teacher copy the same demo activity that the primary action opens', () => {
    renderHome()
    const playHref = screen.getByRole('link', { name: /try an activity/i }).getAttribute('href')
    const shareInput = screen.getByLabelText(/share link/i) as HTMLInputElement

    expect(playHref).toBe(`/play/${MOCK_DEMO_ACTIVITIES[0].id}`)
    expect(new URL(shareInput.value).pathname).toBe(playHref)
  })

  it('lets a teacher preview the same student link they are sharing', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /see what a student sees/i })).toHaveAttribute(
      'href',
      `/play/${MOCK_DEMO_ACTIVITIES[0].id}`,
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
    const guestPlay = screen.getByRole('link', { name: /try an activity/i })

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
