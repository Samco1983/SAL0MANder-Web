import type { ActivityDraft } from '@studio/activityDraft'
import styles from './OptionsPanel.module.css'

/**
 * Student options — three switches, not seven.
 *
 * ## What was left out, and why
 *
 * `ActivityData` carries seven student-facing flags. Four of them are not
 * decisions a teacher would make:
 *
 *   - `allowRestart` and `allowResumeLater` — the answer is yes. A teacher who
 *     wants to stop a class restarting is not served by a checkbox they have to
 *     find and understand.
 *   - `enableCameraZoomAndPan` — off on purpose. Unity's own comment reads
 *     "keep the board stable on mobile", which is a platform decision rather
 *     than a lesson one.
 *   - `allowClassicCustomization` — internal, and means nothing in a teacher's
 *     vocabulary.
 *
 * They keep Unity's defaults and are simply not shown. A settings screen with
 * seven switches makes a teacher believe all seven matter, and the three that
 * genuinely change the lesson get lost among them.
 *
 * ## The three that stayed each change what a student experiences
 *
 * Every label describes the student's side, because that is what the teacher is
 * actually choosing between. "Allow hints" describes a flag; "students can ask
 * for a hint" describes a classroom.
 */

type Toggle = {
  key: 'allowHints' | 'showBoardGuide' | 'allowCompletedPictureView'
  label: string
  /** What the student gets when it is on. */
  on: string
  /** What changes when it is off. Never phrased as a punishment. */
  off: string
}

const TOGGLES: Toggle[] = [
  {
    key: 'allowHints',
    label: 'Hints',
    on: 'Students can ask for a hint on any question.',
    off: 'No hints. Students work each question out on their own.',
  },
  {
    key: 'showBoardGuide',
    label: 'Show picture guide',
    on: 'A faint finished picture appears behind the pieces as a hint.',
    off: 'A dark board shows piece outlines. The picture is revealed as pieces are earned.',
  },
  {
    key: 'allowCompletedPictureView',
    label: 'Picture-only view',
    on: 'Students can hide the controls for a clear view of their current puzzle.',
    off: 'Controls stay visible while students play.',
  },
]

export function OptionsPanel({
  draft,
  onChange,
}: {
  draft: ActivityDraft
  onChange: (next: ActivityDraft) => void
}) {
  const set = (key: Toggle['key'], value: boolean) =>
    onChange({ ...draft, config: { ...draft.config, [key]: value } })

  return (
    <section className={styles.panel} aria-label="Student options">
      <p className={styles.intro}>
        Choose the help students receive while they play. Try these settings in
        Preview; preview progress starts fresh after a reload.
      </p>

      <ul className={styles.list}>
        {TOGGLES.map((t) => {
          const on = draft.config[t.key]
          return (
            <li key={t.key} className={styles.row}>
              <label className={styles.control}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={on}
                  onChange={(e) => set(t.key, e.target.checked)}
                />
                <span className={styles.text}>
                  <span className={styles.label}>{t.label}</span>
                  {/*
                    The consequence of the CURRENT state, not a static
                    description. A teacher scanning this should be able to read
                    what their class will experience without doing the mental
                    inversion of "unchecked means not that".
                  */}
                  <span className={styles.effect}>{on ? t.on : t.off}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
