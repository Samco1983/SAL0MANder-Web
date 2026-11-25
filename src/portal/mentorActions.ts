import { can, resolveLiveActor, type PortalActor } from './access'
import { STARTER_BADGE_LABELS, creditReviewedUnitStripe, getNextBeltStep, grantBadgeInState } from './belts'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import { MentorSchema, type AskQuestion, type BeltColor, type ChildProfile, type MentorRole, type PortalState, type WorkRecord } from './types'

export const MEMBERSHIP_CAP = 100
export const QUIET_DAYS_THRESHOLD = 7

export type UnitScript = {
  unitId: string; title: string; explanation: string; commonMistake: string
  problems: readonly [string, string, string]; links: readonly [{ label: string; url: string }, { label: string; url: string }]
}

export type MentorWorkAnswer = {
  questionId: string
  tries: number
  hintUsed: boolean
  answeredAt: string
  chosenValue?: string
}

export type MentorWorkAttempt = {
  attemptId: string
  startedAt: string
  submittedAt: string | null
  answers: MentorWorkAnswer[]
  openResponse?: string
}

/** Mentor-safe projection of a WorkRecord: leaves out child openResponse and typed answers until parent forwards (FIX 4 / G-03). */
export type MentorWorkRecord = {
  id: string
  householdId: string
  childId: string
  activityId: string
  activityVersionId: string
  unitId: string
  status: WorkRecord['status']
  attempts: MentorWorkAttempt[]
  openResponse?: string
  revisions: WorkRecord['revisions']
  currentRevision: number
  childTextWithheld: boolean
}

export const SCRIPT_LIBRARY: ReadonlyArray<UnitScript> = [
  { unitId: 'g7_u1_ratios', title: 'Unit 1: Ratios & Proportions', explanation: 'Compare quantities by finding the constant of proportionality k = y / x.', commonMistake: 'Adding the same number to both sides instead of multiplying by the scale factor.', problems: ['3 cups flour for 12 muffins → how many cups for 20?', 'Does (2, 7) and (4, 14) show a proportional table?', 'Find unit rate: $18 for 4 notebooks.'], links: [{ label: 'Illustrative Math 7.2', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Ratios', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
  { unitId: 'g7_u2_integers', title: 'Unit 2: Integers & Rational Numbers', explanation: 'Subtracting a negative moves right on the number line: a - (-b) = a + b.', commonMistake: 'Treating -4 - 9 as positive because two minus signs appear.', problems: ['3 - (-5) = ?', '-4 - 9 = ?', '(-6) × 3 + 4 = ?'], links: [{ label: 'Illustrative Math 7.5', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Negative Numbers', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
  { unitId: 'g7_u3_expressions', title: 'Unit 3: Expressions', explanation: 'Combine like terms and distribute negative signs across every term inside parentheses.', commonMistake: 'Distributing -2(x - 3) as -2x - 6 instead of -2x + 6.', problems: ['Simplify 4x - 7 + 2x + 3', 'Expand -2(x - 5)', 'Factor 12a + 18'], links: [{ label: 'Illustrative Math 7.6', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Expressions', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
  { unitId: 'g7_u4_equations', title: 'Unit 4: Equations & Inequalities', explanation: 'Undo operations in reverse order and flip the inequality sign when multiplying/dividing by a negative.', commonMistake: 'Forgetting to reverse < when dividing both sides by -3.', problems: ['Solve 3x + 4 = 19', 'Solve -2x ≤ 10', 'Write an equation for 5 more than twice n is 21.'], links: [{ label: 'Illustrative Math 7.6', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Equations', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
  { unitId: 'g7_u5_geometry', title: 'Unit 5: Geometry', explanation: 'Use supplementary (180°) and complementary (90°) angle pairs plus scale drawings.', commonMistake: 'Using diameter instead of radius in circle area A = πr².', problems: ['Find the supplement of 64°.', 'Area of circle with radius 5 cm (in terms of π).', 'Scale 1 in : 4 ft → how wide is a 3.5 in drawing?'], links: [{ label: 'Illustrative Math 7.7', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Geometry', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
  { unitId: 'g7_u6_statistics', title: 'Unit 6: Statistics', explanation: 'Compare centers (mean/median) and spread (MAD/IQR) from representative samples.', commonMistake: 'Drawing conclusions from a biased convenience sample.', problems: ['Find median & IQR of 4, 6, 7, 9, 14.', 'Why is surveying only team captains biased?', 'Find MAD of 8, 10, 10, 12.'], links: [{ label: 'Illustrative Math 7.8', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Statistics', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
  { unitId: 'g7_u7_probability', title: 'Unit 7: Probability', explanation: 'Model compound events with sample-space tables or trees: favorable outcomes / total outcomes.', commonMistake: 'Adding probabilities of independent steps instead of multiplying.', problems: ['P(heads then 6 on a die)?', 'Bag has 3 green, 5 purple marbles: P(green)?', 'Expected heads in 60 fair coin flips?'], links: [{ label: 'Illustrative Math 7.8', url: 'https://im.kendallhunt.com/' }, { label: 'Khan Probability', url: 'https://www.khanacademy.org/math/cc-seventh-grade-math' }] },
]

export function daysQuiet(child: ChildProfile, nowIso = '2026-11-24T18:00:00Z'): number {
  const diff = (Date.parse(nowIso) || Date.now()) - (Date.parse(child.lastActiveAt) || Date.now())
  return Math.max(0, Math.floor(diff / 86_400_000))
}

/**
 * Determines whether a mentor may see child-authored text (`openResponse` and typed `chosenValue` answers)
 * for one specific attempt inside a WorkRecord (PR #138 typed-answer leak fix / G-03).
 *
 * Deny-by-default: a child's typed answer NEVER reaches any tutor unless:
 * - household & child consent are verified and Questions are enabled (`askMode !== 'off'`),
 * - the attempt has been submitted (never drafts), AND
 * - a linked parent-step record (`AskQuestion`) for that attempt was accepted by the parent's email
 *   provider AND released/forwarded to the mentor (never waiting, held, bounced, or missing).
 */
export function canMentorReadAttemptText(
  state: PortalState,
  record: WorkRecord,
  attemptId: string,
): boolean {
  const child = state.children.find((c) => c.id === record.childId)
  const hh = state.households.find((h) => h.id === record.householdId)
  if (!child || !hh || child.consentStatus !== 'verified' || hh.consentRecord.status !== 'verified') return false
  if (child.askMode === 'off') return false

  const attempt = record.attempts.find((att) => att.attemptId === attemptId)
  if (!attempt || attempt.submittedAt === null) return false

  const attemptScoped = state.askQuestions.filter(
    (q) => q.workRecordId === record.id && q.workAttemptId === attemptId,
  )
  // Legacy record-level AskQuestions (without workAttemptId) may only authorize the single-attempt record
  // they were created for — never a newer redo attempt submitted afterward.
  const linked =
    attemptScoped.length > 0
      ? attemptScoped
      : record.attempts.length === 1
        ? state.askQuestions.filter((q) => q.workRecordId === record.id && !q.workAttemptId)
        : []

  if (linked.length === 0) return false
  if (
    linked.some(
      (q) =>
        q.status === 'waiting_parent_review' ||
        q.status === 'held_undelivered' ||
        q.status === 'parent_bounced' ||
        q.parentEmailAcceptedAt === null,
    )
  ) {
    return false
  }
  return linked.some(
    (q) =>
      q.parentEmailAcceptedAt !== null &&
      q.forwardedToMentorAt !== null &&
      (q.status === 'queued_for_mentor' || q.status === 'replied'),
  )
}

/**
 * Determines whether a mentor may see child-authored text on the latest attempt of a WorkRecord.
 */
export function canMentorReadWorkText(state: PortalState, record: WorkRecord): boolean {
  if (record.status === 'draft') return false
  const latest = record.attempts.at(-1)
  if (!latest) return false
  return canMentorReadAttemptText(state, record, latest.attemptId)
}

/** Returns a mentor-safe WorkRecord view, omitting child text fields per attempt until parent step completes (FIX 4 / G-03). */
export function projectWorkRecordForMentor(state: PortalState, record: WorkRecord): MentorWorkRecord {
  const latest = record.attempts.at(-1)
  const allowLatest = latest ? canMentorReadAttemptText(state, record, latest.attemptId) : false
  let anyWithheld = !allowLatest

  const projectedAttempts: MentorWorkAttempt[] = record.attempts.map((att) => {
    const allowAttempt = canMentorReadAttemptText(state, record, att.attemptId)
    if (!allowAttempt) {
      if (att.openResponse.trim().length > 0 || att.answers.some((a) => a.chosenValue.trim().length > 0)) {
        anyWithheld = true
      }
      return {
        attemptId: att.attemptId,
        startedAt: att.startedAt,
        submittedAt: att.submittedAt,
        answers: att.answers.map((ans) => ({
          questionId: ans.questionId,
          tries: ans.tries,
          hintUsed: ans.hintUsed,
          answeredAt: ans.answeredAt,
        })),
      }
    }
    return {
      attemptId: att.attemptId,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      openResponse: att.openResponse,
      answers: att.answers.map((ans) => ({
        questionId: ans.questionId,
        chosenValue: ans.chosenValue,
        tries: ans.tries,
        hintUsed: ans.hintUsed,
        answeredAt: ans.answeredAt,
      })),
    }
  })

  return {
    id: record.id,
    householdId: record.householdId,
    childId: record.childId,
    activityId: record.activityId,
    activityVersionId: record.activityVersionId,
    unitId: record.unitId,
    status: record.status,
    ...(allowLatest ? { openResponse: record.openResponse } : {}),
    revisions: record.revisions,
    currentRevision: record.currentRevision,
    childTextWithheld: anyWithheld,
    attempts: projectedAttempts,
  }
}

export function listTodayAskQueue(state: PortalState, actor: PortalActor): AskQuestion[] {
  const liveActor = resolveLiveActor(state, actor)
  return state.askQuestions
    .filter((record) => {
      if (record.status !== 'queued_for_mentor') return false
      if (!can(liveActor, 'view', { type: 'ask_question', record })) return false
      const child = state.children.find((c) => c.id === record.childId)
      const hh = state.households.find((h) => h.id === record.householdId)
      if (!child || !hh || child.consentStatus !== 'verified' || hh.consentRecord.status !== 'verified') return false
      return child.askMode !== 'off'
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function listTodayWorkQueue(state: PortalState, actor: PortalActor): MentorWorkRecord[] {
  const liveActor = resolveLiveActor(state, actor)
  return state.workRecords
    .filter((record) => record.status === 'submitted' && can(liveActor, 'review_work', { type: 'work', record }))
    .sort((a, b) => (a.attempts.at(-1)?.submittedAt ?? '').localeCompare(b.attempts.at(-1)?.submittedAt ?? ''))
    .map((record) => projectWorkRecordForMentor(state, record))
}

/** Lists mentor-visible work records (optionally for one child), omitting withheld child text (FIX 3 & FIX 4). */
export function listMentorWorkRecords(state: PortalState, actor: PortalActor, childId?: string): MentorWorkRecord[] {
  const liveActor = resolveLiveActor(state, actor)
  return state.workRecords
    .filter((record) => (childId ? record.childId === childId : true) && can(liveActor, 'view', { type: 'work', record }))
    .map((record) => projectWorkRecordForMentor(state, record))
}

export function listQuietKids(state: PortalState, actor: PortalActor, nowIso = '2026-11-24T18:00:00Z'): ChildProfile[] {
  const liveActor = resolveLiveActor(state, actor)
  return state.children.filter((record) => can(liveActor, 'view', { type: 'child', record }) && daysQuiet(record, nowIso) >= QUIET_DAYS_THRESHOLD)
}

export function listBeltTestsDue(state: PortalState, actor: PortalActor): Array<{ child: ChildProfile; nextBelt: BeltColor; stripesRequired: number; testType: 'whiteboard' | 'teach_it'; ready: boolean }> {
  const liveActor = resolveLiveActor(state, actor)
  const out: Array<{ child: ChildProfile; nextBelt: BeltColor; stripesRequired: number; testType: 'whiteboard' | 'teach_it'; ready: boolean }> = []
  for (const child of state.children) {
    if (!can(liveActor, 'award_belt', { type: 'child', record: child })) continue
    const step = getNextBeltStep(child)
    if (!step) continue
    if (child.stripesEarned >= step.stripesRequired - 1) {
      out.push({ child, nextBelt: step.nextBelt, stripesRequired: step.stripesRequired, testType: step.testType, ready: step.eligible })
    }
  }
  return out
}

export function sendWorkReviewReply(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  workRecordId: string,
  replyText: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; shownToChild: boolean; stripeEarned: boolean } {
  const trimmed = replyText.trim()
  if (!trimmed) throw new PortalAccessError('Reply text is required')
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const record = state.workRecords.find((w) => w.id === workRecordId)
  if (!record || !can(liveActor, 'review_work', { type: 'work', record })) {
    throw new PortalAccessError('Only an assigned mentor may review submitted work')
  }
  const hh = state.households.find((h) => h.id === record.householdId)!
  const child = state.children.find((c) => c.id === record.childId)!
  const mentorId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  const canAutoShow = child.autoShow && child.consentStatus === 'verified' && hh.consentRecord.status === 'verified'

  state.inbox.unshift({
    id: `eml_wr_${state.inbox.length + 1}`, to: hh.parentEmail, householdId: hh.id,
    subject: canAutoShow ? `Work feedback for ${child.nickname} (auto-shown)` : `New work feedback for ${child.nickname} (tap Show to share)`,
    body: `Mr. Sam reviewed ${child.nickname}'s set: "${trimmed}"`,
    kind: 'mentor_reply', status: 'delivered', sentAt: nowIso, relatedQuestionId: null,
  })
  const fbId = `fb_wr_${state.feedback.length + 1}`
  state.feedback.push({
    id: fbId, householdId: hh.id, childId: child.id, workRecordId: record.id, authorMentorId: mentorId,
    status: canAutoShow ? 'visible_to_child' : 'sent_to_parent',
    draftText: '[Placeholder draft] Work review', sentText: trimmed, parentNotifiedAt: nowIso,
    shownToChildAt: canAutoShow ? nowIso : null, shownBy: canAutoShow ? 'parent_auto_show' : null,
  })
  record.status = 'reviewed'
  // Computed stripe when unit's set + open response pass review; NEVER auto-awards a belt.
  const stripeEarned = creditReviewedUnitStripe(state, child, record.unitId)
  if (record.openResponse.trim()) {
    grantBadgeInState(state, child, 'explained_it', STARTER_BADGE_LABELS.explained_it, mentorId, nowIso)
  }
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'review_work', recordType: 'work', recordId: record.id, householdId: hh.id, outcome: 'allow' })
  return { state: adapter.save(state), shownToChild: canAutoShow, stripeEarned }
}

export function sendQuietNudge(adapter: PortalStorageAdapter, actor: PortalActor, childId: string, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const child = state.children.find((c) => c.id === childId)
  const hh = child ? state.households.find((h) => h.id === child.householdId) : undefined
  if (!child || !hh) throw new PortalAccessError('Child not found')
  const probe = { id: 'probe', householdId: hh.id, childId: child.id, authorMentorId: liveActor.kind === 'mentor' ? liveActor.mentorId : '', weekOf: nowIso.slice(0, 10), workedOn: '', needsHelp: '', tryAtHome: '', humanSentence: '', deliveryStatus: 'draft' as const, sentAt: null }
  if (!can(liveActor, 'send_parent_update', { type: 'parent_update', record: probe })) {
    throw new PortalAccessError('Only an assigned mentor may send a quiet check-in to the parent')
  }
  const mentorId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  state.inbox.unshift({
    id: `eml_nudge_${state.inbox.length + 1}`, to: hh.parentEmail, householdId: hh.id,
    subject: `Quick check-in on ${child.nickname}`,
    body: `Hi ${hh.parentName} — noticed ${child.nickname} has had a quiet week on SAL0MANder. No rush; whenever you're ready, one 10-minute set is waiting.`,
    kind: 'friday_note', status: 'delivered', sentAt: nowIso, relatedQuestionId: null,
  })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'send_quiet_nudge', recordType: 'child', recordId: child.id, householdId: hh.id, outcome: 'allow' })
  return adapter.save(state)
}

export function awardBeltPassed(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  childId: string,
  options?: string | { nowIso?: string; teachItCompleted?: boolean },
): PortalState {
  const nowIso = typeof options === 'string' ? options : (options?.nowIso ?? new Date().toISOString())
  const teachItCompleted = typeof options === 'object' ? Boolean(options?.teachItCompleted) : false
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const child = state.children.find((c) => c.id === childId)
  if (!child || !can(liveActor, 'award_belt', { type: 'child', record: child })) {
    throw new PortalAccessError('Only an assigned human mentor may award a belt')
  }
  const step = getNextBeltStep(child)
  if (!step) return state
  if (step.testType === 'teach_it' && !teachItCompleted) {
    throw new PortalAccessError('Black belt requires completing the live teach-it test')
  }
  child.currentBelt = step.nextBelt
  const mentorId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'award_belt', recordType: 'child', recordId: child.id, householdId: child.householdId, outcome: 'allow' })
  return adapter.save(state)
}

export function awardBadgeByMentor(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  childId: string,
  kind: 'first_question' | 'explained_it' | 'came_back',
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const child = state.children.find((c) => c.id === childId)
  if (!child || !can(liveActor, 'award_belt', { type: 'child', record: child })) {
    throw new PortalAccessError('Only an assigned mentor may award a badge')
  }
  const mentorId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  grantBadgeInState(state, child, kind, STARTER_BADGE_LABELS[kind], mentorId, nowIso)
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'award_badge', recordType: 'badge', recordId: `${child.id}:${kind}`, householdId: child.householdId, outcome: 'allow' })
  return adapter.save(state)
}

export type FridayDraft = { childId: string; householdId: string; nickname: string; quiet: boolean; weekOf: string; workedOn: string; needsHelp: string; tryAtHome: string; humanSentence: string }

export function buildFridayDrafts(state: PortalState, actor: PortalActor, weekOf = '2026-11-24', nowIso = '2026-11-24T18:00:00Z'): FridayDraft[] {
  const liveActor = resolveLiveActor(state, actor)
  return state.children
    .filter((record) => can(liveActor, 'view', { type: 'child', record }))
    .map((child) => {
      const quiet = daysQuiet(child, nowIso) >= QUIET_DAYS_THRESHOLD
      const workCount = state.workRecords.filter((w) => w.childId === child.id).length
      return quiet
        ? { childId: child.id, householdId: child.householdId, nickname: child.nickname, quiet: true, weekOf, workedOn: 'Quiet week — no new practice sets saved.', needsHelp: 'Finding a low-pressure 10-minute restart.', tryAtHome: 'Ask which problem feels easiest to open together for 5 minutes.', humanSentence: `Thinking of ${child.nickname} this week — whenever they're ready, we'll pick right back up.` }
        : { childId: child.id, householdId: child.householdId, nickname: child.nickname, quiet: false, weekOf, workedOn: `${workCount} practice set(s) on ${child.level} (${child.stripesEarned} stripes).`, needsHelp: 'Double-checking sign rules on multi-step integer problems.', tryAtHome: `Ask ${child.nickname} to explain one problem out loud.`, humanSentence: `${child.nickname} kept steady momentum this week.` }
    })
}

export function sendAllFridayNotes(adapter: PortalStorageAdapter, actor: PortalActor, drafts: ReadonlyArray<FridayDraft>, nowIso = new Date().toISOString()): { state: PortalState; sentCount: number } {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const mentorId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  let sentCount = 0
  for (const d of drafts) {
    const hh = state.households.find((h) => h.id === d.householdId)
    if (!hh || hh.consentRecord.status !== 'verified') continue
    const upd = {
      id: `upd_${state.parentUpdates.length + 1}`, householdId: hh.id, childId: d.childId, authorMentorId: mentorId,
      weekOf: d.weekOf, workedOn: d.workedOn, needsHelp: d.needsHelp, tryAtHome: d.tryAtHome,
      humanSentence: d.humanSentence.trim() || `${d.nickname} checked in this week.`, deliveryStatus: 'delivered' as const, sentAt: nowIso,
    }
    if (!can(liveActor, 'send_parent_update', { type: 'parent_update', record: upd })) {
      throw new PortalAccessError('Only an assigned mentor may send Friday notes for this household')
    }
    state.parentUpdates.unshift(upd)
    state.inbox.unshift({
      id: `eml_fri_${state.inbox.length + 1}`, to: hh.parentEmail, householdId: hh.id,
      subject: `Friday note for ${d.nickname} — week of ${d.weekOf}`,
      body: `Worked on: ${upd.workedOn} | Needs help: ${upd.needsHelp} | Try at home: ${upd.tryAtHome} | Note: ${upd.humanSentence}`,
      kind: 'friday_note', status: 'delivered', sentAt: nowIso, relatedQuestionId: null,
    })
    sentCount += 1
  }
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'send_parent_update', recordType: 'parent_update', recordId: `batch_${sentCount}`, householdId: null, outcome: 'allow' })
  return { state: adapter.save(state), sentCount }
}

export function addMentorAccount(adapter: PortalStorageAdapter, actor: PortalActor, input: { displayName: string; email: string; roles?: MentorRole[] }, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  if (!can(liveActor, 'add_mentor', { type: 'portal_admin', householdId: null })) {
    throw new PortalAccessError('Only an admin may add a mentor')
  }
  const newId = `mentor_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const mentor = MentorSchema.parse({ id: newId, displayName: input.displayName.trim(), email: input.email.trim().toLowerCase(), roles: input.roles?.length ? input.roles : ['mentor'], active: true })
  state.mentors.push(mentor)
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'admin', actorId: liveActor.kind === 'mentor' ? liveActor.mentorId : 'admin', action: 'add_mentor', recordType: 'mentor', recordId: newId, householdId: null, outcome: 'allow' })
  return adapter.save(state)
}

export function assignMentorToHousehold(adapter: PortalStorageAdapter, actor: PortalActor, mentorId: string, householdId: string, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const hh = state.households.find((h) => h.id === householdId)
  const mentor = state.mentors.find((m) => m.id === mentorId && m.active)
  if (!hh || !mentor || !can(liveActor, 'assign_mentor', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only an admin may assign an active mentor to a household')
  }
  const existing = state.assignments.find((a) => a.mentorId === mentorId && a.householdId === householdId && a.revokedAt === null)
  if (existing) return state
  const asgnId = `asgn_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const adminId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  state.assignments.push({ id: asgnId, mentorId, householdId, assignedByMentorId: adminId, assignedAt: nowIso, revokedAt: null, revokedByMentorId: null })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'admin', actorId: adminId, action: 'assign_mentor', recordType: 'assignment', recordId: asgnId, householdId, outcome: 'allow' })
  return adapter.save(state)
}

export function getMembershipCapacity(state: PortalState) {
  const activeCount = state.households.filter((h) => h.membershipStatus === 'active').length
  const waitlistedCount = state.households.filter((h) => h.membershipStatus === 'waitlisted').length
  return { activeCount, waitlistedCount, cap: MEMBERSHIP_CAP, remaining: Math.max(0, MEMBERSHIP_CAP - activeCount) }
}
