import styles from './Wordmark.module.css'

/**
 * The SAL0MANder Studios wordmark.
 *
 * Drawn rather than shipped as an image: it stays sharp at any size, weighs
 * nothing, recolours with the theme, and — since the letterforms are real text
 * inside an accessible label — a screen reader reads the company name instead
 * of announcing "image".
 *
 * The `0` is the brand mark: a green ring around a dark core with a violet
 * centre. Those two hues, violet and green, are the palette the whole light
 * theme is built from.
 */
export function Wordmark({ showStudios = true }: { showStudios?: boolean }) {
  return (
    <span className={styles.wordmark} role="img" aria-label="SAL0MANder Studios">
      <span aria-hidden="true" className={styles.letters}>
        <span className={styles.sal}>SAL</span>
        <svg className={styles.mark} viewBox="0 0 32 32" focusable="false">
          {/* Green ring, dark core, violet centre — the mark in the logo. */}
          <circle cx="16" cy="16" r="14" className={styles.markRing} />
          <circle cx="16" cy="16" r="9.5" className={styles.markCore} />
          <rect x="12" y="12" width="8" height="8" rx="1.5" className={styles.markCentre} />
        </svg>
        <span className={styles.man}>MAN</span>
        <span className={styles.der}>der</span>
      </span>
      {showStudios ? (
        <span aria-hidden="true" className={styles.studios}>
          Studios
        </span>
      ) : null}
    </span>
  )
}
