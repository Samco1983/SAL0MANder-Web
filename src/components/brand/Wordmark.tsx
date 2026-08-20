import styles from './Wordmark.module.css'

/**
 * The SAL0MANder Studios wordmark.
 *
 * Drawn rather than shipped as a bitmap: sharp at any size, weighs nothing,
 * and — since the name lives in an accessible label — a screen reader
 * announces "SAL0MANder Studios" instead of "image".
 *
 * The `0` is the SAMCO brand mark: a ring running violet at the top to lime at
 * the bottom, wrapped around an angular S monogram on the same gradient. That
 * monogram is what ties SAL0MANder to the parent brand, so it is drawn as the
 * real shape rather than approximated.
 *
 * This is a faithful vector interpretation, not the original artwork. Where the
 * source has bevels, gloss and a bloom, this has flat gradients — those effects
 * belong to a rendered asset. Drop a real SVG or PNG into `public/brand/` and
 * swap `<Mark>` for an `<img>` if the polished version is wanted on the page.
 */
function Mark() {
  return (
    <svg className={styles.mark} viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <defs>
        {/* Violet at the top, lime at the bottom — the brand's vertical split. */}
        <linearGradient id="sal0-brand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-violet-bright)" />
          <stop offset="46%" stopColor="var(--brand-violet)" />
          <stop offset="58%" stopColor="var(--brand-lime)" />
          <stop offset="100%" stopColor="var(--brand-lime-bright)" />
        </linearGradient>
      </defs>

      {/* The ring. Stroked, not filled, so the counter stays open like the O. */}
      <circle cx="32" cy="32" r="27" fill="none" stroke="url(#sal0-brand)" strokeWidth="5" />

      {/*
        The angular S. Two offset bars joined by a diagonal — the corners are
        mitred rather than curved, which is what stops it reading as a plain S.
      */}
      <path
        d="M44 17 H27 a9 9 0 0 0 -9 9 v6 h12 v-3 h8 l-20 20 h17 a9 9 0 0 0 9 -9 v-6 h-12 v3 h-8 l20 -20 z"
        fill="url(#sal0-brand)"
      />
    </svg>
  )
}

export function Wordmark({ showStudios = true }: { showStudios?: boolean }) {
  return (
    <span className={styles.wordmark} role="img" aria-label="SAL0MANder Studios">
      <span aria-hidden="true" className={styles.letters}>
        <span className={styles.sal}>SAL</span>
        <Mark />
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
