import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PuzzlePicture } from '@content/puzzleLibrary'
import { giftPictureSrc } from '@/gifts/giftPicture'
import { Button, LinkButton } from '@components/ui/Button'
import { PictureCredit } from '@components/ui/PictureCredit'
import { LearningOffers } from '@components/learning/LearningOffers'
import { giftComposerLink } from '@/gifts/giftComposer'
import type { GiftMode } from '@/gifts/giftLink'
import { onPreviewMessage } from '@unity/previewBridge'
import { onSlideMessage } from '@unity/slideBridge'
import { onPreviewAttemptMessage } from '@unity/previewAttemptBridge'
import { giftGreeting, type GiftPresentation } from '@/gifts/giftPresentation'
import styles from './GiftCelebration.module.css'

/** Mount with a requestId key: replay receives a fresh latch without restarting Unity. */
export function GiftCelebration({
  requestId,
  presentation,
  channel = 'preview',
  picture,
  onComplete,
  onReset,
  onPictureVisible,
  mode = 'mystery',
  onReplay,
  onClose,
  replaying = false,
  replayError = '',
  collapsed = false,
  onReturnToPuzzle,
}: {
  requestId: string
  presentation: GiftPresentation
  channel?: 'preview' | 'slide' | 'preview-attempt'
  picture?: PuzzlePicture
  onComplete?: (effect: GiftPresentation['celebration']) => void
  onReset?: () => void
  onPictureVisible?: (pictureKey: string) => void
  mode?: GiftMode
  onReplay?: () => void
  onClose?: () => void
  replaying?: boolean
  replayError?: string
  collapsed?: boolean
  onReturnToPuzzle?: () => void
}) {
  const [finished, setFinished] = useState(false)
  const [viewingPicture, setViewingPicture] = useState(false)
  const [moving, setMoving] = useState(false)
  const rewardToken = useRef(0)
  const pictureReported = useRef(false)
  const latest = useRef({
    presentation,
    onComplete,
    onReset,
    onPictureVisible,
  })
  latest.current = { presentation, onComplete, onReset, onPictureVisible }
  useEffect(() => {
    let latched = false
    let attempt = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const invalidatePicture = () => {
      // Late image-load events belong to the old reward, including after unmount.
      rewardToken.current++
      pictureReported.current = false
      setViewingPicture(false)
    }
    const complete = () => {
      if (latched || cancelled) return
      latched = true
      invalidatePicture()
      setFinished(true)
      latest.current.onComplete?.(latest.current.presentation.celebration)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMoving(true)
        timer = setTimeout(() => setMoving(false), 3500)
      }
    }
    const restart = (nextAttempt: number) => {
      if (cancelled || nextAttempt <= attempt) return
      attempt = nextAttempt
      invalidatePicture()
      latest.current.onReset?.()
      latched = false
      clearTimeout(timer)
      setFinished(false)
      setMoving(false)
    }
    const cancel = () => {
      cancelled = true
      invalidatePicture()
      latest.current.onReset?.()
      clearTimeout(timer)
      setFinished(false)
      setMoving(false)
    }
    const stop =
      channel === 'slide'
        ? onSlideMessage((message) => {
            if (message.requestId !== requestId || cancelled) return
            if (message.type === 'slide-ready' && message.attempt > attempt) {
              restart(message.attempt)
            } else if (
              message.type === 'slide-finished' &&
              message.attempt === attempt &&
              attempt > 0
            )
              complete()
            else if (message.type === 'slide-cancelled' || message.type === 'slide-error') {
              cancel()
            }
          })
        : channel === 'preview-attempt'
          ? onPreviewAttemptMessage((message) => {
              if (message.requestId !== requestId || cancelled) return
              if (message.type === 'preview-attempt-ready') restart(message.attempt)
              else if (
                message.type === 'preview-attempt-finished' &&
                attempt > 0 &&
                message.attempt === attempt
              )
                complete()
            })
          : onPreviewMessage((message) => {
              if (message.type === 'preview-finished' && message.requestId === requestId) complete()
              else if (message.type === 'preview-error' && message.requestId === requestId) cancel()
            })
    const stopErrors =
      channel === 'preview-attempt'
        ? onPreviewMessage((message) => {
            if (message.requestId === requestId && message.type === 'preview-error') cancel()
          })
        : undefined
    return () => {
      cancelled = true
      invalidatePicture()
      latest.current.onReset?.()
      stop()
      stopErrors?.()
      clearTimeout(timer)
    }
  }, [requestId, channel])
  if (!finished || collapsed) return null
  const displayedToken = rewardToken.current
  const message = giftGreeting(presentation)
  const decoration =
    presentation.celebration === 'hearts'
      ? '♥'
      : presentation.celebration === 'balloons'
        ? '●'
        : '✦'
  return (
    <section className={styles.celebration} aria-label="Gift complete">
      <div
        className={styles.effects}
        aria-hidden="true"
        data-effect={presentation.celebration}
        data-moving={moving}
      >
        {Array.from({ length: 15 }, (_, index) => (
          <span
            key={index}
            style={
              {
                '--burst-x': `${((index % 5) - 2) * 18}vw`,
                '--burst-y': `${-18 - Math.floor(index / 5) * 18}vh`,
                '--twist': `${(index % 2 ? -1 : 1) * (12 + index * 9)}deg`,
                '--delay': `${(index % 3) * 75}ms`,
                '--rest-x': `${5 + index * 6}%`,
              } as CSSProperties
            }
          >
            {decoration}
          </span>
        ))}
      </div>
      {picture && (
        <img
          className={styles.picture}
          src={`${giftPictureSrc(picture)}`}
          alt={picture.alt}
          onLoad={() => {
            if (displayedToken !== rewardToken.current || pictureReported.current) return
            pictureReported.current = true
            latest.current.onPictureVisible?.(picture.key)
          }}
        />
      )}
      <div className={styles.message}>
        <p role="status">
          <strong>Puzzle complete!</strong> {message}
        </p>
        {picture && <p className={styles.pictureName}>{picture.name} · Your picture to enjoy</p>}
        <p className={styles.invitation}>Your turn to make someone smile.</p>
        <div className={styles.actions}>
          {channel === 'slide' && onReturnToPuzzle && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // Keep this attempt latched; returning only frees the canvas area.
                rewardToken.current++
                setViewingPicture(false)
                setMoving(false)
                onReturnToPuzzle()
              }}
            >
              Return to puzzle
            </Button>
          )}
          <LinkButton to={giftComposerLink(picture?.key, mode)} size="sm">
            Make a gift for someone
          </LinkButton>
          {picture && (
            <Button variant="secondary" size="sm" onClick={() => setViewingPicture(true)}>
              View picture
            </Button>
          )}
          {onReplay && (
            <Button variant="secondary" size="sm" disabled={replaying} onClick={onReplay}>
              {replaying ? 'Starting again…' : 'Play again'}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        {picture && <PictureCredit picture={picture} />}
        {replayError && <p role="alert">{replayError}</p>}
        <LearningOffers compact />
      </div>
      {viewingPicture && picture && (
        <GiftPictureViewer picture={picture} onClose={() => setViewingPicture(false)} />
      )}
    </section>
  )
}

/** A native dialog keeps the full photo above fullscreen and returns focus on dismissal. */
function GiftPictureViewer({ picture, onClose }: { picture: PuzzlePicture; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      className={styles.pictureViewer}
      aria-label="Your completed picture"
      onClose={(event) => {
        // StrictMode may queue a cleanup close event before the dialog is reopened.
        if (!event.currentTarget.open) onClose()
      }}
    >
      <header className={styles.viewerHeader}>
        <h2>{picture.name}</h2>
        <Button variant="secondary" onClick={() => dialog.current?.close()}>
          Back to celebration
        </Button>
      </header>
      <img className={styles.fullPicture} src={giftPictureSrc(picture)} alt={picture.alt} />
      <PictureCredit picture={picture} />
    </dialog>
  )
}
