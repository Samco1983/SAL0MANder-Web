import { can, resolveLiveActor, type PortalActor } from './access'
import { enqueueAskQuestionInState } from './askActions'
import { STARTER_BADGE_LABELS, grantBadgeInState } from './belts'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import type { PortalState, WorkRecord } from './types'
import { DEFAULT_PRACTICE_SET, type QuestionSet } from './worksheet'

const CAME_BACK_DAYS_MS = 14 * 86_400_000

export class WorkConflictError extends Error {
  readonly serverRevision: number
  readonly expectedRevision: number
  readonly serverRecord: WorkRecord

  constructor(serverRevision: number, expectedRevision: number, serverRecord: WorkRecord) {
    super(`Conflicting edit: newer save (rev ${serverRevision}) kept over stale rev ${expectedRevision}`)
    this.name = 'WorkConflictError'
    this.serverRevision = serverRevision
    this.expectedRevision = expectedRevision
    this.serverRecord = serverRecord
  }
}

export type DraftAnswerInput = {
  questionId: string
  chosenValue: string
  tries: number
  hintUsed: boolean
  answeredAt: string
}

export function openOrCreateWorkRecord(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  childId: string,
  set: QuestionSet = DEFAULT_PRACTICE_SET,
  nowIso = new Date().toISOString(),
): { state: PortalState; record: WorkRecord } {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const child = state.children.find((c) => c.id === childId)
  if (!child || !can(liveActor, 'view', { type: 'child', record: child })) {
    throw new PortalAccessError('Child profile is not accessible to this actor')
  }
  if (child.consentStatus !== 'verified') {
    throw new PortalAccessError('Parent consent is required before saving practice work')
  }
  const returnedAfterTwoWeeks =
    (Date.parse(nowIso) || Date.now()) - (Date.parse(child.lastActiveAt) || Date.now()) >= CAME_BACK_DAYS_MS
  let mutated = false
  if (returnedAfterTwoWeeks) {
    mutated = grantBadgeInState(state, child, 'came_back', STARTER_BADGE_LABELS.came_back, 'system', nowIso) || mutated
    child.lastActiveAt = nowIso
    mutated = true
  }
  const existing = state.workRecords.find(
    (w) => w.childId === childId && w.activityId === set.activityId && can(liveActor, 'view', { type: 'work', record: w }),
  )
  if (existing) {
    const out = mutated ? adapter.save(state) : state
    return { state: out, record: out.workRecords.find((w) => w.id === existing.id)! }
  }

  const id = `work_${childId}_${set.activityId}`
  const attemptId = `att_${id}_1`
  state.workRecords.push({
    id, householdId: child.householdId, childId, activityId: set.activityId,
    activityVersionId: set.activityVersionId, unitId: set.unitId, status: 'draft',
    attempts: [{ attemptId, startedAt: nowIso, submittedAt: null, answers: [], openResponse: '' }],
    openResponse: '', revisions: [{ revision: 1, savedAt: nowIso, attemptId }], currentRevision: 1,
  })
  const saved = adapter.save(state)
  return { state: saved, record: saved.workRecords.find((w) => w.id === id)! }
}

export function saveWorkDraft(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  workRecordId: string,
  expectedRevision: number,
  patch: { answers: DraftAnswerInput[]; openResponse: string },
  nowIso = new Date().toISOString(),
): { state: PortalState; record: WorkRecord } {
  const state = adapter.load()
  const record = state.workRecords.find((w) => w.id === workRecordId)
  if (!record || !can(actor, 'save_work', { type: 'work', record })) {
    throw new PortalAccessError('Cannot save work (submitted or unauthorized)')
  }
  const child = state.children.find((c) => c.id === record.childId)
  if (!child || child.consentStatus !== 'verified') {
    throw new PortalAccessError('Parent consent is required to save work')
  }
  if (record.currentRevision !== expectedRevision) {
    throw new WorkConflictError(record.currentRevision, expectedRevision, structuredClone(record))
  }
  const activeAttempt = record.attempts.at(-1)
  if (!activeAttempt || activeAttempt.submittedAt !== null) {
    throw new PortalAccessError('No open draft attempt; start a redo to try again')
  }
  activeAttempt.answers = patch.answers
  activeAttempt.openResponse = patch.openResponse
  record.openResponse = patch.openResponse
  record.currentRevision += 1
  record.revisions.push({ revision: record.currentRevision, savedAt: nowIso, attemptId: activeAttempt.attemptId })
  const saved = adapter.save(state)
  return { state: saved, record: saved.workRecords.find((w) => w.id === workRecordId)! }
}

/** Demo helper: advances the stored revision to simulate a newer edit from another device. */
export function simulateExternalDeviceSave(
  adapter: PortalStorageAdapter,
  workRecordId: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; record: WorkRecord } {
  const state = adapter.load()
  const record = state.workRecords.find((w) => w.id === workRecordId)
  if (!record || record.status !== 'draft') throw new PortalAccessError('Cannot simulate conflict on non-draft work')
  const activeAttempt = record.attempts.at(-1)!
  const note = activeAttempt.openResponse
    ? `${activeAttempt.openResponse} [edited on another device]`
    : 'I drew a number line on the tablet to check 3 - (-5) = 8.'
  activeAttempt.openResponse = note
  record.openResponse = note
  record.currentRevision += 1
  record.revisions.push({ revision: record.currentRevision, savedAt: nowIso, attemptId: activeAttempt.attemptId })
  const saved = adapter.save(state)
  return { state: saved, record: saved.workRecords.find((w) => w.id === workRecordId)! }
}

export function submitWorkRecord(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  workRecordId: string,
  nowIsoOrOptions: string | { nowIso?: string; simulateParentRejected?: boolean } = new Date().toISOString(),
): { state: PortalState; record: WorkRecord } {
  const nowIso = typeof nowIsoOrOptions === 'string' ? nowIsoOrOptions : (nowIsoOrOptions.nowIso ?? new Date().toISOString())
  const simulateParentRejected = typeof nowIsoOrOptions === 'object' ? Boolean(nowIsoOrOptions.simulateParentRejected) : false
  const state = adapter.load()
  const record = state.workRecords.find((w) => w.id === workRecordId)
  if (!record || !can(actor, 'submit_work', { type: 'work', record })) {
    throw new PortalAccessError('Cannot submit work (already submitted or unauthorized)')
  }
  const child = state.children.find((c) => c.id === record.childId)
  const hh = state.households.find((h) => h.id === record.householdId)
  if (!child || !hh || child.consentStatus !== 'verified') {
    throw new PortalAccessError('Parent consent is required to submit work')
  }
  const activeAttempt = record.attempts.at(-1)
  if (!activeAttempt || activeAttempt.submittedAt !== null) throw new PortalAccessError('Attempt already submitted')

  activeAttempt.submittedAt = nowIso
  record.status = 'submitted'
  record.currentRevision += 1
  record.revisions.push({ revision: record.currentRevision, savedAt: nowIso, attemptId: activeAttempt.attemptId })

  // Cosmetics-only completion points (never belts or stripes)
  const pts = state.points.find((p) => p.childId === child.id)
  if (pts) {
    pts.balance += 20
    pts.ledger.push({ id: `pl_${pts.ledger.length + 1}`, amount: 20, reason: 'Submitted practice set (cosmetics only)', createdAt: nowIso })
  }

  // Route ALL child-authored worksheet text (open response AND typed answers) through the parent-first
  // Ask rail so no typed answer can reach a tutor before the parent step completes.
  const openText = record.openResponse.trim()
  const typedAnswers = activeAttempt.answers
    .map((ans) => ({ questionId: ans.questionId, value: ans.chosenValue.trim() }))
    .filter((ans) => ans.value.length > 0)
  const hasChildText = openText.length > 0 || typedAnswers.length > 0

  if (hasChildText && child.askMode !== 'off') {
    const answerSummary = typedAnswers.map((ans) => `${ans.questionId}: ${ans.value}`).join(' · ')
    const parentReviewText = openText || `Submitted typed answers (${answerSummary})`
    enqueueAskQuestionInState(
      state,
      child,
      hh,
      {
        text: parentReviewText,
        source: openText ? 'worksheet_open_response' : 'worksheet_submission',
        workRecordId: record.id,
        workAttemptId: activeAttempt.attemptId,
        simulateParentRejected,
      },
      nowIso,
    )
  }

  // Queue placeholder draft for the submitted math set (typed answers and open response stay behind parent gate until released)
  const mentorId = state.assignments.find((a) => a.householdId === hh.id && a.revokedAt === null)?.mentorId ?? 'mentor_samuel'
  state.feedback.push({
    id: `fb_q_${state.feedback.length + 1}`, householdId: hh.id, childId: child.id, workRecordId: record.id,
    authorMentorId: mentorId, status: 'draft',
    draftText: child.askMode === 'review' && hasChildText
      ? `[Placeholder draft] Review ${child.nickname}'s attempt #${record.attempts.length} (child responses waiting for parent review).`
      : `[Placeholder draft] Review ${child.nickname}'s attempt #${record.attempts.length}.`,
    sentText: null, parentNotifiedAt: null, shownToChildAt: null, shownBy: null,
  })

  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'child', actorId: child.id, action: 'submit_work', recordType: 'work', recordId: record.id, householdId: hh.id, outcome: 'allow' })
  const saved = adapter.save(state)
  return { state: saved, record: saved.workRecords.find((w) => w.id === workRecordId)! }
}

export function startRedoAttempt(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  workRecordId: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; record: WorkRecord } {
  const state = adapter.load()
  const record = state.workRecords.find((w) => w.id === workRecordId)
  if (!record || !can(actor, 'start_redo', { type: 'work', record })) {
    throw new PortalAccessError('Redo is only available on a submitted or reviewed work record')
  }
  const child = state.children.find((c) => c.id === record.childId)
  if (!child || child.consentStatus !== 'verified') {
    throw new PortalAccessError('Parent consent is required to start a redo attempt')
  }
  const attemptId = `att_${record.id}_${record.attempts.length + 1}`
  record.attempts.push({ attemptId, startedAt: nowIso, submittedAt: null, answers: [], openResponse: '' })
  record.status = 'draft'
  record.openResponse = ''
  record.currentRevision += 1
  record.revisions.push({ revision: record.currentRevision, savedAt: nowIso, attemptId })
  const saved = adapter.save(state)
  return { state: saved, record: saved.workRecords.find((w) => w.id === workRecordId)! }
}
