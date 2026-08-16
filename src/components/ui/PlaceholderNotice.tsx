import type { ReactNode } from 'react'
import styles from './PlaceholderNotice.module.css'

/**
 * Marks a surface that intentionally has no final UX yet.
 *
 * Foundation routes exist so the shape of the app is real and navigable, but
 * their content is pending Product/Gameplay Discovery. This component makes
 * "not designed yet" visually explicit so a placeholder is never mistaken for
 * a finished screen during review.
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
