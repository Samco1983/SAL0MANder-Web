import { useEffect, useRef, useState, type FormEvent } from 'react'
import { readClassMeetingInvitation } from '@config/classroom'
import type { ClassMeetingResult, GroupClass, GroupClient } from '@/groups/client'
import styles from './ClassMeetingPanel.module.css'

type Props = { client: GroupClient; group: GroupClass; accountId: string }

export function ClassMeetingPanel(props: Props) {
  return <MeetingSetup key={`${props.accountId}:${props.group.id}`} {...props} />
}

function MeetingSetup({ client, group }: Props) {
  const [provider, setProvider] = useState<'zoom' | 'google-meet'>('zoom')
  const [joinUrl, setJoinUrl] = useState('')
  const [saved, setSaved] = useState<ClassMeetingResult['meeting']>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    const current = ++generation.current
    setLoading(true)
    setLoaded(false)
    setSaved(null)
    setJoinUrl('')
    setError('')
    if (!client.meeting || !client.saveMeeting) {
      setLoading(false)
      return
    }
    void client
      .meeting(group.id)
      .then((result) => {
        if (current !== generation.current) return
        setSaved(result.meeting)
        setProvider(result.meeting?.provider ?? 'zoom')
        setJoinUrl(result.meeting?.joinUrl ?? '')
        setLoaded(true)
      })
      .catch(() => {
        if (current === generation.current)
          setError('Could not load this class meeting. Try again.')
      })
      .finally(() => {
        if (current === generation.current) setLoading(false)
      })
    return () => {
      generation.current = current + 1
    }
  }, [client, group.id, reload])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!client.saveMeeting || !loaded || busy) return
    setError('')
    setMessage('')
    const value = joinUrl.trim()
    if (!readClassMeetingInvitation(provider, value)) {
      setError(
        'Paste the participant join link for the selected app. Host/start links cannot be saved.',
      )
      return
    }
    const current = generation.current
    setBusy(true)
    try {
      const result = await client.saveMeeting(group.id, { provider, joinUrl: value })
      if (current !== generation.current) return
      setSaved(result.meeting)
      setJoinUrl(result.meeting?.joinUrl ?? '')
      setMessage('Meeting link saved privately for this class.')
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : 'The meeting link was not saved. Try again.')
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }

  const app = provider === 'zoom' ? 'Zoom' : 'Google Meet'
  return (
    <section className={styles.panel} aria-label="Class video meeting setup">
      <h2>Set up this class meeting</h2>
      <p>
        {group.topic} ·{' '}
        {new Date(group.startsAt).toLocaleString('en-US', {
          timeZone: group.timeZone,
          dateStyle: 'medium',
          timeStyle: 'short',
        })}{' '}
        Pacific
      </p>
      <p>Video, audio and lesson chat run in Zoom or Google Meet.</p>
      {loading && <p role="status">Loading the class meeting…</p>}
      {!client.meeting || !client.saveMeeting ? (
        <p>Private meeting setup is not connected here yet.</p>
      ) : (
        <form className={styles.form} onSubmit={save}>
          <label>
            Meeting app
            <select
              value={provider}
              disabled={!loaded || busy}
              onChange={(e) => {
                setProvider(e.target.value as 'zoom' | 'google-meet')
                setJoinUrl('')
                setError('')
                setMessage('')
              }}
            >
              <option value="zoom">Zoom</option>
              <option value="google-meet">Google Meet</option>
            </select>
          </label>
          <ol className={styles.steps}>
            <li>
              Open {app} and schedule a meeting for this class time. Use a new meeting for this
              class.
            </li>
            <li>
              {provider === 'zoom'
                ? 'In Zoom, turn on Waiting Room. Admit learners after checking them against your paid roster below.'
                : 'In Google Meet, use host admission controls and check learners against your paid roster below.'}
            </li>
            <li>Copy the participant join link, then save it here.</li>
          </ol>
          <div className={styles.actions}>
            <a
              className={styles.secondary}
              href={provider === 'zoom' ? 'https://zoom.us/signin' : 'https://meet.google.com/'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {app} setup
            </a>
            {provider === 'zoom' && (
              <a
                href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060700"
                target="_blank"
                rel="noopener noreferrer"
              >
                Zoom scheduling guide
              </a>
            )}
          </div>
          {provider === 'zoom' && (
            <p className={styles.quiet}>
              Sign in to Zoom, then choose Meetings → Schedule a Meeting. This website does not
              create your Zoom account or meeting.
            </p>
          )}
          {provider === 'zoom' && (
            <p className={styles.quiet}>
              Use a Zoom host license that supports the full 60-minute lesson; Basic meetings
              usually end at 40 minutes.{' '}
              <a
                href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067966"
                target="_blank"
                rel="noopener noreferrer"
              >
                Check Zoom meeting duration
              </a>
            </p>
          )}
          <label>
            Participant join link
            <input
              type="url"
              value={joinUrl}
              maxLength={512}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={!loaded || busy}
              onChange={(e) => {
                setJoinUrl(e.target.value)
                setError('')
                setMessage('')
              }}
            />
          </label>
          <p className={styles.quiet}>
            Saved links are shown to the booked account after payment is verified and joining opens.
            A copied link can still be forwarded; check admission in your meeting app.
          </p>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={!loaded || busy || !joinUrl.trim()}>
              {busy ? 'Saving…' : 'Save private meeting link'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={loading || busy}
              onClick={() => {
                setMessage('')
                setReload((n) => n + 1)
              }}
            >
              Reload saved meeting
            </button>
          </div>
        </form>
      )}
      {saved && (
        <p>
          <a href={saved.joinUrl} target="_blank" rel="noopener noreferrer">
            Open saved participant link
          </a>
          <span className={styles.quiet}>
            {' '}
            · Start the meeting from your {saved.provider === 'zoom' ? 'Zoom' : 'Google Meet'} host
            account.
          </span>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
