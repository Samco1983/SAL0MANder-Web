import { env } from './env'
import { PUBLIC_TUTORING_BOOKING_URL, readGoogleBookingUrl } from './classroom'

const tutoringInquiry = 'mailto:sal@salomandermath.com?subject=Tutoring%20inquiry'
const practiceInquiry =
  'mailto:sal@salomandermath.com?subject=Paid%20packets%2C%20curriculum%20and%20membership%20inquiry'

/** An explicit blank booking setting stays disabled; a site-origin setting is not a scheduler. */
export function learningOfferLinks(
  bookingUrl = env.classroom?.bookingUrl ?? PUBLIC_TUTORING_BOOKING_URL,
) {
  const booking = readGoogleBookingUrl(bookingUrl)
  return { tutoring: booking || tutoringInquiry, hasBooking: Boolean(booking), practiceInquiry }
}
