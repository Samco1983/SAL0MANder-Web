import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './TermsPage.module.css'

/**
 * Terms of use.
 *
 * One of the five pages a web filter's reviewer looks for, and the one most
 * likely to be written badly — either as boilerplate nobody read, or as a wall
 * of clauses that makes a small classroom tool look like it has something to
 * hide.
 *
 * ## Two constraints shaped this
 *
 * **It must not sell anything.** `docs/coordination/TPT-RULES.md` records TPT's
 * own rule, read from their help centre: "TPT should not be used as a way to
 * drive traffic to another website or business," and the practical line drawn
 * there is that the page a scanned QR lands on must not sell anything or
 * advertise anything for sale. So there is no pricing, no store link, and no
 * marketplace mention anywhere on this page. A Terms page that advertises is
 * the specific thing that could get a TPT listing deactivated.
 *
 * **It must not claim compliance.** No COPPA, FERPA, WCAG, or standards
 * assertion appears, for the same reason as on the privacy page: nothing in
 * this repository establishes one, and an unsupported claim is the first thing
 * a district checks.
 *
 * ## What it does say
 *
 * Plain permission to use this in a classroom, an honest statement about
 * availability rather than an invented uptime promise, and a short list of what
 * is not allowed. Written to be read by a teacher, not to be survived by one.
 *
 * Not legal advice, and not reviewed by a lawyer. When the product starts
 * taking money, this page should be replaced by something that has been.
 */
export function TermsPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Terms of use</p>
          <h1 className={styles.title}>Using {env.appName}</h1>
          <p className={styles.lede}>
            Short version: use it with your classes, share the link freely, and don&apos;t resell it
            or take it apart. The rest of this page is the same thing said carefully.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="what">
          <h2 className={styles.sectionTitle} id="what">
            What this is
          </h2>
          <p>
            {env.appName} is a classroom practice activity. Students answer questions to uncover a
            jigsaw puzzle. Teachers choose the subject and the questions, then share an activity
            link with a class.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="may">
          <h2 className={styles.sectionTitle} id="may">
            What you may do
          </h2>
          <ul className={styles.list}>
            <li>Use {env.appName} with your own students, in class or as assigned work.</li>
            <li>
              Share an activity link with your students, through a learning management system, a
              printed handout, a QR code, or however else you reach them.
            </li>
            <li>Display it on a projector or shared screen.</li>
            <li>
              Show it to colleagues, an administrator, or your district technology staff who are
              evaluating whether to allow it.
            </li>
          </ul>
          <p>No permission needs to be requested for any of that.</p>
        </section>

        <section className={styles.section} aria-labelledby="maynot">
          <h2 className={styles.sectionTitle} id="maynot">
            What you may not do
          </h2>
          <ul className={styles.list}>
            <li>Resell {env.appName}, or present it as your own work.</li>
            <li>
              Copy the activities, artwork, or questions out of it to publish or distribute
              separately.
            </li>
            <li>
              Attempt to break, overload, or gain unauthorised access to the software or the
              computers it runs on.
            </li>
            <li>
              Use it in a way that would put a student at risk, or collect information about
              students through it.
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="students">
          <h2 className={styles.sectionTitle} id="students">
            Students and accounts
          </h2>
          <p>
            Students never create an account to play, and are never asked for a real name, an email
            address, or a password. A player may pick a nickname so a shared device can keep more
            than one person&apos;s progress apart.
          </p>
          <p>
            What information exists and where it is kept is set out on the{' '}
            <a className={styles.link} href={paths.privacy}>
              privacy page
            </a>
            .
          </p>
        </section>

        {/*
          An honest availability statement rather than an invented uptime
          figure. TPT's rules make this load-bearing: they state that if a linked
          resource stops working, "we may have to issue a refund to Buyers and
          deactivate your product." Promising a number this project cannot yet
          measure would be worse than promising nothing — and this repository has
          already shipped a blank site past a green pipeline for three days.
        */}
        <section className={styles.section} aria-labelledby="availability">
          <h2 className={styles.sectionTitle} id="availability">
            Availability
          </h2>
          <p>
            We intend {env.appName} to be available whenever a class needs it, and we treat an
            outage during a school day as a serious problem. We do not promise a specific uptime
            figure, and there may be interruptions for maintenance or for reasons outside our
            control.
          </p>
          <p>
            If an activity will not load when you need it, tell us at{' '}
            <a className={styles.link} href="mailto:support@sal0mander.com">
              support@sal0mander.com
            </a>{' '}
            — that is the fastest way for it to get fixed.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="ownership">
          <h2 className={styles.sectionTitle} id="ownership">
            Who owns what
          </h2>
          <p>
            {env.appName}, its activities, artwork, and software belong to their author. Using the
            activities with your class does not transfer any of that, and nothing here gives anyone
            permission to republish them.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="warranty">
          <h2 className={styles.sectionTitle} id="warranty">
            No warranty
          </h2>
          <p>
            {env.appName} is provided as it is. We do not guarantee it is free of errors, and we are
            not responsible for loss or damage arising from using it. Nothing here limits any right
            you have that cannot be limited by law.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="changes">
          <h2 className={styles.sectionTitle} id="changes">
            Changes to this page
          </h2>
          <p>
            These terms may change as {env.appName} develops. If something changes in a way that
            affects how a class may use it, we will say so on this page rather than quietly.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="contact">
          <h2 className={styles.sectionTitle} id="contact">
            Questions
          </h2>
          <p>
            Teachers and general questions:{' '}
            <a className={styles.link} href="mailto:support@sal0mander.com">
              support@sal0mander.com
            </a>
          </p>
          <p>
            Privacy, student data, and district technology staff:{' '}
            <a className={styles.link} href="mailto:privacy@sal0mander.com">
              privacy@sal0mander.com
            </a>
          </p>
        </section>

        <footer className={styles.footer}>
          <LinkButton to={paths.privacy} variant="secondary">
            Privacy &amp; student data
          </LinkButton>
          <LinkButton to={paths.home} variant="secondary">
            Back to home
          </LinkButton>
        </footer>
      </div>
    </AppShell>
  )
}
