import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * The audience changes in production, and so does what a placeholder means.
 *
 * In review, "not designed yet" must be loud — that is the entire reason
 * PlaceholderNotice exists. In production the same box is read by a teacher who
 * scanned a QR code off a printed worksheet and is deciding in a few seconds
 * whether this is worth class time. A list of unbuilt features answers that
 * badly, about a panel the student does not need in order to play.
 *
 * This is the same call AppShell already made for its foundation banner, tested
 * the same way, so the two cannot drift apart silently.
 */
vi.mock('@config/env', () => ({
  env: {
    appName: 'SAL0MANder',
    appEnv: 'production',
    isProd: true,
    api: { contractVersion: 'v1', isConfigured: false },
  },
}))

import { PlaceholderNotice } from './PlaceholderNotice'

describe('PlaceholderNotice in production', () => {
  it('renders nothing at all', () => {
    const { container } = render(
      <PlaceholderNotice
        label="Companion panel"
        title="Optional context lives here"
        pending={['Lesson context and teacher notes', 'Linked resources']}
      >
        This panel is optional and collapsible.
      </PlaceholderNotice>,
    )

    // Not merely hidden: absent. A visually-hidden placeholder still reaches a
    // screen reader, and a student being read a list of unbuilt features is the
    // same failure wearing an accessibility costume.
    expect(container).toBeEmptyDOMElement()
  })

  it('leaks no part of its content — label, title, body, or pending list', () => {
    render(
      <PlaceholderNotice
        label="Companion panel"
        title="Optional context lives here"
        pending={['Player profile, badges, credits', 'Collaboration tools']}
      >
        Nothing here is required to play.
      </PlaceholderNotice>,
    )

    for (const text of [
      /companion panel/i,
      /optional context lives here/i,
      /nothing here is required to play/i,
      /player profile, badges, credits/i,
      /collaboration tools/i,
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    }
  })
})
