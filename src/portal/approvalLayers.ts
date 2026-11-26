import { buildChildActor, can, resolveLiveActor, type PortalActor } from './access'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import type {
  ApprovalLogEntry,
  ApprovalLogEvent,
  ApprovalToken,
  AskQuestion,
  ChildProfile,
  Household,
  PortalState,
  RegisteredDevice,
  StepUpChallenge,
  StepUpPurpose,
  SuspiciousApprovalFlag,
} from './types'

export const APPROVAL_LINK_TTL_MS = 72 * 3_600_000 // ~72 hours (Layer 1)
export const STEP_UP_CODE_TTL_MS = 10 * 60_000 // 10 minutes (Layer 2)
export const FAST_APPROVAL_THRESHOLD_MS = 30_000 // 30 seconds (Layer 5)
export const EMAIL_CHANGE_HOLD_MS = 48 * 3_600_000 // 48 hours (Layer 7)

function randomToken(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
}

function randomSixDigitCode(): string {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return String(100_000 + ((buf[0] ?? 0) % 900_000))
}

function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? Date.now() : ms
}

/** Layer 6: Human-readable stamp required before Mr. Sam can open any teen question. */
export function formatApprovalStampLabel(iso: string): string {
  const d = new Date(parseIsoMs(iso))
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `Approved by parent, ${yyyy}-${mm}-${dd} ${hh}:${min} UTC`
}

/** Layer 8: Appends an immutable entry to the append-only approval log. */
export function appendApprovalLogInState(
  state: PortalState,
  entry: {
    at: string
    householdId: string
    questionId?: string | null
    actorKind: 'parent' | 'child' | 'mentor' | 'system'
    actorLabel: string
    event: ApprovalLogEvent
    detail: string
    outcome: 'allow' | 'deny' | 'recorded'
  },
): ApprovalLogEntry {
  const sequence = state.approvalLogs.length + 1
  const created: ApprovalLogEntry = {
    id: `aprlog_${sequence}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`,
    sequence,
    at: entry.at,
    householdId: entry.householdId,
    questionId: entry.questionId ?? null,
    actorKind: entry.actorKind,
    actorLabel: entry.actorLabel,
    event: entry.event,
    detail: entry.detail,
    outcome: entry.outcome,
  }
  state.approvalLogs.push(created)
  return created
}

/** Layer 1: Issues a single-use, ~72-hour approval token tied to one question. */
export function issueApprovalTokenInState(
  state: PortalState,
  householdId: string,
  questionId: string,
  nowIso: string,
): ApprovalToken {
  const expiresAt = new Date(parseIsoMs(nowIso) + APPROVAL_LINK_TTL_MS).toISOString()
  const token: ApprovalToken = {
    tokenId: randomToken('aprtok'),
    questionId,
    householdId,
    issuedAt: nowIso,
    expiresAt,
    usedAt: null,
    revokedAt: null,
  }
  state.approvalTokens.push(token)
  return token
}

/** Layer 3: True if the device is currently registered as a teen device (PIN or remembered Chromebook). */
export function isRegisteredTeenDevice(
  state: PortalState,
  householdId: string,
  deviceId: string | null | undefined,
): RegisteredDevice | null {
  if (!deviceId) return null
  return (
    state.devices.find(
      (d) => d.id === deviceId && d.householdId === householdId && d.deviceKind === 'teen_device' && d.revokedAt === null,
    ) ?? null
  )
}

/** Layer 2 + Acceptance Row #5: Sends a fresh 6-digit one-time code to the verified parent email. */
export function requestParentStepUpCode(
  adapter: PortalStorageAdapter,
  householdId: string,
  purpose: StepUpPurpose,
  targetId: string | null = null,
  nowIso = new Date().toISOString(),
): { state: PortalState; challenge: StepUpChallenge } {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh) throw new PortalAccessError('Household not found')

  const code = randomSixDigitCode()
  const expiresAt = new Date(parseIsoMs(nowIso) + STEP_UP_CODE_TTL_MS).toISOString()
  const challenge: StepUpChallenge = {
    id: randomToken('otp'),
    householdId: hh.id,
    purpose,
    targetId,
    code,
    sentToEmail: hh.parentEmail,
    issuedAt: nowIso,
    expiresAt,
    usedAt: null,
  }
  state.stepUpChallenges.unshift(challenge)
  state.inbox.unshift({
    id: `eml_otp_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: `One-time verification code: ${code} (${purpose.replace(/_/g, ' ')})`,
    body: `Fresh parent verification code for ${hh.parentName}: ${code}. Purpose: ${purpose}. Expires at ${expiresAt}. Do not share this code with your teen.`,
    kind: 'step_up_code',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: purpose === 'approve_question' ? targetId : null,
    stepUpCode: code,
  })
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    questionId: purpose === 'approve_question' ? targetId : null,
    actorKind: 'system',
    actorLabel: 'step_up_auth',
    event: 'step_up_code_issued',
    detail: `Sent fresh 6-digit code to verified parent email ${hh.parentEmail} for ${purpose}.`,
    outcome: 'recorded',
  })
  return { state: adapter.save(state), challenge }
}

/** Validates and consumes a fresh single-use 6-digit parent step-up code in state. */
export function verifyAndConsumeStepUpCodeInState(
  state: PortalState,
  householdId: string,
  purpose: StepUpPurpose,
  targetId: string | null,
  rawCode: string,
  nowIso: string,
): { ok: true; challenge: StepUpChallenge } | { ok: false; reason: string } {
  const code = rawCode.trim()
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, reason: 'A fresh 6-digit one-time code sent to the parent email is required.' }
  }
  const nowMs = parseIsoMs(nowIso)
  const challenge = state.stepUpChallenges.find(
    (c) =>
      c.householdId === householdId &&
      c.purpose === purpose &&
      (targetId === null ? c.targetId === null : c.targetId === targetId) &&
      c.code === code,
  )
  if (!challenge) {
    return { ok: false, reason: 'Invalid one-time code for this action.' }
  }
  if (challenge.usedAt !== null) {
    return { ok: false, reason: 'This one-time code has already been used. Request a fresh code.' }
  }
  if (nowMs > parseIsoMs(challenge.expiresAt)) {
    return { ok: false, reason: 'This one-time code has expired. Request a fresh code.' }
  }
  challenge.usedAt = nowIso
  return { ok: true, challenge }
}

function assignedMentorId(state: PortalState, householdId: string): string {
  return state.assignments.find((a) => a.householdId === householdId && a.revokedAt === null)?.mentorId ?? 'mentor_samuel'
}

function computeSuspiciousFlags(
  question: AskQuestion,
  nowIso: string,
  deviceId: string | null,
  networkTag: string | null,
): { flags: SuspiciousApprovalFlag[]; delaySeconds: number } {
  const delayMs = Math.max(0, parseIsoMs(nowIso) - parseIsoMs(question.createdAt))
  const delaySeconds = Math.floor(delayMs / 1000)
  const flags: SuspiciousApprovalFlag[] = []
  if (delayMs <= FAST_APPROVAL_THRESHOLD_MS) flags.push('approved_within_seconds')
  if (deviceId && question.submittedFromDeviceId && deviceId === question.submittedFromDeviceId) {
    flags.push('same_device_as_writer')
  }
  if (networkTag && question.submittedFromNetworkTag && networkTag === question.submittedFromNetworkTag) {
    flags.push('same_network_as_writer')
  }
  return { flags, delaySeconds }
}

function completeQuestionApprovalInState(
  state: PortalState,
  hh: Household,
  child: ChildProfile,
  q: AskQuestion,
  options: {
    method: 'button_step_up' | 'verified_email_forward'
    deviceId: string | null
    networkTag: string | null
    nowIso: string
  },
): void {
  const { method, deviceId, networkTag, nowIso } = options
  const dev = deviceId ? state.devices.find((d) => d.id === deviceId) : undefined
  const effectiveNetwork = networkTag ?? dev?.networkTag ?? null
  const { flags, delaySeconds } = computeSuspiciousFlags(q, nowIso, deviceId, effectiveNetwork)

  // Layer 6: Stamp required for Mr. Sam to open.
  const stampLabel = formatApprovalStampLabel(nowIso)
  q.parentApprovalStamp = {
    label: stampLabel,
    approvedByEmail: hh.parentEmail,
    approvedAt: nowIso,
    method,
    deviceId,
    networkTag: effectiveNetwork,
  }
  q.status = 'queued_for_mentor'
  q.forwardedToMentorAt = nowIso
  q.suspiciousFlags = flags
  q.approvalDelaySeconds = delaySeconds
  q.pulledBackAt = null

  // Queue placeholder mentor draft now that parent approved.
  const mentorId = assignedMentorId(state, hh.id)
  state.feedback.push({
    id: `fb_fwd_${state.feedback.length + 1}`,
    householdId: hh.id,
    childId: child.id,
    workRecordId: q.workRecordId,
    authorMentorId: mentorId,
    status: 'draft',
    draftText: `[Placeholder draft] Parent-approved question from ${child.nickname}.`,
    sentText: null,
    parentNotifiedAt: null,
    shownToChildAt: null,
    shownBy: null,
  })

  // Layer 4: Send "Was this you?" email with one-tap pull-back & approval lock.
  const pullBackTokenId = randomToken('pbtok')
  state.pullBackTokens.push({
    tokenId: pullBackTokenId,
    questionId: q.id,
    householdId: hh.id,
    issuedAt: nowIso,
    usedAt: null,
  })
  const flagNote = flags.length > 0 ? ` [Heads-up flags: ${flags.join(', ')}]` : ''
  state.inbox.unshift({
    id: `eml_wty_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: `Was this you? Approved ${child.nickname}'s question for Mr. Sam`,
    body: `${stampLabel} via ${method === 'button_step_up' ? 'approve link + one-time code' : 'verified parent email forward'}${dev ? ` on ${dev.label}` : ''}.${flagNote} If this was NOT you, tap "Pull back & lock approvals" immediately.`,
    kind: 'approval_receipt_check',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: q.id,
    pullBackTokenId,
  })

  // Layer 8: Append-only approval log + admin audit log.
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    questionId: q.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: method === 'button_step_up' ? 'question_approved_button' : 'question_approved_email_forward',
    detail: `${stampLabel} (${method}, delay ${delaySeconds}s${flags.length ? `, flags: ${flags.join(', ')}` : ''}).`,
    outcome: 'allow',
  })
  state.auditLogs.push({
    id: `aud_${state.auditLogs.length + 1}`,
    at: nowIso,
    actorKind: 'parent',
    actorId: hh.id,
    action: 'forward_question',
    recordType: 'ask_question',
    recordId: q.id,
    householdId: hh.id,
    outcome: 'allow',
  })
}

/**
 * Approves a waiting teen question via the single-use ~72 h approve link + fresh parent one-time code.
 * Enforces Layers 1, 2, 3, 4, 5, 6, and 8.
 */
export function approveQuestionWithLinkAndCode(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  input: {
    questionId: string
    tokenId: string
    stepUpCode: string
    deviceId?: string | null
    networkTag?: string | null
  },
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const q = state.askQuestions.find((x) => x.id === input.questionId)
  const hh = q ? state.households.find((h) => h.id === q.householdId) : undefined
  const child = q ? state.children.find((c) => c.id === q.childId) : undefined

  if (!q || !hh || !child) {
    throw new PortalAccessError('Question or household not found')
  }
  if (!can(actor, 'forward_question', { type: 'ask_question', record: q }) || hh.consentRecord.status !== 'verified') {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: actor.kind === 'child' ? 'child' : actor.kind === 'mentor' ? 'mentor' : 'parent',
      actorLabel: actor.kind === 'parent' ? `${actor.parentEmail} (${actor.sessionScope ?? 'full_parent'})` : actor.kind,
      event: 'parent_power_denied_without_step_up',
      detail: 'Blocked question approval from unauthorized or chooser-only session.',
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError('Only the verified household parent may approve a waiting question')
  }

  // Layer 4 lock check
  if (hh.approvalsLockedAt !== null) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'approval_denied_locked',
      detail: 'Blocked approval while household approvals are locked after a "Was this you?" pull-back.',
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError('Approvals are locked after a "Was this you?" pull-back. Parent must sign in again and unlock with a fresh code.')
  }

  // Layer 3: No approving from a device registered as the teen's (PIN or remembered device).
  const teenDevice = isRegisteredTeenDevice(state, hh.id, input.deviceId)
  if (teenDevice) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'approval_denied_teen_device',
      detail: `Blocked approval attempted from teen-registered device "${teenDevice.label}" (${teenDevice.id}).`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(`Approvals cannot be completed from teen-registered device (${teenDevice.label}).`)
  }

  // Layer 1: Single-use, tied to one question, expires ~72 h.
  const token = state.approvalTokens.find((t) => t.tokenId === input.tokenId)
  const nowMs = parseIsoMs(nowIso)
  if (
    !token ||
    token.householdId !== hh.id ||
    token.questionId !== q.id ||
    token.usedAt !== null ||
    token.revokedAt !== null ||
    nowMs > parseIsoMs(token.expiresAt)
  ) {
    const reason = !token
      ? 'Invalid approval link.'
      : token.questionId !== q.id
        ? 'Approval link is tied to a different question.'
        : token.usedAt !== null
          ? 'Approval link is single-use and has already been used.'
          : token.revokedAt !== null
            ? 'Approval link was revoked.'
            : 'Approval link has expired (72-hour limit).'
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'approval_denied_expired_or_used_link',
      detail: reason,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(reason)
  }

  // Layer 2: Fresh one-time code sent to parent's verified email.
  const stepUp = verifyAndConsumeStepUpCodeInState(state, hh.id, 'approve_question', q.id, input.stepUpCode, nowIso)
  if (!stepUp.ok) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'approval_denied_invalid_step_up',
      detail: stepUp.reason,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(stepUp.reason)
  }

  token.usedAt = nowIso
  completeQuestionApprovalInState(state, hh, child, q, {
    method: 'button_step_up',
    deviceId: input.deviceId ?? null,
    networkTag: input.networkTag ?? null,
    nowIso,
  })
  return adapter.save(state)
}

/**
 * Acceptance Row #6: Releases a waiting question via email forward ONLY if sent FROM
 * the verified parent email address. Forwarding from a teen's address (or any other address) is denied.
 */
export function approveQuestionByEmailForward(
  adapter: PortalStorageAdapter,
  input: {
    questionId: string
    fromEmail: string
    deviceId?: string | null
    networkTag?: string | null
  },
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const q = state.askQuestions.find((x) => x.id === input.questionId)
  const hh = q ? state.households.find((h) => h.id === q.householdId) : undefined
  const child = q ? state.children.find((c) => c.id === q.childId) : undefined
  if (!q || !hh || !child) throw new PortalAccessError('Question not found')

  const sender = input.fromEmail.trim().toLowerCase()
  if (sender !== hh.parentEmail.toLowerCase()) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'child',
      actorLabel: sender || 'unknown',
      event: 'approval_denied_unverified_forwarder',
      detail: `Rejected email forward from "${sender || 'unknown'}" — only verified parent address ${hh.parentEmail} can approve.`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError('Forward did not come from the verified parent email address and does not count as approval.')
  }

  if (hh.consentRecord.status !== 'verified' || q.status !== 'waiting_parent_review') {
    throw new PortalAccessError('Question is not waiting for verified parent approval')
  }

  if (hh.approvalsLockedAt !== null) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'parent',
      actorLabel: sender,
      event: 'approval_denied_locked',
      detail: 'Blocked email-forward approval while household approvals are locked.',
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError('Approvals are locked after a "Was this you?" pull-back. Parent must unlock first.')
  }

  const teenDevice = isRegisteredTeenDevice(state, hh.id, input.deviceId)
  if (teenDevice) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      questionId: q.id,
      actorKind: 'parent',
      actorLabel: sender,
      event: 'approval_denied_teen_device',
      detail: `Blocked forward approval from teen-registered device "${teenDevice.label}".`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(`Approvals cannot be completed from teen-registered device (${teenDevice.label}).`)
  }

  // Mark any single-use token for this question as consumed so it cannot be replayed later.
  for (const tok of state.approvalTokens) {
    if (tok.questionId === q.id && tok.usedAt === null) tok.usedAt = nowIso
  }

  completeQuestionApprovalInState(state, hh, child, q, {
    method: 'verified_email_forward',
    deviceId: input.deviceId ?? null,
    networkTag: input.networkTag ?? null,
    nowIso,
  })
  return adapter.save(state)
}

/** Layer 4: One tap in the "Was this you?" email pulls the question back from Mr. Sam and locks approvals. */
export function pullBackApprovalAndLock(
  adapter: PortalStorageAdapter,
  householdId: string,
  questionId: string,
  pullBackTokenId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  const q = state.askQuestions.find((x) => x.id === questionId && x.householdId === householdId)
  const tok = state.pullBackTokens.find(
    (t) => t.tokenId === pullBackTokenId && t.householdId === householdId && t.questionId === questionId && t.usedAt === null,
  )
  if (!hh || !q || !tok) {
    throw new PortalAccessError('Invalid or already-used pull-back link')
  }

  tok.usedAt = nowIso
  q.status = 'pulled_back'
  q.pulledBackAt = nowIso
  q.parentApprovalStamp = null
  q.forwardedToMentorAt = null

  // Revoke any outstanding single-use approval links for this household.
  for (const t of state.approvalTokens) {
    if (t.householdId === hh.id && t.usedAt === null && t.revokedAt === null) {
      t.revokedAt = nowIso
    }
  }

  hh.approvalsLockedAt = nowIso
  hh.approvalsLockedReason = 'Pulled back via "Was this you?" email — parent sign-in + fresh one-time code required to unlock.'

  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    questionId: q.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: 'approval_pulled_back_and_locked',
    detail: 'Parent tapped "Was this you?" pull-back: removed question from Mr. Sam queue and locked approvals.',
    outcome: 'allow',
  })
  state.auditLogs.push({
    id: `aud_${state.auditLogs.length + 1}`,
    at: nowIso,
    actorKind: 'parent',
    actorId: hh.id,
    action: 'pull_back_approval',
    recordType: 'ask_question',
    recordId: q.id,
    householdId: hh.id,
    outcome: 'allow',
  })
  return adapter.save(state)
}

/** Layer 4 recovery: Unlocks approvals only after parent signs in again and enters a fresh one-time code. */
export function unlockParentApprovals(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  stepUpCode: string,
  deviceId: string | null = null,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(actor, 'edit_household', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the verified parent may unlock approvals')
  }
  const teenDevice = isRegisteredTeenDevice(state, hh.id, deviceId)
  if (teenDevice) {
    throw new PortalAccessError(`Cannot unlock approvals from teen-registered device (${teenDevice.label}).`)
  }
  const stepUp = verifyAndConsumeStepUpCodeInState(state, hh.id, 'unlock_approvals', null, stepUpCode, nowIso)
  if (!stepUp.ok) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'approval_denied_invalid_step_up',
      detail: `Unlock denied: ${stepUp.reason}`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(stepUp.reason)
  }

  hh.approvalsLockedAt = null
  hh.approvalsLockedReason = null
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: 'approvals_unlocked',
    detail: 'Parent re-signed in and unlocked approvals with a fresh one-time code.',
    outcome: 'allow',
  })
  return adapter.save(state)
}

/** Layer 6: Guarded mentor open check — refuses to open any teen question without a valid "Approved by parent" stamp. */
export function openMentorQuestion(
  state: PortalState,
  actor: PortalActor,
  questionId: string,
): { question: AskQuestion; stampLabel: string } {
  const liveActor = resolveLiveActor(state, actor)
  const q = state.askQuestions.find((x) => x.id === questionId)
  if (!q) throw new PortalAccessError('Question not found')
  if (q.pulledBackAt !== null || q.status === 'pulled_back') {
    throw new PortalAccessError('Question was pulled back by the parent and cannot be opened.')
  }
  if (!q.adultDirectBypass && q.parentApprovalStamp === null) {
    throw new PortalAccessError('Cannot open question: missing "Approved by parent, date and time" stamp.')
  }
  if (!can(liveActor, 'view', { type: 'ask_question', record: q })) {
    throw new PortalAccessError('Mentor is not authorized to open this question.')
  }
  return {
    question: q,
    stampLabel: q.adultDirectBypass ? 'Adult learner (18+) — direct question' : q.parentApprovalStamp!.label,
  }
}

/** Layer 7 (Step 1): Requests a parent email change (requires fresh step-up code sent to old address). */
export function requestParentEmailChange(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  newEmailInput: string,
  stepUpCode: string,
  deviceId: string | null = null,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(actor, 'change_parent_email', { type: 'household', record: hh })) {
    if (hh) {
      appendApprovalLogInState(state, {
        at: nowIso,
        householdId: hh.id,
        actorKind: actor.kind === 'child' ? 'child' : 'parent',
        actorLabel: actor.kind === 'parent' ? `${actor.parentEmail} (${actor.sessionScope ?? 'full_parent'})` : actor.kind,
        event: 'parent_power_denied_without_step_up',
        detail: 'Blocked parent email change from unauthorized or forwarded sign-in session.',
        outcome: 'deny',
      })
      adapter.save(state)
    }
    throw new PortalAccessError('Only the verified parent may request an email change')
  }
  const teenDevice = isRegisteredTeenDevice(state, hh.id, deviceId)
  if (teenDevice) {
    throw new PortalAccessError(`Cannot change parent email from teen-registered device (${teenDevice.label}).`)
  }
  const stepUp = verifyAndConsumeStepUpCodeInState(state, hh.id, 'change_parent_email', null, stepUpCode, nowIso)
  if (!stepUp.ok) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'parent_power_denied_without_step_up',
      detail: `Parent email change blocked: ${stepUp.reason}`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(stepUp.reason)
  }

  const newEmail = newEmailInput.trim().toLowerCase()
  if (!newEmail.includes('@') || newEmail === hh.parentEmail.toLowerCase()) {
    throw new PortalAccessError('Enter a valid new email address different from the current parent email')
  }

  const confirmTokenId = randomToken('emchg')
  hh.pendingEmailChange = {
    id: randomToken('pchg'),
    oldEmail: hh.parentEmail,
    newEmail,
    confirmTokenId,
    requestedAt: nowIso,
    oldAddressConfirmedAt: null,
    effectiveAt: null,
    completedAt: null,
    cancelledAt: null,
  }
  state.inbox.unshift({
    id: `eml_echg_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: `Confirm parent email change to ${newEmail} (48-hour hold required)`,
    body: `A request was made to change your parent email from ${hh.parentEmail} to ${newEmail}. Confirm from this current email address to start the mandatory 48-hour safety hold. If this was not you, cancel immediately.`,
    kind: 'email_change_confirm',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: null,
    emailChangeConfirmTokenId: confirmTokenId,
  })
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: 'parent_email_change_requested',
    detail: `Requested email change from ${hh.parentEmail} to ${newEmail}. Waiting for old-address confirmation + 48 h hold.`,
    outcome: 'allow',
  })
  return adapter.save(state)
}

/** Layer 7 (Step 2): Old parent address confirms the change, starting the mandatory 48-hour hold. */
export function confirmOldEmailForChange(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  confirmTokenId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(actor, 'change_parent_email', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the verified parent may confirm an email change')
  }
  const pending = hh.pendingEmailChange
  if (!pending || pending.cancelledAt !== null || pending.completedAt !== null || pending.confirmTokenId !== confirmTokenId) {
    throw new PortalAccessError('Invalid or inactive email-change confirmation token')
  }
  if (pending.oldAddressConfirmedAt !== null) {
    throw new PortalAccessError('Old address already confirmed; waiting for 48-hour hold to finish')
  }

  const effectiveAt = new Date(parseIsoMs(nowIso) + EMAIL_CHANGE_HOLD_MS).toISOString()
  pending.oldAddressConfirmedAt = nowIso
  pending.effectiveAt = effectiveAt

  state.inbox.unshift({
    id: `eml_ehold_${state.inbox.length + 1}`,
    to: pending.oldEmail,
    householdId: hh.id,
    subject: `48-hour hold started: parent email change to ${pending.newEmail}`,
    body: `Confirmed from ${pending.oldEmail}. Your parent email will NOT change until ${effectiveAt} (48 hours). You can cancel at any time before then.`,
    kind: 'email_change_hold',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: null,
  })
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'parent',
    actorLabel: pending.oldEmail,
    event: 'parent_email_change_old_confirmed',
    detail: `Old address ${pending.oldEmail} confirmed change to ${pending.newEmail}; 48 h hold until ${effectiveAt}.`,
    outcome: 'allow',
  })
  return adapter.save(state)
}

/** Layer 7 (Step 3): Finalizes the parent email change ONLY after old-address yes + 48 hours have elapsed. */
export function finalizeParentEmailChange(
  adapter: PortalStorageAdapter,
  householdId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  const pending = hh?.pendingEmailChange
  if (!hh || !pending || pending.cancelledAt !== null || pending.completedAt !== null) {
    throw new PortalAccessError('No active parent email change pending')
  }
  if (pending.oldAddressConfirmedAt === null || pending.effectiveAt === null) {
    throw new PortalAccessError('Old parent email address must confirm before the 48-hour hold can begin')
  }
  if (parseIsoMs(nowIso) < parseIsoMs(pending.effectiveAt)) {
    throw new PortalAccessError(`48-hour safety hold still active until ${pending.effectiveAt}`)
  }

  hh.parentEmail = pending.newEmail
  pending.completedAt = nowIso
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'system',
    actorLabel: 'email_change_hold',
    event: 'parent_email_change_completed',
    detail: `48 h hold finished: parent email updated from ${pending.oldEmail} to ${pending.newEmail}.`,
    outcome: 'allow',
  })
  return adapter.save(state)
}

export function cancelParentEmailChange(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(actor, 'change_parent_email', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the verified parent may cancel an email change')
  }
  if (!hh.pendingEmailChange || hh.pendingEmailChange.completedAt !== null) {
    throw new PortalAccessError('No pending email change to cancel')
  }
  hh.pendingEmailChange.cancelledAt = nowIso
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: 'parent_email_change_cancelled',
    detail: `Cancelled pending email change to ${hh.pendingEmailChange.newEmail}.`,
    outcome: 'allow',
  })
  return adapter.save(state)
}

/** Layer 9: Parent signs in once on teen's Chromebook and registers it as a remembered teen PIN device. */
export function rememberTeenDevice(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  input: { childId: string; label: string; networkTag: string; stepUpCode: string },
  nowIso = new Date().toISOString(),
): { state: PortalState; device: RegisteredDevice } {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  const child = state.children.find((c) => c.id === input.childId && c.householdId === householdId)
  if (!hh || !child || !can(actor, 'manage_devices', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the verified parent may remember a teen device')
  }
  const stepUp = verifyAndConsumeStepUpCodeInState(state, hh.id, 'manage_devices', null, input.stepUpCode, nowIso)
  if (!stepUp.ok) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'parent_power_denied_without_step_up',
      detail: `Remember device blocked: ${stepUp.reason}`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(stepUp.reason)
  }

  const device: RegisteredDevice = {
    id: randomToken('dev'),
    householdId: hh.id,
    label: input.label.trim() || `${child.nickname}'s Chromebook`,
    deviceKind: 'teen_device',
    rememberedForChildId: child.id,
    networkTag: input.networkTag.trim() || 'home-wifi',
    registeredAt: nowIso,
    revokedAt: null,
  }
  state.devices.push(device)
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: 'device_remembered',
    detail: `Remembered "${device.label}" for ${child.nickname}'s PIN profile only (parent approvals blocked on this device).`,
    outcome: 'allow',
  })
  return { state: adapter.save(state), device }
}

/** Layer 9: Parent sees and revokes any remembered device immediately. */
export function revokeRegisteredDevice(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  deviceId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  const dev = state.devices.find((d) => d.id === deviceId && d.householdId === householdId)
  if (!hh || !dev || !can(actor, 'manage_devices', { type: 'household', record: hh })) {
    throw new PortalAccessError('Only the verified parent may revoke a household device')
  }
  dev.revokedAt = nowIso
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: hh.id,
    actorKind: 'parent',
    actorLabel: hh.parentEmail,
    event: 'device_revoked',
    detail: `Revoked device "${dev.label}" (${dev.id}).`,
    outcome: 'allow',
  })
  return adapter.save(state)
}

/** Layer 9: Teen auto-signs-in to their OWN profile on their remembered Chromebook using their PIN (zero parent powers). */
export function signInRememberedTeenDevice(
  state: PortalState,
  deviceId: string,
  pinInput: string,
): { actor: PortalActor; child: ChildProfile; device: RegisteredDevice } {
  const device = state.devices.find((d) => d.id === deviceId && d.deviceKind === 'teen_device' && d.revokedAt === null)
  if (!device || !device.rememberedForChildId) {
    throw new PortalAccessError('This device is not remembered or has been revoked by the parent.')
  }
  const child = state.children.find((c) => c.id === device.rememberedForChildId && c.householdId === device.householdId)
  if (!child) throw new PortalAccessError('Child profile not found for this device.')
  if (child.pinHash && `demo-pin-${pinInput.trim()}` !== child.pinHash) {
    throw new PortalAccessError('Incorrect profile PIN.')
  }
  return { actor: buildChildActor(state, child.id), child, device }
}

/**
 * Acceptance Row #5: Opening a forwarded parent sign-in link (`profile_chooser_only`) reaches ONLY
 * the profile chooser and the teen's own profile with PIN — never parent powers.
 */
export function unlockTeenFromForwardedSignIn(
  adapter: PortalStorageAdapter,
  chooserActor: PortalActor,
  childId: string,
  pinInput: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; childActor: PortalActor; child: ChildProfile } {
  const state = adapter.load()
  if (chooserActor.kind !== 'parent') {
    throw new PortalAccessError('Sign-in session required to open a profile')
  }
  const child = state.children.find((c) => c.id === childId && c.householdId === chooserActor.householdId)
  if (!child || !can(chooserActor, 'view', { type: 'child', record: child })) {
    throw new PortalAccessError('Profile not found on this household sign-in')
  }
  if (child.pinHash && `demo-pin-${pinInput.trim()}` !== child.pinHash) {
    throw new PortalAccessError('Incorrect profile PIN.')
  }
  appendApprovalLogInState(state, {
    at: nowIso,
    householdId: chooserActor.householdId,
    actorKind: 'child',
    actorLabel: child.nickname,
    event: 'forwarded_signin_restricted_to_teen',
    detail: `Opened ${child.nickname}'s teen profile via sign-in link + PIN (no parent powers granted).`,
    outcome: 'recorded',
  })
  return { state: adapter.save(state), childActor: buildChildActor(state, child.id), child }
}

/** Acceptance Row #5: Simulated parent billing/purchase action requires a verified parent + fresh step-up code (never reachable via forwarded sign-in link or teen device). */
export function authorizeParentBillingAction(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  householdId: string,
  itemLabel: string,
  stepUpCode: string,
  deviceId: string | null = null,
  nowIso = new Date().toISOString(),
): { state: PortalState; receipt: string } {
  const state = adapter.load()
  const hh = state.households.find((h) => h.id === householdId)
  if (!hh || !can(actor, 'billing_action', { type: 'household', record: hh })) {
    if (hh) {
      appendApprovalLogInState(state, {
        at: nowIso,
        householdId: hh.id,
        actorKind: actor.kind === 'child' ? 'child' : 'parent',
        actorLabel: actor.kind === 'parent' ? `${actor.parentEmail} (${actor.sessionScope ?? 'full_parent'})` : actor.kind,
        event: 'parent_power_denied_without_step_up',
        detail: `Blocked billing action ("${itemLabel}") from non-parent or forwarded sign-in session.`,
        outcome: 'deny',
      })
      adapter.save(state)
    }
    throw new PortalAccessError('Purchases require a verified parent session and a fresh one-time code sent to the parent email.')
  }
  const teenDevice = isRegisteredTeenDevice(state, hh.id, deviceId)
  if (teenDevice) {
    throw new PortalAccessError(`Purchases are blocked from teen-registered device (${teenDevice.label}).`)
  }
  const stepUp = verifyAndConsumeStepUpCodeInState(state, hh.id, 'billing_action', null, stepUpCode, nowIso)
  if (!stepUp.ok) {
    appendApprovalLogInState(state, {
      at: nowIso,
      householdId: hh.id,
      actorKind: 'parent',
      actorLabel: hh.parentEmail,
      event: 'parent_power_denied_without_step_up',
      detail: `Billing action blocked: ${stepUp.reason}`,
      outcome: 'deny',
    })
    adapter.save(state)
    throw new PortalAccessError(stepUp.reason)
  }
  state.auditLogs.push({
    id: `aud_${state.auditLogs.length + 1}`,
    at: nowIso,
    actorKind: 'parent',
    actorId: hh.id,
    action: 'billing_action',
    recordType: 'household',
    recordId: hh.id,
    householdId: hh.id,
    outcome: 'allow',
  })
  return { state: adapter.save(state), receipt: `Simulated checkout authorized for ${itemLabel} (verified by parent step-up code).` }
}

/** Layer 8: Lists append-only approval logs visible to the actor (own household parent OR Mr. Sam admin). */
export function listVisibleApprovalLogs(state: PortalState, actor: PortalActor): ApprovalLogEntry[] {
  const liveActor = resolveLiveActor(state, actor)
  return state.approvalLogs.filter((record) => can(liveActor, 'view', { type: 'approval_log', record }))
}
