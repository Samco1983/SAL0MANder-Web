import { useEffect, useState } from 'react'
import type { GroupClient, ReservationJoin } from '@/groups/client'
import styles from './ClassMeetingPanel.module.css'

type Props = { client: GroupClient; accountId: string; reservationId: string; classId: string }

export function ReservationJoinPanel(props: Props) {
  return (
    <ReservationAccess
      key={`${props.accountId}:${props.classId}:${props.reservationId}`}
      {...props}
    />
  )
}

function ReservationAccess({ client, reservationId, classId }: Props) {
  const [access, setAccess] = useState<ReservationJoin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const refresh = () => {
    setAccess(null)
    setReload((n) => n + 1)
  }
  useEffect(() => {
    let active = true
    setAccess(null)
    setError('')
    setLoading(true)
    if (!client.join) {
      setLoading(false)
      return
    }
    void client
      .join(reservationId)
      .then((result) => {
        if (result.classId !== classId || result.reservationId !== reservationId)
          throw new Error('The lesson did not match your reservation.')
        if (active) setAccess(result)
      })
      .catch(() => {
        if (active)
          setError(
            'Could not verify access to this lesson. Use the account that booked it, check your payment status, then try again.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, reservationId, classId, reload])

  useEffect(() => {
    const recheck = () => {
      setAccess(null)
      setReload((n) => n + 1)
    }
    const visible = () => {
      if (document.visibilityState === 'visible') recheck()
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  useEffect(() => {
    if (!access || !['open', 'not_open'].includes(access.state)) return
    const boundary = access.state === 'open' ? access.closesAt : access.opensAt
    const remaining = boundary - Date.now()
    // A local clock can hide an expired link, but only the server can grant access.
    if (remaining <= 0) return
    const timer = window.setTimeout(
      () => {
        setAccess(null)
        setReload((n) => n + 1)
      },
      Math.min(remaining + 25, 2147483647),
    )
    return () => window.clearTimeout(timer)
  }, [access])

  const open = access?.state === 'open' && access.closesAt > Date.now()
  const app = access?.provider === 'zoom' ? 'Zoom' : 'Google Meet'
  return (
    <section className={styles.panel} aria-label="Join your booked lesson">
      <h2>Join your lesson</h2>
      {access && (
        <p>
          <strong>{access.topic}</strong>
          {' · '}
          {new Date(access.startsAt).toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          –
          {new Date(access.closesAt).toLocaleTimeString('en-US', {
            timeZone: 'America/Los_Angeles',
            timeStyle: 'short',
          })}{' '}
          Pacific
        </p>
      )}
      {loading && <p role="status">Checking your booking and lesson time…</p>}
      {!client.join && (
        <p>Online lesson access is not connected here yet. Contact your tutor for joining help.</p>
      )}
      {access?.state === 'unconfigured' && (
        <p role="status">
          Your tutor has not added this class’s meeting yet. Check again near the lesson time.
        </p>
      )}
      {access?.state === 'not_open' && (
        <p role="status">
          Joining opens{' '}
          {new Date(access.opensAt).toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            dateStyle: 'medium',
            timeStyle: 'short',
          })}{' '}
          Pacific.
        </p>
      )}
      {(access?.state === 'ended' || (access?.state === 'open' && !open)) && (
        <p role="status">This lesson’s joining window has ended.</p>
      )}
      {open && access?.joinUrl && (
        <div>
          <p>Your booking is verified. Video, audio and lesson chat open in {app}.</p>
          <a
            className={styles.primary}
            href={access.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (Date.now() >= access.closesAt) {
                e.preventDefault()
                refresh()
              }
            }}
          >
            Join lesson in {app}
          </a>
          <p className={styles.quiet}>
            Your tutor admits you in the meeting app. Keep this class link private.
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {client.join && (
        <button type="button" className={styles.secondary} disabled={loading} onClick={refresh}>
          Check lesson access
        </button>
      )}
    </section>
  )
}
