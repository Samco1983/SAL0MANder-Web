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
 * ## It renders nothing in production, and that is the whole point
 *
 * This is review scaffolding. In production there is no reviewer — there is a
 * teacher deciding in about four seconds whether this is a real product, and a
 * student who followed their teacher's link.
 *
 * Both were being shown it. `/profile` is in the production navigation and
 * opened onto a grey box headed "Accounts are not enabled" over a six-item list
 * of things that do not exist yet; Guest Play's companion panel offered a
 * student "Player profile, badges, credits — pending". Nothing was broken and
 * nothing failed: the site simply told everyone who arrived that it was
 * unfinished, in a component built to say exactly that.
 *
 * `deploy.yml` already believed this was handled — its comment lists "every
 * <PlaceholderNotice> listing what is not built yet" among the things gated on
 * `env.isProd`. The banner and the env badge were gated. This never was. The
 * comment described the intent and the code did not implement it, which is why
 * this guard lives in the component rather than at each of the three call
 * sites: a fourth caller would otherwise reintroduce the leak silently.
 *
 * Gated on `isProd` rather than removed, because the review value is real
 * everywhere else — local, preview and CI still show it.
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
