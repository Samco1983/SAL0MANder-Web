import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './DistrictsPage.module.css'

/** School review facts, combining the public trust pages with current local authoring. */
export function DistrictsPage() {
  return (
    <AppShell>
      <article className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>For school and district technology staff</p>
          <h1 className={styles.title}>{env.appName} technical and data summary</h1>
          <p className={styles.lede}>
            Written for the person deciding whether this may run on a school network. Everything
            below describes what the software does today. If you need something this page does not
            answer, the contact address at the bottom reaches a person.
          </p>
          <p className={styles.updated}>Last reviewed September 15, 2026</p>
        </header>

        <section className={styles.section} aria-labelledby="classification">
          <h2 className={styles.sectionTitle} id="classification">
            Requested classification
          </h2>
          <p className={styles.callout}>
            <strong>Education / classroom learning</strong>
          </p>
          <p>
            Students answer teacher-provided questions to reveal or assemble a jigsaw picture.
            Current demonstrations cover integer operations, one-step inequalities, and linear
            equations.
          </p>
          <p>
            The site also offers question-free Classic and Swap &amp; Solve puzzles and personalised
            puzzle gifts. These recreational modes are distinct from teacher-authored question
            practice; not every puzzle measures academic learning.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="allowlist">
          <h2 className={styles.sectionTitle} id="allowlist">
            Guest puzzle play: domains to review
          </h2>
          <p className={styles.callout}>
            <code className={styles.code}>sal0mander.com</code>
            <code className={styles.code}>www.sal0mander.com</code>
          </p>
          {/*
            Both hosts, deliberately. A filter matches on hostname, so allowing
            the apex alone leaves www blocked — which is the exact block a
            district reported: "www.sal0mander.com is not available because it
            is categorized as Unknown." Naming one host here would send an
            administrator to do half the job and believe it was finished.
          */}
          <p>
            For guest puzzle play on these hosts, the website and current game files use HTTPS. No
            browser extension, installed application, administrator access, camera, or microphone is
            required for the puzzle. Library images, fonts, and game assets are bundled with the
            site. Optional tutoring, sign-in, payments and live meetings use additional services
            described below.
          </p>
          <p>
            If your filter categorises by reputation rather than by allowlist, the category to
            request is <strong>Education</strong>. Some school filters have reported the domain as
            unknown or uncategorised. Your district or filtering provider decides whether to approve
            or recategorise it.
          </p>
          <p>If a filter blocks an activity, the contact address below can help with the review.</p>
        </section>

        <section className={styles.section} aria-labelledby="accounts">
          <h2 className={styles.sectionTitle} id="accounts">
            Guest play and optional accounts
          </h2>
          <p>
            Guest puzzle play does not require an account. Students can open a teacher&apos;s
            activity link and play without providing a real name, email address or password.
            Optional tutoring features have a separate parent, adult learner or tutor sign-in; those
            features are not required to play a guest activity.
          </p>
          <p>
            A student may optionally choose a nickname as a display label. It is not a verified
            identity or a separate account. Teachers are asked to use nicknames rather than real
            names.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="stored">
          <h2 className={styles.sectionTitle} id="stored">
            What is stored, and where
          </h2>
          <p>
            Guest preferences, local puzzle progress and local Teacher Studio drafts use browser
            storage on the device where they were entered. This is separate from saved tutoring
            records. The website keys include:
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Contents</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code className={styles.code}>sal0mander.guest.token</code>
                  </td>
                  <td>
                    A random guest session identifier generated on the device. A configured
                    play-session backend can receive it with activity and attempt information; it is
                    not a verified account identity.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code className={styles.code}>sal0mander.guest.displayName</code>
                  </td>
                  <td>An optional self-chosen nickname. Absent unless a student types one.</td>
                </tr>
                <tr>
                  <td>
                    <code className={styles.code}>sal0mander.theme</code>
                  </td>
                  <td>Light or dark appearance preference.</td>
                </tr>
                <tr>
                  <td>
                    <code className={styles.code}>sal0mander.companion.collapsed</code>
                  </td>
                  <td>Whether the side panel is open or closed.</td>
                </tr>
                <tr>
                  <td>
                    <code className={styles.code}>sal0mander.studio.drafts</code>
                  </td>
                  <td>
                    Activities a teacher creates in Teacher Studio, including their questions and
                    settings.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The game can also keep local progress in browser storage. Teacher Studio previews use
            temporary progress. Downloaded activity backups are files the teacher saves separately;
            clearing site data does not remove those files.
          </p>
          <p>
            Clearing the browser&apos;s site data removes locally stored values and drafts; it does
            not delete tutoring account records, payments or uploaded schoolwork. See the{' '}
            <a className={styles.link} href={paths.privacy}>
              privacy page
            </a>{' '}
            for the plain-language explanation.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="optional-services">
          <h2 className={styles.sectionTitle} id="optional-services">
            Optional tutoring and external services
          </h2>
          <p>
            Tutoring can use Google sign-in through Firebase Authentication, a SAL0MANder backend
            hosted on Google Cloud, and Stripe checkout. The backend stores account and learner
            identifiers, bookings, payment status and assigned practice. Optional lesson background
            and uploaded schoolwork are available to the account owner and authorised tutors. These
            are not device-only records.
          </p>
          <p>
            Live video, audio and lesson chat open in Google Meet or Zoom. The tutor selects the
            meeting provider and manages admission. These services have their own privacy settings
            and network requirements; cameras and microphones may be requested in the meeting.
            SAL0MANder does not record the call or save its live chat in this website.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="it-review">
          <h2 className={styles.sectionTitle} id="it-review">
            Practical school IT review
          </h2>
          <ol className={styles.list}>
            <li>
              Start with the exact activity URL and test guest play on a managed student device.
              Review the two puzzle hosts above individually, including the www redirect.
            </li>
            <li>
              Check JavaScript, WebAssembly and WebGL, hardware acceleration, and HTTPS downloads
              under the site&apos;s /unity path. Test the first download and a repeat visit on the
              school network. A successful website load alone does not verify the game.
            </li>
            <li>
              Review optional tutoring separately. Its current TEST deployment uses{' '}
              <code className={styles.code}>sal0mander-math.firebaseapp.com</code>, with the booking
              API at{' '}
              <code className={styles.code}>sal0-tutoring-715251110700.us-west1.run.app</code>.
              Google sign-in loads its SDK from <code className={styles.code}>www.gstatic.com</code>{' '}
              and uses <code className={styles.code}>accounts.google.com</code>; checkout opens{' '}
              <code className={styles.code}>checkout.stripe.com</code>. These are starting points
              for a feature-specific network review, not a complete provider allowlist.
            </li>
            <li>
              If a lesson needs Calendar, Meet or Zoom, review the exact booking or meeting URL
              separately and use that provider&apos;s current network guidance. Request only the
              additional hosts that the chosen feature requires. Do not allow all Firebase, Google
              or Cloud Run domains with a wildcard just for SAL0MANder.
            </li>
          </ol>
          <p>
            Experimental preview links are temporary test deployments. Review each exact preview
            hostname separately; approval of the public site does not automatically cover a preview.
            A page marked TEST may simulate bookings or payments and is not confirmation of a paid
            lesson. School approval and filter classification remain decisions for your district.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="ads">
          <h2 className={styles.sectionTitle} id="ads">
            Advertising, analytics and tracking
          </h2>
          <p>
            No advertising network, third-party analytics service, or tracking pixel is included in
            the public classroom pages.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="requirements">
          <h2 className={styles.sectionTitle} id="requirements">
            Technical requirements
          </h2>
          <ul className={styles.list}>
            <li>
              A current browser with WebGL and WebAssembly available. Test the actual managed
              Chromebook, Windows, macOS, iPad or phone configuration before classroom use.
            </li>
            <li>
              JavaScript enabled, and WebGL available — the activity renders in the browser and
              needs hardware-accelerated graphics.
            </li>
            <li>
              HTTPS access to <code className={styles.code}>sal0mander.com</code>.
            </li>
            <li>
              Browser storage permitted if local progress, nicknames or teacher drafts need to
              persist. Clearing or restricting storage can remove that continuity.
            </li>
            <li>
              Nothing to install. No extension, no plugin, no application, and no administrator
              rights required.
            </li>
          </ul>
          <p>
            The activity is a substantial download the first time a student opens it, so a class
            starting simultaneously on a slow connection will take a moment. It is cached by the
            browser afterwards.
          </p>
        </section>

        {/*
          Stated rather than claimed. A district asks about accessibility and
          the honest answer today is "partly tested, not audited" — which is a
          better answer than a conformance claim nothing here establishes.
        */}
        <section className={styles.section} aria-labelledby="accessibility">
          <h2 className={styles.sectionTitle} id="accessibility">
            Accessibility status
          </h2>
          <p>
            The public website includes semantic structure, keyboard focus, responsive layouts,
            reduced-motion support, and light/dark appearances. The game includes text-size controls
            and full screen. Known limitations and the reporting route are published on the{' '}
            <a className={styles.link} href={paths.accessibility}>
              accessibility page
            </a>
            .
          </p>
          <p>
            We do not claim formal WCAG conformance or a completed third-party accessibility audit.
            If your district requires a completed accessibility report before approval, write to us.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="contact">
          <h2 className={styles.sectionTitle} id="contact">
            Who to contact
          </h2>
          <p>
            Questions about data, privacy, security, accessibility, classification, or adding the
            domain to an allow list:{' '}
            <a className={styles.link} href="mailto:samco1983@gmail.com">
              samco1983@gmail.com
            </a>
          </p>
          <p>
            {env.appName} is built and maintained by a practising high school teacher. Messages from
            district technology staff are answered by that person, not a support queue.
          </p>
        </section>

        <footer className={styles.footer}>
          <LinkButton to={paths.privacy} variant="secondary">
            Privacy &amp; student data
          </LinkButton>
          <LinkButton to={paths.terms} variant="secondary">
            Terms of use
          </LinkButton>
          <LinkButton to={paths.accessibility} variant="secondary">
            Accessibility
          </LinkButton>
          <LinkButton to={paths.about} variant="secondary">
            About
          </LinkButton>
        </footer>
      </article>
    </AppShell>
  )
}
