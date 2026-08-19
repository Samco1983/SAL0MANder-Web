import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CompanionLayout } from './CompanionLayout'

function renderLayout(defaultCollapsed = false) {
  return render(
    <MemoryRouter>
      <CompanionLayout
        defaultCollapsed={defaultCollapsed}
        companion={<p>companion context</p>}
        stage={<div data-testid="stage">unity stage</div>}
      />
    </MemoryRouter>,
  )
}

const COLLAPSE_KEY = 'sal0mander.companion.collapsed'

/** Renders with a controllable `reveal`, and a `show()` to raise or lower it. */
function renderRevealable(startCollapsed: boolean) {
  localStorage.setItem(COLLAPSE_KEY, String(startCollapsed))

  const tree = (reveal: boolean) => (
    <MemoryRouter>
      <CompanionLayout
        reveal={reveal}
        companion={<p>companion context</p>}
        stage={<div data-testid="stage">unity stage</div>}
      />
    </MemoryRouter>
  )

  const { rerender } = render(tree(false))
  return { show: (reveal: boolean) => rerender(tree(reveal)) }
}

/** The panel's live state, read the way a screen reader would. */
const isOpen = () =>
  screen.getByRole('button', { name: /companion/i }).getAttribute('aria-expanded') === 'true'

describe('CompanionLayout', () => {
  it('renders the stage regardless of companion state', () => {
    renderLayout()
    expect(screen.getByTestId('stage')).toBeInTheDocument()
  })

  it('keeps the stage node identical across a collapse — Unity must not remount', async () => {
    const user = userEvent.setup()
    renderLayout()
    const before = screen.getByTestId('stage')

    await user.click(screen.getByRole('button', { name: /hide companion/i }))

    // Same DOM node, not a re-created one: a collapse must never restart a game.
    expect(screen.getByTestId('stage')).toBe(before)
  })

  it('toggles companion visibility and reports it to assistive tech', async () => {
    const user = userEvent.setup()
    renderLayout()

    const toggle = screen.getByRole('button', { name: /hide companion/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(screen.getByRole('button', { name: /show companion/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('starts collapsed when asked, with the stage still present', () => {
    renderLayout(true)
    expect(screen.getByRole('button', { name: /show companion/i })).toBeInTheDocument()
    expect(screen.getByTestId('stage')).toBeInTheDocument()
  })
})

describe('companion disclosure semantics', () => {
  it('points the toggle at the panel it controls', () => {
    renderLayout()

    const toggle = screen.getByRole('button', { name: /companion/i })
    const controls = toggle.getAttribute('aria-controls')
    expect(controls).toBeTruthy()

    // The id must resolve to the panel, not merely be present.
    const panel = document.getElementById(controls!)
    expect(panel).not.toBeNull()
    expect(panel!.tagName).toBe('ASIDE')
  })

  it('keeps aria-controls resolvable after collapsing', async () => {
    const user = userEvent.setup()
    renderLayout()

    const toggle = screen.getByRole('button', { name: /companion/i })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull()
  })
})

/**
 * W-15 — `reveal`.
 *
 * A notice rendered into a collapsed panel is a notice nobody reads, so the app
 * is allowed to open the panel when something in it must be seen. Three things
 * bound that permission, and each has a test here: it must not overwrite the
 * student's preference, it must not take the keyboard, and it must not out-argue
 * a student who closes it again.
 */
describe('revealing the companion for something that must be seen', () => {
  it('opens a collapsed panel', () => {
    const { show } = renderRevealable(true)
    expect(isOpen()).toBe(false)

    show(true)

    expect(isOpen()).toBe(true)
  })

  it('leaves the stored preference alone — the app opened it, not the student', () => {
    const { show } = renderRevealable(true)

    show(true)

    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('true')
  })

  it('puts the collapse back once the reveal is over', () => {
    const { show } = renderRevealable(true)

    show(true)
    expect(isOpen()).toBe(true)
    show(false)

    expect(isOpen()).toBe(false)
  })

  it('restores nothing when the panel was already open', () => {
    const { show } = renderRevealable(false)

    show(true)
    show(false)

    // Nothing was changed, so nothing may be "restored" — closing a panel the
    // student had open would be the reveal doing harm on its way out.
    expect(isOpen()).toBe(true)
  })

  it('does not take focus from the student', () => {
    const { show } = renderRevealable(true)
    const before = document.activeElement

    show(true)

    // `role="alert"` announces without moving the caret. A student still
    // holding the keyboard mid-game must not be dragged into the panel.
    expect(document.activeElement).toBe(before)
    expect(document.activeElement).toBe(document.body)
  })

  it('does not remount the stage', () => {
    const { show } = renderRevealable(true)
    const before = screen.getByTestId('stage')

    show(true)
    show(false)

    // Non-negotiable #4: the reveal is a CSS-level state change like any other
    // collapse, so Unity keeps running through it.
    expect(screen.getByTestId('stage')).toBe(before)
  })

  it('does not re-open a panel the student closed while the reveal was up', async () => {
    const user = userEvent.setup()
    const { show } = renderRevealable(true)

    show(true)
    await user.click(screen.getByRole('button', { name: /hide companion/i }))
    expect(isOpen()).toBe(false)

    // A second failure, a retry, any re-render at all: the reveal is already
    // raised, so it must not fire again and undo an explicit choice.
    show(true)

    expect(isOpen()).toBe(false)
  })

  it('does not undo a preference the student changed during the reveal', async () => {
    const user = userEvent.setup()
    const { show } = renderRevealable(true)

    show(true)
    // Closed it, then decided they wanted it open after all. That second click
    // is a new stored preference — 'false' — and it is now the only one that
    // counts, so the reveal ending must not put the old 'true' back.
    await user.click(screen.getByRole('button', { name: /hide companion/i }))
    await user.click(screen.getByRole('button', { name: /show companion/i }))
    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('false')

    show(false)

    expect(isOpen()).toBe(true)
    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('false')
  })
})
