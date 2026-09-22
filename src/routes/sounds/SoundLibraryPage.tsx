import { useEffect, useId, useRef, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { SOUND_LIBRARY, type SoundDefinition } from '@content/soundLibrary'
import { paths } from '@config/routes'
import { GiftFeedback, defaultFeedbackOptions } from '@/gifts/giftFeedback'
import styles from './SoundLibraryPage.module.css'

const categories = [...new Set(SOUND_LIBRARY.map((sound) => sound.category))]
const categoryName = (category: string) =>
  category === 'UI' ? 'Interface sounds' : category.replaceAll('-', ' ')
const seconds = (value: number) => `${Number(value.toFixed(2))}s`

export function SoundLibraryPage() {
  const id = useId()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [message, setMessage] = useState('Choose a sound and press Play.')
  const [failed, setFailed] = useState(false)
  const generation = useRef(0)
  const player = useRef<GiftFeedback | null>(null)
  useEffect(
    () => () => {
      generation.current++
      player.current?.dispose()
      player.current = null
    },
    [],
  )

  function stop() {
    generation.current++
    player.current?.dispose()
    player.current = null
    setActive(null)
    setFailed(false)
    setMessage('Preview stopped.')
  }
  function play(sound: SoundDefinition) {
    const token = ++generation.current
    player.current?.dispose()
    // Explicit auditions are independent of saved Gift preferences and never use haptics.
    const current = new GiftFeedback({ ...defaultFeedbackOptions(), vibrate: undefined })
    player.current = current
    current.unlock()
    setActive(sound.key)
    setFailed(false)
    setMessage(`Loading or playing ${sound.name}.`)
    void current.play(sound).then((ok) => {
      if (generation.current !== token || player.current !== current) return
      player.current = null
      current.dispose()
      setActive(null)
      setFailed(!ok)
      setMessage(
        ok
          ? `Finished ${sound.name}.`
          : `Could not play ${sound.name}. Try Play again, or check your browser and sound output.`,
      )
    })
  }
  const search = query.normalize('NFKC').trim().toLocaleLowerCase()
  const sounds = SOUND_LIBRARY.filter(
    (sound) =>
      (!category || sound.category === category) &&
      `${sound.name} ${categoryName(sound.category)} ${sound.credit?.author ?? 'original synthesized'}`
        .normalize('NFKC')
        .toLocaleLowerCase()
        .includes(search),
  )
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Listen and explore</p>
          <h1>Sound library</h1>
          <p>
            {SOUND_LIBRARY.length} sounds for puzzle gifts: magical celebrations, gentle game cues
            and animal or nature recordings.
          </p>
          <p className={styles.quiet}>
            Press Play to hear one preview at a time. Longer recordings use short previews. This
            page does not change your Gift sound preference or the game’s music.
          </p>
        </header>
        <div className={styles.filters}>
          <label htmlFor={`${id}-search`}>
            Find a sound
            <input
              id={`${id}-search`}
              type="search"
              value={query}
              placeholder="Try hearts, ocean or victory"
              onChange={(event) => {
                stop()
                setQuery(event.target.value)
              }}
            />
          </label>
          <label htmlFor={`${id}-category`}>
            Category
            <select
              id={`${id}-category`}
              value={category}
              onChange={(event) => {
                stop()
                setCategory(event.target.value)
              }}
            >
              <option value="">All sounds</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryName(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.summary}>
          <p aria-live="polite">
            {sounds.length} of {SOUND_LIBRARY.length} sounds
          </p>
          <Button variant="secondary" disabled={!active} onClick={stop}>
            Stop preview
          </Button>
          {(query || category) && (
            <Button
              variant="ghost"
              onClick={() => {
                stop()
                setQuery('')
                setCategory('')
              }}
            >
              Show all sounds
            </Button>
          )}
        </div>
        <p className={styles.status} role={failed ? 'alert' : 'status'}>
          {message}
        </p>
        {sounds.length === 0 ? (
          <p>No sounds match. Try a different name or category.</p>
        ) : (
          <ul className={styles.grid} aria-label="Sound clips">
            {sounds.map((sound) => {
              const preview = Math.min(sound.previewSeconds ?? sound.durationSeconds, 12)
              return (
                <li key={sound.key} className={styles.card}>
                  <p className={styles.category}>{categoryName(sound.category)}</p>
                  <h2>{sound.name}</h2>
                  <p className={styles.duration}>
                    {preview < sound.durationSeconds
                      ? `${seconds(preview)} preview · ${seconds(sound.durationSeconds)} recording`
                      : `${seconds(sound.durationSeconds)} clip`}
                  </p>
                  <Button
                    variant={active === sound.key ? 'secondary' : 'primary'}
                    aria-label={`${active === sound.key ? 'Stop' : 'Play'} ${sound.name}`}
                    onClick={() => (active === sound.key ? stop() : play(sound))}
                  >
                    {active === sound.key ? 'Stop' : 'Play'}
                  </Button>
                  {sound.credit ? (
                    <div className={styles.credit}>
                      <p>Source-credited recording</p>
                      <a href={sound.credit.source} target="_blank" rel="noopener noreferrer">
                        Recording by {sound.credit.author}
                      </a>
                      <a href={sound.credit.licenseUrl} target="_blank" rel="noopener noreferrer">
                        {sound.credit.license}
                      </a>
                    </div>
                  ) : (
                    <div className={styles.credit}>
                      <p>Original SAL0MANder synthesized effect</p>
                      <a href="#original-sounds">How these effects were made</a>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <section
          className={styles.about}
          id="original-sounds"
          aria-labelledby={`${id}-original-title`}
        >
          <h2 id={`${id}-original-title`}>Original effects and real recordings</h2>
          <p>
            The original game effects were generated for SAL0MANder with layered bell tones, plucked
            notes, warm harmonies and soft noise textures. They are synthesized effects, not animal
            recordings.
          </p>
          <p>
            Animal and nature clips are recordings with their source author and license linked on
            each card. Listening here is a preview, so you can decide which sounds you enjoy.
          </p>
          <LinkButton to={paths.gifts} variant="secondary">
            Make a puzzle gift
          </LinkButton>
        </section>
      </div>
    </AppShell>
  )
}
