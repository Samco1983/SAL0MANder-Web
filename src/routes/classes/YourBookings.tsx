import { useEffect, useState } from 'react'
import type { GroupClient, OwnedBooking, Reservation } from '@/groups/client'
import styles from './YourBookings.module.css'

type Props = {
  client: GroupClient
  accountId: string
  selectedId?: string
  currentReservation?: Reservation | null
  disabled?: boolean
  testMode?: boolean
  onSelect: (booking: OwnedBooking) => void
}

export function YourBookings(props: Props) {
  return <BookingList key={props.accountId} {...props} />
}

function BookingList({
  client,
  selectedId,
  currentReservation,
  disabled,
  testMode,
  onSelect,
}: Props) {
  const [bookings, setBookings] = useState<OwnedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let current = true
    setBookings([])
    setLoading(true)
    setError('')
    if (!client.bookings) {
      setLoading(false)
      setError(
        'Saved booking lookup is unavailable here. Use your original booking link or contact your tutor.',
      )
      return
    }
    void client
      .bookings()
      .then((next) => {
        if (current)
          setBookings(
            next.flatMap((booking) => {
              if (booking.reservation.id !== currentReservation?.id) return [booking]
              if (currentReservation.state === 'expired') return []
              return [
                {
                  ...booking,
                  reservation:
                    currentReservation.state === 'confirmed'
                      ? currentReservation
                      : booking.reservation,
                },
              ]
            }),
          )
      })
      .catch(() => {
        if (current)
          setError(
            'We could not load your booked lessons. Try again, or contact your tutor. No payment has been started.',
          )
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [client, revision, currentReservation])

  const format = (ms: number) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(ms)
  return (
    <section className={styles.panel} aria-label="Your booked lessons">
      <h2>{testMode ? 'Your test bookings' : 'Your booked lessons'}</h2>
      <p>Find upcoming lessons and lessons in progress using the account that booked them.</p>
      {testMode && <p>These are Stripe TEST reservations. They do not book a paid lesson.</p>}
      {loading && <p role="status">Loading your booked lessons…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && bookings.length === 0 && (
        <p>No upcoming or in-progress bookings were found for this account.</p>
      )}
      <ul className={styles.list}>
        {bookings.map((booking) => (
          <li key={booking.reservation.id}>
            <div>
              <strong>{booking.group.topic}</strong>
              <p>
                {booking.group.gradeBand} · {format(booking.group.startsAt)} Pacific
              </p>
              <p>
                {booking.reservation.state === 'confirmed'
                  ? testMode
                    ? 'Test payment confirmed'
                    : 'Seat confirmed'
                  : 'Payment not yet confirmed'}
              </p>
            </div>
            <button
              type="button"
              disabled={disabled || loading}
              aria-pressed={selectedId === booking.reservation.id}
              onClick={() => onSelect(booking)}
            >
              {booking.reservation.state === 'confirmed'
                ? 'Open booked lesson'
                : 'View pending booking'}
            </button>
          </li>
        ))}
      </ul>
      {client.bookings && (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setRevision((n) => n + 1)}
        >
          Refresh booked lessons
        </button>
      )}
    </section>
  )
}
