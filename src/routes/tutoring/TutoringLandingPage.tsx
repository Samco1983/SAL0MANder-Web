import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@components/layout/AppShell'
import { env } from '@config/env'
import { paths } from '@config/routes'
import styles from './TutoringLandingPage.module.css'

const WEEKDAY_AVAILABILITY = [
  ['Monday', '4:30–7:00 AM · 4:30–10:00 PM'],
  ['Tuesday', '4:30–7:00 AM · 4:30–10:00 PM'],
  ['Wednesday', '4:30–7:00 AM · 7:30–10:00 PM'],
  ['Thursday', '4:30–7:00 AM · 4:30–10:00 PM'],
  ['Friday', '4:30–7:00 AM · 4:30–10:00 PM'],
] as const

type TutoringType = 'Small group' | 'One-on-one'

export function TutoringLandingPage() {
  const bookingUrl = env.classroom.bookingUrl
  const [type, setType] = useState<TutoringType>('One-on-one')
  const [details, setDetails] = useState({
    requestedTime: '',
    studentName: '',
    guardianName: '',
    email: '',
    grade: '',
    course: '',
    state: 'California',
    school: '',
    topic: '',
    assessment: '',
    struggle: '',
  })

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Online Math Tutoring | SAL0MANder'
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = meta?.content ?? null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content =
      'Live online math tutoring personalized around your student’s actual classwork. Small groups are $20 per student and one-on-one tutoring is $45 for 60 minutes.'

    return () => {
      document.title = previousTitle
      if (previousDescription === null) meta?.remove()
      else if (meta) meta.content = previousDescription
    }
  }, [])

  const requestMailto = useMemo(() => {
    const body = [
      'Tutoring request',
      '',
      `Type: ${type}`,
      `Requested day/time: ${details.requestedTime || 'Not selected yet'}`,
      `Student: ${details.studentName || 'Not entered'}`,
      `Parent/guardian: ${details.guardianName || 'Not entered'}`,
      `Contact email: ${details.email || 'Not entered'}`,
      `Grade: ${details.grade || 'Not entered'}`,
      `Course: ${details.course || 'Not entered'}`,
      `State: ${details.state || 'Not entered'}`,
      `School/district: ${details.school || 'Not entered'}`,
      `Current topic / need: ${details.topic || 'Not entered'}`,
      `Upcoming quiz/test/assignment: ${details.assessment || 'Not entered'}`,
      `Biggest struggle: ${details.struggle || 'Not entered'}`,
      '',
      'I will attach any worksheet/photo/PDF separately if needed.',
    ].join('\n')

    return `mailto:sal@salomandermath.com?subject=${encodeURIComponent(
      `Tutoring request — ${type}`,
    )}&body=${encodeURIComponent(body)}`
  }, [details, type])

  function update(key: keyof typeof details, value: string) {
    setDetails((current) => ({ ...current, [key]: value }))
  }

  function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.location.href = requestMailto
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Teacher-led online math tutoring</p>
            <h1>Help with the math your student is actually doing right now.</h1>
            <p className={styles.lead}>
              Send the worksheet, homework, study guide, screenshot, or topic from class. Tutoring
              is built around that work, with targeted practice and SAL0MANder activities for
              reinforcement between sessions.
            </p>
            <p className={styles.focus}>
              Strongest initial focus: Grades 6–10 math. Students outside that range may still
              request support.
            </p>
            <div className={styles.heroActions}>
              {bookingUrl ? (
                <a className={styles.primary} href={bookingUrl} target="_blank" rel="noreferrer">
                  Book a one-on-one time
                </a>
              ) : (
                <a className={styles.primary} href="#request">
                  Request tutoring
                </a>
              )}
              <a className={styles.secondary} href="#request">
                Start a tutoring request
              </a>
            </div>
          </div>
          <aside className={styles.promise} aria-label="Tutoring promise">
            <strong>Human first.</strong>
            <span>Live instruction with a real teacher.</span>
            <span>Practice matched to classwork and current needs.</span>
            <span>Remote sessions with clear, limited capacity.</span>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="pricing-title">
          <p className={styles.eyebrow}>Simple pricing</p>
          <h2 id="pricing-title">Choose the kind of support you need.</h2>
          <div className={styles.cards}>
            <article className={styles.card}>
              <h3>Small group</h3>
              <p className={styles.price}>$20</p>
              <p>per student · 60 minutes</p>
              <ul>
                <li>Hard maximum of 6 students</li>
                <li>Shared live instruction</li>
                <li>Best for students working on similar skills</li>
              </ul>
              <Link className={styles.inlineLink} to={paths.classes}>
                See small-group availability
              </Link>
            </article>
            <article className={styles.card}>
              <h3>One-on-one</h3>
              <p className={styles.price}>$45</p>
              <p>one student · 60 minutes</p>
              <ul>
                <li>Private live session</li>
                <li>Built around the student’s current classwork</li>
                <li>Focused reteaching, examples, and practice</li>
              </ul>
              {bookingUrl ? (
                <a className={styles.inlineLink} href={bookingUrl} target="_blank" rel="noreferrer">
                  Open the booking calendar
                </a>
              ) : (
                <a className={styles.inlineLink} href="#request">
                  Request a time
                </a>
              )}
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="availability-title">
          <p className={styles.eyebrow}>Pacific Time</p>
          <h2 id="availability-title">When tutoring is available.</h2>
          <div className={styles.schedule}>
            {WEEKDAY_AVAILABILITY.map(([day, hours]) => (
              <div key={day}>
                <strong>{day}</strong>
                <span>{hours}</span>
              </div>
            ))}
            <div>
              <strong>Saturday</strong>
              <span>Request a time · pre-approval required</span>
            </div>
            <div>
              <strong>Sunday</strong>
              <span>Request a time · generally 1:00–10:00 PM · pre-approval required</span>
            </div>
          </div>
          <p className={styles.note}>
            These are availability windows, not giant sessions. Bookable times are offered as
            individual 60-minute slots. Weekend times are requests until confirmed.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="how-title">
          <p className={styles.eyebrow}>What to expect</p>
          <h2 id="how-title">Bring the real assignment. Build the missing skill.</h2>
          <div className={styles.steps}>
            <article>
              <span>1</span>
              <h3>Show what you are working on</h3>
              <p>Worksheet, homework, study guide, screenshot, quiz review, or just the topic.</p>
            </article>
            <article>
              <span>2</span>
              <h3>Get targeted live help</h3>
              <p>We identify the prerequisite or misconception and work the skill together.</p>
            </article>
            <article>
              <span>3</span>
              <h3>Reinforce it</h3>
              <p>Use focused practice, worked examples, and SAL0MANder puzzle activities.</p>
            </article>
          </div>
        </section>

        <section className={styles.section} id="request" aria-labelledby="request-title">
          <p className={styles.eyebrow}>Start here</p>
          <h2 id="request-title">Tell me what the student needs help with.</h2>
          <p className={styles.note}>
            This launch form prepares an email request. It does not create a paid booking, upload a
            file, or claim a Google Meet session is confirmed.
          </p>

          <form className={styles.form} onSubmit={sendRequest}>
            <label>
              Tutoring type
              <select value={type} onChange={(event) => setType(event.target.value as TutoringType)}>
                <option>One-on-one</option>
                <option>Small group</option>
              </select>
            </label>
            <label>
              Requested day/time
              <input
                value={details.requestedTime}
                onChange={(event) => update('requestedTime', event.target.value)}
                placeholder="Example: Tuesday around 5:30 PM Pacific"
              />
            </label>
            <label>
              Student name
              <input
                value={details.studentName}
                onChange={(event) => update('studentName', event.target.value)}
              />
            </label>
            <label>
              Parent/guardian name
              <input
                value={details.guardianName}
                onChange={(event) => update('guardianName', event.target.value)}
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                required
                value={details.email}
                onChange={(event) => update('email', event.target.value)}
              />
            </label>
            <label>
              Grade
              <input value={details.grade} onChange={(event) => update('grade', event.target.value)} />
            </label>
            <label>
              Course
              <input
                value={details.course}
                onChange={(event) => update('course', event.target.value)}
                placeholder="Example: Integrated Math II"
              />
            </label>
            <label>
              State
              <input value={details.state} onChange={(event) => update('state', event.target.value)} />
            </label>
            <label>
              School / district (optional)
              <input
                value={details.school}
                onChange={(event) => update('school', event.target.value)}
              />
            </label>
            <label className={styles.wide}>
              Current topic / what help is needed
              <textarea
                required
                value={details.topic}
                onChange={(event) => update('topic', event.target.value)}
              />
            </label>
            <label className={styles.wide}>
              Upcoming quiz, test, or assignment
              <textarea
                value={details.assessment}
                onChange={(event) => update('assessment', event.target.value)}
              />
            </label>
            <label className={styles.wide}>
              Biggest struggle
              <textarea
                value={details.struggle}
                onChange={(event) => update('struggle', event.target.value)}
              />
            </label>
            <label className={styles.wide}>
              Worksheet / homework / photo / PDF
              <input type="file" accept="image/*,.pdf" />
              <small>
                File selection stays on this device in this launch version. Attach the file to the
                email that opens, or send it after booking.
              </small>
            </label>
            <button className={styles.primary} type="submit">
              Prepare tutoring request email
            </button>
          </form>
        </section>

        <section className={styles.section} aria-labelledby="provider-title">
          <p className={styles.eyebrow}>Launch status</p>
          <h2 id="provider-title">What is connected — and what is not.</h2>
          <div className={styles.providerGrid}>
            <div>
              <strong>Google booking</strong>
              <span>{bookingUrl ? 'Available for one-on-one scheduling' : 'Not connected yet'}</span>
            </div>
            <div>
              <strong>Google Meet / Calendar</strong>
              <span>Used after a real booking or invitation; no fake confirmation on this page</span>
            </div>
            <div>
              <strong>Schoolwork upload</strong>
              <span>Provider upload is not connected yet; email attachment is the launch fallback</span>
            </div>
            <div>
              <strong>Payment</strong>
              <span>No payment is taken by this page unless a verified provider flow is opened</span>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="practice-title">
          <h2 id="practice-title">Want to see the learning tools first?</h2>
          <p>
            Puzzle practice remains free and separate from tutoring. Students can try SAL0MANder
            without signing up for tutoring.
          </p>
          <Link className={styles.secondary} to={paths.guestPlayIndex}>
            Try puzzle practice
          </Link>
        </section>
      </div>
    </AppShell>
  )
}
