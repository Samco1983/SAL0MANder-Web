import styles from './RouteFallback.module.css'

/**
 * Shown while a split route's chunk downloads.
 *
 * Deliberately quiet — no spinner, no skeleton of a layout that may not match.
 * On a fast connection this is invisible; on classroom wifi it is a couple of
 * seconds, and the only thing that matters is that a student is told something
 * is happening rather than staring at white.
 *
 * `role="status"` rather than `alert`: this is progress, not a problem.
 */
export function RouteFallback() {
  return (
    <div className={styles.fallback} role="status">
      <p className={styles.text}>Loading…</p>
    </div>
  )
}
