import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TutoringBooking } from './TutoringBooking'

const { classroom } = vi.hoisted(() => ({
  classroom: {
    bookingUrl: 'https://calendar.app.google/AbCdEfGh12345678',
    payment: { cents: null as number | null, required: false },
  },
}))
vi.mock('@config/env', () => ({ env: { classroom } }))
beforeEach(() => {
  classroom.bookingUrl = 'https://calendar.app.google/AbCdEfGh12345678'
  classroom.payment = { cents: null, required: false }
})

it('shows Stripe payment wording only when the configured booking flow requires it', () => {
  classroom.payment = { cents: 4550, required: true }
  render(<TutoringBooking />)
  expect(screen.getByText(/\$45.50/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Choose a time & pay' })).toHaveAttribute(
    'href',
    classroom.bookingUrl,
  )
  expect(screen.getByText('Pay securely with Stripe')).toBeVisible()
  expect(
    screen.getByText(/Canceling an appointment does not automatically issue a refund/),
  ).toBeVisible()
  expect(screen.queryByText(/payment confirmed/i)).toBeNull()
})

it('keeps the unconnected state honest and the booking fallback usable', async () => {
  const user = userEvent.setup()
  render(<TutoringBooking />)
  expect(screen.queryByText('Pay securely with Stripe')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Choose a time & pay' })).toBeNull()
  await user.click(screen.getByText('Booking button not opening?'))
  expect(screen.getByRole('link', { name: classroom.bookingUrl })).toHaveAttribute(
    'href',
    classroom.bookingUrl,
  )
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
})

it('does not offer payment without a booking destination', () => {
  classroom.bookingUrl = ''
  classroom.payment = { cents: 4500, required: true }
  render(<TutoringBooking />)
  expect(screen.queryByRole('link', { name: 'Choose a time & pay' })).toBeNull()
  expect(screen.queryByText('Pay securely with Stripe')).toBeNull()
  expect(screen.getByRole('link', { name: 'Email your tutor to arrange your lesson.' })).toHaveAttribute(
    'href',
    'mailto:sal@salomandermath.com',
  )
})
