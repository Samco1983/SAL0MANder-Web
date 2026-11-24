import { can, type PortalActor } from './access'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import { MentorSchema, type AskQuestion, type BeltColor, type ChildProfile, type MentorRole, type PortalState, type WorkRecord } from './types'

export const MEMBERSHIP_CAP = 100
export const QUIET_DAYS_THRESHOLD = 7
const BELT_STEPS: ReadonlyArray<{ belt: BeltColor; next: BeltColor | null; stripesRequired: number }> = [
  { belt: 'white', next: 'yellow', stripesRequired: 2 },
  { belt: 'yellow', next: 'green', stripesRequired: 4 },
  { belt: 'green', next: 'purple', stripesRequired: 6 },
  { belt: 'purple', next: 'black', stripesRequired: 7 },
  { belt: 'black', next: null, stripesRequired: 7 },
]

export type UnitScript = {
  unitId: string; title: string; explanation: string; commonMistake: string
  problems: readonly [string, string, string]; links: readonly [{ label: string; url: string }, { label: string; url: string }]
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

export function listTodayAskQueue(state: PortalState, actor: PortalActor): AskQuestion[] {
  return state.askQuestions
    .filter((record) => record.status === 'queued_for_mentor' && can(actor, 'view', { type: 'ask_question', record }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function listTodayWorkQueue(state: PortalState, actor: PortalActor): WorkRecord[] {
  return state.workRecords
    .filter((record) => record.status === 'submitted' && can(actor, 'review_work', { type: 'work', record }))
    .sort((a, b) => (a.attempts.at(-1)?.submittedAt ?? '').localeCompare(b.attempts.at(-1)?.submittedAt ?? ''))
}

export function listQuietKids(state: PortalState, actor: PortalActor, nowIso = '2026-11-24T18:00:00Z'): ChildProfile[] {
  return state.children.filter((record) => can(actor, 'view', { type: 'child', record }) && daysQuiet(record, nowIso) >= QUIET_DAYS_THRESHOLD)
}

export function listBeltTestsDue(state: PortalState, actor: PortalActor): Array<{ child: ChildProfile; nextBelt: BeltColor; stripesRequired: number; ready: boolean }> {
  const out: Array<{ child: ChildProfile; nextBelt: BeltColor; stripesRequired: number; ready: boolean }> = []
  for (const child of state.children) {
    if (!can(actor, 'award_belt', { type: 'child', record: child })) continue
    const step = BELT_STEPS.find((s) => s.belt === child.currentBelt)
    if (!step?.next) continue
    if (child.stripesEarned >= step.stripesRequired - 1) {
      out.push({ child, nextBelt: step.next, stripesRequired: step.stripesRequired, ready: child.stripesEarned >= step.stripesRequired })
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
): { state: PortalState; shownToChild: boolean } {
  const trimmed = replyText.trim()
  if (!trimmed) throw new PortalAccessError('Reply text is required')
  const state = adapter.load()
  const record = state.workRecords.find((w) => w.id === workRecordId)
  if (!record || !can(actor, 'review_work', { type: 'work', record })) {
    throw new PortalAccessError('Only an assigned mentor may review submitted work')
  }
  const hh = state.households.find((h) => h.id === record.householdId)!
  const child = state.children.find((c) => c.id === record.childId)!
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
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
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'review_work', recordType: 'work', recordId: record.id, householdId: hh.id, outcome: 'allow' })
  return { state: adapter.save(state), shownToChild: canAutoShow }
}

export function sendQuietNudge(adapter: PortalStorageAdapter, actor: PortalActor, childId: string, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const child = state.children.find((c) => c.id === childId)
  const hh = child ? state.households.find((h) => h.id === child.householdId) : undefined
  if (!child || !hh) throw new PortalAccessError('Child not found')
  const probe = { id: 'probe', householdId: hh.id, childId: child.id, authorMentorId: actor.kind === 'mentor' ? actor.mentorId : '', weekOf: nowIso.slice(0, 10), workedOn: '', needsHelp: '', tryAtHome: '', humanSentence: '', deliveryStatus: 'draft' as const, sentAt: null }
  if (!can(actor, 'send_parent_update', { type: 'parent_update', record: probe })) {
    throw new PortalAccessError('Only an assigned mentor may send a quiet check-in to the parent')
  }
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  state.inbox.unshift({
    id: `eml_nudge_${state.inbox.length + 1}`, to: hh.parentEmail, householdId: hh.id,
    subject: `Quick check-in on ${child.nickname}`,
    body: `Hi ${hh.parentName} — noticed ${child.nickname} has had a quiet week on SAL0MANder. No rush; whenever you're ready, one 10-minute set is waiting.`,
    kind: 'friday_note', status: 'delivered', sentAt: nowIso, relatedQuestionId: null,
  })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'send_quiet_nudge', recordType: 'child', recordId: child.id, householdId: hh.id, outcome: 'allow' })
  return adapter.save(state)
}

export function awardBeltPassed(adapter: PortalStorageAdapter, actor: PortalActor, childId: string, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const child = state.children.find((c) => c.id === childId)
  if (!child || !can(actor, 'award_belt', { type: 'child', record: child })) {
    throw new PortalAccessError('Only an assigned human mentor may award a belt')
  }
  const step = BELT_STEPS.find((s) => s.belt === child.currentBelt)
  if (step?.next) child.currentBelt = step.next
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'award_belt', recordType: 'child', recordId: child.id, householdId: child.householdId, outcome: 'allow' })
  return adapter.save(state)
}

export type FridayDraft = { childId: string; householdId: string; nickname: string; quiet: boolean; weekOf: string; workedOn: string; needsHelp: string; tryAtHome: string; humanSentence: string }

export function buildFridayDrafts(state: PortalState, actor: PortalActor, weekOf = '2026-11-24', nowIso = '2026-11-24T18:00:00Z'): FridayDraft[] {
  return state.children
    .filter((record) => can(actor, 'view', { type: 'child', record }))
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
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  let sentCount = 0
  for (const d of drafts) {
    const hh = state.households.find((h) => h.id === d.householdId)
    if (!hh || hh.consentRecord.status !== 'verified') continue
    const upd = {
      id: `upd_${state.parentUpdates.length + 1}`, householdId: hh.id, childId: d.childId, authorMentorId: mentorId,
      weekOf: d.weekOf, workedOn: d.workedOn, needsHelp: d.needsHelp, tryAtHome: d.tryAtHome,
      humanSentence: d.humanSentence.trim() || `${d.nickname} checked in this week.`, deliveryStatus: 'delivered' as const, sentAt: nowIso,
    }
    if (!can(actor, 'send_parent_update', { type: 'parent_update', record: upd })) {
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
  if (!can(actor, 'add_mentor', { type: 'portal_admin', householdId: null })) {
    throw new PortalAccessError('Only an admin may add a mentor')
  }
  const state = adapter.load()
  const newId = `mentor_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const mentor = MentorSchema.parse({ id: newId, displayName: input.displayName.trim(), email: input.email.trim().toLowerCase(), roles: input.roles?.length ? input.roles : ['mentor'], active: true })
  state.mentors.push(mentor)
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'admin', actorId: actor.kind === 'mentor' ? actor.mentorId : 'admin', action: 'add_mentor', recordType: 'mentor', recordId: newId, householdId: null, outcome: 'allow' })
  return adapter.save(state)
}

export function assignMentorToHousehold(adapter: PortalStorageAdapter, actor: PortalActor, mentorId: string, householdId: string, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  const mentor = state.mentors.find((m) => m.id === mentorId && m.active)
  if (!hh || !mentor || !can(actor, 'assign_mentor', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only an admin may assign an active mentor to a household')
  }
  const existing = state.assignments.find((a) => a.mentorId === mentorId && a.householdId === householdId && a.revokedAt === null)
  if (existing) return state
  const asgnId = `asgn_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const adminId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  state.assignments.push({ id: asgnId, mentorId, householdId, assignedByMentorId: adminId, assignedAt: nowIso, revokedAt: null, revokedByMentorId: null })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'admin', actorId: adminId, action: 'assign_mentor', recordType: 'assignment', recordId: asgnId, householdId, outcome: 'allow' })
  return adapter.save(state)
}

export function getMembershipCapacity(state: PortalState) {
  const activeCount = state.households.filter((h) => h.membershipStatus === 'active').length
  const waitlistedCount = state.households.filter((h) => h.membershipStatus === 'waitlisted').length
  return { activeCount, waitlistedCount, cap: MEMBERSHIP_CAP, remaining: Math.max(0, MEMBERSHIP_CAP - activeCount) }
}
