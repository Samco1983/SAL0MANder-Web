import { useEffect, useState } from 'react'
import { LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'
import { onPreviewMessage } from '@unity/previewBridge'
import { onSlideMessage } from '@unity/slideBridge'
import { onPreviewAttemptMessage } from '@unity/previewAttemptBridge'
import { GIFT_OCCASIONS, type GiftPresentation } from '@/gifts/giftPresentation'
import styles from './PuzzleGifts.module.css'

/** Mount with a requestId key: replay receives a fresh latch without restarting Unity. */
export function GiftCelebration({
  requestId,
  presentation,
  channel = 'preview',
}: {
  requestId: string
  presentation: GiftPresentation
  channel?: 'preview' | 'slide' | 'preview-attempt'
}) {
  const [finished, setFinished] = useState(false)
  const [moving, setMoving] = useState(false)
  useEffect(() => {
    let latched = false
    let attempt = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const complete = () => {
      if (latched || cancelled) return
      latched = true
      setFinished(true)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setMoving(true)
        timer = setTimeout(() => setMoving(false), 3500)
      }
    }
    const restart = (nextAttempt: number) => {
      if (cancelled || nextAttempt <= attempt) return
      attempt = nextAttempt
      latched = false
      clearTimeout(timer)
      setFinished(false)
      setMoving(false)
    }
    const cancel = () => {
      cancelled = true
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
            })
    const stopErrors =
      channel === 'preview-attempt'
        ? onPreviewMessage((message) => {
            if (message.requestId === requestId && message.type === 'preview-error') cancel()
          })
        : undefined
    return () => {
      cancelled = true
      stop()
      stopErrors?.()
      clearTimeout(timer)
    }
  }, [requestId, channel])
  if (!finished) return null
  const occasion = GIFT_OCCASIONS.find((item) => item.id === presentation.occasion)!
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
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index}>{decoration}</span>
        ))}
      </div>
      <p role="status">
        <strong>Puzzle complete!</strong> {occasion.message}
      </p>
      <LinkButton to={paths.gifts} variant="secondary" size="sm">
        Make a gift
      </LinkButton>
    </section>
  )
}
