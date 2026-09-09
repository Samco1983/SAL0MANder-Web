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
          <p className={styles.updated}>Last reviewed September 8, 2026</p>
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
        </section>

        <section className={styles.section} aria-labelledby="allowlist">
          <h2 className={styles.sectionTitle} id="allowlist">
            Domains to allow
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
            The public website and current game files are served over HTTPS from this site. No
            browser extension, downloaded application, administrator access, camera, or microphone
            is required. Images, fonts, and game assets are bundled with the site.
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
            Student accounts
          </h2>
          <p>
            There are none. Students do not register, do not sign in, and are never asked for a
            name, an email address, or a password at any point between opening a teacher&apos;s link
            and playing.
          </p>
          <p>
            A student may optionally choose a nickname so that a shared classroom device can keep
            more than one person&apos;s progress apart. Teachers are asked to have their class use
            nicknames rather than real names, and nothing verifies or checks the value.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="stored">
          <h2 className={styles.sectionTitle} id="stored">
            What is stored, and where
          </h2>
          <p>
            Website preferences and teacher drafts stay in the browser&apos;s local storage on the
            device where they were entered. The website keys include:
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
                    A random string generated on the device, so a session can be resumed. Not a
                    login, contains no personal information, and grants access to nothing.
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
            Clearing the browser&apos;s site data removes locally stored values and drafts. See the{' '}
            <a className={styles.link} href={paths.privacy}>
              privacy page
            </a>{' '}
            for the plain-language explanation.
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
              A current version of Chrome, Edge, Firefox, or Safari. ChromeOS and managed
              Chromebooks are supported.
            </li>
            <li>
              JavaScript enabled, and WebGL available — the activity renders in the browser and
              needs hardware-accelerated graphics.
            </li>
            <li>
              HTTPS access to <code className={styles.code}>sal0mander.com</code>.
            </li>
            <li>
              Local storage permitted. If it is blocked, activities still run; the student simply
              cannot resume or keep a nickname.
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
