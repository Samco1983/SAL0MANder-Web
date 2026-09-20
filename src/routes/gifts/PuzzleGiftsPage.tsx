import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { giftComposerDefaults } from '@/gifts/giftComposer'
import { GiftCustomSchema } from '@/gifts/giftCustom'
import { configuredGiftStore, buildSavedGiftLink, savedGiftId } from '@/gifts/savedGiftLink'
import { useLocalPhoto } from '@/media/useLocalPhoto'
import { LocalPhotoPicker } from '@/media/LocalPhotoPicker'
import { giftOriginCopy } from '@/gifts/giftOrigin'
import {
  DEFAULT_GIFT_PRESENTATION,
  GIFT_OCCASIONS,
  MAX_OCCASION_CHARACTERS,
  OccasionTextSchema,
  giftGreeting,
  type GiftPresentation,
} from '@/gifts/giftPresentation'
import { GiftPicturePicker } from './GiftPicturePicker'
import { GiftSurveyForm } from './GiftSurveyForm'
import styles from './PuzzleGifts.module.css'
import messageStyles from './GiftMessageIdeas.module.css'

export function PuzzleGiftsPage() {
  const location = useLocation()
  const defaults = giftComposerDefaults(location.search)
  const originCopy = giftOriginCopy(window.location.origin)
  const [imageKey, setImageKey] = useState(defaults.imageKey)
  const localPhoto = useLocalPhoto()
  const customPhoto = localPhoto.photo
  const photoBusy = localPhoto.preparing
  const [saving, setSaving] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const savePending = useRef<AbortController | null>(null)
  const service = configuredGiftStore()
  useEffect(
    () => () => {
      savePending.current?.abort()
    },
    [],
  )
  const [mode, setMode] = useState<GiftMode>(defaults.mode)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [presentation, setPresentation] = useState<GiftPresentation>(DEFAULT_GIFT_PRESENTATION)
  const occasionCheck =
    presentation.occasionText === undefined
      ? null
      : OccasionTextSchema.safeParse(presentation.occasionText)
  const effectChosen = useRef(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const [sharing, setSharing] = useState(false)
  const giftGeneration = useRef(0)
  const questionMode = mode === 'learning' || mode === 'mystery'
  const isCustom = imageKey === 'custom' && customPhoto !== null
  const candidate = (isCustom ? GiftCustomSchema : GiftSchema).safeParse({
    version: isCustom ? 4 : mode === 'sliding' ? 3 : 2,
    ...(isCustom
      ? {
          image: {
            id: '0'.repeat(32),
            width: customPhoto.width,
            height: customPhoto.height,
            contentType: 'image/png',
          },
        }
      : {}),
    catalogVersion: 2,
    mode,
    imageKey,
    answers: questionMode
      ? GIFT_SURVEY.map((item) => ({ templateId: item.id, answer: answers[item.id] ?? '' }))
      : [],
    ...presentation,
  })
  const picked = PUZZLE_LIBRARY.find((picture) => picture.key === imageKey)
  const savedId = url ? savedGiftId(new URL(url).search) : null
  const backup = savedId
    ? `SAL0-SAVED:${savedId}`
    : url
      ? giftBackupCode(decodeGift(new URL(url).hash, url.length))
      : ''

  function changed() {
    giftGeneration.current++
    savePending.current?.abort()
    setSaving(false)
    setExpiresAt('')
    setUrl('')
    setError('')
    setShareStatus('')
  }
  function chooseMode(next: GiftMode) {
    changed()
    if (next === 'classic' || next === 'sliding' || !questionMode) setAnswers({})
    setMode(next)
  }
  function choosePhoto(file: File) {
    changed()
    setImageKey('custom')
    void localPhoto.choose(file)
  }
  async function generate() {
    if (!candidate.success || saving || photoBusy || imageKey === 'custom') return
    const generation = ++giftGeneration.current
    const controller = new AbortController()
    savePending.current?.abort()
    savePending.current = controller
    setSaving(true)
    setUrl('')
    setError('')
    setShareStatus('')
    setExpiresAt('')
    try {
      const gift = candidate.data
      let nextUrl: string
      let expiry = ''
      if (service) {
        const receipt = await service.save(gift, controller.signal)
        nextUrl = buildSavedGiftLink(receipt.id, window.location.origin)
        expiry = receipt.expiresAt
      } else {
        if (gift.version === 4) throw new Error('Photo gifts need saved sharing.')
        nextUrl = buildGiftLink(gift, window.location.origin)
      }
      if (!controller.signal.aborted && giftGeneration.current === generation) {
        setUrl(nextUrl)
        setExpiresAt(expiry)
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'The gift link could not be created.')
    } finally {
      if (!controller.signal.aborted) setSaving(false)
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
          {defaults.imageKey && picked && (
            <div>
              <p>{picked.name} is ready. Make this gift your own.</p>
              <Button
                onClick={() =>
                  document
                    .getElementById(questionMode ? 'gift-favorite' : 'gift-occasion-text')
                    ?.focus()
                }
              >
                Personalize this gift
              </Button>
            </div>
          )}
          <LinkButton to={paths.giftPlay} variant="secondary">
            Open a gift
          </LinkButton>
        </header>

        <section className={styles.section} aria-labelledby="gift-picture-heading">
          <h2 id="gift-picture-heading">1. Pick their picture</h2>
          <LocalPhotoPicker
            id="gift-own-photo"
            state={localPhoto}
            onChoose={choosePhoto}
            onClear={() => {
              changed()
              localPhoto.clear()
              setImageKey('')
            }}
          />
          <GiftPicturePicker
            selectedKey={imageKey}
            onSelect={(key) => {
              changed()
              localPhoto.clear()
              setImageKey(key)
            }}
          />
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
                  <strong>
                    {option.id === 'mystery' && (
                      <svg className={styles.revealIcon} viewBox="0 0 30 30" aria-hidden="true">
                        <rect
                          x="1"
                          y="1"
                          width="28"
                          height="28"
                          rx="5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path d="M2 22 10 12l6 7 5-5 7 8" fill="currentColor" opacity=".45" />
                        <path d="M10 2v27M20 2v27M2 10h27M2 20h27" stroke="currentColor" />
                        <rect x="11" y="1" width="9" height="9" fill="currentColor" />
                        <rect x="20" y="11" width="9" height="9" fill="currentColor" />
                      </svg>
                    )}
                    {option.name}
                  </strong>
                  <span>{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {questionMode ? (
          <GiftSurveyForm
            answers={answers}
            onContinue={() => document.getElementById('gift-occasion-text')?.focus()}
            onAnswer={(id, value) => {
              changed()
              setAnswers((current) => ({ ...current, [id]: value }))
            }}
          />
        ) : (
          <p className={styles.section}>
            {mode === 'sliding'
              ? 'Swap any two squares to rebuild the picture. Start with blank spaces, then try full 3×3 and 4×4 pictures across eight levels. Your chosen gift picture stays with the recipient. No questions are included.'
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
          <div className={styles.occasionNote}>
            <label htmlFor="gift-occasion-text">Your occasion or message</label>
            <p id="gift-occasion-help">
              Make it yours: “Happy 10th birthday, Maya!” or “You got the job!” Leave it blank to
              use the occasion above.
            </p>
            <input
              id="gift-occasion-text"
              className={styles.textAnswer}
              type="text"
              value={presentation.occasionText ?? ''}
              placeholder="What are you celebrating?"
              aria-describedby="gift-occasion-help gift-occasion-count"
              aria-invalid={occasionCheck ? !occasionCheck.success : false}
              onChange={(event) => {
                changed()
                const value = event.currentTarget.value
                setPresentation((current) => ({
                  ...current,
                  occasionText: value === '' ? undefined : value,
                }))
              }}
            />
            <div className={messageStyles.ideas} role="group" aria-label="Quick message ideas">
              {[
                'Quest complete. Smile unlocked!',
                'You are my favorite player two.',
                'Small steps. Epic wins.',
                'Powered by kindness. Built to win.',
                'You make ordinary days legendary.',
                'Achievement unlocked: being awesome.',
              ].map((message) => (
                <button
                  key={message}
                  type="button"
                  onClick={() => {
                    changed()
                    setPresentation((current) => ({ ...current, occasionText: message }))
                  }}
                >
                  {message}
                </button>
              ))}
            </div>
            <p id="gift-occasion-count" className={styles.quiet}>
              {[...(presentation.occasionText ?? '')].length} / {MAX_OCCASION_CHARACTERS} characters
            </p>
            {occasionCheck && !occasionCheck.success && (
              <p role="alert">{occasionCheck.error.issues[0]?.message}</p>
            )}
            {(!occasionCheck || occasionCheck.success) && (
              <p className={styles.greetingPreview}>
                They’ll see:{' '}
                <strong>
                  {giftGreeting({
                    ...presentation,
                    occasionText: occasionCheck?.success ? occasionCheck.data : undefined,
                  })}
                </strong>
              </p>
            )}
          </div>
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
            {isCustom
              ? `Your photo · ${GIFT_MODES.find((option) => option.id === mode)!.name}`
              : picked
                ? `${picked.name} · ${GIFT_MODES.find((option) => option.id === mode)!.name}`
                : 'Choose a picture to get started.'}
          </p>
          <p className={styles.quiet}>
            Anyone with the link can read your picks and answers. Play progress is temporary.{' '}
            {originCopy.notice}
          </p>
          {!candidate.success && (
            <p>
              {!imageKey ? 'Choose a picture. ' : ''}
              {questionMode ? 'Answer all nine favorites. ' : ''}
              {occasionCheck && !occasionCheck.success ? 'Check your occasion message.' : ''}
            </p>
          )}
          {imageKey === 'custom' && (
            <p>
              Choose a library picture to create a shareable gift. Your local photo is not approved
              for sharing.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <Button
            disabled={!candidate.success || saving || photoBusy || imageKey === 'custom'}
            onClick={() => void generate()}
          >
            {saving ? 'Saving your gift…' : 'Create gift link'}
          </Button>
          {url && (
            <div className={styles.generated}>
              {expiresAt && (
                <p>
                  Saved gift available until {new Date(expiresAt).toLocaleDateString()}. Keep the
                  backup code too.
                </p>
              )}
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
