import { AppShell } from '@components/layout/AppShell'
import { NudgeButton } from '@components/ops/NudgeButton'
import styles from './SystemPage.module.css'

/**
 * Operator console.
 *
 * The web counterpart to the desktop Mission Control launcher, with one
 * deliberate difference: this surface is reachable from any device, so it
 * cannot assume the laptop is awake or that the person pressing it is Samuel.
 * Every action here goes through the edge endpoint, which re-validates, rate
 * limits and de-duplicates before anything reaches Make — the browser never
 * holds a webhook URL.
 *
 * One button on purpose. The plan is to prove a single bounded possession end
 * to end — press, one validated GitHub item, evidence — before adding claims,
 * dashboards or agent control. Everything on this page should be something a
 * stranger pressing it cannot turn into a problem.
 */
export function SystemPage() {
  return (
    <AppShell>
      <section className={styles.page}>
        <header className={styles.header}>
          <h1>Console</h1>
          <p className={styles.tagline}>One button. One bounded possession. Evidence decides.</p>
        </header>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Nudge the council</h2>
          <p className={styles.cardBody}>
            Puts one validated item in the queue. Repeating it inside the same minute is collapsed
            into the first write rather than creating a second.
          </p>
          <NudgeButton reason="Nudge from the website" />
        </div>
      </section>
    </AppShell>
  )
}
