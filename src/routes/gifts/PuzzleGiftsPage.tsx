import { useRef, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { SharePanel } from '@components/share/SharePanel'
import { useCopyToClipboard } from '@components/share/useCopyToClipboard'
import { paths } from '@config/routes'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { GIFT_MODES } from '@/gifts/giftCatalog'
import {
  buildGiftLink,
  decodeGift,
  giftBackupCode,
  giftEmailDraft,
  GiftSchema,
  shareGift,
  type GiftMode,
} from '@/gifts/giftLink'
import { GIFT_SURVEY } from '@/gifts/giftSurvey'
import { giftOriginCopy } from '@/gifts/giftOrigin'
import {
  DEFAULT_GIFT_PRESENTATION,
  GIFT_OCCASIONS,
  type GiftPresentation,
} from '@/gifts/giftPresentation'
import { GiftSurveyForm } from './GiftSurveyForm'
import styles from './PuzzleGifts.module.css'

export function PuzzleGiftsPage() {
  const originCopy = giftOriginCopy(window.location.origin)
  const [imageKey, setImageKey] = useState('')
  const [mode, setMode] = useState<GiftMode>('learning')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [presentation, setPresentation] = useState<GiftPresentation>(DEFAULT_GIFT_PRESENTATION)
  const effectChosen = useRef(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const [sharing, setSharing] = useState(false)
  const giftGeneration = useRef(0)
  const questionMode = mode === 'learning' || mode === 'mystery'
  const candidate = GiftSchema.safeParse({
    version: mode === 'sliding' ? 3 : 2,
    catalogVersion: 2,
    mode,
    imageKey,
    answers: questionMode
      ? GIFT_SURVEY.map((item) => ({ templateId: item.id, answer: answers[item.id] ?? '' }))
      : [],
    ...presentation,
  })
  const picked = PUZZLE_LIBRARY.find((picture) => picture.key === imageKey)
  const backup = url ? giftBackupCode(decodeGift(new URL(url).hash, url.length)) : ''

  function changed() {
    giftGeneration.current++
    setUrl('')
    setError('')
    setShareStatus('')
  }
  function chooseMode(next: GiftMode) {
    changed()
    if (next === 'classic' || next === 'sliding' || !questionMode) setAnswers({})
    setMode(next)
  }
  function generate() {
    if (!candidate.success) return
    try {
      giftGeneration.current++
      setUrl(buildGiftLink(candidate.data, window.location.origin))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The gift link could not be created.')
    }
  }
  async function share() {
    if (!url || sharing) return
    const generation = giftGeneration.current
    setSharing(true)
    const result = await shareGift(url)
    if (giftGeneration.current === generation) {
      setShareStatus(
        result === 'opened'
          ? 'Your device handled the share request. Delivery is not confirmed.'
          : result === 'cancelled'
            ? 'Share closed. Your link is still ready.'
            : 'Sharing is unavailable here. Copy the link below and paste it into a text or email.',
      )
    }
    setSharing(false)
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>A little surprise, made by you</p>
          <h1>Puzzle Gifts</h1>
          <p>Pick a picture, choose how it plays, and give someone a puzzle to open.</p>
          <p className={styles.quiet}>{originCopy.summary}</p>
          <LinkButton to={paths.giftPlay} variant="secondary">
            Open a gift
          </LinkButton>
        </header>

        <section className={styles.section} aria-labelledby="gift-picture-heading">
          <h2 id="gift-picture-heading">1. Pick their picture</h2>
          <div className={styles.pictures}>
            {PUZZLE_LIBRARY.map((picture) => (
              <button
                key={picture.key}
                type="button"
                className={styles.picture}
                aria-pressed={picture.key === imageKey}
                onClick={() => {
                  changed()
                  setImageKey(picture.key)
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}${picture.src}`}
                  alt={picture.alt}
                  width={picture.width}
                  height={picture.height}
                  loading="lazy"
                />
                <span>{picture.name}</span>
              </button>
            ))}
          </div>
        </section>

        <fieldset className={styles.section}>
          <legend>2. Choose a play style</legend>
          <div className={styles.modes}>
            {GIFT_MODES.map((option) => (
              <label
                className={styles.mode}
                key={option.id}
                data-selected={mode === option.id}
                aria-label={option.name}
              >
                <input
                  type="radio"
                  name="gift-mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={() => chooseMode(option.id)}
                />
                <span>
                  <strong>{option.name}</strong>
                  <span>{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {questionMode ? (
          <GiftSurveyForm
            answers={answers}
            onAnswer={(id, value) => {
              changed()
              setAnswers((current) => ({ ...current, [id]: value }))
            }}
          />
        ) : (
          <p className={styles.section}>
            {mode === 'sliding'
              ? 'Slide rows and columns around the 3 × 3 picture grid. No questions are included.'
              : 'Classic Jigsaw is ready with all nine pieces. No questions are included.'}
          </p>
        )}

        <section className={styles.section} aria-labelledby="gift-wrap-heading">
          <h2 id="gift-wrap-heading">Make the moment</h2>
          <fieldset className={styles.preferences}>
            <legend>What’s the occasion?</legend>
            {GIFT_OCCASIONS.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="occasion"
                  checked={presentation.occasion === item.id}
                  onChange={() => {
                    changed()
                    setPresentation((current) => ({
                      ...current,
                      occasion: item.id,
                      celebration: effectChosen.current ? current.celebration : item.suggested,
                    }))
                  }}
                />
                {item.name}
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.preferences}>
            <legend>Celebrate with</legend>
            {(['confetti', 'hearts', 'balloons'] as const).map((effect) => (
              <label key={effect}>
                <input
                  type="radio"
                  name="celebration"
                  checked={presentation.celebration === effect}
                  onChange={() => {
                    changed()
                    effectChosen.current = true
                    setPresentation((current) => ({ ...current, celebration: effect }))
                  }}
                />
                {effect.charAt(0).toUpperCase() + effect.slice(1)}
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.preferences}>
            <legend>Wrap it in</legend>
            {(['box', 'envelope'] as const).map((wrapper) => (
              <label key={wrapper}>
                <input
                  type="radio"
                  name="wrapper"
                  checked={presentation.wrapper === wrapper}
                  onChange={() => {
                    changed()
                    setPresentation((current) => ({ ...current, wrapper }))
                  }}
                />
                {wrapper === 'box' ? 'Gift box' : 'Envelope'}
              </label>
            ))}
          </fieldset>
        </section>

        <section className={styles.section} aria-labelledby="gift-share-heading">
          <h2 id="gift-share-heading">Ready to give</h2>
          <p>
            {picked
              ? `${picked.name} · ${GIFT_MODES.find((option) => option.id === mode)!.name}`
              : 'Choose a picture to get started.'}
          </p>
          <p className={styles.quiet}>
            Anyone with the link can read your picks and answers. Play progress is temporary.{' '}
            {originCopy.notice}
          </p>
          {!candidate.success && (
            <p>
              Choose a picture
              {questionMode ? ' and answer all nine favorites.' : '.'}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <Button disabled={!candidate.success} onClick={generate}>
            Create gift link
          </Button>
          {url && (
            <div className={styles.generated}>
              <div className={styles.actions}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.actionLink}
                >
                  Open gift
                </a>
                <a href={giftEmailDraft(url)} className={styles.actionLink}>
                  Email draft
                </a>
                <Button variant="secondary" disabled={sharing} onClick={() => void share()}>
                  Share…
                </Button>
              </div>
              <p className={styles.quiet}>
                Email opens a draft. Share opens your device’s chooser, where text messaging may be
                available. You choose the recipient and send it yourself.
              </p>
              <p role="status">{shareStatus}</p>
              <SharePanel url={url} title="Your puzzle gift" />
              <GiftBackup key={backup} code={backup} />
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}

function GiftBackup({ code }: { code: string }) {
  const { state, copy } = useCopyToClipboard()
  return (
    <section className={styles.recovery} aria-label="Gift backup code">
      <h3>Keep a backup code</h3>
      <p>
        If a link will not open, choose Open a gift on the main game and paste this full code. The
        website still needs to be reachable.
      </p>
      <label htmlFor="gift-backup-code">Full backup code</label>
      <textarea
        id="gift-backup-code"
        className={styles.textAnswer}
        rows={3}
        value={code}
        readOnly
        spellCheck={false}
      />
      <Button variant="secondary" onClick={() => void copy(code)}>
        Copy backup code
      </Button>
      <p role="status">
        {state === 'copied'
          ? 'Backup code copied.'
          : state === 'failed'
            ? 'Copy is unavailable. Select the full code above and copy it manually.'
            : ''}
      </p>
    </section>
  )
}
