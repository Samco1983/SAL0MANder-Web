import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PREVIEW_EVENT } from '@unity/previewBridge'
import { SLIDE_EVENT } from '@unity/slideBridge'
import { PREVIEW_ATTEMPT_EVENT } from '@unity/previewAttemptBridge'
import { DEFAULT_GIFT_PRESENTATION } from '@/gifts/giftPresentation'
import { GiftCelebration } from './GiftCelebration'

function finish(requestId: string, type = 'preview-finished') {
  act(() =>
    window.dispatchEvent(
      new CustomEvent(PREVIEW_EVENT, { detail: { previewVersion: 1, requestId, type } }),
    ),
  )
}
function show(id = 'current', channel: 'slide' | 'preview' | 'preview-attempt' = 'preview') {
  return render(
    <MemoryRouter>
      <GiftCelebration
        key={id}
        requestId={id}
        channel={channel}
        presentation={{
          ...DEFAULT_GIFT_PRESENTATION,
          occasion: 'birthday',
          celebration: 'balloons',
        }}
      />
    </MemoryRouter>,
  )
}
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('clears native preview replay and celebrates only its second real completion', () => {
  vi.useFakeTimers()
  const view = show('current', 'preview-attempt')
  const emit = (type: string, attempt: number, requestId = 'current') =>
    act(() =>
      window.dispatchEvent(
        new CustomEvent(PREVIEW_ATTEMPT_EVENT, {
          detail: {
            type,
            attemptVersion: 1,
            requestId,
            attempt,
          },
        }),
      ),
    )
  finish('current') // Legacy completion is never a Gift replay signal.
  emit('preview-attempt-finished', 1)
  expect(screen.queryByRole('status')).toBeNull()
  emit('preview-attempt-ready', 1)
  emit('preview-attempt-finished', 1, 'foreign')
  expect(screen.queryByRole('status')).toBeNull()
  emit('preview-attempt-finished', 1)
  expect(screen.getByRole('status')).toBeVisible()
  emit('preview-attempt-ready', 1)
  emit('preview-attempt-finished', 1)
  expect(vi.getTimerCount()).toBe(1)
  emit('preview-attempt-ready', 2)
  expect(screen.queryByRole('status')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  emit('preview-attempt-finished', 1)
  finish('current')
  expect(screen.queryByRole('status')).toBeNull()
  emit('preview-attempt-finished', 2)
  emit('preview-attempt-ready', 1)
  expect(screen.getByRole('status')).toBeVisible()
  finish('foreign', 'preview-error')
  expect(screen.getByRole('status')).toBeVisible()
  finish('current', 'preview-error')
  expect(screen.queryByRole('status')).toBeNull()
  emit('preview-attempt-ready', 3)
  emit('preview-attempt-finished', 3)
  expect(screen.queryByRole('status')).toBeNull()
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('celebrates only the ready slide attempt, preserves duplicate acknowledgements and resets on actual replay', () => {
  vi.useFakeTimers()
  show('current', 'slide')
  const emit = (type: string, attempt?: number, requestId = 'current') =>
    act(() =>
      window.dispatchEvent(
        new CustomEvent(SLIDE_EVENT, {
          detail: {
            type,
            slideVersion: 1,
            requestId,
            ...(attempt === undefined ? {} : { attempt }),
            ...(type === 'slide-finished' ? { moves: 12, seconds: 8.5 } : {}),
          },
        }),
      ),
    )
  emit('slide-finished', 1)
  finish('current')
  expect(screen.queryByRole('status')).toBeNull()
  emit('slide-ready', 1)
  emit('slide-finished', 1, 'stale')
  expect(screen.queryByRole('status')).toBeNull()
  emit('slide-finished', 1)
  expect(screen.getByRole('status')).toHaveTextContent('Happy birthday')
  emit('slide-ready', 1)
  emit('slide-finished', 1)
  expect(screen.getByRole('status')).toBeVisible()
  emit('slide-ready', 2)
  expect(screen.queryByRole('status')).toBeNull()
  emit('slide-finished', 1)
  expect(screen.queryByRole('status')).toBeNull()
  emit('slide-finished', 2)
  emit('slide-ready', 1)
  expect(screen.getByRole('status')).toBeVisible()
  emit('slide-cancelled')
  expect(screen.queryByRole('status')).toBeNull()
  emit('slide-ready', 3)
  emit('slide-finished', 3)
  expect(screen.queryByRole('status')).toBeNull()
})

it('accepts only the current finish, latches duplicates, and stops decoration while keeping the message', () => {
  vi.useFakeTimers()
  const view = show()
  finish('stale')
  finish('current', 'preview-ready')
  finish('current', 'session-finished')
  expect(screen.queryByRole('region', { name: 'Gift complete' })).toBeNull()
  finish('current')
  expect(screen.getByRole('status')).toHaveTextContent('Happy birthday!')
  expect(screen.getByRole('link', { name: 'Make a gift' })).toHaveAttribute('href', '/gifts')
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(2000))
  finish('current')
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(1500))
  expect(view.container.querySelector('[data-moving]')).toHaveAttribute('data-moving', 'false')
  expect(screen.getByRole('status')).toBeVisible()
  finish('current')
  expect(vi.getTimerCount()).toBe(0)
})

it('unsubscribes and clears its timer on navigation; a new request begins unfinished', () => {
  vi.useFakeTimers()
  const remove = vi.spyOn(window, 'removeEventListener')
  const first = show()
  finish('current')
  first.unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(remove).toHaveBeenCalledWith(PREVIEW_EVENT, expect.any(Function))
  show('replay')
  finish('current')
  expect(screen.queryByRole('status')).toBeNull()
  finish('replay')
  expect(screen.getByRole('status')).toBeVisible()
})

it('shows a static celebration with reduced motion and creates no animation timer', () => {
  vi.useFakeTimers()
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ ...media, matches: true })),
  )
  const view = show()
  finish('current')
  expect(screen.getByRole('status')).toBeVisible()
  expect(view.container.querySelector('[data-moving]')).toHaveAttribute('data-moving', 'false')
  expect(vi.getTimerCount()).toBe(0)
})

it('shows the personal occasion after completion as plain text', () => {
  render(
    <MemoryRouter>
      <GiftCelebration
        requestId="custom"
        presentation={{ ...DEFAULT_GIFT_PRESENTATION, occasionText: 'You got the job!' }}
      />
    </MemoryRouter>,
  )
  expect(screen.queryByText('You got the job!')).toBeNull()
  finish('custom')
  expect(screen.getByRole('status')).toHaveTextContent('You got the job!')
})
