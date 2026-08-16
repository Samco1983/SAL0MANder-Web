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
