import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
const companionCss = readFileSync(resolve(__dirname, 'CompanionLayout.module.css'), 'utf8')

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

  it('marks only the active auto-reveal state, so CSS can cap it on phones', async () => {
    const user = userEvent.setup()
    const { show } = renderRevealable(true)
    const layout = screen.getByTestId('stage').closest('[data-collapsed]')

    expect(layout).toHaveAttribute('data-revealed', 'false')

    show(true)
    expect(layout).toHaveAttribute('data-revealed', 'true')

    await user.click(screen.getByRole('button', { name: /hide companion/i }))
    expect(layout).toHaveAttribute('data-revealed', 'false')
  })

  it('caps auto-revealed mobile sheets so the stage cannot be mostly covered', () => {
    const narrowBlock = companionCss.slice(companionCss.indexOf('@media (max-width: 60rem)'))
    expect(narrowBlock).toMatch(/\.layout\[data-revealed='true'\]\s+\.companion/)
  })

  it('leaves most of the stage visible, whatever the number is', () => {
    /*
     * W-17: the ruling is that an auto-reveal may not cover the playable area,
     * and the guarantee has to hold regardless of who calls `reveal`.
     *
     * This used to assert `max-height: 42%` — the literal value. That tests the
     * number rather than the rule, and it fails in both directions: a
     * legitimate change to 45% breaks a passing build for no reason, and a
     * change to 80% gets "fixed" by editing the expected number, which is
     * exactly how a guarantee quietly stops being one.
     *
     * The invariant is that the majority of the stage survives a reveal. Any
     * value at or under half satisfies it; nothing above it does.
     */
    const narrowBlock = companionCss.slice(companionCss.indexOf('@media (max-width: 60rem)'))
    const revealed = narrowBlock.slice(narrowBlock.indexOf("[data-revealed='true']"))
    const match = /max-height:\s*(\d+(?:\.\d+)?)%/.exec(revealed)

    expect(match, 'the revealed sheet must declare a max-height cap').not.toBeNull()
    expect(Number(match![1])).toBeLessThanOrEqual(50)
  })

  it('still reserves enough sheet for the revealed content to be readable', () => {
    // The other wall. A cap so aggressive that the revealed result is unreadable
    // fixes the covering problem by making the feature useless.
    const narrowBlock = companionCss.slice(companionCss.indexOf('@media (max-width: 60rem)'))
    const revealed = narrowBlock.slice(narrowBlock.indexOf("[data-revealed='true']"))
    const match = /max-height:\s*(\d+(?:\.\d+)?)%/.exec(revealed)
    expect(Number(match![1])).toBeGreaterThanOrEqual(30)
  })
})
