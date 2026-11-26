import { can, resolveLiveActor, type PortalActor } from './access'
import {
  appendApprovalLogInState,
  approveQuestionWithLinkAndCode,
  issueApprovalTokenInState,
} from './approvalLayers'
import { STARTER_BADGE_LABELS, grantBadgeInState } from './belts'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import type { AskQuestion, ChildProfile, Household, PortalState } from './types'

export const ASK_SEND_DISCLOSURE = 'This goes to your parent’s email first. Only your parent’s yes sends it to Mr. Sam.'
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
 * worksheet open responses.
 *
 * Nov 25 rule: No Auto-send for teens. Every teen question goes to the parent's
 * verified email first with a single-use ~72 h approve link, and waits until the
 * parent approves (link + fresh one-time code OR forward from verified parent address).
 * Adults (18+, `child.isAdultLearner === true`) bypass parent approval and go straight to Mr. Sam.
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
    deviceId?: string | null
    networkTag?: string | null
  },
  nowIso = new Date().toISOString(),
): { question: AskQuestion; childNotice: string; approvalTokenId: string | null } {
  const trimmed = input.text.trim()
  if (!trimmed) throw new PortalAccessError('Question text is required')

  const qId = randomAskId()
  const mentor = assignedMentor(state, hh.id)
  const expiresAt = new Date((Date.parse(nowIso) || Date.now()) + THIRTY_DAYS_MS).toISOString()
  const photo = input.photoPlaceholder
    ? { label: input.photoPlaceholder.label.trim() || 'Written work photo (placeholder)', nameCovered: input.photoPlaceholder.nameCovered, expiresAt }
    : null

  const submittingDev = input.deviceId ? state.devices.find((d) => d.id === input.deviceId) : undefined
  const submittedFromDeviceId = input.deviceId ?? null
  const submittedFromNetworkTag = input.networkTag ?? submittingDev?.networkTag ?? null

  // Adults (18+): no parent approval layers; question goes straight to Mr. Sam.
  if (child.isAdultLearner) {
    const directQuestion: AskQuestion = {
      id: qId,
      householdId: hh.id,
      childId: child.id,
      workRecordId: input.workRecordId ?? null,
      source: input.source,
      text: trimmed,
      photoPlaceholder: photo,
      askModeAtSend: 'review',
      status: 'queued_for_mentor',
      parentEmailAcceptedAt: nowIso,
      forwardedToMentorAt: nowIso,
      submittedFromDeviceId,
      submittedFromNetworkTag,
      parentApprovalStamp: null,
      suspiciousFlags: [],
      approvalDelaySeconds: null,
      pulledBackAt: null,
      adultDirectBypass: true,
      createdAt: nowIso,
    }
    state.askQuestions.unshift(directQuestion)
    grantBadgeInState(state, child, 'first_question', STARTER_BADGE_LABELS.first_question, 'system', nowIso)
    if (input.source === 'ask_form') {
      state.feedback.push({
        id: `fb_ask_${state.feedback.length + 1}`,
        householdId: hh.id,
        childId: child.id,
        workRecordId: input.workRecordId ?? null,
        authorMentorId: mentor.id,
        status: 'draft',
        draftText: `[Placeholder draft] Direct reply to adult learner ${child.nickname}.`,
        sentText: null,
        parentNotifiedAt: null,
        shownToChildAt: null,
        shownBy: null,
      })
    }
    state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'child', actorId: child.id, action: 'submit_question', recordType: 'ask_question', recordId: qId, householdId: hh.id, outcome: 'allow' })
    return {
      question: directQuestion,
      childNotice: 'Sent straight to Mr. Sam (18+ adult learner account — no parent approval step).',
      approvalTokenId: null,
    }
  }

  // Step 1 (Teens): Attempt parent email send first. If rejected, hold undelivered — never send content to mentor.
  if (input.simulateParentRejected) {
    state.inbox.unshift({
      id: `eml_rej_${state.inbox.length + 1}`,
      to: hh.parentEmail,
      householdId: hh.id,
      subject: `Rejected: ${child.nickname}'s math question could not be delivered`,
      body: 'Simulated provider rejection before acceptance. Held undelivered; not sent to Mr. Sam.',
      kind: 'question_review',
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
      status: 'held_undelivered', parentEmailAcceptedAt: null, forwardedToMentorAt: null,
      submittedFromDeviceId, submittedFromNetworkTag,
      parentApprovalStamp: null, suspiciousFlags: [], approvalDelaySeconds: null, pulledBackAt: null, adultDirectBypass: false,
      createdAt: nowIso,
    }
    state.askQuestions.unshift(held)
    state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'system', actorId: 'email_provider', action: 'ask_held_undelivered', recordType: 'ask_question', recordId: qId, householdId: hh.id, outcome: 'recorded' })
    return { question: held, childNotice: PARENT_REJECTED_CHILD_NOTICE, approvalTokenId: null }
  }

  // Provider accepted parent email send -> ALWAYS Review-first (no Auto-send). Issue single-use 72 h approval token.
  const token = issueApprovalTokenInState(state, hh.id, qId, nowIso)
  state.inbox.unshift({
    id: `eml_ask_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: `${child.nickname}'s question is waiting for your approval`,
    body: `Review-first (single-use link expires ${token.expiresAt}): "${trimmed}"${photo ? ` [Photo: ${photo.label}, name covered: ${photo.nameCovered ? 'yes' : 'reminder shown'}]` : ''}. Only your yes (approve button + fresh one-time code, or a forward FROM ${hh.parentEmail}) releases it to Mr. Sam.`,
    kind: 'question_review',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: qId,
    approvalTokenId: token.tokenId,
  })

  const question: AskQuestion = {
    id: qId, householdId: hh.id, childId: child.id, workRecordId: input.workRecordId ?? null,
    source: input.source, text: trimmed, photoPlaceholder: photo, askModeAtSend: 'review',
    status: 'waiting_parent_review',
    parentEmailAcceptedAt: nowIso,
    forwardedToMentorAt: null,
    submittedFromDeviceId, submittedFromNetworkTag,
    parentApprovalStamp: null, suspiciousFlags: [], approvalDelaySeconds: null, pulledBackAt: null, adultDirectBypass: false,
    createdAt: nowIso,
  }
  state.askQuestions.unshift(question)
  grantBadgeInState(state, child, 'first_question', STARTER_BADGE_LABELS.first_question, 'system', nowIso)

  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    questionId: qId,
    actorKind: 'child',
    actorLabel: child.nickname,
    event: 'question_sent_to_parent',
    detail: `Question sent to ${hh.parentEmail} with single-use 72 h approve token (${token.tokenId}). Waiting for parent approval.`,
    outcome: 'recorded',
  })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'child', actorId: child.id, action: 'submit_question', recordType: 'ask_question', recordId: qId, householdId: hh.id, outcome: 'allow' })
  return {
    question,
    childNotice: 'Sent to your parent first to review before Mr. Sam sees it.',
    approvalTokenId: token.tokenId,
  }
}

export function submitAskQuestion(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  childId: string,
  input: {
    text: string
    photoPlaceholder?: AskPhotoInput
    simulateParentRejected?: boolean
    deviceId?: string | null
    networkTag?: string | null
  },
  nowIso = new Date().toISOString(),
): { state: PortalState; question: AskQuestion; childNotice: string; approvalTokenId: string | null } {
  const state = adapter.load()
  const child = state.children.find((c) => c.id === childId)
  const hh = child ? state.households.find((h) => h.id === child.householdId) : undefined
  if (!child || !hh || !can(actor, 'submit_question', { type: 'child', record: child }) || hh.consentRecord.status !== 'verified') {
    throw new PortalAccessError('Ask Mr. Sam requires verified parent consent and Ask mode enabled')
  }
  const { question, childNotice, approvalTokenId } = enqueueAskQuestionInState(
    state, child, hh, { ...input, source: 'ask_form', workRecordId: null }, nowIso,
  )
  return { state: adapter.save(state), question, childNotice, approvalTokenId }
}

/**
 * Parent-approved release via single-use 72 h link + fresh parent step-up OTP.
 * Enforces all Nov 25 approval layers (never releases without link + code + non-teen device).
 */
export function forwardQuestionToMentor(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  questionId: string,
  approval: { tokenId: string; stepUpCode: string; deviceId?: string | null; networkTag?: string | null },
  nowIso = new Date().toISOString(),
): PortalState {
  return approveQuestionWithLinkAndCode(
    adapter,
    actor,
    {
      questionId,
      tokenId: approval.tokenId,
      stepUpCode: approval.stepUpCode,
      deviceId: approval.deviceId ?? null,
      networkTag: approval.networkTag ?? null,
    },
    nowIso,
  )
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
  const liveActor = resolveLiveActor(state, actor)
  const q = state.askQuestions.find((x) => x.id === questionId)
  if (!q || !can(liveActor, 'view', { type: 'ask_question', record: q }) || q.status === 'parent_bounced' || q.status === 'pulled_back') {
    throw new PortalAccessError('Mentor may reply only to an assigned, parent-approved (stamped) question')
  }
  const hh = state.households.find((h) => h.id === q.householdId)!
  const child = state.children.find((c) => c.id === q.childId)!
  if (!q.adultDirectBypass && (child.consentStatus !== 'verified' || hh.consentRecord.status !== 'verified' || child.askMode === 'off')) {
    throw new PortalAccessError('Mentor may not reply when consent is unverified or Questions are off')
  }
  const mentorId = liveActor.kind === 'mentor' ? liveActor.mentorId : 'mentor_samuel'
  const fbId = `fb_rep_${state.feedback.length + 1}`
  const candidateFb = {
    id: fbId, householdId: hh.id, childId: child.id, workRecordId: q.workRecordId,
    authorMentorId: mentorId, status: 'draft' as const,
    draftText: '[Placeholder draft] Human reply', sentText: null,
    parentNotifiedAt: null, shownToChildAt: null, shownBy: null,
  }
  if (!can(liveActor, 'author_feedback', { type: 'feedback', record: candidateFb })) {
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

  // Step 1: Parent email accepted first (or adult learner's own email).
  const canAutoShow = q.adultDirectBypass || (child.autoShow && child.consentStatus === 'verified' && hh.consentRecord.status === 'verified')
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
