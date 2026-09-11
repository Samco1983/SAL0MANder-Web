import type { PuzzlePicture } from '@content/puzzleLibrary'
import styles from './PhotoCredit.module.css'

/** Credit links are outside picture-selection buttons so both remain keyboard accessible. */
export function PhotoCredit({ credit }: { credit?: PuzzlePicture['photoCredit'] }) {
  if (!credit) return null
  return (
    <span className={styles.credit}>
      Photo:{' '}
      <a href={credit.source} target="_blank" rel="noopener noreferrer">
        {credit.author}
      </a>
      {' · '}
      <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
        {credit.license}
      </a>
    </span>
  )
}
