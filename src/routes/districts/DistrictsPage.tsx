import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './DistrictsPage.module.css'

/**
 * The page a teacher forwards to their district technology office.
 *
 * That conversation happens whether or not this page exists — a teacher wants
 * to use SAL0MANder, IT asks what it is and what it collects, and without an
 * artifact the teacher has to answer from memory. This is the artifact.
 *
 * ## Written for the person who says no
 *
 * A district technology officer is not the buyer; they are the veto. They are
 * looking for the thing that makes this someone else's problem — an unexplained
 * third-party domain, student data with no retention story, a vague privacy
 * page, a vendor who cannot name what they store.
 *
 * So this page leads with the allowlist, states the storage inventory
 * exhaustively, and answers the questions in the order they get asked rather
 * than the order that flatters the product.
 *
 * ## Every fact here was measured, not asserted
 *
 *   - one domain — the production bundle contacts no external host. The
 *     `api.github.com` and Cloudflare Access references in the repository exist
 *     only inside `missionControlWorker.test.ts`, an internal ops test, and
 *     never ship.
 *   - four storage keys — the complete set as of this writing, from the
 *     constants in `src/auth/guestIdentity.ts`, `ThemeProvider`, and
 *     `CompanionLayout`.
 *   - no accounts — `guestIdentity.ts`, and CLAUDE.md non-negotiable 3.
 *
 * ## What it must never do
 *
 * Claim COPPA, FERPA, WCAG, or standards compliance. A district checks those
 * first, and an unsupported claim on the page written to earn their trust is
 * worse than no page. What it can do — and does — is state the facts precisely
 * enough that a reviewer can draw their own conclusion.
 *
 * It also sells nothing: `TPT-RULES.md` records that a page reachable from a
 * TPT resource must not advertise anything for sale, and this one is linked
 * from the footer of every page.
 */
export function DistrictsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>For district technology staff</p>
          <h1 className={styles.title}>{env.appName} technical and data summary</h1>
          <p className={styles.lede}>
            Written for the person deciding whether this may run on a school network. Everything
            below describes what the software does today. If you need something this page does not
            answer, the contact address at the bottom reaches a person.
          </p>
        </header>

        {/*
          First, because it is the question that actually gets asked, and a
          reviewer who has to hunt for it assumes the answer is complicated.
        */}
        <section className={styles.section} aria-labelledby="allowlist">
          <h2 className={styles.sectionTitle} id="allowlist">
            Domains to allow
          </h2>
          <p className={styles.callout}>
            <code className={styles.code}>sal0mander.com</code>
          </p>
          <p>
            That is the complete list. The website, the activity, and every image, script and asset
            are served from this one domain over HTTPS. There is no content delivery network, no
            font service, no analytics endpoint, and no third-party host of any kind.
          </p>
          <p>
            A browser loading an activity makes requests to this domain and nowhere else. If your
            filter reports otherwise, we would genuinely like to know — write to the address below.
          </p>
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
            Four values, in the browser&apos;s local storage on the student&apos;s own device. This
            is the complete inventory as of this writing:
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
              </tbody>
            </table>
          </div>
          <p>
            Clearing site data in the browser removes all of it. There is no server-side student
            record to request the deletion of, because none is created.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="ads">
          <h2 className={styles.sectionTitle} id="ads">
            Advertising, analytics and tracking
          </h2>
          <p>
            None of the three. No advertising network, no analytics service, no tracking pixel, and
            no third-party script is loaded on any page. Nothing about a student is transmitted to
            another company, because no other company is involved.
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
            Accessibility
          </h2>
          <p>
            The website is built with semantic HTML and landmarks, is operable by keyboard, and its
            text and interface colours are checked against WCAG AA contrast ratios in both light and
            dark appearance.
          </p>
          <p>
            The activity itself has not yet been through a formal accessibility audit, and no
            conformance report exists. We would rather say that plainly than claim a standard we
            have not verified. If your district requires a completed accessibility report before
            approval, write to us and we will tell you honestly where that work stands.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="contact">
          <h2 className={styles.sectionTitle} id="contact">
            Who to contact
          </h2>
          <p>
            Questions about data, privacy, security, or adding the domain to an allow list:{' '}
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
          <LinkButton to={paths.about} variant="secondary">
            About
          </LinkButton>
        </footer>
      </div>
    </AppShell>
  )
}
