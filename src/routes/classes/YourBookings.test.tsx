import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { GroupClient, OwnedBooking } from '@/groups/client'
import { YourBookings } from './YourBookings'

const booking: OwnedBooking = {
  group: {
    id: 'a'.repeat(32),
    topic: 'Booked fractions',
    gradeBand: 'Grade 6',
    startsAt: 1789400000000,
    endsAt: 1789403600000,
    timeZone: 'America/Los_Angeles',
    capacity: 6,
    priceCents: 2000,
    currency: 'usd',
    state: 'scheduled',
    seatsAvailable: 5,
    confirmedSeats: 1,
    pendingSeats: 0,
  },
  reservation: {
    id: 'b'.repeat(32),
    classId: 'a'.repeat(32),
    learnerId: 'c'.repeat(32),
    state: 'confirmed',
    checkoutUrl: null,
    expiresAt: null,
    priceCents: 2000,
    currency: 'usd',
  },
}
function client(bookings: NonNullable<GroupClient['bookings']>): GroupClient {
  return {
    demo: true,
    apiBase: 'http://127.0.0.1:5191',
    identity: { signIn: vi.fn(), authorization: vi.fn() },
    list: vi.fn(),
    create: vi.fn(),
    checkout: vi.fn(),
    reservation: vi.fn(),
    bookings,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
it('never repaints account A bookings after switching to B', async () => {
  const a = deferred<OwnedBooking[]>(),
    b = deferred<OwnedBooking[]>()
  const c = client(vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise))
  const select = vi.fn()
  const view = render(<YourBookings client={c} accountId="A" onSelect={select} />)
  view.rerender(<YourBookings client={c} accountId="B" onSelect={select} />)
  await act(async () => {
    b.resolve([])
  })
  await screen.findByText(/No upcoming or in-progress/)
  await act(async () => {
    a.resolve([booking])
  })
  expect(screen.queryByText('Booked fractions')).not.toBeInTheDocument()
  expect(select).not.toHaveBeenCalled()
})
it('clears already-visible bookings immediately when the account changes', async () => {
  const next = deferred<OwnedBooking[]>()
  const c = client(vi.fn().mockResolvedValueOnce([booking]).mockReturnValueOnce(next.promise))
  const view = render(<YourBookings client={c} accountId="A" onSelect={vi.fn()} />)
  await screen.findByText('Booked fractions')
  view.rerender(<YourBookings client={c} accountId="B" onSelect={vi.fn()} />)
  expect(screen.queryByText('Booked fractions')).not.toBeInTheDocument()
  await act(async () => {
    next.resolve([])
  })
})
it('distinguishes lookup failure from no bookings and supports retry', async () => {
  const c = client(
    vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([booking]),
  )
  render(<YourBookings client={c} accountId="A" onSelect={vi.fn()} />)
  await screen.findByRole('alert')
  expect(screen.queryByText(/No upcoming or in-progress/)).not.toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Refresh booked lessons' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refresh booked lessons' }))
  await screen.findByText('Booked fractions')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('views pending bookings without checkout or payment reconciliation', async () => {
  const pending = {
    ...booking,
    reservation: { ...booking.reservation, state: 'pending' as const },
  }
  const c = client(vi.fn().mockResolvedValue([pending])),
    selected = vi.fn()
  render(<YourBookings client={c} accountId="A" onSelect={selected} />)
  fireEvent.click(await screen.findByRole('button', { name: 'View pending booking' }))
  expect(selected).toHaveBeenCalledWith(pending)
  expect(c.checkout).not.toHaveBeenCalled()
  expect(c.reservation).not.toHaveBeenCalled()
})
it('labels TEST reservations without claiming a paid lesson', async () => {
  render(
    <YourBookings
      client={client(vi.fn().mockResolvedValue([booking]))}
      accountId="A"
      onSelect={vi.fn()}
      testMode
    />,
  )
  expect(await screen.findByText('Test payment confirmed')).toBeInTheDocument()
  expect(screen.getByText(/do not book a paid lesson/)).toBeInTheDocument()
  expect(screen.queryByText('Seat confirmed')).not.toBeInTheDocument()
})
