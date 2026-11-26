import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildChildActor, can, type PortalActor } from '@/portal/access'
import { ASK_SEND_DISCLOSURE, submitAskQuestion } from '@/portal/askActions'
import { awardCosmeticPoints, countPassedSetsInUnit, getCourseLadder, getNextBeltStep } from '@/portal/belts'
import {
  ANSWER_INPUT_MAX_LENGTH,
  CORRECT_FADE_MS,
  EXPLANATION_WRONG_TRIES,
  GRADE7_CURRICULUM,
  GRADE7_PRACTICE_SETS,
  VOICE_CLIP_PLACEHOLDER_NOTICE,
  checkCurriculumAnswer,
  filterPracticeSets,
  getCurriculumSet,
  getDefaultCurriculumSet,
  resolveProblemStandards,
  selectProblemHint,
  type CurriculumProblem,
  type LoadedPracticeSet,
} from '@/portal/curriculum'
import { FUN_GAMES, LESSON_GAMES } from '@/portal/parentActions'
import { canChildAccessRoom } from '@/portal/roomActions'
import { portalStorage } from '@/portal/storage'
import type { ChildProfile, PortalState, WorkAttempt, WorkRecord } from '@/portal/types'
import {
  WorkConflictError, openOrCreateWorkRecord, saveWorkDraft,
  simulateExternalDeviceSave, startRedoAttempt, submitWorkRecord, type DraftAnswerInput,
} from '@/portal/workActions'
import { BELT_MASCOT } from '@/portal/worksheet'
import styles from './PortalPage.module.css'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const GAME_LABELS: Record<string, string> = Object.fromEntries([...LESSON_GAMES, ...FUN_GAMES].map((g) => [g.id, g.label]))
const FUN_GAME_IDS = new Set<string>(FUN_GAMES.map((g) => g.id))

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

function defaultUnitForChild(child: ChildProfile): string {
  const idx = Math.min(child.stripesEarned, GRADE7_CURRICULUM.length - 1)
  return GRADE7_CURRICULUM[idx]?.unitId ?? GRADE7_CURRICULUM[0]!.unitId
}

export function ChildProfileView({
  state, onStateChange, onOpenRoom,
}: {
  state: PortalState; onStateChange: (next: PortalState) => void; onOpenRoom?: (inviteId: string, childId: string) => void
}) {
  const [selectedChildId, setSelectedChildId] = useState(state.children[0]?.id ?? '')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [setSearchQuery, setSetSearchQuery] = useState('')
  const [openWorkId, setOpenWorkId] = useState<string | null>(null)
  const [profileError, setProfileError] = useState('')

  const child = state.children.find((c) => c.id === selectedChildId) ?? state.children[0]
  if (!child) return <Card title="Child profile" headingLevel={2}><p className={styles.note}>No child profiles available.</p></Card>

  const childActor = buildChildActor(state, child.id)
  const mascot = BELT_MASCOT[child.currentBelt]
  const ladder = getCourseLadder(child.level)
  const nextBelt = getNextBeltStep(child)
  const completedUnitSet = new Set(child.completedUnitIds ?? [])
  const nextUnitObj =
    ladder.units.find((u, idx) => !completedUnitSet.has(u.unitId) && idx >= child.stripesEarned) ??
    ladder.units[Math.min(child.stripesEarned, ladder.units.length - 1)] ??
    ladder.units[0]!
  const visibleWork = state.workRecords.filter((record) => can(childActor, 'view', { type: 'work', record }))
  const visibleFeedback = state.feedback.filter((record) => can(childActor, 'view', { type: 'feedback', record }))
  const waitingReply = state.feedback.find((f) => f.childId === child.id && f.status === 'sent_to_parent')
  const visibleRooms = state.roomInvites.filter(
    (record) => can(childActor, 'view', { type: 'room_invite', record }) && canChildAccessRoom(state, child.id, record),
  )
  const visibleBadges = state.badges.filter((record) => can(childActor, 'view', { type: 'badge', record }))
  const pointsRec = state.points.find((record) => can(childActor, 'view', { type: 'points', record }))
  const activeWork = openWorkId ? visibleWork.find((w) => w.id === openWorkId) : undefined

  const activeUnitId = selectedUnitId ?? defaultUnitForChild(child)
  const activeUnit = GRADE7_CURRICULUM.find((u) => u.unitId === activeUnitId) ?? GRADE7_CURRICULUM[0]!
  const isSearching = setSearchQuery.trim().length > 0
  const displayedSets = isSearching
    ? filterPracticeSets(setSearchQuery, GRADE7_PRACTICE_SETS)
    : GRADE7_PRACTICE_SETS.filter((s) => s.unitId === activeUnit.unitId)

  const draftWork = visibleWork.find((w) => w.status === 'draft' && getCurriculumSet(w.activityId))
  const continueSet: LoadedPracticeSet =
    (draftWork ? getCurriculumSet(draftWork.activityId) : undefined) ??
    GRADE7_PRACTICE_SETS.find((s) => s.unitId === activeUnit.unitId && !visibleWork.some((w) => w.activityId === s.setId && w.status === 'reviewed')) ??
    getDefaultCurriculumSet()
  const continueWork = visibleWork.find((w) => w.activityId === continueSet.activityId)

  function openPracticeSet(practiceSet: LoadedPracticeSet) {
    setProfileError('')
    try {
      const res = openOrCreateWorkRecord(portalStorage, childActor, child!.id, practiceSet)
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
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={c.id === child.id ? 'primary' : 'secondary'}
              onClick={() => { setSelectedChildId(c.id); setSelectedUnitId(null); setSetSearchQuery(''); setOpenWorkId(null); setProfileError('') }}
            >
              {c.nickname} ({c.currentBelt})
            </Button>
          ))}
        </div>
        {child.pinHash ? <p className={styles.note}>Optional demo PIN set on {child.nickname}’s profile (opens child profile only; never unlocks parent settings).</p> : null}
      </Card>

      {activeWork ? (
        <WorksheetPanel
          key={`${activeWork.id}-${activeWork.attempts.length}`}
          child={child}
          childActor={childActor}
          record={activeWork}
          practiceSet={getCurriculumSet(activeWork.activityId) ?? getDefaultCurriculumSet()}
          onStateChange={onStateChange}
          onBack={() => setOpenWorkId(null)}
        />
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
                  <Button size="lg" onClick={() => openPracticeSet(continueSet)}>
                    {continueWork?.status === 'draft' ? 'Continue unfinished set' : continueWork ? 'Continue (review / redo set)' : 'Continue'}
                  </Button>
                ) : (
                  <p className={styles.warningText}>Waiting for parent consent before saving practice work. Free arcade games remain open outside the portal.</p>
                )}
              </div>
            </div>
            <p className={styles.firstLine}>“{child.firstConversationLine}”</p>
            {profileError ? <p className={styles.warningText} role="alert">{profileError}</p> : null}
          </Card>

          {child.consentStatus === 'verified' ? (
            <Card title="Choose a unit and set (7th Grade Math — 7 units × 3 sets)" headingLevel={2}>
              <div className={styles.stack} data-testid="unit-set-picker">
                <div className={styles.searchRow}>
                  <label className={styles.field}>
                    <span>Search sets by standard code or word</span>
                    <input
                      type="search"
                      className={styles.input}
                      value={setSearchQuery}
                      onChange={(e) => setSetSearchQuery(e.target.value)}
                      placeholder="e.g. 7.EE.1, 7.RP.3, percent, scale"
                    />
                  </label>
                  {isSearching ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSetSearchQuery('')}>
                      Clear search
                    </Button>
                  ) : null}
                </div>

                {!isSearching ? (
                  <>
                    <div className={styles.actions} role="group" aria-label="Choose a unit">
                      {GRADE7_CURRICULUM.map((unit, idx) => {
                        const unitCfg = ladder.units.find((u) => u.unitId === unit.unitId)
                        const passedCount = unitCfg ? countPassedSetsInUnit(state, child.id, unitCfg) : 0
                        const unitDone = completedUnitSet.has(unit.unitId) || (unitCfg ? passedCount === unitCfg.requiredActivityIds.length : false)
                        return (
                          <Button
                            key={unit.unitId}
                            type="button"
                            size="sm"
                            variant={unit.unitId === activeUnit.unitId ? 'primary' : 'secondary'}
                            onClick={() => setSelectedUnitId(unit.unitId)}
                          >
                            {unitDone ? '✓ ' : ''}Unit {idx + 1}: {unit.unitName}
                          </Button>
                        )
                      })}
                    </div>
                    <p className={styles.note}>
                      <strong>Unit {GRADE7_CURRICULUM.findIndex((u) => u.unitId === activeUnit.unitId) + 1}: {activeUnit.unitName}</strong>
                      {' · '}Complete all 3 sets + open responses for this unit’s stripe.
                    </p>
                  </>
                ) : (
                  <p className={styles.note} role="status" data-testid="set-search-count">
                    Showing {displayedSets.length} matching {displayedSets.length === 1 ? 'set' : 'sets'} for “{setSearchQuery.trim()}”.
                  </p>
                )}

                {displayedSets.length === 0 ? (
                  <p className={styles.note}>No sets matched “{setSearchQuery.trim()}”. Try a standard like 7.NS.1, 7.EE.1, or a topic like percent.</p>
                ) : (
                  <div className={styles.stack}>
                    {displayedSets.map((setEntry) => {
                      const existing = visibleWork.find((w) => w.activityId === setEntry.setId)
                      const statusLabel =
                        existing?.status === 'reviewed' ? 'Reviewed ✓'
                          : existing?.status === 'submitted' ? 'Submitted'
                            : existing?.status === 'draft' ? 'In progress'
                              : 'Not started'
                      return (
                        <div key={setEntry.setId} className={styles.setCard} data-testid={`set-card-${setEntry.setId}`}>
                          <div className={styles.checkMeta}>
                            <p className={styles.checkLabel}>
                              {isSearching ? `Unit ${setEntry.unitNumber} · ` : ''}{setEntry.setLabel}: {setEntry.title}
                            </p>
                            <p className={styles.checkDetail}>{setEntry.skill}</p>
                            <p className={styles.standardCode}>Standards: {setEntry.standards.join(', ')}</p>
                            <p className={styles.note}>{setEntry.problems.length} problems + open response · Status: <strong>{statusLabel}</strong></p>
                          </div>
                          <Button type="button" size="sm" variant={existing?.status === 'draft' ? 'primary' : 'secondary'} onClick={() => openPracticeSet(setEntry)}>
                            {existing?.status === 'draft' ? `Resume ${setEntry.setLabel}` : existing ? `Review / Redo ${setEntry.setLabel}` : `Open ${setEntry.setLabel}`}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          ) : null}

          <div className={styles.grid}>
            <Card title={`Belt ladder — ${ladder.courseLabel}`} headingLevel={2}>
              <p className={styles.checkLabel}>{mascot.label} · {child.stripesEarned} / {ladder.units.length} stripes</p>
              <p className={styles.statusCallout}>Next unit: <strong>{nextUnitObj.title}</strong></p>
              <p className={styles.note}>
                Belts at 2 / 4 / 6 / last (+ live teach-it test for Black).
                {nextBelt ? ` Next belt: ${nextBelt.nextBelt} at ${nextBelt.stripesRequired} stripes (${nextBelt.testType === 'teach_it' ? 'teach-it test' : 'live whiteboard test'}).` : ' Black belt complete!'}
              </p>
              <ol className={styles.miniList}>
                {ladder.units.map((unit, idx) => {
                  const done = completedUnitSet.has(unit.unitId) || idx < child.stripesEarned
                  const isNext = unit.unitId === nextUnitObj.unitId && !done
                  return (
                    <li key={unit.unitId}>{done ? '✓ ' : isNext ? '→ ' : '○ '}{unit.title}</li>
                  )
                })}
              </ol>
              <p className={styles.note}>Belts are awarded only by a human mentor — never automatic, never by fun games.</p>
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
                        {room && onOpenRoom ? (
                          <>
                            {' '}
                            <Button type="button" size="sm" variant="secondary" onClick={() => onOpenRoom(room.id, child.id)}>
                              Open room ({room.roomCode})
                            </Button>
                          </>
                        ) : null}
                        {FUN_GAME_IDS.has(gameId) && child.consentStatus === 'verified' ? (
                          <>
                            {' '}
                            <Button type="button" size="sm" variant="ghost" onClick={() => onStateChange(awardCosmeticPoints(portalStorage, childActor, child.id, 10, `Played ${GAME_LABELS[gameId] ?? gameId}`))}>
                              Play (+10 cosmetic pts)
                            </Button>
                          </>
                        ) : null}
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
          <AskMrSamCard
            key={child.id}
            child={child}
            childActor={childActor}
            questions={state.askQuestions.filter((record) => can(childActor, 'view', { type: 'ask_question', record }))}
            onStateChange={onStateChange}
          />
        </div>
      )}
    </div>
  )
}

function AskMrSamCard({
  child, childActor, questions, onStateChange,
}: {
  child: ChildProfile; childActor: PortalActor; questions: PortalState['askQuestions']; onStateChange: (next: PortalState) => void
}) {
  const [questionText, setQuestionText] = useState('')
  const [attachPhoto, setAttachPhoto] = useState(false)
  const [nameCovered, setNameCovered] = useState(true)
  const [feedbackMsg, setFeedbackMsg] = useState<{ alert: boolean; text: string } | null>(null)
  const canAsk = can(childActor, 'submit_question', { type: 'child', record: child })

  function send(simulateParentRejected: boolean) {
    if (!questionText.trim()) return
    try {
      const res = submitAskQuestion(portalStorage, childActor, child.id, {
        text: questionText,
        photoPlaceholder: attachPhoto ? { label: 'Written homework photo (placeholder)', nameCovered } : null,
        simulateParentRejected,
      })
      onStateChange(res.state)
      setQuestionText('')
      setAttachPhoto(false)
      setFeedbackMsg({ alert: simulateParentRejected, text: res.childNotice })
    } catch (err) {
      setFeedbackMsg({ alert: true, text: err instanceof Error ? err.message : 'Unable to send question.' })
    }
  }

  return (
    <Card title="Ask Mr. Sam" headingLevel={2}>
      {!canAsk ? (
        <p className={styles.note}>
          {child.consentStatus !== 'verified'
            ? 'Ask Mr. Sam stays Off until your parent verifies consent.'
            : 'Ask Mr. Sam is turned Off in your parent’s settings.'}
        </p>
      ) : (
        <form className={styles.formStack} onSubmit={(e: FormEvent) => { e.preventDefault(); send(false) }}>
          <label className={styles.field}>
            <span>Your math question (no email, phone, or last name)</span>
            <textarea rows={2} required className={styles.input} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Where did you get stuck?" />
          </label>
          <label className={styles.radioRow}>
            <input type="checkbox" checked={attachPhoto} onChange={(e) => setAttachPhoto(e.target.checked)} />
            Attach 1 photo of written work (demo placeholder — cover your name; 30-day retention)
          </label>
          {attachPhoto ? (
            <label className={styles.radioRow}>
              <input type="checkbox" checked={nameCovered} onChange={(e) => setNameCovered(e.target.checked)} />
              I covered my name on the page (never uploaded in Phase 1 demo)
            </label>
          ) : null}
          <p className={styles.note}>
            <strong>{ASK_SEND_DISCLOSURE}</strong> ({child.askMode === 'review' ? 'Review-first: parent forwards each question.' : 'Auto-send: parent email accepted first, then Mr. Sam.'})
          </p>
          <div className={styles.actions}>
            <Button type="submit" size="sm">Send question</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => send(true)}>Simulate parent email rejected</Button>
          </div>
        </form>
      )}
      {feedbackMsg ? (
        <p className={feedbackMsg.alert ? styles.alertCallout : styles.statusCallout} role={feedbackMsg.alert ? 'alert' : 'status'} data-testid="ask-rail-status">
          {feedbackMsg.text}
        </p>
      ) : null}
      {questions.length > 0 ? (
        <ul className={styles.miniList}>
          {questions.map((q) => (
            <li key={q.id}>
              “{q.text}” — <strong>{q.status === 'held_undelivered' ? 'Held (parent email rejected)' : q.status === 'waiting_parent_review' ? 'Waiting for parent review' : q.status === 'queued_for_mentor' ? 'Sent to Mr. Sam' : 'Replied'}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

type ProblemCheckState = {
  status: 'correct' | 'wrong'
  hint: string | null
  tries: number
  wrongTries: number
  showCorrectBanner: boolean
  showExplanation: boolean
  voicePlaceholderShown: boolean
}

function initialCheckState(attempt: WorkAttempt | undefined, practiceSet: LoadedPracticeSet): Record<string, ProblemCheckState> {
  const out: Record<string, ProblemCheckState> = {}
  const byId = new Map(practiceSet.problems.map((p) => [p.id, p]))
  for (const a of attempt?.answers ?? []) {
    if (a.tries <= 0) continue
    const prob = byId.get(a.questionId)
    if (!prob) continue
    const ok = checkCurriculumAnswer(a.chosenValue, prob)
    const wrongTries = ok ? Math.max(0, a.tries - 1) : a.tries
    out[a.questionId] = {
      status: ok ? 'correct' : 'wrong',
      hint: ok ? null : selectProblemHint(a.chosenValue, prob),
      tries: a.tries,
      wrongTries,
      showCorrectBanner: false,
      showExplanation: ok || wrongTries >= EXPLANATION_WRONG_TRIES,
      voicePlaceholderShown: false,
    }
  }
  return out
}

function WorksheetPanel({
  child, childActor, record, practiceSet, onStateChange, onBack,
}: {
  child: ChildProfile
  childActor: PortalActor
  record: WorkRecord
  practiceSet: LoadedPracticeSet
  onStateChange: (next: PortalState) => void
  onBack: () => void
}) {
  const activeAttempt = record.attempts.at(-1)
  const priorAttempts = record.attempts.slice(0, -1)
  const isFrozen = record.status !== 'draft' || activeAttempt?.submittedAt !== null
  const voiceClipsAllowed = child.voiceClipsEnabled ?? true

  const [answers, setAnswers] = useState<Record<string, DraftAnswerInput>>(() => answersToMap(activeAttempt))
  const [checkedMap, setCheckedMap] = useState<Record<string, ProblemCheckState>>(() => initialCheckState(activeAttempt, practiceSet))
  const [hintsMuted, setHintsMuted] = useState(false)
  const [openResponse, setOpenResponse] = useState(() => activeAttempt?.openResponse ?? record.openResponse)
  const [localRevision, setLocalRevision] = useState(record.currentRevision)
  const [failedSaveMode, setFailedSaveMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ kind: 'saved' | 'retrying' | 'conflict'; text: string }>({
    kind: 'saved',
    text: isFrozen ? `Submitted · rev ${record.currentRevision} (read-only)` : `Saved · rev ${record.currentRevision}`,
  })

  // Timers exist ONLY to fade the "Correct!" message after ~3 seconds. Hints NEVER have a timer.
  const correctTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const timers = correctTimersRef.current
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer)
    }
  }, [])

  function clearCorrectTimer(questionId: string) {
    const existing = correctTimersRef.current[questionId]
    if (existing !== undefined) {
      clearTimeout(existing)
      delete correctTimersRef.current[questionId]
    }
  }

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
        setCheckedMap(initialCheckState(latest, practiceSet))
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

  function handleCheck(problem: CurriculumProblem) {
    const prev = answers[problem.id]
    const chosenValue = prev?.chosenValue ?? ''
    if (!chosenValue.trim()) return
    const ok = checkCurriculumAnswer(chosenValue, problem)
    const tries = (prev?.tries ?? 0) + 1
    const prevCheck = checkedMap[problem.id]
    const wrongTries = ok ? (prevCheck?.wrongTries ?? 0) : (prevCheck?.wrongTries ?? 0) + 1
    const next = {
      ...answers,
      [problem.id]: {
        questionId: problem.id,
        chosenValue,
        tries,
        hintUsed: Boolean(prev?.hintUsed) || !ok,
        answeredAt: new Date().toISOString(),
      },
    }
    setAnswers(next)
    clearCorrectTimer(problem.id)
    setCheckedMap((prevMap) => ({
      ...prevMap,
      [problem.id]: {
        status: ok ? 'correct' : 'wrong',
        hint: ok ? null : selectProblemHint(chosenValue, problem),
        tries,
        wrongTries,
        showCorrectBanner: ok,
        showExplanation: ok || wrongTries >= EXPLANATION_WRONG_TRIES || Boolean(prevCheck?.showExplanation),
        voicePlaceholderShown: false,
      },
    }))
    if (ok) {
      correctTimersRef.current[problem.id] = setTimeout(() => {
        setCheckedMap((prevMap) => {
          const cur = prevMap[problem.id]
          if (!cur) return prevMap
          return { ...prevMap, [problem.id]: { ...cur, showCorrectBanner: false } }
        })
        delete correctTimersRef.current[problem.id]
      }, CORRECT_FADE_MS)
    }
    persistDraft(next, openResponse)
  }

  function handleHearMrSam(problemId: string) {
    if (!voiceClipsAllowed || hintsMuted) return
    setCheckedMap((prevMap) => {
      const cur = prevMap[problemId]
      if (!cur) return prevMap
      return { ...prevMap, [problemId]: { ...cur, voicePlaceholderShown: !cur.voicePlaceholderShown } }
    })
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
          <h2 className={styles.sectionTitle}>
            Unit {practiceSet.unitNumber}: {practiceSet.unitName} · {practiceSet.setLabel}: {practiceSet.title} — Attempt #{record.attempts.length}
          </h2>
          <p className={styles.note}>{practiceSet.skill}</p>
          <p className={styles.note}>Status: <strong>{record.status}</strong> · {practiceSet.problems.length} problems · Autosaves on every change</p>
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
            {practiceSet.problems.map((q, idx) => {
              const entry = answers[q.id]
              const chosenValue = entry?.chosenValue ?? ''
              const fb = checkedMap[q.id]
              const standards = resolveProblemStandards(q, practiceSet)
              return (
                <li key={q.id} className={styles.questionItem} data-testid={`problem-${q.id}`}>
                  {q.answerType === 'choice' && q.choices ? (
                    <fieldset className={styles.choiceGroup} disabled={isFrozen}>
                      <legend className={styles.checkLabel}>{idx + 1}. {q.prompt}</legend>
                      <div className={styles.choiceList}>
                        {q.choices.map((choice) => (
                          <label key={choice.id} className={styles.radioRow}>
                            <input
                              type="radio"
                              name={`ws-${q.id}`}
                              value={choice.id}
                              checked={chosenValue.toLowerCase() === choice.id.toLowerCase()}
                              onChange={() => handleAnswerChange(q.id, choice.id)}
                            />
                            <span>{choice.id}) {choice.text}</span>
                          </label>
                        ))}
                      </div>
                      {!isFrozen ? (
                        <div className={styles.actions}>
                          <Button type="button" size="sm" variant="secondary" disabled={!chosenValue.trim()} onClick={() => handleCheck(q)}>Check</Button>
                        </div>
                      ) : null}
                    </fieldset>
                  ) : (
                    <div className={styles.questionRow}>
                      <label htmlFor={`ws-${q.id}`} className={styles.checkLabel}>{idx + 1}. {q.prompt}</label>
                      <div className={styles.actions}>
                        <input
                          id={`ws-${q.id}`}
                          type="text"
                          size={26}
                          maxLength={ANSWER_INPUT_MAX_LENGTH}
                          autoComplete="off"
                          spellCheck={false}
                          className={styles.answerInput}
                          disabled={isFrozen}
                          value={chosenValue}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isFrozen && chosenValue.trim()) {
                              e.preventDefault()
                              handleCheck(q)
                            }
                          }}
                        />
                        {!isFrozen ? <Button type="button" size="sm" variant="secondary" disabled={!chosenValue.trim()} onClick={() => handleCheck(q)}>Check</Button> : null}
                      </div>
                    </div>
                  )}

                  <p className={styles.standardCode} data-testid={`problem-standards-${q.id}`}>
                    Standard{standards.length === 1 ? '' : 's'}: {standards.join(', ')}
                  </p>

                  {fb?.showCorrectBanner ? (
                    <p className={styles.correctText} role="status" data-testid={`correct-msg-${q.id}`}>
                      Correct! ({fb.tries} {fb.tries === 1 ? 'try' : 'tries'})
                    </p>
                  ) : null}

                  {fb?.status === 'wrong' && fb.hint ? (
                    <div className={styles.hintBox} data-testid={`hint-box-${q.id}`}>
                      <div className={styles.hintRow}>
                        <p className={styles.hintText}>Teacher hint: {fb.hint}</p>
                        <div className={styles.actions}>
                          {voiceClipsAllowed ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={hintsMuted}
                                onClick={() => handleHearMrSam(q.id)}
                              >
                                Hear Mr. Sam explain
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-pressed={hintsMuted}
                                onClick={() => setHintsMuted((m) => !m)}
                              >
                                {hintsMuted ? 'Unmute' : 'Mute'}
                              </Button>
                            </>
                          ) : (
                            <span className={styles.note}>Mr. Sam’s voice clips: Off (parent setting)</span>
                          )}
                        </div>
                      </div>
                      {voiceClipsAllowed && hintsMuted ? (
                        <p className={styles.note}>Voice clips muted — written hint stays visible.</p>
                      ) : null}
                      {voiceClipsAllowed && !hintsMuted && fb.voicePlaceholderShown ? (
                        <p className={styles.note} role="status">{VOICE_CLIP_PLACEHOLDER_NOTICE}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {fb?.showExplanation ? (
                    <p className={styles.explanationBox} data-testid={`explanation-${q.id}`}>
                      <strong>Explanation:</strong> {q.explanation}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ol>

          <label className={styles.field}>
            <span>Open response (Problem #{practiceSet.openResponse.problemNumber}): {practiceSet.openResponse.prompt}</span>
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
