import type { PuzzlePicture } from '@content/puzzleLibrary'
import { PhotoCredit } from './PhotoCredit'
import styles from './PhotoCredit.module.css'

/** Photo licensing and generated-art provenance stay distinct, outside selection buttons. */
export function PictureCredit({ picture }: { picture: PuzzlePicture }) {
  if (picture.artworkCredit) {
    return (
      <span className={styles.credit}>
        Original {picture.artworkCredit.generation} artwork · {picture.artworkCredit.creator}
        {picture.artworkCredit.modifications ? ` · ${picture.artworkCredit.modifications}` : null}
      </span>
    )
  }
  return <PhotoCredit credit={picture.photoCredit} />
}
