import { useEffect, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import { GIFT_SURVEY, GiftAnswerTextSchema } from '@/gifts/giftSurvey'
import styles from './PuzzleGifts.module.css'

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
  const template = GIFT_SURVEY[step]!
  const value = answers[template.id] ?? ''
  const parsed = GiftAnswerTextSchema.safeParse(value)
  const completed = GIFT_SURVEY.filter(
    (item) => GiftAnswerTextSchema.safeParse(answers[item.id] ?? '').success,
  ).length
  useEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [step, review])

  return (
    <section className={styles.section} aria-labelledby="gift-questions-heading">
      <h2 id="gift-questions-heading">3. Make it about you</h2>
      <p>
        Nine little favorites. Type yours or tap a suggestion. Your answers become the right picks.
      </p>
      <p role="status">{completed} of 9 answered</p>
      {review ? (
        <>
          <h3>Review your favorites</h3>
          <ul className={styles.review}>
            {GIFT_SURVEY.map((item, index) => (
              <li key={item.id}>
                <span>
                  <strong>{item.label}</strong>
                  <span>{answers[item.id]}</span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(index)
                    setReview(false)
                  }}
                  aria-label={`Edit ${item.label.toLowerCase()}`}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
          <p>Your favorites are ready. Choose the occasion below.</p>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!parsed.success) return
            onAnswer(template.id, parsed.data)
            if (step === GIFT_SURVEY.length - 1) setReview(true)
            else setStep(step + 1)
          }}
        >
          <p className={styles.eyebrow}>Question {step + 1} of 9</p>
          <label className={styles.surveyLabel} htmlFor="gift-favorite">
            {template.ask}
          </label>
          <input
            ref={input}
            id="gift-favorite"
            className={styles.textAnswer}
            type="text"
            value={value}
            onChange={(event) => onAnswer(template.id, event.target.value)}
            autoComplete="off"
            aria-describedby="gift-answer-help gift-answer-error"
            aria-invalid={Boolean(value && !parsed.success)}
          />
          <p id="gift-answer-help" className={styles.quiet}>
            Keep it short: up to 40 characters. Some symbols take more room.
          </p>
          <p id="gift-answer-error" role={value && !parsed.success ? 'alert' : undefined}>
            {value && !parsed.success ? parsed.error.issues[0]?.message : ''}
          </p>
          <div className={styles.suggestions} aria-label="Answer suggestions">
            {template.suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="secondary"
                onClick={() => {
                  onAnswer(template.id, suggestion)
                  input.current?.focus()
                }}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
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
