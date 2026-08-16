import { env } from '@config/env'
import { paths, buildPath } from '@config/routes'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import styles from './HomePage.module.css'

/**
 * Public home surface. Deliberately plain: marketing/product copy and visual
 * identity are a later, approval-gated pass. What this page establishes is the
 * information architecture, not the design.
 */
export function HomePage() {
  return (
    <AppShell>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Cloud companion platform</p>
        <h1 className={styles.title}>{env.appName}</h1>
        <p className={styles.lede}>
          The SAL0MANder application owns the gameplay. This site is the cloud companion around it:
          share links, profiles, saved progress, media, and teacher tools. Students can open a
          shared activity and play without an account.
        </p>
        <div className={styles.actions}>
          <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITY_ID)} size="lg">
            Try Guest Play
          </LinkButton>
          <LinkButton to={paths.unity} variant="secondary" size="lg">
            WebGL host
          </LinkButton>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What the web platform is responsible for</h2>
        <div className={styles.grid}>
          <Card title="Share &amp; distribute">
            A teacher publishes an activity and gets a stable link to send through TPT, Google
            Classroom, an LMS, or a QR code.
          </Card>
          <Card title="Guest Play">
            A student opens that link and plays. No email, no password, no account required.
          </Card>
          <Card title="Profiles &amp; progress">
            Optional accounts add saved progress, XP, credits, badges, and history — never a
            requirement to play.
          </Card>
          <Card title="Cloud storage">
            Activities, versions, and images live in cloud storage and are served from a CDN.
          </Card>
        </div>
      </section>

      <section className={styles.section}>
        <PlaceholderNotice
          title="This is a foundation, not a finished product surface"
          pending={[
            'Product/Gameplay Discovery and wireframes come before broad UX implementation',
            'Teacher Studio stays in Unity; the web side gets teacher tools later',
            'Credits, badges, classes, reports, and collaboration are deferred',
            'No backend provider, auth provider, or storage provider has been chosen',
          ]}
        >
          Every route here exists to establish structure and boundaries. Copy, layout, and visual
          language are placeholders pending product approval.
        </PlaceholderNotice>
      </section>
    </AppShell>
  )
}
