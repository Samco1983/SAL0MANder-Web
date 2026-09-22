import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { newId } from '@contracts/v1'
import { UnityStage } from '@unity/UnityStage'
import { preparePreview, type PreviewBoot } from '@unity/previewBridge'
import { prepareSlide, type SlideBoot } from '@unity/slideBridge'
import { decodeGift } from '@/gifts/giftLink'
import type { StoredGift } from '@/gifts/giftStore'
import { configuredGiftStore, savedGiftId } from '@/gifts/savedGiftLink'
import { loadSavedCustomPhoto } from '@/gifts/customPhoto'
import { customGiftPicture } from '@/gifts/giftPicture'
import type { PuzzlePicture } from '@content/puzzleLibrary'
import { giftToDraft } from '@/gifts/giftActivity'
import { GIFT_MODES } from '@/gifts/giftCatalog'
import { giftGreeting, giftPresentation } from '@/gifts/giftPresentation'
import { GiftOpening } from './GiftOpening'
import { GiftCelebration } from './GiftCelebration'
import { GiftRecoveryForm } from './GiftRecoveryForm'
import { GiftFeedbackControls } from './GiftFeedbackControls'
import { useGiftFeedback } from './useGiftFeedback'
import feedbackStyles from './GiftFeedbackControls.module.css'
import styles from './PuzzleGifts.module.css'

export function GiftPlayPage() {
  const location = useLocation()
  // Keying the launch owner also cancels pending preparation if a recipient opens another gift.
  return (
    <GiftRecipient
      key={`${location.key}:${location.pathname}${location.search}${location.hash}`}
      search={location.search}
      hash={location.hash}
      urlLength={Math.max(
        window.location.href.length,
        window.location.origin.length +
          location.pathname.length +
          location.search.length +
          location.hash.length,
      )}
    />
  )
}

function GiftRecipient({
  hash,
  search,
  urlLength,
}: {
  hash: string
  search: string
  urlLength: number
}) {
  const feedback = useGiftFeedback()
  const [preview, setPreview] = useState<PreviewBoot | SlideBoot | null>(null)
  const [completionActive, setCompletionActive] = useState(false)
  const [completionDismissed, setCompletionDismissed] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const [loadedGift, setLoadedGift] = useState<StoredGift | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(new URLSearchParams(search).has('g'))
  const [customPicture, setCustomPicture] = useState<PuzzlePicture | undefined>(undefined)
  let gift: StoredGift | null = loadedGift
  let invalid = loadError
  let storedId: string | null = null
  try {
    storedId = savedGiftId(search)
    if (storedId && hash) throw new Error('Use one complete gift link at a time.')
    if (hash) gift = decodeGift(hash, urlLength)
  } catch (cause) {
    invalid = cause instanceof Error ? cause.message : 'This gift link could not be opened.'
  }
  useEffect(() => {
    if (!storedId || hash) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const service = configuredGiftStore()
    if (!service) {
      setLoadError('Saved gifts are not connected on this website yet.')
      setLoading(false)
      return
    }
    void service
      .load(storedId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setLoadedGift(result.gift)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            cause instanceof Error ? cause.message : 'This gift could not be loaded. Try again.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [storedId, hash])
  const picture =
    gift?.version === 4 ? customPicture : PUZZLE_LIBRARY.find((item) => item.key === gift?.imageKey)

  async function open() {
    if (!gift || preparing) return
    feedback.stop()
    feedback.unlock()
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setPreparing(true)
    setError('')
    try {
      const id = `gift_${newId()}`
      const requestId = `preview_${newId()}`
      let preparedPhoto: { key: string; pngBase64: string } | undefined
      if (gift.version === 4) {
        const service = configuredGiftStore()
        if (!service) throw new Error('Saved gifts are not connected on this website yet.')
        const photo = await loadSavedCustomPhoto(
          service.imageUrl(gift.image.id),
          gift.image,
          controller.signal,
        )
        controller.signal.throwIfAborted()
        setCustomPicture(customGiftPicture(photo))
        preparedPhoto = { key: 'custom', pngBase64: photo.pngBase64 }
      }
      const prepared =
        gift.mode === 'sliding'
          ? preparedPhoto
            ? await prepareSlide(gift.imageKey, requestId, controller.signal, preparedPhoto)
            : await prepareSlide(gift.imageKey, requestId, controller.signal)
          : preparedPhoto
            ? await preparePreview(
                giftToDraft(gift, id),
                requestId,
                controller.signal,
                preparedPhoto,
              )
            : await preparePreview(giftToDraft(gift, id), requestId, controller.signal)
      if (!controller.signal.aborted) {
        setCompletionActive(false)
        setCompletionDismissed(false)
        setPreview(prepared)
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        feedback.stop()
        setError(cause instanceof Error ? cause.message : 'The puzzle could not open. Try again.')
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false)
    }
  }

  function closePuzzle() {
    pending.current?.abort()
    pending.current = null
    setPreparing(false)
    setError('')
    feedback.stop()
    setCompletionActive(false)
    setCompletionDismissed(false)
    setPreview(null)
  }

  if (preview && gift) {
    const completion = (
      <GiftCelebration
        key={preview.requestId}
        requestId={preview.requestId}
        channel={preview.type === 'slide-boot' ? 'slide' : 'preview-attempt'}
        presentation={giftPresentation(gift)}
        picture={picture}
        onComplete={(effect) => {
          setCompletionActive(true)
          setCompletionDismissed(false)
          feedback.complete(effect)
        }}
        onReset={() => {
          setCompletionActive(false)
          setCompletionDismissed(false)
          feedback.stop()
        }}
        onPictureVisible={feedback.pictureVisible}
        mode={gift.mode}
        collapsed={completionDismissed}
        onReturnToPuzzle={
          preview.type === 'slide-boot'
            ? () => {
                setCompletionDismissed(true)
                setCompletionActive(false)
                feedback.stop()
              }
            : undefined
        }
        onReplay={() => void open()}
        onClose={closePuzzle}
        replaying={preparing}
        replayError={error}
      />
    )
    const controls = (
      <div className={feedbackStyles.playerToolbar}>
        <GiftFeedbackControls feedback={feedback} />
        {completionDismissed && preview.type === 'slide-boot' && (
          <Button
            variant="secondary"
            onClick={() => {
              setCompletionDismissed(false)
              setCompletionActive(true)
            }}
          >
            Show gift
          </Button>
        )}
        <Button variant="secondary" onClick={closePuzzle}>
          Close puzzle
        </Button>
      </div>
    )
    return (
      <AppShell fill contained={false}>
        <div
          className={`${styles.player} ${feedbackStyles.scope}`}
          data-gift-text={feedback.textSize}
        >
          <header className={styles.playerHeader}>
            <div>
              <h1 data-player-heading>Your puzzle gift</h1>
              <p data-player-note>Progress is temporary. Reloading starts again.</p>
            </div>
          </header>
          <div className={styles.stage} data-slide-gift={preview.type === 'slide-boot'}>
            {preview.type === 'slide-boot' ? (
              <UnityStage
                key={preview.requestId}
                slide={preview}
                audience="student"
                completion={completion}
                completionActive={completionActive}
                controls={controls}
              />
            ) : (
              <UnityStage
                key={preview.requestId}
                preview={preview}
                previewAttempts
                audience="student"
                completion={completion}
                completionActive={completionActive}
                controls={controls}
              />
            )}
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div
        className={`${styles.page} ${styles.recipient} ${feedbackStyles.scope}`}
        data-gift-text={feedback.textSize}
      >
        <p className={styles.eyebrow}>Someone made this for you</p>
        <h1 data-gift-heading>
          {invalid
            ? 'This gift needs a complete link'
            : gift
              ? 'You have a puzzle gift'
              : 'Open a gift'}
        </h1>
        <GiftFeedbackControls feedback={feedback} />
        {loading && !invalid ? (
          <p role="status">Opening your saved gift…</p>
        ) : !gift ? (
          <>
            <GiftRecoveryForm initialError={invalid} />
            <LinkButton to={paths.gifts}>Make a puzzle gift</LinkButton>
          </>
        ) : (
          <>
            <p>
              {GIFT_MODES.find((mode) => mode.id === gift!.mode)!.name} ·{' '}
              {gift!.version === 1 ? 'Four' : 'Nine'} pieces
            </p>
            <p className={styles.eyebrow}>{giftGreeting(giftPresentation(gift!))}</p>
            <GiftOpening
              wrapper={giftPresentation(gift!).wrapper}
              onUnwrap={feedback.opening}
              picture={gift!.mode === 'classic' || gift!.mode === 'sliding' ? picture : undefined}
            >
              <p>
                {gift!.mode === 'sliding'
                  ? 'Tap any two squares to swap them. Join the picture anywhere it fits. Start with blank spaces, then work up to full 3×3 and 4×4 pictures. Your gift picture stays the same.'
                  : gift!.mode === 'classic'
                    ? 'Put the pieces together to discover your picture. No questions needed.'
                    : 'Guess the sender’s favorites to uncover the picture. A wrong guess can be retried.'}
              </p>
              <p className={styles.quiet}>
                No sign-in needed. Your progress is temporary; reopening or reloading starts again.
              </p>
              {error && <p role="alert">{error}</p>}
              <Button disabled={preparing} onClick={() => void open()}>
                {preparing ? 'Opening puzzle…' : 'Open puzzle'}
              </Button>
            </GiftOpening>
          </>
        )}
      </div>
    </AppShell>
  )
}
