import { can, type PortalActor } from './access'
import { STARTER_BADGE_LABELS, grantBadgeInState } from './belts'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import type { AskQuestion, ChildProfile, Household, PortalState } from './types'

export const ASK_SEND_DISCLOSURE = 'This goes to Mr. Sam and to your parent.'
export const PARENT_REJECTED_CHILD_NOTICE =
  "We couldn't reach your parent's email; ask them to check their settings."

const THIRTY_DAYS_MS = 30 * 86_400_000

function randomAskId(): string {
  return `ask_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
}

function assignedMentor(state: PortalState, householdId: string) {
  const mentorId =
    state.assignments.find((a) => a.householdId === householdId && a.revokedAt === null)?.mentorId ?? 'mentor_samuel'
  return state.mentors.find((m) => m.id === mentorId) ?? state.mentors[0]!
}

export type AskPhotoInput = { label: string; nameCovered: boolean } | null

/**
 * Shared Ask Rail state mutation used by both the standalone Ask Form and
 * worksheet open responses. Enforces parent-first delivery with the
 * provider-accepted gate before anything reaches Samuel or any mentor.
 */
export function enqueueAskQuestionInState(
  state: PortalState,
  child: ChildProfile,
  hh: Household,
  input: {
    text: string
    source: 'ask_form' | 'worksheet_open_response'
    workRecordId?: string | null
    photoPlaceholder?: AskPhotoInput
    simulateParentRejected?: boolean
  },
  nowIso = new Date().toISOString(),
): { question: AskQuestion; childNotice: string } {
  const trimmed = input.text.trim()
  if (!trimmed) throw new PortalAccessError('Question text is required')

  const qId = randomAskId()
  const mentor = assignedMentor(state, hh.id)
  const expiresAt = new Date((Date.parse(nowIso) || Date.now()) + THIRTY_DAYS_MS).toISOString()
  const photo = input.photoPlaceholder
    ? { label: input.photoPlaceholder.label.trim() || 'Written work photo (placeholder)', nameCovered: input.photoPlaceholder.nameCovered, expiresAt }
    : null

  // Step 1: Attempt parent email send first. If rejected, hold undelivered — never send content to mentor.
  if (input.simulateParentRejected) {
    state.inbox.unshift({
      id: `eml_rej_${state.inbox.length + 1}`,
      to: hh.parentEmail,
      householdId: hh.id,
      subject: `Rejected: ${child.nickname}'s math question could not be delivered`,
      body: 'Simulated provider rejection before acceptance. Held undelivered; not sent to Mr. Sam.',
      kind: child.askMode === 'review' ? 'question_review' : 'question_copy',
      status: 'rejected',
      sentAt: nowIso,
      relatedQuestionId: qId,
    })
    state.inbox.unshift({
      id: `eml_fail_${state.inbox.length + 1}`,
      to: mentor.email,
      householdId: hh.id,
      subject: 'Delivery failure notice (no child content)',
      body: 'Parent email delivery was rejected by the email provider. The item is held undelivered; no child question content is included.',
      kind: 'delivery_failure',
      status: 'delivered',
      sentAt: nowIso,
      relatedQuestionId: null,
    })
    const held: AskQuestion = {
      id: qId, householdId: hh.id, childId: child.id, workRecordId: input.workRecordId ?? null,
      source: input.source, text: trimmed, photoPlaceholder: photo, askModeAtSend: child.askMode,
      status: 'held_undelivered', parentEmailAcceptedAt: null, forwardedToMentorAt: null, createdAt: nowIso,
    }
    state.askQuestions.unshift(held)
    state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'system', actorId: 'email_provider', action: 'ask_held_undelivered', recordType: 'ask_question', recordId: qId, householdId: hh.id, outcome: 'recorded' })
    return { question: held, childNotice: PARENT_REJECTED_CHILD_NOTICE }
  }

  // Provider accepted parent email send.
  const isReview = child.askMode === 'review'
  state.inbox.unshift({
    id: `eml_ask_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: isReview
      ? `${child.nickname}'s question is waiting for your review`
      : `Copy: ${child.nickname} asked Mr. Sam a question`,
    body: isReview
      ? `Review-first mode: "${trimmed}"${photo ? ` [Photo: ${photo.label}, name covered: ${photo.nameCovered ? 'yes' : 'reminder shown'}]` : ''}. Tap Forward to Mr. Sam when ready.`
      : `Auto-send mode (parent email accepted first, then queued for Mr. Sam): "${trimmed}"`,
    kind: isReview ? 'question_review' : 'question_copy',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: qId,
  })

  const question: AskQuestion = {
    id: qId, householdId: hh.id, childId: child.id, workRecordId: input.workRecordId ?? null,
    source: input.source, text: trimmed, photoPlaceholder: photo, askModeAtSend: child.askMode,
    status: isReview ? 'waiting_parent_review' : 'queued_for_mentor',
    parentEmailAcceptedAt: nowIso,
    forwardedToMentorAt: isReview ? null : nowIso,
    createdAt: nowIso,
  }
  state.askQuestions.unshift(question)
  grantBadgeInState(state, child, 'first_question', STARTER_BADGE_LABELS.first_question, 'system', nowIso)

  // Only Auto-send queues a mentor draft immediately (after parent acceptance); Review-first waits for parent Forward.
  if (!isReview && input.source === 'ask_form') {
    state.feedback.push({
      id: `fb_ask_${state.feedback.length + 1}`,
      householdId: hh.id, childId: child.id, workRecordId: input.workRecordId ?? null,
      authorMentorId: mentor.id, status: 'draft',
      draftText: `[Placeholder draft] Reply to ${child.nickname}'s question.`,
      sentText: null, parentNotifiedAt: null, shownToChildAt: null, shownBy: null,
    })
  }

  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'child', actorId: child.id, action: 'submit_question', recordType: 'ask_question', recordId: qId, householdId: hh.id, outcome: 'allow' })
  return {
    question,
    childNotice: isReview
      ? 'Sent to your parent first to review before Mr. Sam sees it.'
      : "Sent to your parent's email first, then queued for Mr. Sam.",
  }
}

export function submitAskQuestion(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  childId: string,
  input: { text: string; photoPlaceholder?: AskPhotoInput; simulateParentRejected?: boolean },
  nowIso = new Date().toISOString(),
): { state: PortalState; question: AskQuestion; childNotice: string } {
  const state = adapter.load()
  const child = state.children.find((c) => c.id === childId)
  const hh = child ? state.households.find((h) => h.id === child.householdId) : undefined
  if (!child || !hh || !can(actor, 'submit_question', { type: 'child', record: child }) || hh.consentRecord.status !== 'verified') {
    throw new PortalAccessError('Ask Mr. Sam requires verified parent consent and Ask mode enabled')
  }
  const { question, childNotice } = enqueueAskQuestionInState(
    state, child, hh, { ...input, source: 'ask_form', workRecordId: null }, nowIso,
  )
  return { state: adapter.save(state), question, childNotice }
}

export function forwardQuestionToMentor(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  questionId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const q = state.askQuestions.find((x) => x.id === questionId)
  const hh = q ? state.households.find((h) => h.id === q.householdId) : undefined
  const child = q ? state.children.find((c) => c.id === q.childId) : undefined
  if (!q || !hh || !child || !can(actor, 'forward_question', { type: 'ask_question', record: q }) || hh.consentRecord.status !== 'verified') {
    throw new PortalAccessError('Only the household parent with verified consent may forward a waiting question')
  }
  q.status = 'queued_for_mentor'
  q.forwardedToMentorAt = nowIso
  const mentor = assignedMentor(state, hh.id)
  state.feedback.push({
    id: `fb_fwd_${state.feedback.length + 1}`,
    householdId: hh.id, childId: child.id, workRecordId: q.workRecordId,
    authorMentorId: mentor.id, status: 'draft',
    draftText: `[Placeholder draft] Parent-forwarded question from ${child.nickname}.`,
    sentText: null, parentNotifiedAt: null, shownToChildAt: null, shownBy: null,
  })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'parent', actorId: hh.id, action: 'forward_question', recordType: 'ask_question', recordId: q.id, householdId: hh.id, outcome: 'allow' })
  return adapter.save(state)
}

export function sendMentorReplyDemo(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  questionId: string,
  replyText: string,
  options?: { simulateParentRejected?: boolean; nowIso?: string },
): { state: PortalState; shownToChild: boolean; held: boolean; message: string } {
  const nowIso = options?.nowIso ?? new Date().toISOString()
  const trimmed = replyText.trim()
  if (!trimmed) throw new PortalAccessError('Reply text is required')

  const state = adapter.load()
  const q = state.askQuestions.find((x) => x.id === questionId)
  if (!q || !can(actor, 'view', { type: 'ask_question', record: q }) || q.status === 'parent_bounced') {
    throw new PortalAccessError('Mentor may reply only to an assigned, provider-accepted question')
  }
  const hh = state.households.find((h) => h.id === q.householdId)!
  const child = state.children.find((c) => c.id === q.childId)!
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  const fbId = `fb_rep_${state.feedback.length + 1}`
  const candidateFb = {
    id: fbId, householdId: hh.id, childId: child.id, workRecordId: q.workRecordId,
    authorMentorId: mentorId, status: 'draft' as const,
    draftText: '[Placeholder draft] Human reply', sentText: null,
    parentNotifiedAt: null, shownToChildAt: null, shownBy: null,
  }
  if (!can(actor, 'author_feedback', { type: 'feedback', record: candidateFb })) {
    throw new PortalAccessError('Only an assigned mentor may send feedback')
  }

  if (options?.simulateParentRejected) {
    state.inbox.unshift({
      id: `eml_rrej_${state.inbox.length + 1}`, to: hh.parentEmail, householdId: hh.id,
      subject: `Rejected: Mr. Sam's reply for ${child.nickname}`,
      body: 'Simulated provider rejection. Reply was held as draft and never shown to the child.',
      kind: 'mentor_reply', status: 'rejected', sentAt: nowIso, relatedQuestionId: q.id,
    })
    state.feedback.push(candidateFb)
    return { state: adapter.save(state), shownToChild: false, held: true, message: 'Parent email rejected — reply held as draft and NOT shown to child.' }
  }

  // Step 1: Parent email accepted first.
  const canAutoShow = child.autoShow && child.consentStatus === 'verified' && hh.consentRecord.status === 'verified'
  state.inbox.unshift({
    id: `eml_rep_${state.inbox.length + 1}`, to: hh.parentEmail, householdId: hh.id,
    subject: canAutoShow
      ? `Reply for ${child.nickname} (auto-show enabled after your copy)`
      : `New reply for ${child.nickname} (tap Show to share)`,
    body: canAutoShow
      ? `Mr. Sam replied: "${trimmed}". Because auto-show is on, it is now visible on ${child.nickname}'s profile.`
      : `Mr. Sam replied: "${trimmed}". Open your Parent View and tap "Show to ${child.nickname}" to share it.`,
    kind: 'mentor_reply', status: 'delivered', sentAt: nowIso, relatedQuestionId: q.id,
  })
  state.feedback.push({
    ...candidateFb,
    status: canAutoShow ? 'visible_to_child' : 'sent_to_parent',
    sentText: trimmed,
    parentNotifiedAt: nowIso,
    shownToChildAt: canAutoShow ? nowIso : null,
    shownBy: canAutoShow ? 'parent_auto_show' : null,
  })
  q.status = 'replied'
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'send_mentor_reply', recordType: 'feedback', recordId: fbId, householdId: hh.id, outcome: 'allow' })
  return {
    state: adapter.save(state),
    shownToChild: canAutoShow,
    held: false,
    message: canAutoShow
      ? `Sent to ${hh.parentName}'s email first, then auto-shown to ${child.nickname}.`
      : `Sent to ${hh.parentName}'s email first — waiting for "Show to ${child.nickname}".`,
  }
}
