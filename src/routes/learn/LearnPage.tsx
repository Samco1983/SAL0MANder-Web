import { useEffect, useReducer, useRef, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button, LinkButton } from '@components/ui/Button'
import { paths } from '@config/routes'
import { env } from '@config/env'
import { equationSupport, helpEvidenceReducer, initialHelpEvidence } from '@content/questionSupport'
import { LESSONS, courseLabel, lessonBackup, type Lesson } from './lessonCatalog'
import { QuestionHelp } from './QuestionHelp'
import styles from './LearnPage.module.css'

export function LearnPage() {
  const [selected, setSelected] = useState('')
  const lesson = LESSONS.find((entry) => entry.id === selected)
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Math you can explain</p>
          <h1>Find your next math lesson</h1>
          <p>
            Choose a course, explore a worked example, and try a short practice set. Bring your
            thinking to your next lesson.
          </p>
          <p className={styles.quiet}>
            Four original pilot lessons for grades 6, 7, 8 and Algebra I. These samples are not a
            complete grades 6–12 curriculum. Your work stays on this page and clears when you leave
            or change lessons.
          </p>
          <div className={styles.actions}>
            <LinkButton to={env.sites?.tutoring || paths.classroom}>Book Tutoring</LinkButton>
            <LinkButton
              to={
                env.sites?.puzzles ? env.sites.puzzles + paths.guestPlayIndex : paths.guestPlayIndex
              }
              variant="secondary"
            >
              Puzzle Practice
            </LinkButton>
          </div>
        </header>
        <section aria-labelledby="course-title">
          <h2 id="course-title">Pick a course</h2>
          <div className={styles.courses}>
            {LESSONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected === entry.id}
                className={styles.course}
                onClick={() => setSelected(entry.id)}
              >
                <strong>{courseLabel(entry)}</strong>
                <span>{entry.title}</span>
                <small>{entry.teacherGuide.learningTarget}</small>
              </button>
            ))}
          </div>
        </section>
        {lesson && <LessonView key={lesson.id} lesson={lesson} />}
      </div>
    </AppShell>
  )
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState(0)
  const [independent, setIndependent] = useState(false)
  const [freshCheck, setFreshCheck] = useState(false)
  const questions = lesson.activityDraft.questions.slice(0, 3)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <article className={styles.lesson} aria-labelledby="lesson-title">
      <p className={styles.eyebrow}>{courseLabel(lesson)} · Pilot lesson</p>
      <h2 id="lesson-title" ref={heading} tabIndex={-1}>
        {lesson.title}
      </h2>
      <p>
        <strong>Your goal: </strong>
        {lesson.teacherGuide.learningTarget}
      </p>
      <div hidden={independent}>
        {!freshCheck && (
          <section className={styles.card} aria-labelledby="example-title">
            <h3 id="example-title">A worked example</h3>
            <p>{lesson.teacherGuide.miniLesson}</p>
            <p className={styles.quiet}>
              Try the model on paper or in your writing app. Explain why each step makes sense.
            </p>
          </section>
        )}
        <section className={styles.card} aria-labelledby="practice-title">
          <h3 id="practice-title">Try a short practice set</h3>
          <p className={styles.quiet}>
            Supported practice · Question {step + 1} of {questions.length}. Hints are available.
            There is no timer or saved score.
          </p>
          {questions.map((question, index) => (
            <div key={question.id} hidden={index !== step}>
              <PracticeQuestion
                lesson={lesson}
                index={index}
                active={!independent && index === step}
                onFreshCheckChange={setFreshCheck}
              />
            </div>
          ))}
          <div className={styles.actions}>
            <Button
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep((value) => value - 1)}
            >
              Previous question
            </Button>
            <Button
              variant="secondary"
              disabled={step === questions.length - 1}
              onClick={() => setStep((value) => value + 1)}
            >
              Next question
            </Button>
          </div>
        </section>
      </div>
      <section className={styles.card} aria-labelledby="independent-title">
        <h3 id="independent-title">Try it independently</h3>
        {independent ? (
          <IndependentCheck lesson={lesson} />
        ) : (
          <>
            <p>
              Use a fresh sheet for a different problem. Finish your own work before opening the
              review guide.
            </p>
            <Button onClick={() => setIndependent(true)}>Start independent check</Button>
          </>
        )}
        {independent && (
          <Button variant="secondary" onClick={() => setIndependent(false)}>
            Back to supported practice
          </Button>
        )}
      </section>
      <section className={styles.card} aria-labelledby="studio-title">
        <h3 id="studio-title">Bring the full lesson into Teacher Studio</h3>
        <p>
          The download contains all 12 questions in a Studio backup. In Teacher Studio, choose{' '}
          <strong>Import backup</strong> and select the file. It adds a new copy. Choose a picture
          and review the student options before previewing the puzzle.
        </p>
        <p className={styles.quiet}>
          The file includes correct answers. Keep it for lesson preparation.
        </p>
        <DownloadLesson key={lesson.id} lesson={lesson} />
        <LinkButton to={paths.studio} variant="secondary">
          Open Teacher Studio
        </LinkButton>
      </section>
      <details className={styles.card}>
        <summary>Standards and pilot scope</summary>
        <p>{lesson.teacherGuide.assessmentLimits}</p>
        <ul>
          {lesson.standards.map((standard) => (
            <li key={standard.id}>
              <a href={standard.url} target="_blank" rel="noopener noreferrer">
                California {standard.id}
              </a>{' '}
              — {standard.alignmentSummary}
            </li>
          ))}
        </ul>
        <p>
          Original practice material, not a CDE endorsement or an automatically adaptive course. A
          tutor can review your reasoning and choose the next lesson.
        </p>
      </details>
    </article>
  )
}

function PracticeQuestion({
  lesson,
  index,
  active,
  onFreshCheckChange,
}: {
  lesson: Lesson
  index: number
  active: boolean
  onFreshCheckChange: (active: boolean) => void
}) {
  const question = lesson.activityDraft.questions[index]!
  const note = lesson.questionNotes.find((entry) => entry.questionId === question.id)!
  const [selected, setSelected] = useState('')
  const [checked, setChecked] = useState(false)
  const [hint, setHint] = useState(false)
  const [freshCheck, setFreshCheck] = useState(false)
  const [evidence, dispatch] = useReducer(helpEvidenceReducer, note, initialHelpEvidence)
  const support =
    question.id === 'ca-g7-math-equations-q01' ? equationSupport(question, note) : null
  const supported = support !== null
  useEffect(() => {
    if (!supported) return
    onFreshCheckChange(active && freshCheck)
    return () => onFreshCheckChange(false)
  }, [active, freshCheck, onFreshCheckChange, supported])
  const legend = useRef<HTMLLegendElement>(null)
  useEffect(() => {
    if (active) legend.current?.focus()
  }, [active])
  const choice = question.choices.find((entry) => entry.id === selected)
  return (
    <div>
      <fieldset className={styles.question}>
        <legend ref={legend} tabIndex={-1}>
          {question.questionText}
        </legend>
        {question.choices.map((entry) => (
          <label key={entry.id} className={styles.choice}>
            <input
              type="radio"
              name={question.id}
              value={entry.id}
              checked={selected === entry.id}
              onChange={() => {
                setSelected(entry.id)
                setChecked(false)
              }}
            />
            <span>{entry.text}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        <Button
          disabled={!selected || checked}
          onClick={() => {
            if (!choice) return
            setChecked(true)
            if (support)
              dispatch({ type: 'original_answer', choiceId: choice.id, correct: choice.isCorrect })
          }}
        >
          Check answer
        </Button>
        {!support && (
          <Button
            variant="secondary"
            aria-expanded={hint}
            onClick={() => setHint((value) => !value)}
          >
            {hint ? 'Hide hint' : 'Show a hint'}
          </Button>
        )}
      </div>
      {support && (
        <QuestionHelp
          support={support}
          active={active}
          evidence={evidence}
          onAction={dispatch}
          onFreshCheckChange={setFreshCheck}
          threeReads={{
            happening: 'A craft order has a delivery charge and a price for each kit.',
            quantities: `$${support.constant} for delivery, $${support.coefficient} per kit, $${support.total} in total.`,
            find: 'The number of kits, represented by x.',
          }}
        />
      )}
      {hint && (
        <p className={styles.hint}>
          {question.hintText} <span className={styles.quiet}>This is supported practice.</span>
        </p>
      )}
      {checked && choice && !freshCheck && (
        <div role="status" className={styles.feedback}>
          <strong>{choice.isCorrect ? 'That works.' : 'Take another look.'}</strong>
          <p>{note.choiceReasoning.find((entry) => entry.choiceId === choice.id)!.reason}</p>
          {choice.isCorrect && <p>Explain the method in your own words before moving on.</p>}
        </div>
      )}
    </div>
  )
}

function IndependentCheck({ lesson }: { lesson: Lesson }) {
  const [finished, setFinished] = useState(false)
  const prompt = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    prompt.current?.focus()
  }, [])
  return (
    <div>
      <p ref={prompt} tabIndex={-1}>
        {lesson.teacherGuide.independentExit.prompt}
      </p>
      <p className={styles.quiet}>{lesson.teacherGuide.independentExit.conditions}</p>
      {finished ? (
        <div className={styles.feedback}>
          <h4>Compare and discuss</h4>
          <ul>
            {lesson.teacherGuide.performanceRubric.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p>{lesson.teacherGuide.independentExit.review}</p>
          <p className={styles.quiet}>This page does not grade or save your independent work.</p>
        </div>
      ) : (
        <Button onClick={() => setFinished(true)}>I finished — show the review guide</Button>
      )}
    </div>
  )
}

function DownloadLesson({ lesson }: { lesson: Lesson }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const ownedUrl = useRef('')
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(
    () => () => {
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current)
    },
    [],
  )
  useEffect(() => {
    if (url) link.current?.focus()
  }, [url])
  function prepare() {
    try {
      const next = URL.createObjectURL(
        new Blob([lessonBackup(lesson)], { type: 'application/json' }),
      )
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current)
      ownedUrl.current = next
      setUrl(next)
      setError('')
    } catch {
      setError('The download could not be prepared. Try again in this browser.')
    }
  }
  return (
    <div className={styles.download}>
      <Button variant="secondary" onClick={prepare}>
        Prepare Studio download
      </Button>
      {url && (
        <a ref={link} href={url} download={`${lesson.id}.studio-backup.json`}>
          Download Studio activity
        </a>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
