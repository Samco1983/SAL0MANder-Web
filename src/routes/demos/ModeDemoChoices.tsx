import { Link } from 'react-router-dom'
import { paths, buildPath } from '@config/routes'
import { DEMO_MATH_COURSES, DEMO_CLASSIC_COURSE } from '@content/demoLevels'
import styles from './ModeDemos.module.css'

const choices = [
  {
    title: 'Mystery Pictures',
    icon: '▧',
    detail: 'Answer and reveal. Choose Mystery Reveal in the game.',
    levels: '3 levels · 4 → 9 → 16 pieces',
    to: buildPath.guestPlay(DEMO_MATH_COURSES[0]!.id),
  },
  {
    title: 'Learning Puzzle',
    icon: '✚',
    detail: 'Answer, then place each piece yourself. Choose Learning Puzzle in the game.',
    levels: '3 levels · 4 → 9 → 16 pieces',
    to: buildPath.guestPlay(DEMO_MATH_COURSES[0]!.id),
  },
  {
    title: 'Classic Jigsaw',
    icon: '▦',
    detail: 'All pieces ready. Put the picture together without questions.',
    levels: '3 levels · 4 → 9 → 16 pieces',
    to: buildPath.guestPlay(DEMO_CLASSIC_COURSE.id),
  },
  {
    title: 'Swap & Solve',
    icon: '↔',
    detail: 'Tap two squares to swap. Start with blank spaces, then fill the board.',
    levels: '8 levels · blanks → full 3×3 → full 4×4',
    to: paths.slideDemo,
  },
] as const

export function ModeDemoChoices() {
  return (
    <section aria-labelledby="mode-demo-title">
      <h2 id="mode-demo-title">Try every way to play</h2>
      <p>
        Start easy, then move up. No account or setup form needed. On a phone, portrait gives you
        the best view. Landscape works too.
      </p>
      <div className={styles.grid}>
        {choices.map((choice) => (
          <Link key={choice.title} to={choice.to} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              {choice.icon}
            </span>
            <strong>{choice.title}</strong>
            <span className={styles.detail}>{choice.detail}</span>
            <span className={styles.levels}>{choice.levels}</span>
            <span className={styles.action}>Try demo →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
