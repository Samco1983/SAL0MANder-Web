import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Quiz } from '@contracts/v1'
import { Button } from '@components/ui/Button'
import styles from './QuizPanel.module.css'

/**
 * The web-playable lesson.
 *
 * A student following a share link can answer the whole quiz here with no Unity
 * build present. The puzzle is an enhancement to this, never a prerequisite for
 * it — before this existed, a missing WebGL build meant a teacher could share
 * nothing that worked.
 *
 * NO PUZZLE LOGIC LIVES HERE and none ever should. `linkedPieceIndex` is
 * carried in the contract and deliberately ignored: which piece a correct
 * answer releases is Unity's decision, and duplicating it on the web is the one
 * thing CLAUDE.md names as out of scope.
 */

type Answers = Record<string, string>

export type QuizSubmission = {
  questionsAnswered: number
  questionsCorrect: number
  durationMs: number
}

/**
 * Progress key. Bound to the ATTEMPT, not the activity: two attempts at the
 * same lesson are different work, and restoring the first into the second would
 * silently answer questions the student never saw.
 */
const keyFor = (attemptId: string, quizId: string) => `sal0:quiz:${attemptId}:${quizId}`

/**
 * Submitted-ness has to persist too, and for a while it did not.
 *
 * Answers survived a refresh but the "finished" flag was React state only, so a
 * student could finish, reload, and submit the whole lesson a second time —
 * duplicate results in a teacher's record. The in-memory guards were real and
 * caught a double CLICK; they simply did not survive the page.
 *
 * Found by measuring a reloaded page rather than by re-reading the component.
 */
const doneKeyFor = (attemptId: string, quizId: string) =>
  `sal0:quiz:${attemptId}:${quizId}:submitted`

function loadAnswers(key: string): Answers {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return {}
    // Shape-check rather than cast: this is user-writable storage, and a
    // half-written or hand-edited value must degrade to "start over" instead of
    // rendering something incoherent to a child.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([k, v]) => typeof k === 'string' && typeof v === 'string',
      ),
    ) as Answers
  } catch {
    return {}
  }
}

export function QuizPanel({
  quiz,
  attemptId,
  onComplete,
  submitting = false,
  submitted = false,
}: {
  quiz: Quiz
  attemptId: string
  onComplete: (submission: QuizSubmission) => void
  submitting?: boolean
  submitted?: boolean
}) {
  const storageKey = keyFor(attemptId, quiz.quizId)
  const doneKey = doneKeyFor(attemptId, quiz.quizId)
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(storageKey))
  const [wasSubmitted, setWasSubmitted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(doneKey) === '1'
    } catch {
      return false
    }
  })
  const startedAt = useRef<number>(Date.now())

  // Restored progress must not be counted as time spent, or a lesson resumed
  // the next morning reports a sixteen-hour duration.
  useEffect(() => {
    startedAt.current = Date.now()
  }, [storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(answers))
    } catch {
      // A full or disabled store must never break the lesson. Losing progress
      // is bad; refusing to let a student answer is worse.
    }
  }, [answers, storageKey])

  const answeredCount = useMemo(
    () => quiz.questions.filter((q) => answers[q.questionId]).length,
    [quiz.questions, answers],
  )
  const allAnswered = answeredCount === quiz.questions.length

  const correctCount = useMemo(
    () =>
      quiz.questions.filter((q) => {
        const chosen = answers[q.questionId]
        return chosen ? q.choices.some((c) => c.choiceId === chosen && c.isCorrect) : false
      }).length,
    [quiz.questions, answers],
  )

  const choose = useCallback(
    (questionId: string, choiceId: string) => {
      if (submitted || submitting) return
      setAnswers((prev) => ({ ...prev, [questionId]: choiceId }))
    },
    [submitted, submitting],
  )

  const finish = useCallback(() => {
    // Guard is here as well as on `disabled`, because a disabled attribute is a
    // hint to a pointer and nothing at all to a double-fired event or a
    // keyboard repeat.
    if (!allAnswered || submitting || submitted) return
    onComplete({
      questionsAnswered: answeredCount,
      questionsCorrect: correctCount,
      durationMs: Math.max(0, Date.now() - startedAt.current),
    })
  }, [allAnswered, submitting, submitted, onComplete, answeredCount, correctCount])

  useEffect(() => {
    if (!submitted) return
    setWasSubmitted(true)
    try {
      // Written only when `submitted` is true, and the parent flips that only
      // AFTER the result write is awaited. Recording it earlier would lock a
      // student out of a lesson whose result never left the device.
      window.localStorage.setItem(doneKey, '1')
    } catch {
      // A full store means the guard is in-memory only for this page. Losing
      // it is better than refusing to let a student finish.
    }
  }, [submitted, doneKey])

  if (submitted || wasSubmitted) {
    return (
      <section className={styles.panel} aria-labelledby="quiz-done">
        <h2 id="quiz-done" className={styles.title}>
          Finished
        </h2>
        <p className={styles.done}>
          You answered {correctCount} of {quiz.questions.length} correctly. Your teacher will see
          this.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.panel} aria-labelledby="quiz-title">
      <h2 id="quiz-title" className={styles.title}>
        Questions
      </h2>

      {/* Polite, and only the count changes — announcing every keystroke of
          progress would talk over a student who is still reading. */}
      <p className={styles.progress} role="status" aria-live="polite">
        {answeredCount} of {quiz.questions.length} answered
      </p>

      <ol className={styles.list}>
        {quiz.questions.map((q, index) => (
          <li key={q.questionId} className={styles.item}>
            {/* A real fieldset + legend, so a screen reader announces the
                question with each choice instead of reading five orphaned
                labels. Native radios also give arrow-key navigation for free. */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.prompt}>
                <span className={styles.index}>{index + 1}.</span> {q.prompt}
              </legend>
              <div className={styles.choices}>
                {q.choices.map((c) => {
                  const id = `${q.questionId}-${c.choiceId}`
                  return (
                    <label key={c.choiceId} className={styles.choice} htmlFor={id}>
                      <input
                        id={id}
                        type="radio"
                        name={q.questionId}
                        value={c.choiceId}
                        checked={answers[q.questionId] === c.choiceId}
                        onChange={() => choose(q.questionId, c.choiceId)}
                        disabled={submitting}
                      />
                      <span>{c.text}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <Button onClick={finish} disabled={!allAnswered || submitting}>
        {submitting ? 'Sending…' : 'Finish'}
      </Button>

      {!allAnswered ? <p className={styles.hint}>Answer every question to finish.</p> : null}
    </section>
  )
}
