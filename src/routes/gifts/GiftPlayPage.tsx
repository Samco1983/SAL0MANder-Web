import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { env } from '@config/env'
import { Wordmark } from '@components/brand/Wordmark'
import { AppShell } from '@components/layout/AppShell'
import { GameMusicControl } from '@components/audio/GameMusicControl'
import { Button, LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { newId } from '@contracts/v1'
import { UnityStage } from '@unity/UnityStage'
import { useFullscreen } from '@unity/useFullscreen'
import { preparePreview, type PreviewBoot } from '@unity/previewBridge'
import { prepareSlide, type SlideBoot } from '@unity/slideBridge'
import { decodeGift, type Gift } from '@/gifts/giftLink'
import { giftToDraft } from '@/gifts/giftActivity'
import { GIFT_MODES } from '@/gifts/giftCatalog'
import { giftGreeting, giftPresentation } from '@/gifts/giftPresentation'
import { GiftOpening } from './GiftOpening'
import { GiftCelebration } from './GiftCelebration'
import { GiftRecoveryForm } from './GiftRecoveryForm'
import styles from './PuzzleGifts.module.css'

export function GiftPlayPage() {
  const location = useLocation()
  // Keying the launch owner also cancels pending preparation if a recipient opens another gift.
  return (
    <GiftRecipient
      key={`${location.pathname}${location.search}${location.hash}`}
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

function GiftRecipient({ hash, urlLength }: { hash: string; urlLength: number }) {
  const [preview, setPreview] = useState<PreviewBoot | SlideBoot | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const playerRef = useRef<HTMLDivElement | null>(null)
  const fullscreen = useFullscreen(playerRef)
  useEffect(() => () => pending.current?.abort(), [])
  let gift: Gift | null = null
  let invalid = ''
  try {
    if (hash) gift = decodeGift(hash, urlLength)
  } catch (cause) {
    invalid = cause instanceof Error ? cause.message : 'This gift link could not be opened.'
  }

  async function open() {
    if (!gift || preparing) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setPreparing(true)
    setError('')
    try {
      const id = `gift_${newId()}`
      const requestId = `preview_${newId()}`
      const prepared =
        gift.mode === 'sliding'
          ? await prepareSlide(gift.imageKey, requestId, controller.signal)
          : await preparePreview(giftToDraft(gift, id), requestId, controller.signal)
      if (!controller.signal.aborted) setPreview(prepared)
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'The puzzle could not open. Try again.')
    } finally {
      if (!controller.signal.aborted) setPreparing(false)
    }
  }

  if (preview && gift)
    return (
      <AppShell fill contained={false} hideHeader>
        <div
          ref={playerRef}
          className={styles.player}
          data-fullscreen={fullscreen.isFullscreen}
          data-fullscreen-self={fullscreen.isSelfFullscreen}
        >
          <header className={styles.playerHeader} aria-label="Game controls">
            <div className={styles.playerTitleGroup}>
              <Link
                to={paths.home}
                className={styles.playerBrand}
                aria-label={`${env.appName} home`}
              >
                <Wordmark showStudios={false} />
              </Link>
              <h1>Your puzzle gift</h1>
              <p>Progress is temporary. Reloading starts again.</p>
            </div>
            <div className={styles.playerActions}>
              <GameMusicControl gameId="puzzle-gifts" persist={false} />
              {fullscreen.isSupported ? (
                <Button variant="secondary" size="sm" onClick={fullscreen.toggle}>
                  {fullscreen.isFullscreen ? 'Exit full screen' : 'Full screen'}
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
                Close puzzle
              </Button>
            </div>
          </header>
          <GiftCelebration
            key={preview.requestId}
            requestId={preview.requestId}
            channel={preview.type === 'slide-boot' ? 'slide' : 'preview-attempt'}
            presentation={giftPresentation(gift)}
            picture={PUZZLE_LIBRARY.find((item) => item.key === gift.imageKey)}
          />
          <div className={styles.stage}>
            {preview.type === 'slide-boot' ? (
              <UnityStage
                key={preview.requestId}
                slide={preview}
                audience="student"
                hideFullscreenControl
              />
            ) : (
              <UnityStage
                key={preview.requestId}
                preview={preview}
                previewAttempts
                audience="student"
                hideFullscreenControl
              />
            )}
          </div>
        </div>
      </AppShell>
    )

  return (
    <AppShell>
      <div className={`${styles.page} ${styles.recipient}`}>
        <p className={styles.eyebrow}>Someone made this for you</p>
        <h1>
          {invalid
            ? 'This gift needs a complete link'
            : gift
              ? 'You have a puzzle gift'
              : 'Open a gift'}
        </h1>
        {!gift ? (
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
              picture={
                gift!.mode === 'classic' || gift!.mode === 'sliding'
                  ? PUZZLE_LIBRARY.find((item) => item.key === gift!.imageKey)
                  : undefined
              }
            >
              <p>
                {gift!.mode === 'sliding'
                  ? 'Slide a row or column to move all three tiles, wrapping around the edge. Restore the picture to finish.'
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
