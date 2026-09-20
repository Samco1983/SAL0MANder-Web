import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './PrivacyPage.module.css'

/** Guest puzzle play and optional hosted tutoring have different data paths. */
export function PrivacyPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Privacy</p>
          <h1 className={styles.title}>What {env.appName} collects</h1>
          <p className={styles.lede}>
            {env.appName} is a practice tool for classrooms, with optional tutoring features. Guest
            puzzle play, saved tutoring preparation and live lessons use different information and
            services. This page explains those differences.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="students">
          <h2 className={styles.sectionTitle} id="students">
            Guest puzzle play needs no account
          </h2>
          <p>
            A teacher shares an activity link. A student opens it and plays. There is no sign-up,
            email address, password or real-name requirement on that guest play path. Optional
            tutoring accounts are separate from guest play.
          </p>
          <p>
            Students may choose a nickname — <strong>Player 1</strong>, or something they make up.
            It is an optional display label, not a verified identity or a separate account.
          </p>
          <p className={styles.callout}>
            Guest puzzle play does not ask for a student&apos;s real name. Teachers are encouraged
            to use nicknames and avoid putting personal information in shared activities.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="stored">
          <h2 className={styles.sectionTitle} id="stored">
            What is stored on the device
          </h2>
          <p>
            {env.appName} stores preferences and local work in the browser. Depending on which
            features you use, this includes:
          </p>
          <ul className={styles.list}>
            <li>The nickname a player chose, if they chose one</li>
            <li>A random identifier, so a session can be resumed on the same device</li>
            <li>Light or dark appearance preference</li>
            <li>Whether the side panel is open or closed</li>
            <li>Game settings and locally saved puzzle progress</li>
            <li>
              Teacher Studio activity drafts, including questions, picture choices, settings and
              notes
            </li>
          </ul>
          <p>
            The guest identifier is randomly generated on the device rather than supplied as a name
            or email address. It is a session identifier, not proof of a person&apos;s identity. If
            a play-session backend is configured, the guest identifier and optional nickname can be
            sent with the activity and attempt information; completed-session results can also be
            sent to that backend. Guest play does not require tutoring sign-in.
          </p>
          <p>
            Teacher drafts stay in the browser where they were created. Download backup saves a
            separate file containing those drafts and notes; importing it adds copies to that
            browser. Teacher previews use temporary game progress and do not replace saved student
            progress.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="tutoring-data">
          <h2 className={styles.sectionTitle} id="tutoring-data">
            Optional tutoring accounts and saved preparation
          </h2>
          <p>
            Parents, adult learners and tutors can use Google sign-in through Firebase
            Authentication for tutoring. The account email is used for sign-in and shown to the
            signed-in user. The tutoring backend stores account and learner identifiers, roles,
            bookings, payment status, assigned practice and practice progress. Google Cloud services
            provide that backend and its storage.
          </p>
          <p>
            Lesson preparation is optional: grade or course, math topic, learning goal and what
            helps the learner. An authenticated parent or adult learner can save this background and
            upload PDF, JPEG or PNG schoolwork for their tutor. The backend checks access for the
            account owner and authorised tutors; it does not expose these records to classmates.
            Include only the pages needed for the lesson.
          </p>
          <p>
            Clearing browser data does not delete server-stored tutoring records, uploaded files or
            payment records. Contact us below about access, corrections or deletion. Retention and
            deletion questions, including provider records, need an individual response; this page
            does not promise an automatic deletion deadline.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="providers">
          <h2 className={styles.sectionTitle} id="providers">
            Payments, scheduling and live lessons
          </h2>
          <p>
            Stripe handles card checkout on its payment page. The tutoring backend keeps checkout
            references and payment status to confirm seats; the SAL0MANder booking form does not
            collect card numbers. Booking links may open Google Calendar.
          </p>
          <p>
            Video, audio and lesson chat open in the tutor&apos;s chosen Google Meet or Zoom
            meeting. This website does not record the call or store its live chat. The meeting
            provider&apos;s settings and privacy practices apply there, including any recording
            enabled in that provider. A private-lesson invitation pasted into the join form stays in
            that page until you choose to open it; pasting an invitation does not create a booking.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="sharing">
          <h2 className={styles.sectionTitle} id="sharing">
            Shared activities and pictures
          </h2>
          <p>
            Sharing a gift or activity makes its included content available to anyone who receives
            the link or backup file. Avoid including sensitive information in questions, answers,
            messages or pictures. Local Teacher Studio drafts are separate from content you choose
            to share. Where a hosted gift or custom-picture feature is enabled, saving or sharing
            can send that content to the configured gift service.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="ads">
          <h2 className={styles.sectionTitle} id="ads">
            Advertising and service connections
          </h2>
          <p>
            The public puzzle pages do not include an advertising network, advertising pixels or a
            third-party analytics SDK. This does not mean every feature is offline or that no
            information reaches a service provider.
          </p>
          <p>
            Guest library images, fonts and game files are bundled with the site. Optional Google
            sign-in loads Google-hosted code; tutoring calls the configured backend; payments and
            meetings open their providers. Website hosts and service providers receive network
            requests needed to deliver those features. Their handling of those requests is separate
            from browser-only puzzle progress.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="teachers">
          <h2 className={styles.sectionTitle} id="teachers">
            For teachers and school technology staff
          </h2>
          <p>
            A class can use guest puzzle activities without creating tutoring accounts or uploading
            schoolwork. If you want saved learner preparation, assigned practice, paid bookings or
            live meetings, review those additional data paths before using them with students. The{' '}
            <a className={styles.link} href={paths.districts}>
              school technical summary
            </a>{' '}
            lists the review steps and current host information.
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
