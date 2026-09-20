import { learningOfferLinks } from '@config/learningOffers'
import styles from './LearningOffers.module.css'

/** Optional learning links never gate play or send a message without the visitor acting. */
export function LearningOffers({ compact = false }: { compact?: boolean }) {
  const links = learningOfferLinks()
  return (
    <section
      className={compact ? styles.compact : styles.offers}
      aria-label="Learning with Sam"
      id={compact ? undefined : 'learning-options'}
    >
      {compact ? (
        <span className={styles.prompt}>Keep learning with Sam:</span>
      ) : (
        <div className={styles.copy}>
          <h2>Keep learning with Sam</h2>
          <p>
            Get personal math help with paid tutoring for grades 6–12 and adult learners. Ask about
            paid practice packets and curriculum options, plus planned membership tiers.
          </p>
          <p className={styles.free}>Free puzzles and picture gifts stay free.</p>
        </div>
      )}
      <div className={styles.links}>
        <a
          className={compact ? styles.textLink : styles.primary}
          href={links.tutoring}
          target={links.hasBooking ? '_blank' : undefined}
          rel={links.hasBooking ? 'noopener noreferrer' : undefined}
          title={links.hasBooking ? 'Opens Google booking in a new tab' : undefined}
        >
          {links.hasBooking
            ? compact
              ? 'Tutoring with Sam'
              : 'See tutoring times'
            : 'Ask about tutoring'}
        </a>
        <a className={styles.textLink} href={links.practiceInquiry}>
          {compact ? 'Packets & curriculum inquiry' : 'Ask about packets, curriculum & memberships'}
        </a>
      </div>
    </section>
  )
}
