import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { GroupClient, ReservationJoin } from '@/groups/client'
import { ReservationJoinPanel } from './ReservationJoinPanel'

const classId = 'a'.repeat(32)
const reservationId = 'b'.repeat(32)
const joinUrl = 'https://us06web.zoom.us/j/12345678901?pwd=Passcode'
function access(state: ReservationJoin['state'] = 'open'): ReservationJoin {
  return {
    classId,
    reservationId,
    topic: 'Booked algebra class',
    startsAt: Date.now() - 500,
    state,
    opensAt: Date.now() - 1000,
    closesAt: Date.now() + 60000,
    provider: state === 'unconfigured' ? null : 'zoom',
    joinUrl: state === 'open' ? joinUrl : null,
  }
}
afterEach(() => vi.useRealTimers())

it.each(['unconfigured', 'not_open', 'ended'] as const)(
  'shows %s status without a meeting URL',
  async (state) => {
    const join = vi.fn(async () => access(state))
    render(
      <ReservationJoinPanel
        client={{ join } as unknown as GroupClient}
        accountId="parent"
        classId={classId}
        reservationId={reservationId}
      />,
    )
    await waitFor(() => expect(screen.queryByText(/Checking your booking/)).toBeNull())
    expect(screen.queryByRole('link')).toBeNull()
    expect(document.body.innerHTML).not.toContain(joinUrl)
  },
)

it('shows only server-authorized access and removes a previous link immediately while rechecking', async () => {
  const user = userEvent.setup()
  let finish!: (value: ReservationJoin) => void
  const join = vi
    .fn(async () => access())
    .mockImplementationOnce(async () => access())
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
  render(
    <ReservationJoinPanel
      client={{ join } as unknown as GroupClient}
      accountId="parent"
      classId={classId}
      reservationId={reservationId}
    />,
  )
  expect(await screen.findByRole('link', { name: 'Join lesson in Zoom' })).toHaveAttribute(
    'href',
    joinUrl,
  )
  expect(screen.getByText('Booked algebra class')).toBeVisible()
  expect(screen.getByText(/Video, audio and lesson chat open in Zoom/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Check lesson access' }))
  expect(screen.queryByRole('link')).toBeNull()
  await act(async () => finish(access('ended')))
  expect(screen.getByRole('status')).toHaveTextContent(/window has ended/)
  expect(screen.queryByRole('link')).toBeNull()
})

it('never exposes a link after denied access or an account/class switch with a late response', async () => {
  let finish!: (value: ReservationJoin) => void
  const join = vi
    .fn<NonNullable<GroupClient['join']>>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockRejectedValueOnce(new Error('forbidden'))
  const client = { join } as unknown as GroupClient
  const view = render(
    <ReservationJoinPanel
      client={client}
      accountId="first"
      classId={classId}
      reservationId={reservationId}
    />,
  )
  view.rerender(
    <ReservationJoinPanel
      client={client}
      accountId="second"
      classId={classId}
      reservationId={reservationId}
    />,
  )
  await act(async () => finish(access()))
  expect(await screen.findByRole('alert')).toHaveTextContent(/Could not verify access/)
  expect(screen.queryByRole('link')).toBeNull()
})

it('removes the link at the closing boundary and asks the server again', async () => {
  vi.useFakeTimers()
  const now = Date.now()
  const join = vi
    .fn<NonNullable<GroupClient['join']>>()
    .mockResolvedValueOnce({ ...access(), closesAt: now + 1000 })
    .mockResolvedValueOnce(access('ended'))
  render(
    <ReservationJoinPanel
      client={{ join } as unknown as GroupClient}
      accountId="parent"
      classId={classId}
      reservationId={reservationId}
    />,
  )
  await act(async () => {})
  expect(screen.getByRole('link', { name: 'Join lesson in Zoom' })).toBeVisible()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1025)
  })
  expect(screen.queryByRole('link')).toBeNull()
  expect(join).toHaveBeenCalledTimes(2)
})
