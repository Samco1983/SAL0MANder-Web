import { Link } from 'react-router-dom'
import { LearningOffers } from '@components/learning/LearningOffers'
import { buildPath, paths } from '@config/routes'
import type { DemoLevel } from '@content/demoLevels'
import { clearStartKey } from './idempotency'
import styles from './DemoLevelControls.module.css'

/** An explicit page navigation gives each level a fresh v1 Unity receiver and session. */
export function DemoLevelControls({ level, completed }: { level: DemoLevel; completed: boolean }) {
  function freshAttempt(id: string) {
    clearStartKey(`${id}-v1`)
  }
  return (
    <section className={styles.controls} aria-label="Demo levels">
      <p className={styles.label} role="status">
        <strong>
          Level {level.level} of 3 · {level.label}
        </strong>
        <span>
          {level.pieceCount} {level.series === 'matching' ? 'tiles' : 'pieces'}
          {level.mode === 'classic-puzzle' ? ' · No questions' : ''}
        </span>
      </p>
      {completed ? (
        <div className={styles.actions}>
          {level.nextId ? (
            <Link
              className={styles.primary}
              reloadDocument
              to={buildPath.guestPlay(level.nextId)}
              onClick={() => freshAttempt(level.nextId!)}
            >
              Next level
            </Link>
          ) : (
            <span className={styles.finished}>Final level complete!</span>
          )}
          <Link
            reloadDocument
            to={buildPath.guestPlay(level.id)}
            onClick={() => freshAttempt(level.id)}
          >
            Replay level
          </Link>
          {level.previousId ? (
            <Link
              reloadDocument
              to={buildPath.guestPlay(level.previousId)}
              onClick={() => freshAttempt(level.previousId!)}
            >
              Easier level
            </Link>
          ) : null}
          <Link reloadDocument to={paths.guestPlayIndex}>
            Choose another demo
          </Link>
        </div>
      ) : (
        <span className={styles.note}>Finish the picture to continue.</span>
      )}
      {completed && <LearningOffers compact />}
    </section>
  )
}
