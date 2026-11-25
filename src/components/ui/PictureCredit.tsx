import type { PuzzlePicture } from '@content/puzzleLibrary'
import styles from './PictureCredit.module.css'

/**
 * Shown after a puzzle is completed so players see who made or photographed
 * the uncovered artwork without spoiling the picture beforehand.
 */
export function PictureCredit({ picture }: { picture?: PuzzlePicture }) {
  if (!picture) return null

  if (picture.photoCredit) {
    const { author, source, license, licenseUrl } = picture.photoCredit
    return (
      <p className={styles.credit}>
        Picture: <strong>{picture.name}</strong> · Photo:{' '}
        <a href={source} target="_blank" rel="noopener noreferrer">
          {author}
        </a>
        {' · '}
        <a href={licenseUrl} target="_blank" rel="noopener noreferrer">
          {license}
        </a>
      </p>
    )
  }

  return (
    <p className={styles.credit}>
      Picture: <strong>{picture.name}</strong> · Artwork: SAL0MANder Studios
    </p>
  )
}
