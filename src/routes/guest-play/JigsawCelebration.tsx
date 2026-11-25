import { useEffect, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import type { PuzzlePicture } from '@content/puzzleLibrary'
import { correlateAttempt, isUsableFinishedPayload, onUnityMessage } from '@unity/bridge'
import { onPreviewMessage } from '@unity/previewBridge'
import { onPreviewAttemptMessage } from '@unity/previewAttemptBridge'
import styles from './JigsawCelebration.module.css'

type CompletionSummary = {
  questionsCorrect?: number
  questionsAnswered?: number
}

/**
 * End-of-round celebration banner for Jigsaw & Picture Reveal.
 *
 * Listens across the active completion channel:
 *  - Sample library preview (`previewRequestId` set): `preview-attempt-finished`
 *    (replay-aware) and legacy `preview-finished`.
 *  - Standard guest play (`previewRequestId` unset): correlated `session-finished`,
 *    reading `clientAttemptId`/`sessionId` through a ref so the bridge listener
 *    is registered once per mount and never re-subscribes across renders.
 *
 * Renders above the Unity stage without unmounting or covering the finished
 * picture, and offers an immediate "Next picture" action when rotation is allowed.
 */
export function JigsawCelebration({
  previewRequestId,
  clientAttemptId,
  sessionId,
  picture,
  onNextPicture,
}: {
  previewRequestId?: string
  clientAttemptId?: string
  sessionId?: string
  picture?: PuzzlePicture
  onNextPicture?: () => void
}) {
  const [completion, setCompletion] = useState<CompletionSummary | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [moving, setMoving] = useState(false)

  const correlationRef = useRef<{
    clientAttemptId: string | undefined
    sessionId: string | undefined
  }>({ clientAttemptId, sessionId })
  correlationRef.current = { clientAttemptId, sessionId }

  const latchedRef = useRef(false)
  const motionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    latchedRef.current = false
    clearTimeout(motionTimerRef.current)
    setCompletion(null)
    setDismissed(false)
    setMoving(false)
  }, [previewRequestId, picture?.key])

  useEffect(() => {
    let attempt = 0
    let cancelled = false

    const celebrate = (summary: CompletionSummary = {}) => {
      if (latchedRef.current || cancelled) return
      latchedRef.current = true
      setDismissed(false)
      setCompletion(summary)
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduced) {
        setMoving(true)
        clearTimeout(motionTimerRef.current)
        motionTimerRef.current = setTimeout(() => setMoving(false), 3500)
      }
    }

    const restart = (nextAttempt: number) => {
      if (cancelled || nextAttempt <= attempt) return
      attempt = nextAttempt
      latchedRef.current = false
      clearTimeout(motionTimerRef.current)
      setCompletion(null)
      setDismissed(false)
      setMoving(false)
    }

    const cancel = () => {
      cancelled = true
      clearTimeout(motionTimerRef.current)
      setCompletion(null)
      setMoving(false)
    }

    if (previewRequestId) {
      const stopAttempt = onPreviewAttemptMessage((message) => {
        if (message.requestId !== previewRequestId || cancelled) return
        if (message.type === 'preview-attempt-ready') {
          restart(message.attempt)
        } else if (
          message.type === 'preview-attempt-finished' &&
          attempt > 0 &&
          message.attempt === attempt
        ) {
          celebrate()
        }
      })

      const stopPreview = onPreviewMessage((message) => {
        if (message.requestId !== previewRequestId || cancelled) return
        if (message.type === 'preview-finished') celebrate()
        else if (message.type === 'preview-error') cancel()
      })

      return () => {
        cancelled = true
        stopAttempt()
        stopPreview()
        clearTimeout(motionTimerRef.current)
      }
    }

    const stopUnity = onUnityMessage((message) => {
      if (message.type !== 'session-finished' || cancelled) return
      const { clientAttemptId: activeAttempt, sessionId: activeSession } = correlationRef.current
      const correlation = correlateAttempt(
        message,
        { clientAttemptId: activeAttempt, sessionId: activeSession },
        { requireSession: activeSession !== undefined },
      )
      if (correlation !== 'match') return
      if (isUsableFinishedPayload(message)) {
        celebrate({
          questionsCorrect: message.questionsCorrect,
          questionsAnswered: message.questionsAnswered,
        })
      } else {
        celebrate()
      }
    })

    return () => {
      cancelled = true
      stopUnity()
      clearTimeout(motionTimerRef.current)
    }
  }, [previewRequestId])

  if (!completion || dismissed) return null

  const hasScore =
    typeof completion.questionsAnswered === 'number' &&
    completion.questionsAnswered > 0 &&
    typeof completion.questionsCorrect === 'number'

  return (
    <section className={styles.celebration} aria-label="Puzzle complete">
      <div className={styles.effects} aria-hidden="true" data-moving={moving}>
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index}>✦</span>
        ))}
      </div>
      <div className={styles.copy} role="status">
        <p className={styles.headline}>
          <strong>Puzzle complete!</strong>
          {picture ? ` You uncovered ${picture.name}.` : ' Great work!'}
        </p>
        {hasScore ? (
          <p className={styles.detail}>
            {completion.questionsCorrect} of {completion.questionsAnswered} questions answered
            correctly.
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        {onNextPicture ? (
          <Button size="sm" onClick={onNextPicture}>
            Next picture
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" onClick={() => setDismissed(true)}>
          Keep looking
        </Button>
      </div>
    </section>
  )
}
