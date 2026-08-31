import { useId, useState, type FormEvent } from 'react'
import { Button } from '@components/ui/Button'
import {
  MAX_HANDLE_LENGTH,
  MAX_PROFILES,
  PRESET_HANDLES,
  createProfile,
  getActiveProfile,
  isHandleTaken,
  listProfiles,
  setActiveProfile,
  suggestHandle,
  type PlayerProfile,
} from '@auth/playerProfiles'
import styles from './PlayerPicker.module.css'

/**
 * Who is playing on this device.
 *
 * ## Not on the path to play
 *
 * This never blocks anything. A player who ignores it entirely plays exactly as
 * before — CLAUDE.md non-negotiable 3 says opening a share link and playing must
 * not require an account, an email, or a name prompt, and a picker that appears
 * first is a name prompt however politely it is worded.
 *
 * So it lives in the optional companion panel, it opens closed, and choosing a
 * player is something you do because you want your progress kept, not because
 * the game is waiting on you.
 *
 * ## Presets before the text box
 *
 * The buttons come first and the free-text field is secondary, because an empty
 * box invites a real name and a filled-in `Player 2` almost never gets changed.
 * That ordering is the actual privacy control — see
 * `docs/coordination/TEACHER-SIGNUP-COPY-PLAYER-NAMES.md`. There is no
 * name filter, deliberately: no filter can tell "Ember" from "Emma R", so it
 * would reject harmless handles and miss real names anyway.
 *
 * The explanatory line is written for a teacher looking over a shoulder, not
 * for a child. It says what the feature does and where the name lives, without
 * handing a ten-year-old a worry about their privacy.
 */
export function PlayerPicker({ onChange }: { onChange?: (profile: PlayerProfile) => void }) {
  const [profiles, setProfiles] = useState<PlayerProfile[]>(() => listProfiles())
  const [active, setActive] = useState<PlayerProfile | undefined>(() => getActiveProfile())
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const customId = useId()

  const isFull = profiles.length >= MAX_PROFILES

  function choose(profile: PlayerProfile) {
    const next = setActiveProfile(profile.token)
    if (!next) return
    setActive(next)
    setError(undefined)
    onChange?.(next)
  }

  function add(handle: string) {
    const result = createProfile(handle)
    if (!result.ok) {
      setError(
        result.reason === 'taken'
          ? 'Someone on this device is already using that name.'
          : result.reason === 'full'
            ? `This device can hold ${MAX_PROFILES} players. Pick one that's already here.`
            : 'Type a name first.',
      )
      return
    }
    setProfiles(listProfiles())
    setActive(result.profile)
    setCustom('')
    setError(undefined)
    onChange?.(result.profile)
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    add(custom)
  }

  return (
    <section className={styles.picker} aria-labelledby="player-picker-heading">
      <h2 className={styles.heading} id="player-picker-heading">
        Who&apos;s playing?
      </h2>

      <p className={styles.lede}>
        Pick a name to keep your progress on this device. You can share the device — everyone gets
        their own.
      </p>

      {active ? (
        <p className={styles.active} role="status">
          Playing as <strong>{active.handle}</strong>
        </p>
      ) : null}

      {profiles.length > 0 ? (
        <>
          <h3 className={styles.groupLabel}>Already here</h3>
          <ul className={styles.chipList}>
            {profiles.map((profile) => (
              <li key={profile.token}>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={profile.token === active?.token}
                  onClick={() => choose(profile)}
                >
                  {profile.handle}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {isFull ? null : (
        <>
          <h3 className={styles.groupLabel}>Add a player</h3>
          <ul className={styles.chipList}>
            {PRESET_HANDLES.filter((h) => !isHandleTaken(h, profiles)).map((handle) => (
              <li key={handle}>
                <button type="button" className={styles.preset} onClick={() => add(handle)}>
                  {handle}
                </button>
              </li>
            ))}
          </ul>

          <form className={styles.customForm} onSubmit={submitCustom}>
            <label className={styles.customLabel} htmlFor={customId}>
              Or make one up
            </label>
            <div className={styles.customRow}>
              <input
                id={customId}
                className={styles.customInput}
                value={custom}
                onChange={(event) => setCustom(event.currentTarget.value)}
                /*
                  Placeholder, not a value: it demonstrates the kind of name
                  wanted without pre-filling a field the player must then clear.
                */
                placeholder={suggestHandle(profiles) || 'Rocket'}
                maxLength={MAX_HANDLE_LENGTH}
                autoComplete="off"
                spellCheck="false"
              />
              <Button type="submit" variant="secondary" disabled={!custom.trim()}>
                Add
              </Button>
            </div>
          </form>
        </>
      )}

      {/*
        role="alert" because the message replaces an action the player just
        attempted — a silently rejected name reads as a broken button.
      */}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <p className={styles.note}>
        Names stay on this device and are never sent anywhere. A nickname works better than a real
        name.
      </p>
    </section>
  )
}
