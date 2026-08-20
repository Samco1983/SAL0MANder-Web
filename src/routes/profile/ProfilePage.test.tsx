import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@app/providers/ThemeProvider'
import { ProfilePage } from './ProfilePage'
import { GUEST_TOKEN_KEY } from '@auth/guestIdentity'
import { buildPath, paths } from '@config/routes'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'

/**
 * Profile is the surface where an account requirement creeps in.
 *
 * Every other route has an obvious reason not to ask for a login. This one has
 * an obvious reason to: it is *called* Profile, it is where avatars and XP will
 * live, and it is the only route that renders identity material. A future
 * change that puts a sign-in form here would look like the page finally being
 * finished. These tests are what makes it look like a regression instead.
 *
 * Internal device identifiers do not belong on a student-facing page. The
 * tests use a known token so they can prove neither the whole value nor a
 * recognizable fragment leaks into rendered text.
 */

/** A known token, so "the full token is not on screen" is checkable at all. */
const TOKEN = 'AbCdEf01GhIjKl23'

const renderProfile = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </ThemeProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(GUEST_TOKEN_KEY, TOKEN)
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('accounts are off, and the page acts like it', () => {
  it('renders', () => {
    renderProfile()
    expect(screen.getByRole('heading', { name: /profile/i, level: 1 })).toBeVisible()
  })

  it('never prompts for an account, email, password, or name', () => {
    renderProfile()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.querySelector('input')).toBeNull()
    expect(document.querySelector('form')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign in|sign up|log in|create account/i })).toBeNull()
  })

  it('does not present an account as something the student is missing', () => {
    // "Sign up to save your progress" is a prompt wearing a placeholder's
    // clothes. The page may say accounts do not exist yet; it may not tell a
    // student to go get one.
    //
    // Ban the IMPERATIVE, not the vocabulary. The first version of this banned
    // the words "sign up" outright, which would fail against correct copy —
    // describing that progress could later be claimed by an account is stating
    // a future, not asking for anything.
    renderProfile()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\b(sign (in|up)|log in|create an account) to\b/i)
    expect(text).not.toMatch(/\byou (must|need to|have to) (sign|log|create|register)/i)
    expect(text).not.toMatch(/\benter your\b/i)
  })

  it('says out loud that a profile never gates play', () => {
    renderProfile()
    expect(screen.getByText(/never gate/i)).toBeVisible()
  })

  it('offers a direct way to keep playing as a guest', () => {
    renderProfile()
    expect(screen.getByRole('link', { name: /keep playing as guest/i })).toHaveAttribute(
      'href',
      paths.guestPlayIndex,
    )
  })

  it('offers a direct sample activity path from Profile', () => {
    renderProfile()
    expect(screen.getByRole('link', { name: /open sample activity/i })).toHaveAttribute(
      'href',
      buildPath.guestPlay(MOCK_DEMO_ACTIVITY_ID),
    )
  })

  it('offers a teacher or tester path to the WebGL host', () => {
    renderProfile()
    expect(screen.getByRole('link', { name: /preview webgl host/i })).toHaveAttribute(
      'href',
      paths.unity,
    )
    expect(document.body.textContent ?? '').not.toMatch(/\b(sign (in|up)|log in|create an account) to\b/i)
  })

  it('gives a concrete next step without creating an account prompt', () => {
    renderProfile()
    expect(screen.getByText(/next step: keep playing from a shared activity/i)).toBeVisible()
    expect(screen.getByText(/approved profile claim flow/i)).toBeVisible()
    expect(document.body.textContent ?? '').not.toMatch(/\b(sign (in|up)|log in|create an account) to\b/i)
  })
})

describe('the guest session on screen', () => {
  it('does not expose the stored device identifier or a recognizable fragment', () => {
    renderProfile()
    const text = document.body.textContent ?? ''
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(TOKEN.slice(0, TOKEN.length / 2))
    expect(document.querySelector('code')).toBeNull()
  })

  it('explains the local session without presenting it as an account or authentication', () => {
    renderProfile()
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/keep guest progress on this device/i)
    expect(text).toMatch(/not an account/i)
    expect(text).toMatch(/not used as authentication|is not authentication/i)
  })
})

describe('links', () => {
  const ROUTE_PATTERNS = Object.values(paths)
    .filter((p) => p !== '*')
    .map((p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+') + '$'))

  it('never points at a route the router does not serve', () => {
    renderProfile()
    const internal = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((h) => h.startsWith('/'))

    for (const href of internal) {
      const path = href.split(/[?#]/)[0] ?? ''
      expect(
        ROUTE_PATTERNS.some((r) => r.test(path)),
        `"${href}" is not a route in config/routes.ts — this link 404s a real visitor`,
      ).toBe(true)
    }
  })
})

describe('storage the browser refuses to give us', () => {
  /** A private window, an embedded frame, or a locked-down school profile. */
  const denyStorage = () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  }

  it('still renders the page', () => {
    // A thrown localStorage is the single most common way this page could go
    // blank in a classroom, and the least likely to be caught by hand.
    denyStorage()
    expect(() => renderProfile()).not.toThrow()
    expect(screen.getByRole('heading', { name: /profile/i, level: 1 })).toBeVisible()
  })

  it('still refuses to ask for an account', () => {
    // The failure mode worth naming: storage is unavailable, so the page
    // decides the student "has no identity" and offers a sign-in.
    denyStorage()
    renderProfile()
    expect(document.querySelector('input')).toBeNull()
    expect(document.querySelector('form')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign in|sign up|log in/i })).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/\b(sign (in|up)|log in) to\b/i)
  })
})
