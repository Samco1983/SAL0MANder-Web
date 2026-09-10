import { useEffect, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import {
  GIFT_SURVEY,
  GIFT_SURVEY_IDEAS,
  GiftAnswerTextSchema,
  giftAnswerKey,
} from '@/gifts/giftSurvey'
import styles from './GiftSurveyForm.module.css'

export function GiftSurveyForm({
  answers,
  onAnswer,
}: {
  answers: Record<string, string>
  onAnswer: (id: string, value: string) => void
}) {
  const [step, setStep] = useState(0)
  const [review, setReview] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const question = useRef<HTMLLabelElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const focusTarget = useRef<'answer' | 'question' | 'review' | null>(null)
  const template = GIFT_SURVEY[step]!
  const ideas = GIFT_SURVEY_IDEAS[template.id]
  const value = answers[template.id] ?? ''
  const parsed = GiftAnswerTextSchema.safeParse(value)
  const validAnswers = GIFT_SURVEY.map(
    (item) => GiftAnswerTextSchema.safeParse(answers[item.id] ?? '').success,
  )
  const completed = validAnswers.filter(Boolean).length
  const allAnswered = completed === GIFT_SURVEY.length

  useEffect(() => {
    const target = focusTarget.current
    if (target === 'answer') input.current?.focus()
    if (target === 'question') question.current?.focus()
    if (target === 'review') reviewHeading.current?.focus()
    focusTarget.current = null
  }, [step, review])

  function openQuestion(index: number, focus: 'question' | 'answer' = 'question') {
    focusTarget.current = focus
    if (!review && index === step) {
      const target = focus === 'answer' ? input.current : question.current
      target?.focus()
      focusTarget.current = null
    }
    setStep(index)
    setReview(false)
  }

  function openReview() {
    focusTarget.current = 'review'
    setReview(true)
  }

  return (
    <section className={styles.section} aria-labelledby="gift-questions-heading">
      <header className={styles.header}>
        <h2 id="gift-questions-heading">3. Make it about you</h2>
        <p>Nine favorites. How well do they know you? Your picks become the right answers.</p>
      </header>
      <div className={styles.progressRow}>
        <p role="status">{completed} of 9 answered</p>
        {!review && (
          <Button type="button" variant="ghost" onClick={openReview}>
            Review all favorites
          </Button>
        )}
      </div>
      <progress
        className={styles.progress}
        aria-label="Favorites answered"
        max={GIFT_SURVEY.length}
        value={completed}
      />
      <nav aria-label="Choose a favorite">
        <ol className={styles.questions}>
          {GIFT_SURVEY.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.questionButton}
                aria-label={`Question ${index + 1}: ${item.label}, ${validAnswers[index] ? 'answered' : 'not answered'}`}
                aria-current={!review && step === index ? 'step' : undefined}
                data-answered={validAnswers[index]}
                onClick={() => openQuestion(index)}
              >
                <span aria-hidden="true">{GIFT_SURVEY_IDEAS[item.id].icon}</span>
                <span>{GIFT_SURVEY_IDEAS[item.id].shortLabel}</span>
                <span className={styles.questionMark} aria-hidden="true">
                  {validAnswers[index] ? '✓' : index + 1}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {review ? (
        <div className={styles.card}>
          <h3 ref={reviewHeading} tabIndex={-1}>
            Review your favorites
          </h3>
          <p className={styles.quiet}>
            {allAnswered
              ? 'That’s you in nine answers. Change any pick, or choose the occasion below.'
              : 'A few favorites still need a pick. You can answer them in any order.'}
          </p>
          <ul className={styles.review}>
            {GIFT_SURVEY.map((item, index) => (
              <li key={item.id}>
                <span className={styles.reviewAnswer}>
                  <strong>{item.label}</strong>
                  <span>{answers[item.id] || 'Not answered yet'}</span>
                  {!validAnswers[index] && answers[item.id] && (
                    <span className={styles.invalid}>Needs a shorter, plain-text answer</span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => openQuestion(index, 'answer')}
                  aria-label={`Edit ${item.label.toLowerCase()}`}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
          {!allAnswered && (
            <Button type="button" onClick={() => openQuestion(validAnswers.indexOf(false))}>
              Continue favorites
            </Button>
          )}
        </div>
      ) : (
        <form
          className={styles.card}
          onSubmit={(event) => {
            event.preventDefault()
            if (!parsed.success) return
            onAnswer(template.id, parsed.data)
            if (step === GIFT_SURVEY.length - 1) openReview()
            else openQuestion(step + 1)
          }}
        >
          <div className={styles.promptTop}>
            <span className={styles.heroIcon} aria-hidden="true">
              {ideas.icon}
            </span>
            <p className={styles.eyebrow}>Question {step + 1} of 9</p>
          </div>
          <label
            ref={question}
            tabIndex={-1}
            className={styles.surveyLabel}
            htmlFor="gift-favorite"
          >
            {template.ask}
          </label>
          <div className={styles.suggestions} role="group" aria-label="Answer suggestions">
            {[...template.suggestions, ...ideas.extra].map((suggestion) => {
              const selected =
                parsed.success && giftAnswerKey(parsed.data) === giftAnswerKey(suggestion)
              return (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestion}
                  aria-pressed={selected}
                  onClick={() => onAnswer(template.id, suggestion)}
                >
                  <span className={styles.choiceMark} aria-hidden="true">
                    {selected ? '✓' : '+'}
                  </span>
                  {suggestion}
                </button>
              )
            })}
          </div>
          <p className={styles.typeHint}>Or make it your own</p>
          <input
            ref={input}
            id="gift-favorite"
            className={styles.textAnswer}
            type="text"
            value={value}
            onChange={(event) => onAnswer(template.id, event.target.value)}
            placeholder="Type your favorite…"
            autoComplete="off"
            enterKeyHint="next"
            aria-describedby="gift-answer-help gift-answer-error"
            aria-invalid={Boolean(value && !parsed.success)}
          />
          <p id="gift-answer-help" className={styles.quiet}>
            Up to 40 characters. Some symbols take more room.
          </p>
          <p
            id="gift-answer-error"
            className={styles.invalid}
            role={value && !parsed.success ? 'alert' : undefined}
          >
            {value && !parsed.success ? parsed.error.issues[0]?.message : ''}
          </p>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              onClick={() => openQuestion(step - 1)}
            >
              Back
            </Button>
            <Button type="submit" disabled={!parsed.success}>
              {step === GIFT_SURVEY.length - 1 ? 'Review favorites' : 'Next favorite'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
