import { can, resolveLiveActor, type PortalActor } from './access'
import {
  appendApprovalLogInState,
  isRegisteredTeenDevice,
  verifyAndConsumeStepUpCodeInState,
} from './approvalLayers'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import {
  ChildProfileSchema,
  type AskMode,
  type EmailMode,
  type PortalState,
} from './types'

function revokeChildRoomAccessInState(state: PortalState, childId: string, onlyGameId?: string): void {
  for (const inv of state.roomInvites) {
    if (inv.childId !== childId) continue
    if (onlyGameId && inv.gameId !== onlyGameId) continue
    inv.activeChildIds = inv.activeChildIds.filter((id) => id !== childId)
    if (inv.closedAt === null && (inv.parentApproval === 'approved' || inv.parentApproval === 'standing_yes' || inv.parentApproval === 'pending')) {
      inv.parentApproval = 'declined'
      inv.approvedAt = null
    }
  }
}

export const CONSENT_NOTICE_VERSION = '2026-11-25-demo-v2'

export const CONSENT_NOTICE_POINTS = [
  'What is collected: first name or nickname, math level, saved practice work, and Ask Mr. Sam questions (text + one photo with your teen’s name covered). Never teen email, password, last name, or teen video.',
  'Nothing is recorded: no video, transcript, or AI note-taker in live Google Meet sessions. A parent is present for every private lesson with a teen.',
  'Review-first questions: every teen question goes to your verified email first. Only your yes (single-use 72 h approve link + fresh one-time code, or a forward from your verified email) releases it to Mr. Sam. No Auto-send.',
  'Your rights: you can review your teen’s saved items, pull back approvals, revoke remembered devices, withdraw consent, turn questions off, export, or delete your family’s records at any time.',
] as const

export const ASK_MODE_HELP =
  'If your teen sends Mr. Sam a written math question, it goes to your email first. Only your yes (approve button + one-time code, or a forward from your verified address) releases it. Auto-send is removed.'

export const AUTO_SHOW_WARNING =
  'Warning: replies will show on your child’s profile automatically after your email copy is accepted. You still receive every reply by email first and can switch back to tapping each reply at any time.'

export const LESSON_GAMES = [{ id: 'act_integer_operations', label: 'Integer Operations (lesson game)' }] as const

export const FUN_GAMES = [
  { id: 'moon-gate', label: 'Moon Gate' },
  { id: 'neon-dash', label: 'Neon Dash' },
  { id: 'space-rescue', label: 'Space Rescue' },
  { id: 'origin-defenders', label: 'Origin Defenders' },
  { id: 'bunker-strike', label: 'Bunker Strike' },
] as const

export type ParentReceipt = { id: string; kind: 'consent' | 'show_reply' | 'room_yes' | 'deletion'; label: string; at: string }

export function requestParentSignInLink(
  adapter: PortalStorageAdapter,
  emailInput: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; sent: boolean; message: string } {
  const normalized = emailInput.trim().toLowerCase()
  const state = adapter.load()
  const hh = state.households.find((h) => h.parentEmail.toLowerCase() === normalized)
  if (!hh) {
    return { state, sent: false, message: 'No fictional demo household matched that email. Try elena.demo@family.example, priya.demo@family.example, or david.demo@family.example.' }
  }
  state.inbox.unshift({
    id: `eml_signin_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: `Sign in to SAL0MANder (${hh.parentName}'s membership)`,
    body: `Simulated one-time sign-in link for ${hh.parentName}. Opening this link reaches the profile chooser (teen PIN only). Parent controls, approvals, settings, purchases, and email changes each require a fresh one-time code sent to ${hh.parentEmail}.`,
    kind: 'sign_in_link',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: null,
  })
  return { state: adapter.save(state), sent: true, message: `Simulated sign-in link delivered to ${hh.parentEmail} in the Simulated Inbox panel.` }
}

export function completeParentConsent(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  method: 'simulated_form' | 'simulated_call',
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(liveActor, 'edit_household', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the household parent may record consent')
  }
  hh.consentRecord = { status: 'verified', noticeVersion: CONSENT_NOTICE_VERSION, verifiedAt: nowIso, withdrawnAt: null, method }
  for (const child of state.children) {
    if (child.householdId !== householdId) continue
    child.consentStatus = 'verified'
    if (!child.approvedGames.includes('act_integer_operations')) child.approvedGames.push('act_integer_operations')
  }
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'parent', actorId: householdId, action: 'consent_verified', recordType: 'household', recordId: householdId, householdId, outcome: 'allow' })
  return adapter.save(state)
}

export function withdrawParentConsent(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(liveActor, 'edit_household', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the household parent may withdraw consent')
  }
  hh.consentRecord = { ...hh.consentRecord, status: 'withdrawn', withdrawnAt: nowIso }
  for (const child of state.children) {
    if (child.householdId !== householdId) continue
    child.consentStatus = 'withdrawn'
    child.askMode = 'off'
    child.autoShow = false
    child.joinRooms = false
    child.approvedGames = []
    revokeChildRoomAccessInState(state, child.id)
  }
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'parent', actorId: householdId, action: 'consent_withdrawn', recordType: 'household', recordId: householdId, householdId, outcome: 'allow' })
  return adapter.save(state)
}

export function saveChildProfile(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  input: { id?: string; nickname: string; level: string; pin?: string; firstConversationLine: string; isAdultLearner?: boolean },
): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh) throw new PortalAccessError('Household not found')
  const pinHash = input.pin?.trim() ? `demo-pin-${input.pin.trim()}` : undefined

  if (input.id) {
    const existing = state.children.find((c) => c.id === input.id)
    if (!existing || !can(liveActor, 'edit_child', { type: 'child', record: existing })) {
      throw new PortalAccessError('Only the household parent may edit this child profile')
    }
    const { pinHash: _prevPin, ...rest } = existing
    void _prevPin
    const updated = ChildProfileSchema.parse({
      ...rest,
      nickname: input.nickname.trim(),
      level: input.level.trim(),
      ...(pinHash ? { pinHash } : {}),
      ...(typeof input.isAdultLearner === 'boolean' ? { isAdultLearner: input.isAdultLearner } : {}),
      firstConversationLine: input.firstConversationLine.trim(),
    })
    state.children = state.children.map((c) => (c.id === existing.id ? updated : c))
    return adapter.save(state)
  }

  if (!can(liveActor, 'create_child', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the household parent may create a child profile')
  }
  const newId = `child_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const created = ChildProfileSchema.parse({
    id: newId,
    householdId,
    nickname: input.nickname.trim(),
    level: input.level.trim(),
    ...(pinHash ? { pinHash } : {}),
    isAdultLearner: Boolean(input.isAdultLearner),
    consentStatus: hh.consentRecord.status,
    askMode: 'off',
    autoShow: false,
    approvedGames: hh.consentRecord.status === 'verified' ? ['act_integer_operations'] : [],
    joinRooms: false,
    currentBelt: 'white',
    stripesEarned: 0,
    firstConversationLine: input.firstConversationLine.trim() || 'Just getting started.',
  })
  state.children.push(created)
  state.points.push({ id: `pts_${newId}`, householdId, childId: newId, balance: 0, ledger: [] })
  return adapter.save(state)
}

export function updateFourSettings(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  childId: string,
  next: {
    askMode: AskMode
    autoShow: boolean
    approvedLessonGames?: string[]
    approvedFunGames: string[]
    joinRooms: boolean
    emailMode: EmailMode
    voiceClipsEnabled?: boolean
  },
  stepUpOptions?: { stepUpCode: string; deviceId?: string | null; nowIso?: string },
): PortalState {
  const state = adapter.load()
  const liveActor = resolveLiveActor(state, actor)
  const hh = state.households.find((h) => h.id === householdId)
  const child = state.children.find((c) => c.id === childId)
  if (!hh || !child || !can(liveActor, 'edit_household', { type: 'household', record: hh }) || !can(liveActor, 'edit_child', { type: 'child', record: child })) {
    if (hh) {
      appendApprovalLogInState(state, {
        at: stepUpOptions?.nowIso ?? new Date().toISOString(),
        householdId: hh.id,
        actorKind: actor.kind === 'child' ? 'child' : 'parent',
        actorLabel: actor.kind === 'parent' ? `${actor.parentEmail} (${actor.sessionScope ?? 'full_parent'})` : actor.kind,
        event: 'parent_power_denied_without_step_up',
        detail: 'Blocked settings change from unauthorized or forwarded sign-in session.',
        outcome: 'deny',
      })
      adapter.save(state)
    }
    throw new PortalAccessError('Only the household parent may update settings')
  }
  if (stepUpOptions) {
    const nowIso = stepUpOptions.nowIso ?? new Date().toISOString()
    const teenDevice = isRegisteredTeenDevice(state, hh.id, stepUpOptions.deviceId)
    if (teenDevice) {
      throw new PortalAccessError(`Settings cannot be changed from teen-registered device (${teenDevice.label}).`)
    }
    const stepUp = verifyAndConsumeStepUpCodeInState(state, hh.id, 'change_settings', null, stepUpOptions.stepUpCode, nowIso)
    if (!stepUp.ok) {
      appendApprovalLogInState(state, {
        at: nowIso,
        householdId: hh.id,
        actorKind: 'parent',
        actorLabel: hh.parentEmail,
        event: 'parent_power_denied_without_step_up',
        detail: `Settings change blocked: ${stepUp.reason}`,
        outcome: 'deny',
      })
      adapter.save(state)
      throw new PortalAccessError(stepUp.reason)
    }
  }
  const consentOk = hh.consentRecord.status === 'verified'
  const allowedLesson = new Set<string>(LESSON_GAMES.map((g) => g.id))
  const allowedFun = new Set<string>(FUN_GAMES.map((g) => g.id))
  const cleanLesson = (next.approvedLessonGames ?? LESSON_GAMES.map((g) => g.id)).filter((g) => allowedLesson.has(g))
  const cleanFun = next.approvedFunGames.filter((g) => allowedFun.has(g))
  hh.settings.emailMode = next.emailMode
  child.askMode = consentOk ? next.askMode : 'off'
  child.autoShow = consentOk ? next.autoShow : false
  child.joinRooms = consentOk ? next.joinRooms : false
  child.approvedGames = consentOk ? [...cleanLesson, ...cleanFun] : []
  if (typeof next.voiceClipsEnabled === 'boolean') {
    child.voiceClipsEnabled = next.voiceClipsEnabled
  }
  if (!child.joinRooms) {
    revokeChildRoomAccessInState(state, child.id)
  } else {
    for (const inv of state.roomInvites) {
      if (inv.childId === child.id && inv.parentApproval === 'standing_yes' && !child.approvedGames.includes(inv.gameId)) {
        revokeChildRoomAccessInState(state, child.id, inv.gameId)
      }
    }
  }
  return adapter.save(state)
}

export function showFeedbackToChild(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  feedbackId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const fb = state.feedback.find((f) => f.id === feedbackId)
  if (!fb || !can(actor, 'show_feedback_to_child', { type: 'feedback', record: fb })) {
    throw new PortalAccessError('Only the household parent may show a waiting reply to their child')
  }
  fb.status = 'visible_to_child'
  fb.shownToChildAt = nowIso
  fb.shownBy = 'parent_tap'
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'parent', actorId: fb.householdId, action: 'show_feedback_to_child', recordType: 'feedback', recordId: fb.id, householdId: fb.householdId, outcome: 'allow' })
  return adapter.save(state)
}

/** Household-scoped receipts only (consent, parent approval taps, parent deletion requests) — never admin AuditLog. */
export function listParentReceipts(state: PortalState, actor: PortalActor): ParentReceipt[] {
  if (actor.kind !== 'parent' || actor.sessionScope === 'profile_chooser_only') return []
  const hh = state.households.find((h) => h.id === actor.householdId)
  if (!hh || !can(actor, 'view', { type: 'household', record: hh })) return []
  const out: ParentReceipt[] = []
  if (hh.consentRecord.verifiedAt) {
    out.push({ id: `rcpt_consent_${hh.id}`, kind: 'consent', label: `Consent verified (${hh.consentRecord.method ?? 'recorded'}, notice ${hh.consentRecord.noticeVersion})`, at: hh.consentRecord.verifiedAt })
  }
  if (hh.consentRecord.withdrawnAt) {
    out.push({ id: `rcpt_consent_withdrawn_${hh.id}`, kind: 'consent', label: `Consent withdrawn (notice ${hh.consentRecord.noticeVersion})`, at: hh.consentRecord.withdrawnAt })
  }
  for (const fb of state.feedback) {
    if (fb.householdId === hh.id && fb.shownToChildAt) {
      const name = state.children.find((c) => c.id === fb.childId)?.nickname ?? 'child'
      out.push({ id: `rcpt_fb_${fb.id}`, kind: 'show_reply', label: `Showed mentor reply to ${name} (${fb.shownBy === 'parent_auto_show' ? 'auto-show' : 'parent tap'})`, at: fb.shownToChildAt })
    }
  }
  for (const inv of state.roomInvites) {
    if (inv.householdId === hh.id && inv.approvedAt && (inv.parentApproval === 'approved' || inv.parentApproval === 'standing_yes')) {
      const name = state.children.find((c) => c.id === inv.childId)?.nickname ?? 'child'
      out.push({ id: `rcpt_room_${inv.id}`, kind: 'room_yes', label: `Approved ${inv.gameId} room for ${name} (${inv.parentApproval})`, at: inv.approvedAt })
    }
  }
  for (const log of state.auditLogs) {
    if (log.householdId === hh.id && log.actorKind === 'parent' && log.action === 'delete_household') {
      out.push({ id: `rcpt_del_${log.id}`, kind: 'deletion', label: 'Household deletion recorded', at: log.at })
    }
  }
  return out
}
