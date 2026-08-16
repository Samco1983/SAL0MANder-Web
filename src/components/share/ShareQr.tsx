import { useEffect, useState } from 'react'
import styles from './SharePanel.module.css'

/**
 * QR for a share link.
 *
 * The encoder is imported dynamically so it never reaches the initial bundle.
 * A student opening a share link must not download a QR library to play — only
 * a teacher on the sharing surface needs it, and by then a small extra chunk is
 * free.
 */
export function ShareQr({ url, size = 176 }: { url: string; size?: number }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; dataUrl: string } | { status: 'failed' }
  >({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })

    import('qrcode')
      .then((qr) =>
        qr.toDataURL(url, {
          width: size,
          margin: 1,
          // Printed worksheets get photocopied and creased; the highest error
          // correction level survives that far better than the default.
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#ffffff' },
        }),
      )
      .then((dataUrl) => {
        if (active) setState({ status: 'ready', dataUrl })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })

    return () => {
      active = false
    }
  }, [url, size])

  if (state.status === 'failed') {
    // Never block sharing on the QR: the link itself is the real artifact.
    return (
      <p className={styles.qrFallback} role="status">
        QR code unavailable — use the link instead.
      </p>
    )
  }

  if (state.status === 'loading') {
    return <div className={styles.qrPlaceholder} style={{ width: size, height: size }} />
  }

  return (
    <img
      className={styles.qr}
      src={state.dataUrl}
      width={size}
      height={size}
      // The QR encodes the link, which is already shown as text beside it, so
      // describing it again would be noise for a screen reader.
      alt=""
    />
  )
}
