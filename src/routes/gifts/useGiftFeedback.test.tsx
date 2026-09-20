import { StrictMode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  GiftFeedback,
  GIFT_SOUND_KEY,
  GIFT_VIBRATION_KEY,
  GIFT_TEXT_KEY,
} from '@/gifts/giftFeedback'
import { useGiftFeedback } from './useGiftFeedback'
import { GiftFeedbackControls } from './GiftFeedbackControls'

function TestFeedback() {
  const feedback = useGiftFeedback()
  return (
    <>
      <GiftFeedbackControls feedback={feedback} />
      <button onClick={() => feedback.opening('box')}>Unwrap test</button>
      <button onClick={() => feedback.complete('hearts')}>Complete test</button>
      <button onClick={() => feedback.pictureVisible('puggle-puppy')}>Image loaded test</button>
      <button onClick={feedback.stop}>Replay test</button>
    </>
  )
}
beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

it.each(['smaller', 'smallest'])(
  'remembers the extra %s text setting after returning',
  async (size) => {
    const user = userEvent.setup()
    const view = render(<TestFeedback />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gift text size' }), size)
    expect(localStorage.getItem(GIFT_TEXT_KEY)).toBe(size)
    view.unmount()
    render(<TestFeedback />)
    expect(screen.getByRole('combobox', { name: 'Gift text size' })).toHaveValue(size)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gift text size' }), 'normal')
    expect(localStorage.getItem(GIFT_TEXT_KEY)).toBe('normal')
  },
)

it('uses normal text if the stored size is unsupported', () => {
  localStorage.setItem(GIFT_TEXT_KEY, 'unreadable')
  render(<TestFeedback />)
  expect(screen.getByRole('combobox', { name: 'Gift text size' })).toHaveValue('normal')
})

it('is silent on initial mount and honestly disables unavailable vibration', () => {
  const play = vi.spyOn(GiftFeedback.prototype, 'play').mockResolvedValue(false)
  const unlock = vi.spyOn(GiftFeedback.prototype, 'unlock').mockImplementation(() => {})
  render(<TestFeedback />)
  expect(play).not.toHaveBeenCalled()
  expect(unlock).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Gift sounds on' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Vibration unavailable' })).toBeDisabled()
})

it('persists independent sound/vibration and web text settings and remains usable under StrictMode', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('navigator', { ...navigator, vibrate: vi.fn() })
  const play = vi.spyOn(GiftFeedback.prototype, 'play').mockResolvedValue(false)
  const unlock = vi.spyOn(GiftFeedback.prototype, 'unlock').mockImplementation(() => {})
  const first = render(
    <StrictMode>
      <TestFeedback />
    </StrictMode>,
  )
  await user.click(screen.getByRole('button', { name: 'Unwrap test' }))
  expect(play).toHaveBeenCalledWith(expect.objectContaining({ key: 'gift_box_pop' }))
  expect(unlock).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Gift sounds on' }))
  await user.click(screen.getByRole('button', { name: 'Vibration on' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Gift text size' }), 'compact')
  expect(localStorage.getItem(GIFT_SOUND_KEY)).toBe('off')
  expect(localStorage.getItem(GIFT_VIBRATION_KEY)).toBe('off')
  expect(localStorage.getItem(GIFT_TEXT_KEY)).toBe('compact')
  first.unmount()
  render(<TestFeedback />)
  expect(screen.getByRole('button', { name: 'Gift sounds off' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Vibration off' })).toBeVisible()
  expect(screen.getByRole('combobox', { name: 'Gift text size' })).toHaveValue('compact')
})

it('never starts a picture call before completion and queues it after the reward sound finishes', async () => {
  const user = userEvent.setup()
  let resolve!: (ok: boolean) => void
  const play = vi
    .spyOn(GiftFeedback.prototype, 'play')
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((done) => {
          resolve = done
        }),
    )
    .mockResolvedValue(true)
  render(<TestFeedback />)
  await user.click(screen.getByRole('button', { name: 'Image loaded test' }))
  expect(play).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Complete test' }))
  await user.click(screen.getByRole('button', { name: 'Image loaded test' }))
  expect(play).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ key: 'heart_bloom' }))
  await act(async () => resolve(true))
  expect(play).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'dog-bark' }))
  expect(play).toHaveBeenCalledTimes(2)
})

it.each(['mute', 'replay', 'unmount'])(
  'cancels a queued picture call on %s even if the old fanfare settles later',
  async (action) => {
    const user = userEvent.setup()
    let resolve!: (ok: boolean) => void
    const play = vi
      .spyOn(GiftFeedback.prototype, 'play')
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((done) => {
            resolve = done
          }),
      )
      .mockResolvedValue(true)
    const view = render(<TestFeedback />)
    await user.click(screen.getByRole('button', { name: 'Complete test' }))
    await user.click(screen.getByRole('button', { name: 'Image loaded test' }))
    if (action === 'mute') {
      await user.click(screen.getByRole('button', { name: 'Gift sounds on' }))
      await user.click(screen.getByRole('button', { name: 'Gift sounds off' }))
    } else if (action === 'replay')
      await user.click(screen.getByRole('button', { name: 'Replay test' }))
    else view.unmount()
    await act(async () => resolve(true))
    expect(play).toHaveBeenCalledTimes(1)
  },
)
