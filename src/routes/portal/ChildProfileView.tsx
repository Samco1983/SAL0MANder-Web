import { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildChildActor, can, type PortalActor } from '@/portal/access'
import { FUN_GAMES, LESSON_GAMES } from '@/portal/parentActions'
import { portalStorage } from '@/portal/storage'
import type { ChildProfile, PortalState, WorkAttempt, WorkRecord } from '@/portal/types'
import {
  WorkConflictError, openOrCreateWorkRecord, saveWorkDraft,
  simulateExternalDeviceSave, startRedoAttempt, submitWorkRecord, type DraftAnswerInput,
} from '@/portal/workActions'
import { BELT_MASCOT, GRADE7_UNITS, INTEGER_OPERATIONS_SET, checkNumericAnswer, nextUnitName } from '@/portal/worksheet'
import styles from './PortalPage.module.css'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const GAME_LABELS: Record<string, string> = Object.fromEntries([...LESSON_GAMES, ...FUN_GAMES].map((g) => [g.id, g.label]))

function replyWeekday(iso: string | null): string {
  if (!iso) return 'recently'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'recently' : (WEEKDAYS[d.getUTCDay()] ?? 'recently')
}

function formatRaceTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(d)
}

function answersToMap(attempt: WorkAttempt | undefined): Record<string, DraftAnswerInput> {
  const out: Record<string, DraftAnswerInput> = {}
  for (const a of attempt?.answers ?? []) out[a.questionId] = a
  return out
}

export function ChildProfileView({ state, onStateChange }: { state: PortalState; onStateChange: (next: PortalState) => void }) {
  const [selectedChildId, setSelectedChildId] = useState(state.children[0]?.id ?? '')
  const [openWorkId, setOpenWorkId] = useState<string | null>(null)
  const [profileError, setProfileError] = useState('')

  const child = state.children.find((c) => c.id === selectedChildId) ?? state.children[0]
  if (!child) return <Card title="Child profile" headingLevel={2}><p className={styles.note}>No child profiles available.</p></Card>

  const childActor = buildChildActor(state, child.id)
  const mascot = BELT_MASCOT[child.currentBelt]
  const visibleWork = state.workRecords.filter((record) => can(childActor, 'view', { type: 'work', record }))
  const visibleFeedback = state.feedback.filter((record) => can(childActor, 'view', { type: 'feedback', record }))
  const waitingReply = state.feedback.find((f) => f.childId === child.id && f.status === 'sent_to_parent')
  const visibleRooms = state.roomInvites.filter((record) => can(childActor, 'view', { type: 'room_invite', record }))
  const visibleBadges = state.badges.filter((record) => can(childActor, 'view', { type: 'badge', record }))
  const pointsRec = state.points.find((record) => can(childActor, 'view', { type: 'points', record }))
  const activeWork = openWorkId ? visibleWork.find((w) => w.id === openWorkId) : undefined
  const intOpsWork = visibleWork.find((w) => w.activityId === INTEGER_OPERATIONS_SET.activityId)

  function handleContinue() {
    setProfileError('')
    try {
      const res = openOrCreateWorkRecord(portalStorage, childActor, child!.id, INTEGER_OPERATIONS_SET)
      onStateChange(res.state)
      setOpenWorkId(res.record.id)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to open practice set.')
    }
  }

  return (
    <div className={styles.stack}>
      <Card title="Demo child switcher (child profile only — never parent controls)" headingLevel={2}>
        <div className={styles.actions}>
          {state.children.map((c) => (
            <Button key={c.id} type="button" size="sm" variant={c.id === child.id ? 'primary' : 'secondary'} onClick={() => { setSelectedChildId(c.id); setOpenWorkId(null); setProfileError('') }}>
              {c.nickname} ({c.currentBelt})
            </Button>
          ))}
        </div>
        {child.pinHash ? <p className={styles.note}>Optional demo PIN set on {child.nickname}’s profile (opens child profile only; never unlocks parent settings).</p> : null}
      </Card>

      {activeWork ? (
        <WorksheetPanel key={`${activeWork.id}-${activeWork.attempts.length}`} child={child} childActor={childActor} record={activeWork} onStateChange={onStateChange} onBack={() => setOpenWorkId(null)} />
      ) : (
        <div className={styles.stack}>
          <Card headingLevel={2}>
            <div className={styles.heroRow}>
              <div className={styles.mascotBox} data-belt={child.currentBelt}>
                <svg width="48" height="48" viewBox="0 0 48 48" role="img" aria-label={`${mascot.label}: ${mascot.gear}`} className={styles.mascotSvg}>
                  <circle cx="24" cy="24" r="21" fill="currentColor" opacity="0.16" />
                  <path d="M12 28c3-7 9-11 16-11 5 0 8 2 10 5-3 1-5 3-7 6-4 5-12 6-19 0Z" fill="currentColor" />
                  <circle cx="31" cy="21" r="2.2" fill="var(--color-surface)" />
                </svg>
                <div>
                  <p className={styles.checkLabel}>{child.nickname} · {child.level}</p>
                  <p className={styles.checkDetail}>{mascot.badgeText} — {mascot.gear}</p>
                </div>
              </div>
              <div className={styles.heroCta}>
                <p className={styles.motto}>Homework done? Then let’s go.</p>
                {child.consentStatus === 'verified' ? (
                  <Button size="lg" onClick={handleContinue}>
                    {intOpsWork?.status === 'draft' ? 'Continue unfinished set' : intOpsWork ? 'Continue (review / redo set)' : 'Continue'}
                  </Button>
                ) : (
                  <p className={styles.warningText}>Waiting for parent consent before saving practice work. Free arcade games remain open outside the portal.</p>
                )}
              </div>
            </div>
            <p className={styles.firstLine}>“{child.firstConversationLine}”</p>
            {profileError ? <p className={styles.warningText} role="alert">{profileError}</p> : null}
          </Card>

          <div className={styles.grid}>
            <Card title="Belt ladder & next unit" headingLevel={2}>
              <p className={styles.checkLabel}>{mascot.label} · {child.stripesEarned} / {GRADE7_UNITS.length} stripes</p>
              <p className={styles.statusCallout}>Next unit: <strong>{nextUnitName(child.stripesEarned)}</strong></p>
              <ol className={styles.miniList}>
                {GRADE7_UNITS.map((unit, idx) => (
                  <li key={unit}>{idx < child.stripesEarned ? '✓ ' : idx === child.stripesEarned ? '→ ' : '○ '}{unit}</li>
                ))}
              </ol>
              <p className={styles.note}>Belts and stripes are awarded only by a human mentor — never by fun games.</p>
            </Card>

            <Card title="Replies from Mr. Sam" headingLevel={2}>
              {waitingReply ? (
                <p className={styles.warningText}>
                  Mr. Sam replied {replyWeekday(waitingReply.parentNotifiedAt)}, ask your parent to check their email and you’ll see it here.
                </p>
              ) : null}
              {visibleFeedback.length === 0 ? <p className={styles.note}>No replies shown yet.</p> : (
                <ul className={styles.miniList}>{visibleFeedback.map((fb) => <li key={fb.id}>{fb.sentText}</li>)}</ul>
              )}
            </Card>
          </div>

          <div className={styles.grid}>
            <Card title="Approved games" headingLevel={2}>
              {child.approvedGames.length === 0 ? (
                <p className={styles.note}>No portal games enabled by parent. Free arcade games stay outside the portal.</p>
              ) : (
                <ul className={styles.miniList}>
                  {child.approvedGames.map((gameId) => {
                    const room = visibleRooms.find((r) => r.gameId === gameId)
                    return (
                      <li key={gameId}>
                        <strong>{GAME_LABELS[gameId] ?? gameId}</strong>
                        {room ? ` — races open at ${formatRaceTime(room.startsAt)} (code ${room.roomCode})` : ''}
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className={styles.note}>Entertainment games are for fun only and never earn belts or gate practice.</p>
            </Card>

            <Card title="Badges & points" headingLevel={2}>
              <p className={styles.checkLabel}>Points: {pointsRec?.balance ?? 0} pts <span className={styles.note}>(cosmetics only)</span></p>
              {visibleBadges.length === 0 ? (
                <p className={styles.note}>No badges yet — ask a question or explain a step to earn your first badge.</p>
              ) : (
                <div className={styles.actions}>{visibleBadges.map((b) => <span key={b.id} className={`${styles.badge} ${styles.pass}`}>{b.label}</span>)}</div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function WorksheetPanel({
  child, childActor, record, onStateChange, onBack,
}: {
  child: ChildProfile; childActor: PortalActor; record: WorkRecord; onStateChange: (next: PortalState) => void; onBack: () => void
}) {
  const activeAttempt = record.attempts.at(-1)
  const priorAttempts = record.attempts.slice(0, -1)
  const isFrozen = record.status !== 'draft' || activeAttempt?.submittedAt !== null

  const [answers, setAnswers] = useState<Record<string, DraftAnswerInput>>(() => answersToMap(activeAttempt))
  const [openResponse, setOpenResponse] = useState(() => activeAttempt?.openResponse ?? record.openResponse)
  const [localRevision, setLocalRevision] = useState(record.currentRevision)
  const [failedSaveMode, setFailedSaveMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ kind: 'saved' | 'retrying' | 'conflict'; text: string }>({
    kind: 'saved',
    text: isFrozen ? `Submitted · rev ${record.currentRevision} (read-only)` : `Saved · rev ${record.currentRevision}`,
  })

  function persistDraft(nextAnswers: Record<string, DraftAnswerInput>, nextOpen: string, bypassFail = false) {
    if (isFrozen) return
    if (failedSaveMode && !bypassFail) {
      setSaveStatus({ kind: 'retrying', text: 'Not saved, retrying… Your answers are still here (no work lost).' })
      return
    }
    const list = Object.values(nextAnswers).filter((a) => a.chosenValue.trim() !== '' || a.tries > 0)
    try {
      const res = saveWorkDraft(portalStorage, childActor, record.id, localRevision, { answers: list, openResponse: nextOpen })
      setLocalRevision(res.record.currentRevision)
      setFailedSaveMode(false)
      setSaveStatus({
        kind: 'saved',
        text: bypassFail ? `Saved · rev ${res.record.currentRevision} (recovered after retry, no work lost)` : `Saved · rev ${res.record.currentRevision}`,
      })
      onStateChange(res.state)
    } catch (err) {
      if (err instanceof WorkConflictError) {
        const latest = err.serverRecord.attempts.at(-1)
        setAnswers(answersToMap(latest))
        setOpenResponse(latest?.openResponse ?? err.serverRecord.openResponse)
        setLocalRevision(err.serverRevision)
        onStateChange(portalStorage.load())
        setSaveStatus({ kind: 'conflict', text: `Conflicting edit: newer save (rev ${err.serverRevision}) from another device kept over rev ${err.expectedRevision}. Nothing was silently overwritten.` })
      } else {
        setSaveStatus({ kind: 'retrying', text: err instanceof Error ? err.message : 'Save failed, retrying…' })
      }
    }
  }

  function handleAnswerChange(questionId: string, chosenValue: string) {
    const prev = answers[questionId]
    const next = { ...answers, [questionId]: { questionId, chosenValue, tries: prev?.tries ?? 0, hintUsed: prev?.hintUsed ?? false, answeredAt: new Date().toISOString() } }
    setAnswers(next)
    persistDraft(next, openResponse)
  }

  function handleCheck(questionId: string, expected: number) {
    const prev = answers[questionId]
    const chosenValue = prev?.chosenValue ?? ''
    const ok = checkNumericAnswer(chosenValue, expected)
    const next = { ...answers, [questionId]: { questionId, chosenValue, tries: (prev?.tries ?? 0) + 1, hintUsed: Boolean(prev?.hintUsed) || !ok, answeredAt: new Date().toISOString() } }
    setAnswers(next)
    persistDraft(next, openResponse)
  }

  function handleSubmit() {
    if (isFrozen || failedSaveMode) return
    const res = submitWorkRecord(portalStorage, childActor, record.id)
    setLocalRevision(res.record.currentRevision)
    setSaveStatus({ kind: 'saved', text: `Submitted · rev ${res.record.currentRevision} (frozen and sent to mentor queue)` })
    onStateChange(res.state)
  }

  const askRouteNote =
    child.askMode === 'review' ? 'Routed through Ask Mr. Sam (parent reviews first before Mr. Sam sees it).'
      : child.askMode === 'auto' ? 'Routed through Ask Mr. Sam (copy sent to parent first, then queued for Mr. Sam).'
        : 'Saved on your worksheet (Ask Mr. Sam is Off in parent settings).'

  return (
    <div className={styles.stack}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>{INTEGER_OPERATIONS_SET.title} — Attempt #{record.attempts.length}</h2>
          <p className={styles.note}>Status: <strong>{record.status}</strong> · Autosaves on every change</p>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" size="sm" onClick={onBack}>Back to profile</Button>
          {!isFrozen ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFailedSaveMode(true); setSaveStatus({ kind: 'retrying', text: 'Not saved, retrying… Your answers are still here (no work lost).' }) }}>
              Simulate failed save
            </Button>
          ) : null}
          {!isFrozen && failedSaveMode ? <Button type="button" size="sm" onClick={() => persistDraft(answers, openResponse, true)}>Retry save now</Button> : null}
          {!isFrozen ? <Button type="button" variant="ghost" size="sm" onClick={() => { simulateExternalDeviceSave(portalStorage, record.id); persistDraft(answers, openResponse, true) }}>Simulate conflicting edit</Button> : null}
        </div>
      </div>

      <p className={saveStatus.kind === 'saved' ? styles.statusCallout : styles.alertCallout} role={saveStatus.kind === 'saved' ? 'status' : 'alert'} data-testid="worksheet-save-status">
        {saveStatus.text}
      </p>

      <div className={priorAttempts.length > 0 ? styles.sideBySide : styles.stack}>
        <Card title={`Active attempt (#${record.attempts.length})`} headingLevel={3}>
          <ol className={styles.questionList}>
            {INTEGER_OPERATIONS_SET.questions.map((q, idx) => {
              const entry = answers[q.id]
              const checked = (entry?.tries ?? 0) > 0
              const isCorrect = checked && checkNumericAnswer(entry?.chosenValue ?? '', q.answer)
              return (
                <li key={q.id} className={styles.questionItem}>
                  <div className={styles.questionRow}>
                    <label htmlFor={`ws-${q.id}`} className={styles.checkLabel}>{idx + 1}. {q.prompt}</label>
                    <div className={styles.actions}>
                      <input id={`ws-${q.id}`} type="text" inputMode="numeric" className={styles.answerInput} disabled={isFrozen} value={entry?.chosenValue ?? ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} />
                      {!isFrozen ? <Button type="button" size="sm" variant="secondary" onClick={() => handleCheck(q.id, q.answer)}>Check</Button> : null}
                    </div>
                  </div>
                  {checked ? (isCorrect ? <p className={styles.correctText}>Correct! ({entry?.tries} {entry?.tries === 1 ? 'try' : 'tries'})</p> : <p className={styles.hintText}>Teacher hint: {q.hint}</p>) : null}
                </li>
              )
            })}
          </ol>

          <label className={styles.field}>
            <span>Open response: {INTEGER_OPERATIONS_SET.openResponsePrompt}</span>
            <textarea rows={3} className={styles.input} disabled={isFrozen} value={openResponse} onChange={(e) => { setOpenResponse(e.target.value); persistDraft(answers, e.target.value) }} />
          </label>
          <p className={styles.note}>{askRouteNote}</p>

          <div className={styles.actions}>
            {!isFrozen ? <Button type="button" onClick={handleSubmit} disabled={failedSaveMode}>Submit set</Button>
              : <Button type="button" onClick={() => onStateChange(startRedoAttempt(portalStorage, childActor, record.id).state)}>Redo (new attempt side by side)</Button>}
          </div>
        </Card>

        {priorAttempts.length > 0 ? (
          <Card title="Previous attempt(s) — side by side (read-only)" headingLevel={3}>
            <div className={styles.stack} data-testid="prior-attempts-column">
              {priorAttempts.map((att, idx) => (
                <div key={att.attemptId} className={styles.childPreview}>
                  <p className={styles.checkLabel}>Attempt #{idx + 1} · submitted {att.submittedAt ?? 'draft'}</p>
                  <ul className={styles.miniList}>
                    {att.answers.length === 0 ? <li>No recorded answers</li> : att.answers.map((a) => <li key={a.questionId}>{a.questionId}: {a.chosenValue || '—'} ({a.tries} {a.tries === 1 ? 'try' : 'tries'})</li>)}
                  </ul>
                  {att.openResponse ? <p className={styles.checkDetail}>Open response: “{att.openResponse}”</p> : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
