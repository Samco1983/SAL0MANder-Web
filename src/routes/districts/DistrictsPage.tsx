import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './DistrictsPage.module.css'

export function DistrictsPage() {
  return (
    <AppShell>
      <article className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>For school and district technology staff</p>
          <h1 className={styles.title}>{env.appName} technical and data summary</h1>
          <p className={styles.lede}>
            A concise review sheet for a school deciding whether to allow this classroom learning tool.
            It describes the production service as it operates today.
          </p>
          <p className={styles.updated}>Last reviewed September 2, 2026</p>
        </header>

        <section className={styles.section} aria-labelledby="classification">
          <h2 className={styles.sectionTitle} id="classification">Requested classification</h2>
          <p className={styles.callout}><strong>Education / classroom learning</strong></p>
          <p>
            Students answer teacher-provided questions to reveal or assemble a jigsaw picture.
            Current demonstrations cover integer operations, one-step inequalities, and linear equations.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="allowlist">
          <h2 className={styles.sectionTitle} id="allowlist">Domain to review and allow</h2>
          <p className={styles.domain}><code>sal0mander.com</code></p>
          <p>
            The public website and current game files are served over HTTPS from this domain. No browser
            extension, downloaded application, administrator access, camera, or microphone is required.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="students">
          <h2 className={styles.sectionTitle} id="students">Student access and data</h2>
          <ul className={styles.list}>
            <li>No student account, email address, password, or real name is required.</li>
            <li>An optional nickname and random local identifier can be stored on that browser.</li>
            <li>Appearance and panel preferences can also be stored locally.</li>
            <li>No advertising or third-party analytics scripts are present.</li>
            <li>Clearing the browser&apos;s site data removes locally stored values.</li>
          </ul>
          <p>
            See the <a className={styles.link} href={paths.privacy}>privacy page</a> for the complete
            plain-language explanation.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="requirements">
          <h2 className={styles.sectionTitle} id="requirements">Technical requirements</h2>
          <ul className={styles.list}>
            <li>A current Chrome, Edge, Firefox, or Safari browser with JavaScript and WebGL enabled.</li>
            <li>HTTPS access to <code>sal0mander.com</code>.</li>
            <li>Local storage is recommended for preferences and same-device continuity.</li>
            <li>The first game load is large; later loads may benefit from the browser cache.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="accessibility">
          <h2 className={styles.sectionTitle} id="accessibility">Accessibility status</h2>
          <p>
            The public website includes semantic structure, keyboard focus, responsive layouts, reduced-motion
            support, and light/dark appearances. The game includes text-size controls and full screen. Known
            limitations and the reporting route are published on the{' '}
            <a className={styles.link} href={paths.accessibility}>accessibility page</a>.
          </p>
          <p>We do not claim formal WCAG conformance or a completed third-party accessibility audit.</p>
        </section>

        <section className={styles.section} aria-labelledby="contact">
          <h2 className={styles.sectionTitle} id="contact">Review contact</h2>
          <p>
            Privacy, security, accessibility, classification, or allowlist questions:{' '}
            <a className={styles.link} href="mailto:samco1983@gmail.com">samco1983@gmail.com</a>
          </p>
          <p>{env.appName} is built and maintained by a high school math teacher.</p>
        </section>

        <footer className={styles.footer}>
          <LinkButton to={paths.privacy} variant="secondary">Privacy &amp; student data</LinkButton>
          <LinkButton to={paths.accessibility} variant="secondary">Accessibility</LinkButton>
          <LinkButton to={paths.about} variant="secondary">About the project</LinkButton>
        </footer>
      </article>
    </AppShell>
  )
}
