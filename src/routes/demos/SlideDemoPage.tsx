import { useEffect, useRef, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { PictureCredit } from '@components/ui/PictureCredit'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { paths } from '@config/routes'
import { newId } from '@contracts/v1'
import { UnityStage } from '@unity/UnityStage'
import { prepareSlide, type SlideBoot } from '@unity/slideBridge'
import styles from './ModeDemos.module.css'
import { SlideLearningOffer } from './SlideLearningOffer'

const picture = PUZZLE_LIBRARY.find((entry) => entry.key === 'fictional-neon-tuner-v1')!

/** Hosts the native eight-level swapping game; the historical route and wire remain compatible. */
export function SlideDemoPage() {
  const [boot, setBoot] = useState<SlideBoot | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  async function start() {
    if (pending.current && !pending.current.signal.aborted) return
    const controller = new AbortController()
    pending.current = controller
    setPreparing(true)
    setError('')
    try {
      const prepared = await prepareSlide(picture.key, `demo_${newId()}`, controller.signal)
      if (!controller.signal.aborted) setBoot(prepared)
    } catch {
      if (!controller.signal.aborted) setError('The demo picture could not load. Please try again.')
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setPreparing(false)
      }
    }
  }

  if (boot) {
    return (
      <AppShell fill contained={false}>
        <div className={styles.player}>
          <UnityStage
            audience="student"
            slide={boot}
            controls={
              <div className={styles.controls}>
                <span>Swap &amp; Solve · 8 levels</span>
                <LinkButton to={paths.guestPlayIndex} variant="secondary" size="sm">
                  All demos
                </LinkButton>
                <SlideLearningOffer key={boot.requestId} requestId={boot.requestId} />
              </div>
            }
          />
        </div>
      </AppShell>
    )
  }
  return (
    <AppShell>
      <section className={styles.intro} aria-labelledby="slide-demo-title">
        <p>Try a little puzzle adventure</p>
        <h1 id="slide-demo-title">Swap &amp; Solve demo</h1>
        <p>
          Tap any two squares to swap them. Move picture pieces into blank spaces or exchange two
          pieces. Join the picture anywhere it fits.
        </p>
        <p>
          Start one swap away with plenty of blank spaces. Later levels have fewer blanks, then full
          3×3 and 4×4 pictures. New levels bring different pictures and music; Replay keeps your
          current challenge. No questions or sign-in.
        </p>
        <img
          className={styles.picture}
          src={picture.src}
          alt={picture.alt}
          width={picture.width}
          height={picture.height}
        />
        <p>A taste of the picture collection. Each new level reveals another surprise.</p>
        <PictureCredit picture={picture} />
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button onClick={() => void start()} disabled={preparing} aria-busy={preparing}>
            {preparing ? 'Preparing your picture…' : error ? 'Try again' : 'Start easy level'}
          </Button>
          <LinkButton to={paths.guestPlayIndex} variant="secondary">
            All demos
          </LinkButton>
        </div>
      </section>
    </AppShell>
  )
}
