import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { GiftOpening, GIFT_OPENING_MS } from './GiftOpening'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it.each(['box', 'envelope'] as const)(
  'opens the %s by keyboard into a covered card and transfers focus',
  async (wrapper) => {
    const user = userEvent.setup()
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ ...media, matches: true })),
    )
    render(
      <GiftOpening wrapper={wrapper}>
        <button>Open puzzle</button>
      </GiftOpening>,
    )
    expect(screen.queryByRole('button', { name: 'Open puzzle' })).toBeNull()
    const opener = screen.getByRole('button', {
      name: wrapper === 'box' ? 'Open gift box' : 'Open envelope',
    })
    opener.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Covered puzzle card')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open puzzle' })).toHaveFocus()
    expect(document.querySelector('img')).toBeNull()
  },
)
it('finishes one short opening and cleans pending timers on unmount', () => {
  vi.useFakeTimers()
  const first = render(
    <GiftOpening wrapper="box">
      <button>Open puzzle</button>
    </GiftOpening>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open gift box' }))
  expect(screen.getByRole('button', { name: 'Unwrapping…' })).toBeDisabled()
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(GIFT_OPENING_MS))
  expect(screen.getByRole('button', { name: 'Open puzzle' })).toHaveFocus()
  first.unmount()
  const otherTimers = vi.getTimerCount()
  const second = render(
    <GiftOpening wrapper="envelope">
      <button>Open puzzle</button>
    </GiftOpening>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open envelope' }))
  second.unmount()
  expect(vi.getTimerCount()).toBe(otherTimers)
})
