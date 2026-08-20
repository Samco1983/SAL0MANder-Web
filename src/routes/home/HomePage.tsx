import { env } from '@config/env'
import { paths, buildPath } from '@config/routes'
import { MOCK_DEMO_ACTIVITY_ID } from '@api/mockTransport'
import { AppShell } from '@components/layout/AppShell'
import { SharePanel } from '@components/share/SharePanel'
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
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Cloud companion platform</p>
          <h1 className={styles.title}>{env.appName}</h1>
          <p className={styles.lede}>
            The SAL0MANder application owns the gameplay. This site is the cloud companion around
            it: share links, profiles, saved progress, media, and teacher tools. Students can open a
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
        </div>

        {/*
          Orientation, not decoration: what exists right now, in three numbers.

          Term before definition, and the visual order flipped in CSS instead.
          A screen reader announces "Demo activity: 1", which is the sentence a
          person would say; the value-first version I wrote initially was both
          invalid markup and announced backwards as "1, Demo activity".
        */}
        <dl className={styles.stats}>
          {[
            { label: 'Demo activity', value: '1', note: 'Mock backend' },
            { label: 'Accounts needed to play', value: '0', note: 'Guest Play' },
            { label: 'Contract version', value: 'v1', note: 'Draft' },
          ].map((s) => (
            <div className={styles.stat} key={s.label}>
              <dt className={styles.statLabel}>{s.label}</dt>
              <dd className={styles.statValue}>{s.value}</dd>
              <dd className={styles.statNote}>{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="demo-share-title">
        <div className={styles.demoShare}>
          <div className={styles.demoShareCopy}>
            <p className={styles.eyebrow}>Teacher handoff</p>
            <h2 className={styles.sectionTitle} id="demo-share-title">
              Share the demo activity
            </h2>
            <p className={styles.demoShareText}>
              Use the same demo link as Guest Play to try the teacher side of distribution: copy it,
              post it, or open the QR when you need a printable handoff.
            </p>
            <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITY_ID)} variant="secondary">
              Preview student link
            </LinkButton>
          </div>
          <SharePanel
            activityId={MOCK_DEMO_ACTIVITY_ID}
            baseUrl={env.publicBaseUrl}
            title="Sample SAL0MANder Activity"
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What the web platform is responsible for</h2>
        {/*
          Intent-led headings, borrowed from the older shell: each card leads
          with what someone is trying to do, not the feature's name.
        */}
        <div className={styles.grid}>
          <Card title="I want to share an activity">
            A teacher publishes and gets a stable link to send through TPT, Google Classroom, an
            LMS, or a QR code.
          </Card>
          <Card title="I want to just play">
            A student opens that link and plays. No email, no password, no account required.
          </Card>
          <Card title="I want to keep my progress">
            Optional accounts add saved progress, XP, credits, badges, and history — never a
            requirement to play.
            <div style={{ marginTop: 'var(--space-4)' }}>
              <LinkButton to={paths.profile} variant="secondary">
                View guest progress
              </LinkButton>
            </div>
          </Card>
          <Card title="I want my images to load fast">
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
