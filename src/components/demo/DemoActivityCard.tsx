import { useState } from 'react'
import { buildPath } from '@config/routes'
import { SharePanel } from '@components/share/SharePanel'
import { Button, LinkButton } from '@components/ui/Button'
import {
  describeLaunchStatus,
  isPlayable,
  type DemoActivity,
} from '@demo/demoActivities'
import styles from './DemoActivityCard.module.css'

/**
 * One demo activity, as a teacher sees it.
 *
 * The card carries a launch-verification badge, and that badge is the reason
 * this component is not just markup. A demo card pointing at an activity looks
 * exactly the same whether the link works or not — the student still gets *a*
 * puzzle either way. Stating what has actually been verified is the only thing
 * on the page that can tell those two apart, so it is placed where the decision
 * is made rather than in a footnote.
 */
export function DemoActivityCard({
  activity,
  baseUrl,
}: {
  activity: DemoActivity
  baseUrl: string
}) {
  const [showShare, setShowShare] = useState(false)
  const status = describeLaunchStatus(activity.launchStatus)
  const playable = isPlayable(activity)
  const headingId = `demo-${activity.id}-title`

  return (
    <article className={styles.card} aria-labelledby={headingId}>
      {/*
        Decorative only, and hidden from assistive tech: it carries no
        information a screen reader would lose. Deliberately an abstract
        pattern rather than a screenshot — a screenshot of gameplay we have
        never successfully launched would be the most misleading element here.
      */}
      <div
        className={styles.preview}
        style={{ '--card-accent': activity.accent } as React.CSSProperties}
        aria-hidden="true"
      >
        <span className={styles.previewGlyph} />
      </div>

      <div className={styles.body}>
        <p className={styles.eyebrow}>{activity.strand}</p>
        <h3 className={styles.title} id={headingId}>
          {activity.title}
        </h3>
        <p className={styles.blurb}>{activity.blurb}</p>

        <p className={styles.gradeTag}>{activity.gradeTag}</p>

        {/*
          `role="status"` rather than a plain span: when this flips from "not
          yet verified" to "launch verified" it is the answer to the question
          the teacher came with, and it should be announced, not silently
          repainted.
        */}
        <p className={styles.status} data-tone={status.tone} role="status">
          <span className={styles.statusLabel}>{status.label}</span>
          <span className={styles.statusDetail}>{status.detail}</span>
        </p>

        <div className={styles.actions}>
          {playable ? (
            <LinkButton to={buildPath.guestPlay(activity.id)}>Play</LinkButton>
          ) : (
            /*
              Not a disabled Button. A disabled control is unreachable by
              keyboard and gives no reason, so a teacher is left guessing why
              the card they are evaluating does nothing. Saying it plainly is
              both more accessible and more honest.
            */
            <p className={styles.unavailable}>Not available to play yet</p>
          )}
          <Button
            variant="secondary"
            onClick={() => setShowShare((open) => !open)}
            aria-expanded={showShare}
            aria-controls={`demo-${activity.id}-share`}
          >
            {showShare ? 'Hide share link' : 'Share link & QR'}
          </Button>
        </div>

        {/*
          The share link is offered even when the activity is not yet playable,
          and that is deliberate: the link's *shape* is stable and printable
          long before the pack exists, so a teacher preparing a worksheet is not
          blocked. The status badge directly above it is what stops that from
          being a promise the link cannot keep.
        */}
        {showShare ? (
          <div className={styles.share} id={`demo-${activity.id}-share`}>
            <SharePanel activityId={activity.id} baseUrl={baseUrl} title={activity.title} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
