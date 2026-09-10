import { useId, useState } from 'react'
import { PUZZLE_LIBRARY, PUZZLE_PICTURE_CATEGORIES } from '@content/puzzleLibrary'
import styles from './GiftPicturePicker.module.css'

export function GiftPicturePicker({
  selectedKey,
  onSelect,
}: {
  selectedKey: string
  onSelect: (key: string) => void
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const search = query.trim().toLowerCase()
  const pictures = PUZZLE_LIBRARY.filter(
    (picture) =>
      (!category || picture.category === category) &&
      (!search ||
        `${picture.name} ${picture.alt} ${picture.category}`.toLowerCase().includes(search)),
  )
  const selected = PUZZLE_LIBRARY.find((picture) => picture.key === selectedKey)

  return (
    <div className={styles.picker}>
      <div className={styles.filters}>
        <label htmlFor={`${id}-search`}>
          Find a picture
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            placeholder="Try dinosaurs, birds or castles"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label htmlFor={`${id}-category`}>
          Theme
          <select
            id={`${id}-category`}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All themes</option>
            {PUZZLE_PICTURE_CATEGORIES.map((theme) => (
              <option key={theme}>{theme}</option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.summary} aria-live="polite">
        {pictures.length} of {PUZZLE_LIBRARY.length} pictures
        {selected ? ` · Selected picture: ${selected.name}` : ' · Choose one for your gift'}
      </p>
      {query || category ? (
        <button
          className={styles.clear}
          type="button"
          onClick={() => {
            setQuery('')
            setCategory('')
          }}
        >
          Show all pictures
        </button>
      ) : null}
      {pictures.length === 0 ? <p>No pictures match. Try another search or theme.</p> : null}
      <div className={styles.grid}>
        {pictures.map((picture) => (
          <button
            key={picture.key}
            type="button"
            className={styles.picture}
            aria-label={`Choose ${picture.name}`}
            aria-pressed={picture.key === selectedKey}
            onClick={() => onSelect(picture.key)}
          >
            <img
              src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}${picture.src}`}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              loading="lazy"
              decoding="async"
            />
            <span className={styles.name}>{picture.name}</span>
            {picture.key === selectedKey ? <span className={styles.selected}>Selected</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
