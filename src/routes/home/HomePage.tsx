import { env } from '@config/env'
import { paths, buildPath } from '@config/routes'
import { MOCK_DEMO_ACTIVITIES } from '@api/mockTransport'
import { AppShell } from '@components/layout/AppShell'
import { SharePanel } from '@components/share/SharePanel'
import { LinkButton } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import styles from './HomePage.module.css'

/**
 * The public front door — and the page a web filter's reviewer reads.
 *
 * A district blocks sal0mander.com as "categorized as Unknown". Securly and
 * Cisco both describe their reviewers examining page text and structure, so
 * what this page *says* is part of the categorization input, not only the meta
 * tags a crawler parses.
 *
 * Until now it said "Cloud companion platform", "The SAL0MANder application
 * owns the gameplay. This site is the cloud companion around it", "Mock
 * backend", "Contract version v1 · Draft", and "What the web platform is
 * responsible for". All accurate to an engineer and all wrong for the audience:
 * it reads as internal architecture documentation, and "Mock backend" and
 * "Draft" say *unfinished* to anyone deciding whether this is a real product.
 *
 * Rewritten for the two people who actually arrive here — a teacher deciding in
 * about four seconds, and a reviewer deciding what this domain is.
 *
 * ## Every claim on this page is one the repository can defend
 *
 * No COPPA, FERPA, WCAG, or standards-alignment claim appears, because nothing
 * here establishes one. The numbers are checkable: zero student accounts
 * (`src/auth/guestIdentity.ts`), zero ad and analytics scripts (nothing in
 * `index.html` but the app's own module), one domain (the bundle contacts no
 * external host). A page that overstates is the thing a district checks first.
 */
export function HomePage() {
  return (
    <AppShell>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Learning puzzles for the classroom</p>
          <h1 className={styles.title}>{env.appName}</h1>
          <p className={styles.lede}>
            Students answer questions to uncover a jigsaw puzzle, one piece at a time — math,
            science, vocabulary, or whatever a teacher builds. Share an activity with a single link:
            no accounts to create, no passwords to reset, nothing for a student to remember.
          </p>
          <div className={styles.actions}>
            <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)} size="lg">
              Try an activity
            </LinkButton>
            {/*
              The "WebGL host" button that sat here was an internal smoke-test
              route. It stays reachable by URL — see `visibleNav` in AppShell —
              but offering it on the front page tells a teacher this is a
              developer build.
            */}
            <LinkButton to={paths.privacy} variant="secondary" size="lg">
              Privacy &amp; student data
            </LinkButton>
          </div>
        </div>

        {/*
          Three numbers a teacher and a district reviewer both care about, and
          all three are checkable in this repository rather than asserted.

          They replaced "Demo activity: 1 / Mock backend" and "Contract
          version: v1 / Draft" — internal status dressed as product facts, and
          the two words most likely to make a reviewer file this as unfinished.

          Term before definition, and the visual order flipped in CSS instead.
          A screen reader announces "Demo activity: 1", which is the sentence a
          person would say; the value-first version I wrote initially was both
          invalid markup and announced backwards as "1, Demo activity".
        */}
        <dl className={styles.stats}>
          {[
            { label: 'Student accounts needed', value: '0', note: 'Students never sign up' },
            { label: 'Ads and tracking scripts', value: '0', note: 'None, anywhere' },
            { label: 'Steps for a student to start', value: '1', note: 'Open the link' },
          ].map((s) => (
            <div className={styles.stat} key={s.label}>
              <dt className={styles.statLabel}>{s.label}</dt>
              <dd className={styles.statValue}>{s.value}</dd>
              <dd className={styles.statNote}>{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>


      {/*
        The three activities, rendered FROM `MOCK_DEMO_ACTIVITIES` rather than
        written out here.

        Not a style preference. Two separate drafts of this work named the
        activity ids wrong, in two different ways — `act_integer_ops` in one and
        the old seeded set (`act_quadratics`, `act_cell_structure`,
        `act_vocab_review`) in another — and neither mistake failed anything,
        because a hardcoded string on a page is not checked against anything.
        Mapping the array means the ids here cannot drift from the ids the
        transport resolves, and `threeDemoActivities.test.ts` pins those to
        Unity's.

        A wrong id is not a cosmetic bug on this page: it is a dead share link
        on a teacher's printed worksheet.
      */}
      <section className={styles.section} aria-labelledby="activities-title">
        <h2 className={styles.sectionTitle} id="activities-title">
          Activities you can try right now
        </h2>
        <p className={styles.demoShareText}>
          Each one opens the way a student sees it — no account, no sign-in, nothing to install.
        </p>
        <div className={styles.grid}>
          {MOCK_DEMO_ACTIVITIES.map((activity) => (
            <Card key={activity.id} title={activity.title}>
              {activity.description}
              <div className={styles.cardAction}>
                <LinkButton to={buildPath.guestPlay(activity.id)}>
                  Open {activity.title}
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="demo-share-title">
        <div className={styles.demoShare}>
          <div className={styles.demoShareCopy}>
            <p className={styles.eyebrow}>For teachers</p>
            <h2 className={styles.sectionTitle} id="demo-share-title">
              One link is the whole setup
            </h2>
            <p className={styles.demoShareText}>
              Copy the link into Google Classroom, Canvas, Schoology, or Teams — or print the QR
              code onto a worksheet. Students open it and start. There is nothing to install and no
              roster to upload.
            </p>
            <div className={styles.inlineActions}>
              <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)} variant="secondary">
                See what a student sees
              </LinkButton>
            </div>
          </div>
          <SharePanel
            activityId={MOCK_DEMO_ACTIVITIES[0].id}
            baseUrl={env.publicBaseUrl}
            title={MOCK_DEMO_ACTIVITIES[0].title}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works in a classroom</h2>
        {/*
          Headed by what a person is trying to do, not by the feature's name.

          The card these replaced said images "live in cloud storage and are
          served from a CDN" — which is not true today and is exactly the kind
          of third-party claim a district technology officer would go looking
          for. Everything is served from this one domain, which is a better
          answer anyway.
        */}
        <div className={styles.grid}>
          <Card title="Share it">
            Send one link through Google Classroom, Canvas, Schoology, Teams, or a printed QR code.
            The link stays the same, so a worksheet printed today still works next year.
          </Card>
          <Card title="Students play">
            They open the link and start solving. No email, no password, no account — and no class
            time lost to sign-ins that do not work.
          </Card>
          <Card title="Answer, and the picture appears">
            Each correct answer releases a puzzle piece. Students see the image come together as
            they work, which is the part that keeps them going — and it works the same whether the
            questions are equations, cell biology, or vocabulary.
          </Card>
          <Card title="Nothing to configure">
            Everything loads from this one website. No plugins, no extensions, no separate accounts,
            and no other companies involved.
            <div className={styles.cardAction}>
              <LinkButton to={paths.privacy} variant="secondary">
                What we collect
              </LinkButton>
            </div>
          </Card>
        </div>
      </section>

    </AppShell>
  )
}
