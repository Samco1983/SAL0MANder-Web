import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  HelpPolicySchema,
  availableHelpTiers,
  exampleEquation,
  freshEquation,
  helpCategory,
  sameNumber,
  type EquationSupport,
  type HelpAction,
  type HelpEvidence,
  type HelpPolicy,
  type HelpTier,
} from '@content/questionSupport'
import styles from './QuestionHelp.module.css'

const TITLES = [
  'Light help',
  'Balance model',
  'Solve with me',
  'Different example',
  'Full solution',
] as const
const EVIDENCE_LABELS = [
  'No help opened',
  'Light help used',
  'Visual help used',
  'Guided help used',
  'Worked example used',
  'Full solution used',
] as const

type Props = {
  support: EquationSupport
  active?: boolean
  evidence: HelpEvidence
  onAction: (action: HelpAction) => void
  policy?: Partial<HelpPolicy>
  threeReads?: { happening: string; quantities: string; find: string }
  /** Hide surrounding worked examples/feedback even when a pending check's panel is closed. */
  onFreshCheckChange?: (active: boolean) => void
  /** Only render an action when the host supplies a real integration. */
  onAskTeacher?: () => void | Promise<void>
}

/** Dismissible web help; the host owns evidence separately from answers or game progress. */
export function QuestionHelp({
  support,
  active = true,
  evidence,
  onAction,
  policy: overrides,
  threeReads,
  onFreshCheckChange,
  onAskTeacher,
}: Props) {
  const policy = useMemo(() => HelpPolicySchema.parse(overrides ?? {}), [overrides])
  const available = useMemo(() => availableHelpTiers(policy), [policy])
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<HelpTier | null>(null)
  const [previewingFull, setPreviewingFull] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [guideAnswer, setGuideAnswer] = useState('')
  const [guideFeedback, setGuideFeedback] = useState('')
  const [freshVisible, setFreshVisible] = useState(false)
  const [freshAnswer, setFreshAnswer] = useState('')
  const [freshFeedback, setFreshFeedback] = useState('')
  const [teacherError, setTeacherError] = useState('')
  const [asking, setAsking] = useState(false)
  const [reads, setReads] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const thresholdShown = useRef(false)
  const originalAttempts = useRef(evidence.originalAttempts.length)
  const panelId = useId()
  const incorrect = evidence.originalAttempts.filter((attempt) => !attempt.correct).length
  const suggested = incorrect >= 3 ? 3 : incorrect >= 2 ? 2 : null
  const activeTier = tier && available.includes(tier) ? tier : null
  const currentCheck = evidence.freshChecks.at(-1)
  const fresh = currentCheck ? freshEquation(support, currentCheck.sequence) : null

  function chooseTier(next: HelpTier) {
    setTier(next)
    setFreshVisible(false)
    setOpen(true)
    const preview = next === 5 && !evidence.exampleViewed
    setPreviewingFull(preview)
    onAction({ type: 'open_tier', tier: preview ? 4 : next })
  }
  function close() {
    setOpen(false)
    trigger.current?.focus()
  }
  function reopen() {
    if (freshVisible && currentCheck) setOpen(true)
    else if (activeTier) {
      setOpen(true)
      onAction({ type: 'open_tier', tier: previewingFull ? 4 : activeTier })
    } else {
      const next = activeTier ?? available[0]
      if (next) chooseTier(next)
    }
  }
  useEffect(() => {
    if (open) closeButton.current?.focus({ preventScroll: true })
  }, [open])
  useEffect(() => {
    if (!open) return
    function dismissFromPanel(event: KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        event.target instanceof Node &&
        panel.current?.contains(event.target)
      ) {
        event.preventDefault()
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('keydown', dismissFromPanel)
    return () => document.removeEventListener('keydown', dismissFromPanel)
  }, [open])
  useEffect(() => {
    onFreshCheckChange?.(freshVisible)
    return () => onFreshCheckChange?.(false)
  }, [freshVisible, onFreshCheckChange])
  useEffect(() => {
    if (originalAttempts.current !== evidence.originalAttempts.length) {
      originalAttempts.current = evidence.originalAttempts.length
      setFreshVisible(false)
    }
  }, [evidence.originalAttempts.length])
  useEffect(() => {
    // Other lesson views expose the surrounding worked example again.
    if (
      !active &&
      freshVisible &&
      currentCheck &&
      !currentCheck.correct &&
      !currentCheck.helpUsed
    ) {
      onAction({ type: 'open_tier', tier: 4 })
    }
  }, [active, freshVisible, currentCheck, onAction])
  useEffect(() => {
    const limit = policy.suggestAfterIncorrect
    if (thresholdShown.current || limit === null || incorrect < limit || !available.length) return
    thresholdShown.current = true
    const next = available.includes(2) ? 2 : available[0]!
    setTier(next)
    setFreshVisible(false)
    setOpen(true)
    const preview = next === 5 && !evidence.exampleViewed
    setPreviewingFull(preview)
    onAction({ type: 'open_tier', tier: preview ? 4 : next })
  }, [available, incorrect, onAction, policy.suggestAfterIncorrect, evidence.exampleViewed])

  function checkStep() {
    const expected = [support.constant, support.coefficient, support.solution][
      evidence.guidedStepsCompleted
    ]
    if (expected === undefined || !guideAnswer.trim()) return
    if (!sameNumber(guideAnswer, expected)) {
      setGuideFeedback('Try that step again. Keep the two sides equal.')
      return
    }
    onAction({ type: 'guided_step', completed: evidence.guidedStepsCompleted + 1 })
    setGuideAnswer('')
    setGuideFeedback('That step keeps the balance.')
  }
  function beginFresh() {
    onAction({ type: 'begin_fresh_check' })
    setFreshVisible(true)
    setFreshAnswer('')
    setFreshFeedback('')
  }
  if (!available.length && !onAskTeacher) return null
  return (
    <div className={styles.help}>
      <div className={styles.actions}>
        {available.length > 0 && (
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={open ? close : reopen}
          >
            {open ? 'Hide question help' : 'Question help'}
          </button>
        )}
        {!open && policy.autoSuggest && suggested && available.includes(suggested) && (
          <button type="button" onClick={() => chooseTier(suggested)}>
            {suggested === 2 ? 'Try the balance model' : 'Try one step together'}
          </button>
        )}
        {onAskTeacher && (
          <button
            type="button"
            disabled={asking}
            onClick={async () => {
              setAsking(true)
              setTeacherError('')
              try {
                await onAskTeacher()
              } catch {
                setTeacherError('The teacher action could not open. Try again.')
              } finally {
                setAsking(false)
              }
            }}
          >
            Ask teacher
          </button>
        )}
      </div>
      {teacherError && <p role="alert">{teacherError}</p>}
      {open && (
        <section
          ref={panel}
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-modal="false"
          aria-label="Question help"
        >
          <header className={styles.header}>
            <strong>
              {support.coefficient}x + {support.constant} = {support.total}
            </strong>
            <button ref={closeButton} type="button" onClick={close}>
              Close help
            </button>
          </header>
          <div className={styles.body}>
            <label className={styles.level}>
              Help level
              <select
                value={freshVisible ? '' : (activeTier ?? '')}
                onChange={(event) => chooseTier(Number(event.target.value) as HelpTier)}
              >
                <option value="" disabled>
                  {freshVisible ? 'Open support for this check' : 'Choose a level'}
                </option>
                {available.map((value) => (
                  <option key={value} value={value}>
                    {value}. {TITLES[value - 1]}
                  </option>
                ))}
              </select>
            </label>
            {freshVisible && currentCheck && fresh ? (
              <div>
                <h4>Fresh check · {support.standardIds.join(', ')}</h4>
                <p>
                  Use the same method with new numbers. Work without opening help for this check.
                </p>
                {currentCheck.helpUsed && (
                  <p>
                    Support was reopened during this check. You can finish it, then try a new check
                    without help.
                  </p>
                )}
                <p className={styles.equation}>
                  {fresh.coefficient}x + {fresh.constant} = {fresh.total}
                </p>
                {currentCheck.correct ? (
                  <p role="status">
                    {currentCheck.independentSuccess
                      ? 'Correct on a fresh check without opening help. A tutor can review your understanding.'
                      : 'Correct with support. Try a new check without help when you are ready.'}
                  </p>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!freshAnswer.trim()) return
                      const correct = sameNumber(freshAnswer, fresh.solution)
                      onAction({ type: 'fresh_answer', correct })
                      setFreshFeedback(
                        correct
                          ? ''
                          : 'Not yet. Check your operations on both sides and try again.',
                      )
                    }}
                  >
                    <label>
                      Fresh check: x =
                      <input
                        inputMode="decimal"
                        value={freshAnswer}
                        onChange={(event) => setFreshAnswer(event.target.value)}
                      />
                    </label>
                    <button type="submit" disabled={!freshAnswer.trim()}>
                      Check fresh answer
                    </button>
                    {freshFeedback && <p role="status">{freshFeedback}</p>}
                  </form>
                )}
                <div className={styles.actions}>
                  <button type="button" onClick={beginFresh}>
                    Try a new check
                  </button>
                  <button type="button" onClick={close}>
                    Return to my question
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activeTier === 1 && (
                  <div>
                    <h4>Light help</h4>
                    <p>{support.hint}</p>
                    <p>
                      An equation says two amounts are equal. Undo the added amount on both sides
                      first.
                    </p>
                    {threeReads && (
                      <>
                        <button
                          type="button"
                          aria-expanded={reads}
                          onClick={() => setReads((value) => !value)}
                        >
                          Read the story in three parts
                        </button>
                        {reads && (
                          <div>
                            <p>
                              <strong>1. What is happening?</strong> {threeReads.happening}
                            </p>
                            <p>
                              <strong>2. What quantities do we know?</strong>{' '}
                              {threeReads.quantities}
                            </p>
                            <p>
                              <strong>3. What do we need to find?</strong> {threeReads.find}
                            </p>
                            <p>
                              Model: {support.coefficient}x + {support.constant} = {support.total}.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {activeTier === 2 && (
                  <div>
                    <h4>Keep the equation balanced</h4>
                    <EquationBalance support={support} removed={removed} />
                    <p>Each x box is an equal unknown amount. Each dot is one unit.</p>
                    <button type="button" onClick={() => setRemoved((value) => !value)}>
                      {removed ? 'Reset the model' : `Remove ${support.constant} from both sides`}
                    </button>
                    <p role="status">
                      {removed
                        ? `Both sides lost ${support.constant}, so they stay equal. Now find the amount in each x box.`
                        : 'Remove the same amount from both sides to keep them equal.'}
                    </p>
                  </div>
                )}
                {activeTier === 3 && (
                  <div>
                    <h4>Solve with me</h4>
                    {evidence.guidedStepsCompleted === 3 ? (
                      <p>
                        You completed the steps: x = {support.solution}. Return to the original
                        question and choose your answer.
                      </p>
                    ) : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          checkStep()
                        }}
                      >
                        <p>Step {evidence.guidedStepsCompleted + 1} of 3</p>
                        <p className={styles.equation}>
                          {evidence.guidedStepsCompleted === 0
                            ? `${support.coefficient}x + ${support.constant} = ${support.total}`
                            : evidence.guidedStepsCompleted === 1
                              ? `${support.coefficient}x = ${support.total - support.constant}`
                              : `x = ${support.total - support.constant} ÷ ${support.coefficient}`}
                        </p>
                        <label>
                          {evidence.guidedStepsCompleted === 0
                            ? 'What should we subtract from both sides?'
                            : evidence.guidedStepsCompleted === 1
                              ? 'What should we divide both sides by?'
                              : 'Complete the last step: x ='}
                          <input
                            inputMode="decimal"
                            value={guideAnswer}
                            onChange={(event) => setGuideAnswer(event.target.value)}
                          />
                        </label>
                        <button type="submit" disabled={!guideAnswer.trim()}>
                          Check this step
                        </button>
                      </form>
                    )}
                    {guideFeedback && <p role="status">{guideFeedback}</p>}
                  </div>
                )}
                {activeTier === 4 && (
                  <div>
                    <h4>Same skill, different numbers</h4>
                    <WorkedEquation equation={exampleEquation(support)} />
                    <button type="button" onClick={close}>
                      Return to my question
                    </button>
                  </div>
                )}
                {activeTier === 5 && previewingFull && (
                  <div>
                    <h4>First, see a different example</h4>
                    <WorkedEquation equation={exampleEquation(support)} />
                    <button type="button" onClick={() => chooseTier(5)}>
                      Explain my problem
                    </button>
                  </div>
                )}
                {activeTier === 5 && !previewingFull && (
                  <div>
                    <h4>Your full solution</h4>
                    <WorkedEquation equation={support} />
                    <p>
                      This is recorded as full-solution support. You can keep going. A new, similar
                      check without help is needed before reviewing independent understanding.
                    </p>
                    <button type="button" onClick={beginFresh}>
                      Try a fresh check
                    </button>
                  </div>
                )}
                {!activeTier && <p>Choose an available help level.</p>}
              </>
            )}
          </div>
        </section>
      )}
      {evidence.highestTier > 0 && (
        <p className={styles.note} data-help-category={helpCategory(evidence)}>
          {EVIDENCE_LABELS[evidence.highestTier]}. Closing help keeps your answer and this help
          history. Practice notes stay on this page; no mastery grade is saved.
        </p>
      )}
    </div>
  )
}

/** Text and manipulable quantities share the same equation data, independent of any game engine. */
export function EquationBalance({
  support,
  removed,
}: {
  support: EquationSupport
  removed: boolean
}) {
  const right = support.total - (removed ? support.constant : 0)
  return (
    <div
      className={styles.balance}
      role="img"
      aria-label={
        removed
          ? `${support.coefficient} x boxes balance ${right} units. ${support.coefficient}x = ${right}.`
          : `${support.coefficient} x boxes and ${support.constant} units balance ${right} units.`
      }
    >
      <div className={styles.pan} aria-hidden="true">
        <div className={styles.quantities}>
          {Array.from({ length: support.coefficient }, (_, index) => (
            <span className={styles.box} key={`x${index}`}>
              x
            </span>
          ))}
          {!removed &&
            Array.from({ length: support.constant }, (_, index) => (
              <span className={styles.unit} key={`u${index}`} />
            ))}
        </div>
        <strong>
          {support.coefficient}x{!removed && ` + ${support.constant}`}
        </strong>
      </div>
      <strong aria-hidden="true">=</strong>
      <div className={styles.pan} aria-hidden="true">
        <div className={styles.quantities}>
          {Array.from({ length: right }, (_, index) => (
            <span className={styles.unit} key={index} />
          ))}
        </div>
        <strong>{right}</strong>
      </div>
    </div>
  )
}

function WorkedEquation({
  equation,
}: {
  equation: Pick<EquationSupport, 'coefficient' | 'constant' | 'total' | 'solution'>
}) {
  const { coefficient, constant, total, solution } = equation
  return (
    <div>
      <p className={styles.equation}>
        {coefficient}x + {constant} = {total}
      </p>
      <ol>
        <li>
          Subtract {constant} from both sides to undo addition and keep them equal: {coefficient}x ={' '}
          {total - constant}.
        </li>
        <li>
          Divide both sides by {coefficient} to find one equal group: x = {solution}.
        </li>
        <li>
          Check in the original equation: {coefficient} × {solution} + {constant} = {total}.
        </li>
      </ol>
    </div>
  )
}
