import { useId, useState } from 'react'
import { PhotoCredit } from '@components/ui/PhotoCredit'
import { PUZZLE_LIBRARY, PUZZLE_PICTURE_CATEGORIES } from '@content/puzzleLibrary'
import { BOARD_SHAPES, PIECE_COUNTS, type ActivityDraft } from '@studio/activityDraft'
import styles from './ImagePanel.module.css'

function withBaseUrl(src: string): string {
  return `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}${src}`
}

/**
 * Choosing the picture and the board.
 *
 * ## The picture and the board shape are chosen together
 *
 * They are one decision. A portrait photograph on a landscape board is either
 * cropped or letterboxed, and neither is what the teacher pictured. Splitting
 * them across two screens is how someone ends up with a puzzle that looks wrong
 * and no idea which setting caused it.
 *
 * Pictures that do not fit the current board are shown, dimmed, with the shape
 * they need — rather than hidden. A teacher who cannot find the castle they saw
 * a moment ago will assume the tool lost it.
 *
 * Play preview resolves the selected key in this library, converts its WebP
 * into PNG, and sends the actual pixels through the local preview bridge.
 * Unity's built-in numbered presets remain separate. Publishing is pending.
 *
 * The selection is therefore stored as a stable `key`, never as an array index.
 * `imagePresetIndex` is positional, so reordering Unity's array would silently
 * repoint every existing activity at a different picture — a failure a teacher
 * would meet in front of a class with nothing to explain it.
 */
export function ImagePanel({
  draft,
  onChange,
}: {
  draft: ActivityDraft
  onChange: (next: ActivityDraft) => void
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const setConfig = (patch: Partial<ActivityDraft['config']>) =>
    onChange({ ...draft, config: { ...draft.config, ...patch } })

  const selected = draft.meta.imageKey
  const search = query.trim().toLowerCase()
  const visiblePictures = PUZZLE_LIBRARY.filter(
    (picture) =>
      (!category || picture.category === category) &&
      (!search ||
        `${picture.name} ${picture.alt} ${picture.category} ${picture.searchTerms?.join(' ') ?? ''}`
          .toLowerCase()
          .includes(search)),
  )
  const fitting = visiblePictures.filter((p) => p.shape === draft.config.boardShape)

  return (
    <section className={styles.panel} aria-label="Puzzle and image">
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>Board shape</span>
          <select
            className={styles.select}
            value={draft.config.boardShape}
            onChange={(e) =>
              setConfig({ boardShape: e.target.value as (typeof BOARD_SHAPES)[number] })
            }
          >
            {BOARD_SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Puzzle pieces</span>
          <select
            className={styles.select}
            value={draft.config.pieceCountPreset}
            onChange={(e) =>
              setConfig({
                pieceCountPreset: Number(e.target.value) as (typeof PIECE_COUNTS)[number],
              })
            }
          >
            {PIECE_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n} pieces
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            Each piece takes one correct answer, so this is also how many
            questions the activity needs.
          </span>
        </label>
      </div>

      <div className={styles.filters}>
        <label className={styles.field} htmlFor={`${id}-search`}>
          <span className={styles.label}>Find a picture</span>
          <input
            id={`${id}-search`}
            className={styles.select}
            type="search"
            value={query}
            placeholder="Try rover, puppies, space or reef"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className={styles.field} htmlFor={`${id}-theme`}>
          <span className={styles.label}>Theme</span>
          <select
            id={`${id}-theme`}
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All themes</option>
            {PUZZLE_PICTURE_CATEGORIES.map((theme) => (
              <option key={theme} value={theme}>
                {theme}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.headingRow}>
        <h3 className={styles.heading}>
          Pictures ({visiblePictures.length} of {PUZZLE_LIBRARY.length})
          {fitting.length > 0 && <span className={styles.count}> · {fitting.length} fit this board</span>}
        </h3>
        {query || category ? (
          <button
            type="button"
            className={styles.clearFilter}
            onClick={() => {
              setQuery('')
              setCategory('')
            }}
          >
            Show all pictures
          </button>
        ) : null}
      </div>

      {visiblePictures.length === 0 ? (
        <p className={styles.hint}>No library pictures match that search. Try another theme or keyword.</p>
      ) : null}

      <ul className={styles.grid}>
        {visiblePictures.map((picture) => {
          const fits = picture.shape === draft.config.boardShape
          const isSelected = selected === picture.key
          return (
            <li key={picture.key} className={styles.card}>
              <button
                type="button"
                className={styles.pick}
                data-selected={isSelected}
                data-fits={fits}
                aria-pressed={isSelected}
                onClick={() =>
                  onChange({
                    ...draft,
                    // Choosing a picture sets the board it was made for and pins
                    // imagePresetIndex to -1 so preview loads the library pixels.
                    config: { ...draft.config, boardShape: picture.shape, imagePresetIndex: -1 },
                    meta: { ...draft.meta, imageKey: picture.key },
                  })
                }
              >
                <img
                  className={styles.thumb}
                  src={withBaseUrl(picture.src)}
                  alt={picture.alt}
                  width={picture.width}
                  height={picture.height}
                  loading="lazy"
                  decoding="async"
                />
                <span className={styles.pickName}>{picture.name}</span>
                <span className={styles.pickShape}>
                  {fits ? picture.shape : `${picture.shape} board`}
                </span>
              </button>
              <PhotoCredit credit={picture.photoCredit} />
            </li>
          )
        })}
      </ul>

      {/*
        Stated plainly rather than hidden behind a disabled control. A teacher
        who is told upload is "coming soon" with no reason assumes it is
        abandoned; one who is told what has to exist first can plan around it.
      */}
      <p className={styles.upload}>
        Uploading your own picture is switched off until picture storage exists.
        Anything uploaded will be resized automatically — a phone photo is
        roughly a hundred times larger than a puzzle needs, and every student
        would download all of it.
      </p>
    </section>
  )
}
