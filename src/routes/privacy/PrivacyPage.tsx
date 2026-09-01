import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './PrivacyPage.module.css'

/**
 * Privacy and data practices, written for two readers.
 *
 * A teacher deciding whether to use this with a class, and a content reviewer at
 * a web-filtering vendor deciding how to categorize the domain. Sanger Unified
 * currently blocks `sal0mander.com` as "categorized as Unknown" — not a content
 * judgement, just an absence of one — and a page like this is part of what
 * categorization looks for.
 *
 * ## Every claim here is verifiable in this repository
 *
 * That constraint is the point. A privacy page that overstates is worse than
 * none: it is the first thing a district checks and the first thing that costs
 * trust when it turns out to be aspirational.
 *
 * So this page states only what the code does today, and each claim has a
 * checkable basis:
 *
 *   - no ads, no analytics, no third-party scripts — nothing in `index.html`
 *     but the app's own module, and no tracker SDK anywhere in `src/`
 *   - one domain — the bundle contacts no external host, and the Unity build is
 *     served from `/unity` on the same origin
 *   - no accounts to play — `src/auth/guestIdentity.ts`, and CLAUDE.md
 *     non-negotiable 3
 *   - the local storage list is exhaustive as of this writing
 *
 * ## What it deliberately does NOT claim
 *
 * No COPPA, FERPA, WCAG, or standards-alignment claim appears here. Those are
 * assertions about legal and audit status that nothing in this repository
 * establishes, and a district that checks one and finds it unsupported has
 * learned something worse than "this page is thin".
 *
 * The strongest honest position is a short, exact page. Add a compliance claim
 * only when there is a document behind it.
 */
export function PrivacyPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Privacy</p>
          <h1 className={styles.title}>What {env.appName} collects</h1>
          <p className={styles.lede}>
            {env.appName} is a practice tool for classrooms. Students answer questions to reveal a
            puzzle, in whatever subject their teacher built the activity for. This page describes
            exactly what the software does with information — no more and no less.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="students">
          <h2 className={styles.sectionTitle} id="students">
            Students do not make accounts
          </h2>
          <p>
            A teacher shares a link. A student opens it and plays. There is no sign-up, no email
            address, no password, and no request for a real name at any point on the way to an
            activity.
          </p>
          <p>
            Students may choose a nickname — <strong>Player 1</strong>, or something they make up —
            so a shared classroom device can keep more than one person&apos;s progress apart. A
            nickname is optional, and it is never checked against anything.
          </p>
          <p className={styles.callout}>
            We never ask a student for their real name. Teachers are encouraged to have their class
            use nicknames.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="stored">
          <h2 className={styles.sectionTitle} id="stored">
            What is stored on the device
          </h2>
          <p>
            {env.appName} keeps a small amount of information in the browser so a student can come
            back to what they were doing. As of this writing that is the complete list:
          </p>
          <ul className={styles.list}>
            <li>The nickname a player chose, if they chose one</li>
            <li>A random identifier, so a session can be resumed on the same device</li>
            <li>Light or dark appearance preference</li>
            <li>Whether the side panel is open or closed</li>
          </ul>
          <p>
            The random identifier is not a login and grants access to nothing. It contains no
            personal information and is not tied to a name, an email address, or a school record.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="ads">
          <h2 className={styles.sectionTitle} id="ads">
            No advertising and no tracking
          </h2>
          <p>
            There is no advertising anywhere in {env.appName}. There are no analytics services, no
            advertising networks, and no third-party tracking scripts of any kind.
          </p>
          <p>
            Everything the browser downloads — the site, the game, the images — comes from this one
            domain. {env.appName} loads no content from any outside company.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="teachers">
          <h2 className={styles.sectionTitle} id="teachers">
            For teachers and school technology staff
          </h2>
          <p>
            {env.appName} is used by students in classrooms, so it is built to collect as little as
            possible. Student work is practice, not a record: the software is designed so a class
            can use it without the school handing over student information.
          </p>
          {/*
            The "get in touch" sentence that used to sit here was replaced by
            the Contact section below, which names the address and says what
            will be sent back. "Please get in touch" is the shape of a sentence
            that sounds helpful and tells a district technology officer nothing
            they can act on.
          */}
          <p>
            Everything above is what the software does today. If something here is not enough detail
            for a review, the contact addresses below reach a person.
          </p>
        </section>

        {/*
          Two addresses rather than one, because they are read by different
          people. A teacher whose class cannot load an activity and a district
          privacy officer evaluating the product both need a route in, and a
          single inbox makes the second one look like an afterthought.

          The same monitored mailbox is listed for both audiences until
          dedicated domain mailboxes are configured. A working contact is more
          trustworthy than publishing role addresses that cannot receive mail.
        */}
        <section className={styles.section} aria-labelledby="contact">
          <h2 className={styles.sectionTitle} id="contact">
            Contact
          </h2>
          <p>
            <strong>Teachers and general support:</strong>{' '}
            <a className={styles.link} href="mailto:samco1983@gmail.com">
              samco1983@gmail.com
            </a>
          </p>
          <p>
            <strong>Privacy, student data, and district technology staff:</strong>{' '}
            <a className={styles.link} href="mailto:samco1983@gmail.com">
              samco1983@gmail.com
            </a>
          </p>
          <p>
            If your district filters web traffic and needs {env.appName} reviewed or added to an
            allow list, write to the privacy address and we will send the exact domain list and a
            description of what the software does.
          </p>
        </section>

        <footer className={styles.footer}>
          <LinkButton to={paths.home} variant="secondary">
            Back to home
          </LinkButton>
        </footer>
      </div>
    </AppShell>
  )
}
