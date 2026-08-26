import { useMemo, useRef, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import {
  AUTHORING_CONTRACT_VERSION,
  DEFAULT_PIECE_COUNT,
  PublishableActivityDraftSchema,
  type ActivityDraft,
} from '@contracts/authoring'
import { LocalActivityDraftRepository } from '../../studio/draftRepository'
import {
  parseQuestionImport,
  validateQuestionRows,
  type ImportedQuestionRow,
} from '../../studio/questionImport'
import styles from './TeacherStudioPage.module.css'

const repository = new LocalActivityDraftRepository()
const STEPS = ['Setup', 'Questions', 'Puzzle', 'Test', 'Publish & Share'] as const

function newDraft(): ActivityDraft {
  return {
    contractVersion: AUTHORING_CONTRACT_VERSION,
    id: 'local-activity-draft',
    revision: 0,
    title: '',
    puzzle: { rows: 3, columns: 3 },
    questions: [],
    updatedAt: new Date().toISOString(),
  }
}

function saveDraft(draft: ActivityDraft): ActivityDraft {
  const saved = {
    ...draft,
    revision: draft.revision + 1,
    updatedAt: new Date().toISOString(),
  }
  repository.save(saved)
  return saved
}

type ReviewSnapshot = {
  draft: ActivityDraft
  rows: ImportedQuestionRow[]
}

type QuestionReviewProps = {
  rows: ImportedQuestionRow[]
  onChange: (id: string, field: 'prompt' | 'answer', value: string) => void
  onEditStart: () => void
  onCommit: () => void
  onMove: (id: string, direction: -1 | 1) => void
}

function QuestionReview({ rows, onChange, onEditStart, onCommit, onMove }: QuestionReviewProps) {
  if (rows.length === 0) {
    return <p className={styles.empty}>No questions imported.</p>
  }

  return (
    <ol className={styles.reviewList} aria-label="Imported question review">
      {rows.map((row) => (
        <li key={row.id} className={styles.reviewRow} data-flagged={Boolean(row.issue)}>
          <span className={styles.pieceNumber}>{row.line}</span>
          <label className={styles.reviewField}>
            <span>Question {row.line}</span>
            <input
              value={row.prompt}
              maxLength={240}
              aria-invalid={Boolean(row.issue)}
              onFocus={onEditStart}
              onChange={(event) => onChange(row.id, 'prompt', event.target.value)}
              onBlur={onCommit}
            />
          </label>
          <label className={styles.reviewField}>
            <span>Answer {row.line}</span>
            <input
              value={row.answer}
              maxLength={120}
              aria-invalid={Boolean(row.issue)}
              onFocus={onEditStart}
              onChange={(event) => onChange(row.id, 'answer', event.target.value)}
              onBlur={onCommit}
            />
          </label>
          <span className={styles.rowStatus}>{row.issue ?? 'Ready'}</span>
          <span className={styles.rowActions} aria-label={`Reorder question ${row.line}`}>
            <button
              type="button"
              title="Move question up"
              aria-label={`Move question ${row.line} up`}
              disabled={row.line === 1}
              onClick={() => onMove(row.id, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              title="Move question down"
              aria-label={`Move question ${row.line} down`}
              disabled={row.line === rows.length}
              onClick={() => onMove(row.id, 1)}
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function TeacherStudioPage() {
  const [draft, setDraft] = useState<ActivityDraft>(() => repository.load() ?? newDraft())
  const [importText, setImportText] = useState('')
  const [reviewRows, setReviewRows] = useState<ImportedQuestionRow[]>(() =>
    draft.questions.map((question, index) => ({
      id: question.id,
      line: index + 1,
      prompt: question.prompt,
      answer: question.answer,
    })),
  )
  const [history, setHistory] = useState<ReviewSnapshot[]>([])
  const editSnapshot = useRef<ReviewSnapshot | null>(null)
  const [activeView, setActiveView] = useState<'import' | 'review'>('import')
  const [saveError, setSaveError] = useState<string | null>(null)

  const readiness = useMemo(() => PublishableActivityDraftSchema.safeParse(draft), [draft])
  const remaining = Math.max(0, DEFAULT_PIECE_COUNT - draft.questions.length)
  const flaggedCount = reviewRows.filter((row) => row.issue).length

  function persist(next: ActivityDraft) {
    try {
      const saved = saveDraft(next)
      setDraft(saved)
      setSaveError(null)
    } catch {
      setDraft(next)
      setSaveError('Draft could not be saved on this device.')
    }
  }

  function importQuestions() {
    const result = parseQuestionImport(importText)
    setHistory((current) => [...current.slice(-9), { draft, rows: reviewRows }])
    setReviewRows(result.rows)
    persist({ ...draft, questions: result.questions })
    setActiveView('review')
  }

  function updateReviewRow(id: string, field: 'prompt' | 'answer', value: string) {
    setReviewRows((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  function beginReviewEdit() {
    editSnapshot.current ??= { draft, rows: reviewRows }
  }

  function commitReviewRows() {
    const result = validateQuestionRows(reviewRows)
    const unchanged = JSON.stringify(result.questions) === JSON.stringify(draft.questions)
    if (unchanged) {
      editSnapshot.current = null
      return
    }

    const snapshot = editSnapshot.current ?? { draft, rows: reviewRows }
    setHistory((current) => [...current.slice(-9), snapshot])
    setReviewRows(result.rows)
    persist({ ...draft, questions: result.questions })
    editSnapshot.current = null
  }

  function moveReviewRow(id: string, direction: -1 | 1) {
    const sourceIndex = reviewRows.findIndex((row) => row.id === id)
    const targetIndex = sourceIndex + direction
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= reviewRows.length) return

    const reordered = [...reviewRows]
    const [moved] = reordered.splice(sourceIndex, 1)
    if (!moved) return
    reordered.splice(targetIndex, 0, moved)
    const result = validateQuestionRows(reordered)

    setHistory((current) => [...current.slice(-9), { draft, rows: reviewRows }])
    setReviewRows(result.rows)
    persist({ ...draft, questions: result.questions })
  }

  function undoLastChange() {
    const previous = history.at(-1)
    if (!previous) return
    persist({ ...previous.draft, revision: draft.revision })
    setReviewRows(previous.rows)
    setHistory((current) => current.slice(0, -1))
  }

  return (
    <AppShell contained={false}>
      <div className={styles.studio}>
        <header className={styles.workspaceHeader}>
          <div>
            <p className={styles.eyebrow}>Teacher Studio</p>
            <h1>Activity workshop</h1>
          </div>
          <label className={styles.titleField}>
            <span>Activity title</span>
            <input
              value={draft.title}
              maxLength={120}
              placeholder="Untitled activity"
              onChange={(event) => persist({ ...draft, title: event.target.value })}
            />
          </label>
          <div className={styles.saveState} role="status" aria-live="polite">
            {saveError ??
              (draft.revision > 0 ? `Draft saved · revision ${draft.revision}` : 'New draft')}
          </div>
        </header>

        <nav className={styles.workflow} aria-label="Activity workflow">
          {STEPS.map((step, index) => (
            <span key={step} data-active={index === 1} data-complete={index === 0}>
              <b>{index + 1}</b>
              {step}
            </span>
          ))}
        </nav>

        <div className={styles.workspace}>
          <section className={styles.editor} aria-labelledby="questions-heading">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.stepLabel}>Step 2</p>
                <h2 id="questions-heading">Questions</h2>
              </div>
              <div className={styles.segmented} aria-label="Question view">
                <button
                  type="button"
                  aria-pressed={activeView === 'import'}
                  onClick={() => setActiveView('import')}
                >
                  Import
                </button>
                <button
                  type="button"
                  aria-pressed={activeView === 'review'}
                  onClick={() => setActiveView('review')}
                >
                  Review {reviewRows.length > 0 ? `(${reviewRows.length})` : ''}
                </button>
              </div>
            </div>

            {activeView === 'import' ? (
              <div className={styles.importPanel}>
                <label htmlFor="question-import">Questions and answers</label>
                <textarea
                  id="question-import"
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={'What is -4 + 9? | 5\nWhat is 7 - 12? | -5'}
                  spellCheck="true"
                />
                <div className={styles.importActions}>
                  <span>{importText.split(/\r?\n/).filter((line) => line.trim()).length} rows</span>
                  <Button type="button" onClick={importQuestions} disabled={!importText.trim()}>
                    Import questions
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.reviewPanel}>
                <div className={styles.reviewSummary} aria-live="polite">
                  <span>{draft.questions.length} ready</span>
                  <span>{flaggedCount} flagged</span>
                  <span>{remaining} missing</span>
                </div>
                <QuestionReview
                  rows={reviewRows}
                  onChange={updateReviewRow}
                  onEditStart={beginReviewEdit}
                  onCommit={commitReviewRows}
                  onMove={moveReviewRow}
                />
                <div className={styles.reviewActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={undoLastChange}
                    disabled={history.length === 0}
                  >
                    Undo last change
                  </Button>
                  <Button type="button" onClick={() => setActiveView('import')}>
                    Replace import
                  </Button>
                </div>
              </div>
            )}
          </section>

          <aside className={styles.readiness} aria-labelledby="readiness-heading">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.stepLabel}>3 × 3 puzzle</p>
                <h2 id="readiness-heading">Piece readiness</h2>
              </div>
              <strong className={styles.readinessCount} data-ready={readiness.success}>
                {draft.questions.length}/{DEFAULT_PIECE_COUNT}
              </strong>
            </div>

            <div className={styles.pieceGrid} aria-label="Question to piece map">
              {Array.from({ length: DEFAULT_PIECE_COUNT }, (_, index) => {
                const question = draft.questions.find((item) => item.pieceIndex === index)
                return (
                  <div key={index} data-ready={Boolean(question)}>
                    <b>{index + 1}</b>
                    <span>{question ? 'Question ready' : 'Question needed'}</span>
                  </div>
                )
              })}
            </div>

            <div className={styles.readinessStatus} data-ready={readiness.success} role="status">
              <strong>
                {readiness.success ? 'Ready for puzzle setup' : `${remaining} questions needed`}
              </strong>
              <span>
                {readiness.success
                  ? 'Each question unlocks one distinct piece.'
                  : 'Puzzle setup stays locked until every piece has one question.'}
              </span>
            </div>

            <Button type="button" size="lg" disabled={!readiness.success}>
              Continue to puzzle
            </Button>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
