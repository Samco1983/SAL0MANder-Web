import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { DemoActivityCard } from '@components/demo/DemoActivityCard'
import { LinkButton } from '@components/ui/Button'
import { DEMO_ACTIVITIES, SAMPLE_ACTIVITY, isPlayable } from '@demo/demoActivities'
import styles from './DemoGalleryPage.module.css'

/**
 * The teacher-facing showcase for the three launch activities.
 *
 * Deliberately NOT `/play`. That route is the recovery screen for a student
 * whose share link was truncated — a real arrival with tests behind it — and
 * turning it into a picker would replace a considered student flow with a
 * marketing surface.
 *
 * Every card states what has actually been verified about its link. That is
 * unusual for a demo page and it is the point: until `BLOCKERS.md` B-11
 * clears, a card here cannot honestly claim its link launches the activity it
 * names, because Unity does not yet report which activity it loaded.
 */
export function DemoGalleryPage() {
  const baseUrl = env.publicBaseUrl ?? ''
  /*
    Same gate the truncated-link screen already uses: the sample lives in the
    mock transport, so offering it against a real API would promise an activity
    that may not exist there — a worse dead end than showing nothing, because
    this one looks like it works.
  */
  const showSample = !env.api.isConfigured
  const cards = showSample ? [...DEMO_ACTIVITIES, SAMPLE_ACTIVITY] : DEMO_ACTIVITIES
  /*
    Deliberately DEMO_ACTIVITIES, not `cards`. The banner is a statement about
    the three launch activities; the mock sample being playable says nothing
    about whether those have shipped, and letting it suppress the warning would
    make the page claim readiness it does not have.
  */
  const anyPlayable = DEMO_ACTIVITIES.some(isPlayable)

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Demo activities</p>
          <h1 className={styles.title}>Three activities to try</h1>
          <p className={styles.lede}>
            Each one opens as a puzzle a student can play from a link — no account, no sign-in.
            Share the link, or print the QR code onto a worksheet.
          </p>
        </header>

        {/*
          One honest banner instead of repeating the caveat inside every card's
          prose. The per-card badge still carries the specific verdict; this
          says why they all read the same way today.

          Shown only while nothing is playable. Once one activity verifies, a
          blanket "none of these work" would be false, and the per-card badges
          are already precise.
        */}
        {anyPlayable ? null : (
          <p className={styles.notice} role="status">
            <strong className={styles.noticeTitle}>These are not live yet.</strong> The activities
            are still being built in the app. The links and QR codes below are final and safe to
            save, but they will not open a puzzle until the activities ship.
          </p>
        )}

        <ul className={styles.grid}>
          {cards.map((activity) => (
            <li key={activity.id}>
              <DemoActivityCard activity={activity} baseUrl={baseUrl} />
            </li>
          ))}
        </ul>

        <footer className={styles.footer}>
          <LinkButton to={paths.home} variant="secondary">
            Back to home
          </LinkButton>
        </footer>
      </div>
    </AppShell>
  )
}
