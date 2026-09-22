import { env } from '@config/env'
import { tutoringPriceLabel } from '@config/tutoringPayment'
import styles from './TutoringBooking.module.css'

export function TutoringBooking() {
  const { bookingUrl, payment } = env.classroom
  const paid = !!(bookingUrl && payment?.required && payment.cents)
  return (
    <section className={styles.booking} id="booking" aria-labelledby="booking-title">
      <div>
        <p className={styles.eyebrow}>Your next step</p>
        <h2 id="booking-title">Book your private lesson</h2>
        <p>Private session · 1 learner + your tutor · 60 minutes · Google Meet</p>
        {payment?.cents ? (
          <p className={styles.price}>
            {tutoringPriceLabel(payment.cents)} <span>per lesson · USD</span>
          </p>
        ) : null}
        <p className={styles.muted}>
          Your completed booking reserves the selected time for one learner and your tutor. A parent
          or guardian books for a child. Adult learners can book for themselves.
        </p>
        {bookingUrl ? (
          <>
            <a
              className={styles.action}
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {paid ? 'Choose a time & pay' : 'Open Google booking page'}
            </a>
            <p className={styles.muted}>
              {paid ? 'Complete payment and booking' : 'Complete the booking steps'} to reserve your
              private session with your tutor. Both you and your tutor receive a confirmation email
              with a calendar invitation for the same session.
            </p>
            <details className={styles.backup}>
              <summary>Booking button not opening?</summary>
              <p>Copy this link into your browser, or email your tutor for help.</p>
              <a
                className={styles.rawLink}
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bookingUrl}
              </a>
            </details>
          </>
        ) : (
          <p>
            The Google booking link is being set up.{' '}
            <a href="mailto:sal@salomandermath.com">Email your tutor to arrange your lesson.</a>
          </p>
        )}
      </div>
      <div>
        <h3>From booking to your lesson</h3>
        <ol className={styles.steps}>
          <li>
            <strong>Choose a time</strong>
            <span>See available times and check the time zone on the booking page.</span>
          </li>
          <li>
            <strong>{paid ? 'Pay securely with Stripe' : 'Complete your booking'}</strong>
            <span>
              {paid
                ? 'Review the price and cancellation policy, then pay to reserve one private session for your learner and your tutor.'
                : 'Tell your tutor the grade or course and what you want help with.'}
            </span>
          </li>
          <li>
            <strong>Open your lesson invitation</strong>
            <span>
              Your Google Calendar confirmation includes the Google Meet link. Keep that email for
              lesson day.
            </span>
          </li>
        </ol>
        <p className={styles.group}>
          Small-group tutoring: $20 reserves one learner’s seat in a shared 60-minute session with
          your tutor. Up to 6 learners + your tutor attend the same session.{' '}
          <a href="/classes">See available small-group sessions.</a>
        </p>
        {paid ? (
          <p className={styles.muted}>
            For payment or refund help,{' '}
            <a href="mailto:sal@salomandermath.com">contact your tutor</a>. Canceling an appointment
            does not automatically issue a refund.
          </p>
        ) : null}
      </div>
    </section>
  )
}
