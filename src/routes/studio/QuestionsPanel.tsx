import { Button } from '@components/ui/Button'
import {
  MAX_CHOICES,
  MIN_CHOICES,
  PROBLEM_TEXT,
  addChoice,
  addQuestion,
  editChoice,
  editQuestion,
  moveQuestion,
  questionProblems,
  removeChoice,
  removeQuestion,
  setCorrectChoice,
} from '@studio/questions'
import { missAllowance, puzzlePrice, type ActivityDraft } from '@studio/activityDraft'
import styles from './QuestionsPanel.module.css'

/**
 * Where a teacher writes the questions.
 *
 * ## Every question is open at once
 *
 * No accordion, no one-at-a-time wizard. A teacher writing ten questions is
 * checking them against each other — spotting a repeat, balancing difficulty,
 * making sure the same answer is not correct four times running. Collapsing them
 * hides exactly the comparison the work depends on, and it turns proofreading
 * into ten clicks.
 *
 * ## Problems are shown per question
 *
 * `questionProblems` returns what is unfinished about *that* question, so the
 * teacher is pointed at the row rather than told the activity is invalid and
 * left to hunt. Nothing here blocks typing — an unfinished question is normal
 * mid-work, and only the Readiness Checklist decides whether it can be
 * published.
 *
 * ## The correct answer is a radio, not a checkbox
 *
 * `QuestionSchema` requires exactly one correct choice. A checkbox can express
 * zero or two; a radio cannot. Making the invalid state unreachable beats
 * validating for it afterwards.
 */
export function QuestionsPanel({
  draft,
  onChange,
}: {
  draft: ActivityDraft
  onChange: (next: ActivityDraft) => void
}) {
  const price = puzzlePrice(draft)
  const spare = missAllowance(draft)
  const short = price - draft.questions.length

  return (
    <section className={styles.panel} aria-label="Questions">
      {/*
        Answers are currency: a correct answer earns one, each piece costs one.
        Stated as a fact the teacher can act on rather than an error — writing
        extra questions is how they give a class room to miss a few.
      */}
      <div className={styles.budget} data-short={short > 0}>
        {short > 0 ? (
          <>
            <strong>{draft.questions.length} of {price} questions.</strong> This puzzle needs{' '}
            {price} correct answers, so students cannot finish it yet. Add {short} more
            {short > 2 ? ', or use fewer puzzle pieces' : ''}.
          </>
        ) : (
          <>
            <strong>{draft.questions.length} questions · puzzle costs {price}.</strong>{' '}
            {spare === 0
              ? 'Students must get every question right. Add a few more to give them room to miss one.'
              : `Students can miss ${spare} and still finish the picture.`}
          </>
        )}
      </div>

      {draft.questions.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Students answer these to uncover the picture. Write them in the order you want them
            asked.
          </p>
          <Button onClick={() => onChange(addQuestion(draft))}>Write the first question</Button>
        </div>
      ) : (
        <ol className={styles.list}>
          {draft.questions.map((q, index) => {
            const problems = questionProblems(q)
            return (
              <li key={q.id} className={styles.question}>
                <div className={styles.questionHead}>
                  <span className={styles.number}>Question {index + 1}</span>
                  <div className={styles.questionTools}>
                    <button
                      type="button"
                      className={styles.tool}
                      onClick={() => onChange(moveQuestion(draft, q.id, -1))}
                      disabled={index === 0}
                      aria-label={`Move question ${index + 1} earlier`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.tool}
                      onClick={() => onChange(moveQuestion(draft, q.id, 1))}
                      disabled={index === draft.questions.length - 1}
                      aria-label={`Move question ${index + 1} later`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.tool}
                      onClick={() => onChange(removeQuestion(draft, q.id))}
                      aria-label={`Delete question ${index + 1}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <label className={styles.field}>
                  <span className={styles.srOnly}>Question {index + 1} text</span>
                  <textarea
                    className={styles.questionText}
                    rows={2}
                    value={q.questionText}
                    placeholder="What do you want to ask?"
                    onChange={(e) => onChange(editQuestion(draft, q.id, { questionText: e.target.value }))}
                  />
                </label>

                <fieldset className={styles.choices}>
                  <legend className={styles.srOnly}>Answers for question {index + 1}</legend>
                  {q.choices.map((c, ci) => (
                    <div key={c.id} className={styles.choice} data-correct={c.isCorrect}>
                      <label className={styles.correctPick}>
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={c.isCorrect}
                          onChange={() => onChange(setCorrectChoice(draft, q.id, c.id))}
                        />
                        <span className={styles.srOnly}>
                          Mark answer {ci + 1} correct
                        </span>
                      </label>
                      <input
                        className={styles.choiceText}
                        value={c.text}
                        placeholder={`Answer ${ci + 1}`}
                        aria-label={`Answer ${ci + 1} for question ${index + 1}`}
                        onChange={(e) => onChange(editChoice(draft, q.id, c.id, e.target.value))}
                      />
                      <button
                        type="button"
                        className={styles.tool}
                        onClick={() => onChange(removeChoice(draft, q.id, c.id))}
                        disabled={q.choices.length <= MIN_CHOICES}
                        aria-label={`Remove answer ${ci + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {q.choices.length < MAX_CHOICES && (
                    <Button size="sm" variant="secondary" onClick={() => onChange(addChoice(draft, q.id))}>
                      Add an answer
                    </Button>
                  )}
                </fieldset>

                <label className={styles.field}>
                  <span className={styles.label}>Hint</span>
                  <span className={styles.hint}>
                    Shown if a student asks for help. Point at the method, not the answer.
                  </span>
                  <input
                    className={styles.hintInput}
                    value={q.hintText}
                    placeholder="Optional"
                    onChange={(e) => onChange(editQuestion(draft, q.id, { hintText: e.target.value }))}
                  />
                </label>

                {problems.length > 0 && (
                  <p className={styles.problems}>
                    {problems.map((p) => PROBLEM_TEXT[p]).join(' · ')}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {draft.questions.length > 0 && (
        <div className={styles.addRow}>
          <Button onClick={() => onChange(addQuestion(draft))}>Add a question</Button>
        </div>
      )}
    </section>
  )
}
