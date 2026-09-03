import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './AccessibilityPage.module.css'

export function AccessibilityPage() {
  return (
    <AppShell>
      <article className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Accessibility</p>
          <h1 className={styles.title}>Making {env.appName} easier for every student to use</h1>
          <p className={styles.lede}>
            Accessibility is ongoing product work, not a badge. This page explains what works now,
            what still needs work, and how to report a barrier.
          </p>
          <p className={styles.updated}>Last reviewed September 2, 2026</p>
        </header>

        <section className={styles.section} aria-labelledby="available-now">
          <h2 className={styles.sectionTitle} id="available-now">Available now</h2>
          <ul className={styles.list}>
            <li>The website uses headings, landmarks, descriptive links, and visible keyboard focus.</li>
            <li>A “Skip to main content” link bypasses repeated navigation.</li>
            <li>Light, dark, and system appearance choices are available.</li>
            <li>The website responds to browser zoom and narrow screens without requiring horizontal reading.</li>
            <li>Reduced-motion preferences limit nonessential website animation.</li>
            <li>The game includes A−, A, and A+ text choices and a full-screen option.</li>
            <li>Students can open shared activities without creating an account or entering a real name.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="known-limitations">
          <h2 className={styles.sectionTitle} id="known-limitations">Known limitations</h2>
          <p>
            The Unity game is visual and pointer-driven. Complete keyboard-only play and full screen-reader
            support for puzzle manipulation have not yet been verified. The game has not completed a formal
            third-party accessibility audit, and we do not claim WCAG conformance.
          </p>
          <p>
            Text reflow, touch target size, drag reliability, and phone-sized layouts are active testing areas.
            If one of those prevents a student from participating, please tell us the device, browser, activity,
            and what the student was trying to do.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="report-barrier">
          <h2 className={styles.sectionTitle} id="report-barrier">Report an accessibility barrier</h2>
          <p>
            Email <a className={styles.link} href="mailto:samco1983@gmail.com">samco1983@gmail.com</a>.
            Messages reach the teacher building and maintaining {env.appName}.
          </p>
          <p className={styles.callout}>
            Include a screenshot if possible, but never include a student&apos;s full name or other personal information.
          </p>
        </section>

        <footer className={styles.footer}>
          <LinkButton to={paths.districts} variant="secondary">District technical summary</LinkButton>
          <LinkButton to={paths.privacy} variant="secondary">Privacy &amp; student data</LinkButton>
        </footer>
      </article>
    </AppShell>
  )
}
