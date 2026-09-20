import { useRef, useState, type FormEvent } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { env } from '@config/env'
import { paths } from '@config/routes'
import { readLessonInvitation } from '@config/classroom'
import { TutoringBooking } from './TutoringBooking'
import { MeetingCodeCopy } from './MeetingCodeCopy'
import styles from './ClassroomPage.module.css'

export function ClassroomPage() {
  const practicePath = env.sites?.puzzles
    ? env.sites.puzzles + paths.guestPlayIndex
    : paths.guestPlayIndex
  const giftsPath = env.sites?.puzzles ? env.sites.puzzles + paths.gifts : paths.gifts
  const [input, setInput] = useState('')
  const [invitation, setInvitation] = useState(() =>
    readLessonInvitation(env.classroom.invitation?.url ?? ''),
  )
  const [error, setError] = useState('')
  const join = useRef<HTMLAnchorElement>(null)
  const focusJoin = useRef(false)
  function prepare(event: FormEvent) {
    event.preventDefault()
    const parsed = readLessonInvitation(input)
    setInvitation(parsed)
    setError(
      parsed
        ? ''
        : 'Paste the Zoom or Google Meet participant link or meeting code from your tutor.',
    )
    focusJoin.current = !!parsed
    if (parsed && join.current) join.current.focus()
  }
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Grades 6–12 math · Families and adult learners</p>
          <h1>Private tutoring &amp; small groups of up to 6 students</h1>
          <p>
            Build confidence in math with a tutor, then keep exploring with self-paced puzzle
            practice. Private lessons and groups of 1–6 students are available to request; your
            tutor confirms the group size.
          </p>
          <div className={styles.actions}>
            <a className={styles.action} href="#booking">
              Book Tutoring
            </a>
            <LinkButton to={paths.classes} variant="secondary">
              Find a small group
            </LinkButton>
            <a href="#live-classroom">Join a live lesson</a>
            <LinkButton to={practicePath} variant="secondary">
              Puzzle Practice
            </LinkButton>
            <LinkButton to={giftsPath} variant="secondary">
              Puzzle Gifts
            </LinkButton>
            <LinkButton to={paths.learn} variant="secondary">
              Math Lessons
            </LinkButton>
          </div>
        </header>

        <TutoringBooking />
        <div className={styles.grid}>
          <section className={styles.card} id="live-classroom" aria-labelledby="live-title">
            <p className={styles.step}>Live tutoring</p>
            <h2 id="live-title">Join your live classroom</h2>
            <p>
              Video, audio and lesson chat open in Zoom or Google Meet. Your tutor chooses the
              meeting app and controls admission and chat.
            </p>
            <LinkButton to={paths.classes} variant="secondary">
              Open my group booking
            </LinkButton>
            <p className={styles.quiet}>
              For a paid group class, use the Join lesson button in your booking when joining opens.
            </p>
            <h3>Have an invitation from your tutor?</h3>
            <p>
              For an arranged private lesson, paste your invitation below. Pasting a link here does
              not confirm a booking.
            </p>
            <form onSubmit={prepare} className={styles.form}>
              <label htmlFor="meet-invitation">Zoom or Google Meet link, or meeting code</label>
              <input
                id="meet-invitation"
                type="text"
                value={input}
                maxLength={2048}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                aria-describedby={error ? 'meet-error meet-help' : 'meet-help'}
                aria-invalid={!!error}
                onChange={(event) => {
                  setInput(event.target.value)
                  setError('')
                  setInvitation(null)
                }}
              />
              <p id="meet-help" className={styles.quiet}>
                Your pasted invitation stays in this page. It is not saved or sent to SAL0MANder.
              </p>
              {error && (
                <p id="meet-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit">Use this invitation</Button>
            </form>
            {invitation ? (
              <div className={styles.join}>
                <a
                  className={styles.action}
                  href={invitation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  ref={(node) => {
                    join.current = node
                    if (node && focusJoin.current) {
                      focusJoin.current = false
                      node.focus()
                    }
                  }}
                >
                  Join lesson in {invitation.provider === 'zoom' ? 'Zoom' : 'Google Meet'}
                </a>
                <MeetingCodeCopy key={invitation.meetingCode} code={invitation.meetingCode} />
                <p className={styles.quiet}>
                  Video, audio and lesson chat open in{' '}
                  {invitation.provider === 'zoom' ? 'Zoom' : 'Google Meet'}. If the link does not
                  open, open {invitation.provider === 'zoom' ? 'Zoom' : 'Google Meet'} on the web or
                  in its app and enter this meeting code. Use the account your tutor invited if
                  sign-in is requested.
                  {invitation.provider === 'zoom' &&
                    ' Use the passcode from your invitation if asked.'}
                </p>
              </div>
            ) : (
              <p className={styles.quiet}>
                No lesson is selected. Paste your invitation above to continue.
              </p>
            )}
            <details className={styles.help}>
              <summary>Video, chat and saving your work</summary>
              <p>
                Use the chat inside your meeting app during the lesson. This website does not store
                that chat or record your call.
              </p>
              <p>
                Save writing in your writing app. If your booked account has a preparation area, you
                can upload schoolwork there for your tutor; it is separate from the live chat.
              </p>
            </details>
            <details className={styles.help}>
              <summary>One device or computer + iPad and pen</summary>
              <h3>One device</h3>
              <p>
                Join in the meeting app with your camera and microphone. Write on paper and show it
                to the camera, or ask your tutor to let you share your writing app’s screen.
              </p>
              <h3>Computer + iPad and pen</h3>
              <p>
                Use the computer for the call. Open the same meeting on your iPad, keep the iPad
                microphone muted and speaker volume down to avoid echo, then share its screen and
                open your writing app. Use your pen there.
              </p>
              <p className={styles.quiet}>
                Everyone in the lesson can see the shared screen. Stop sharing when finished. This
                is not a shared whiteboard built into this website.
              </p>
              <div className={styles.actions}>
                <a
                  href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066104"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Zoom iPad screen sharing
                </a>
                <a
                  href="https://support.google.com/meet/answer/9308856?co=GENIE.Platform%3DiOS&hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Meet iPad screen sharing
                </a>
              </div>
            </details>
          </section>

          <div className={styles.side}>
            <section className={styles.card} aria-labelledby="practice-title">
              <p className={styles.step}>Self-paced practice</p>
              <h2 id="practice-title">Keep exploring between lessons</h2>
              <p>
                Open a practice puzzle or use the activity link your tutor shared. Guest puzzle play
                does not require a SAL0MANder account.
              </p>
              <div className={styles.actions}>
                <LinkButton to={practicePath}>Open puzzle practice</LinkButton>
                <LinkButton to={paths.studio} variant="secondary">
                  Teacher Studio
                </LinkButton>
              </div>
              <p className={styles.quiet}>
                Tutors can prepare questions and pictures in Teacher Studio.
              </p>
              <p>
                Start with an original sample lesson in grade 6, 7, 8 or Algebra I: worked examples,
                hints and a separate independent check.
              </p>
              <LinkButton to={paths.learn} variant="secondary">
                Browse sample math lessons
              </LinkButton>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
