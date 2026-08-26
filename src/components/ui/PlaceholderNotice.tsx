import type { ReactNode } from 'react'
import { env } from '@config/env'
import styles from './PlaceholderNotice.module.css'

/**
 * Marks a surface that intentionally has no final UX yet.
 *
 * Foundation routes exist so the shape of the app is real and navigable, but
 * their content is pending Product/Gameplay Discovery. This component makes
 * "not designed yet" visually explicit so a placeholder is never mistaken for
 * a finished screen during review.
 *
 * Renders nothing in production, for the same reason AppShell hides its
 * foundation banner there: the audience changed. "During review" is the whole
 * point of this component, and a teacher who scans a QR code off a printed
 * worksheet is not reviewing anything — they are deciding in about four seconds
 * whether this is worth their class time. A box listing what has not been built
 * yet answers that question badly, and answers it about a panel the student
 * does not need in order to play.
 *
 * The panel it usually occupies is optional by design: CompanionLayout keeps the
 * Unity stage's space when the companion is empty, collapsed, or failed, so
 * returning null here degrades into the layout's existing empty case rather than
 * leaving a hole. Below 60rem the companion is a bottom sheet, so on a phone
 * this reclaims screen the puzzle can use.
 *
 * Reviewers lose nothing: every non-production build — dev, preview, and the
 * test suite — still renders the notice in full.
 */
export function PlaceholderNotice({
  label = 'Placeholder',
  title,
  children,
  pending,
}: {
  label?: string
  title: string
  children?: ReactNode
  /** Work explicitly deferred until product/UX approval. */
  pending?: string[]
}) {
  if (env.isProd) return null

  return (
    <div className={styles.notice}>
      <span className={styles.label}>{label}</span>
      <h2 className={styles.title}>{title}</h2>
      {children ? <div className={styles.body}>{children}</div> : null}
      {pending?.length ? (
        <ul className={styles.list}>
          {pending.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
