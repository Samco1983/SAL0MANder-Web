import { lazy, Suspense, useState } from 'react'
import { Button } from '@components/ui/Button'
import { useCopyToClipboard } from './useCopyToClipboard'
import styles from './SharePanel.module.css'

// Split so neither the QR encoder nor its chunk is in the initial download.
const ShareQr = lazy(() => import('./ShareQr').then((m) => ({ default: m.ShareQr })))

/**
 * The teacher-facing share surface.
 *
 * A share link is the product's distribution mechanism: it gets pasted into
 * Google Classroom, listed on TPT, and printed on worksheets as a QR. All three
 * routes are supported here, and the raw link stays visible and selectable so
 * there is always a manual path when the clipboard is unavailable.
 */
export function SharePanel({ url, title }: { url: string; title?: string }) {
  const { state, copy } = useCopyToClipboard()
  const [showQr, setShowQr] = useState(false)

  return (
    <section className={styles.panel} aria-label="Share this activity">
      <h2 className={styles.heading}>Share</h2>
      {title ? <p className={styles.subject}>{title}</p> : null}

      <div className={styles.linkRow}>
        {/*
          Readonly rather than disabled: a disabled input is not selectable or
          reachable by keyboard, which removes the fallback the copy button
          depends on.
        */}
        <input className={styles.linkInput} value={url} readOnly aria-label="Share link" />
        <Button variant="secondary" onClick={() => void copy(url)}>
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy link'}
        </Button>
      </div>

      {/* Announced politely so the outcome reaches a screen reader either way. */}
      <p className={styles.copyStatus} role="status">
        {state === 'copied'
          ? 'Link copied to your clipboard.'
          : state === 'failed'
            ? 'Could not reach the clipboard. Select the link above and copy it manually.'
            : ''}
      </p>

      <Button variant="ghost" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
        {showQr ? 'Hide QR code' : 'Show QR code'}
      </Button>

      {showQr ? (
        <div className={styles.qrWrap}>
          <Suspense
            fallback={<div className={styles.qrPlaceholder} style={{ width: 176, height: 176 }} />}
          >
            <ShareQr url={url} />
          </Suspense>
          <p className={styles.qrHint}>
            Point a phone camera at this, or print it on a worksheet. It opens the activity with no
            sign-in.
          </p>
        </div>
      ) : null}
    </section>
  )
}
