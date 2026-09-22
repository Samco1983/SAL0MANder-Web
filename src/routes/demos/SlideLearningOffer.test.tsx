import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SLIDE_EVENT, type SlideEvent } from '@unity/slideBridge'
import { SlideLearningOffer } from './SlideLearningOffer'

function message(detail: SlideEvent) {
  act(() => window.dispatchEvent(new CustomEvent(SLIDE_EVENT, { detail })))
}
const ready = (attempt: number, requestId = 'demo_1'): SlideEvent => ({
  type: 'slide-ready',
  slideVersion: 1,
  requestId,
  attempt,
})
const finish = (attempt: number, requestId = 'demo_1'): SlideEvent => ({
  type: 'slide-finished',
  slideVersion: 1,
  requestId,
  attempt,
  moves: 1,
  seconds: 2,
})
const offer = () => screen.queryByRole('region', { name: 'Learning with Sam' })

describe('Swap completion offer', () => {
  it('waits for the matching ready attempt, hides on next level, and ignores stale finishes', () => {
    render(<SlideLearningOffer requestId="demo_1" />)
    message(finish(1))
    message(ready(1, 'other'))
    message(finish(1, 'other'))
    expect(offer()).toBeNull()
    message(ready(1))
    expect(offer()).toBeNull()
    message(finish(1))
    expect(offer()).toBeVisible()
    message(ready(2))
    message(finish(1))
    expect(offer()).toBeNull()
    message(finish(2))
    expect(offer()).toBeVisible()
  })

  it.each(['slide-cancelled', 'slide-error'] as const)(
    'clears on %s and rejects delayed completion',
    (type) => {
      render(<SlideLearningOffer requestId="demo_1" />)
      message(ready(1))
      message(finish(1))
      message(
        type === 'slide-error'
          ? { type, slideVersion: 1, requestId: 'demo_1', message: 'Stopped' }
          : { type, slideVersion: 1, requestId: 'demo_1' },
      )
      message(finish(1))
      expect(offer()).toBeNull()
    },
  )
})
