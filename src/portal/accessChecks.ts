import {
  buildChildActor,
  buildForwardedSignInActor,
  buildMentorActor,
  buildParentActor,
  can,
  type PortalActor,
} from './access'
import { ChildProfileSchema, type AskQuestion, type PortalState } from './types'

export type AccessCheckResult = { id: string; label: string; passed: boolean; detail: string }

function visible(state: PortalState, actor: PortalActor) {
  return {
    households: state.households.filter((record) => can(actor, 'view', { type: 'household', record })).map((h) => h.id),
    children: state.children.filter((record) => can(actor, 'view', { type: 'child', record })).map((c) => c.id),
    work: state.workRecords.filter((record) => can(actor, 'view', { type: 'work', record })).map((w) => w.id),
    feedback: state.feedback.filter((record) => can(actor, 'view', { type: 'feedback', record })).map((f) => f.id),
    updates: state.parentUpdates.filter((record) => can(actor, 'view', { type: 'parent_update', record })).map((u) => u.id),
    auditLogs: state.auditLogs.filter((record) => can(actor, 'view', { type: 'audit_log', record })).map((a) => a.id),
  }
}

export function runAccessChecks(seed: PortalState): AccessCheckResult[] {
  const state = structuredClone(seed)
  const elena = buildParentActor(state, 'hh_elena')
  const elenaForwardedLink = buildForwardedSignInActor(state, 'hh_elena')
  const priya = buildParentActor(state, 'hh_priya')
  const marcus = buildChildActor(state, 'child_marcus')
  const leo = buildChildActor(state, 'child_leo')
  const samuel = buildMentorActor(state, 'mentor_samuel')
  const mentorB = buildMentorActor(state, 'mentor_b')
  const mentorC = buildMentorActor(state, 'mentor_c')
  const anon: PortalActor = { kind: 'anonymous' }

  const ev = visible(state, elena)
  const pv = visible(state, priya)
  const parentOwnOnly =
    ev.households.join(',') === 'hh_elena' &&
    ev.children.join(',') === 'child_marcus,child_sofia' &&
    !ev.feedback.includes('fb_marcus_draft') &&
    ev.feedback.includes('fb_marcus_waiting') &&
    pv.children.join(',') === 'child_leo,child_nina'

  const bv = visible(state, mentorB)
  const mentorBAssignedOnly =
    bv.households.join(',') === 'hh_elena' &&
    bv.children.join(',') === 'child_marcus,child_sofia' &&
    !bv.work.includes('work_leo_u2') &&
    bv.auditLogs.length === 0

  const cv = visible(state, mentorC)
  const mentorCSeesNothing =
    cv.households.length + cv.children.length + cv.work.length + cv.feedback.length + cv.updates.length + cv.auditLogs.length === 0

  const mv = visible(state, marcus)
  const lv = visible(state, leo)
  const childIsolated =
    mv.children.join(',') === 'child_marcus' &&
    mv.households.length === 0 &&
    mv.feedback.length === 0 &&
    mv.updates.length === 0 &&
    lv.children.join(',') === 'child_leo' &&
    lv.feedback.join(',') === 'fb_leo_shown'

  const revoked = structuredClone(state)
  const asgnB = revoked.assignments.find((a) => a.id === 'asgn_b_elena')
  const samCanRevoke = asgnB !== undefined && can(samuel, 'revoke_mentor', { type: 'assignment', record: asgnB })
  if (asgnB && samCanRevoke) {
    asgnB.revokedAt = '2026-11-24T12:00:00Z'
    asgnB.revokedByMentorId = 'mentor_samuel'
  }
  const bAfter = visible(revoked, buildMentorActor(revoked, 'mentor_b'))
  const revokeEmptiesB =
    samCanRevoke && bAfter.households.length + bAfter.children.length + bAfter.work.length + bAfter.feedback.length === 0

  const targetHh = { type: 'household' as const, record: state.households.find((h) => h.id === 'hh_elena')! }
  const exportDeleteScoped =
    [elena, samuel].every((a) => can(a, 'export_household', targetHh) && can(a, 'delete_household', targetHh)) &&
    [priya, marcus, mentorB, mentorC, anon].every((a) => !can(a, 'export_household', targetHh) && !can(a, 'delete_household', targetHh))

  const forbidden = ['email', 'password', 'lastName', 'photo', 'video', 'privateChannel']
  const rejectedAllForbidden = forbidden.every((f) => !ChildProfileSchema.safeParse({ ...state.children[0]!, [f]: 'x' }).success)

  const pureAdmin: PortalActor = { kind: 'mentor', mentorId: 'admin_only', roles: ['admin'], active: true, assignments: state.assignments }
  const samUnassigned: PortalActor = {
    kind: 'mentor',
    mentorId: 'mentor_samuel',
    roles: ['owner', 'admin', 'mentor'],
    active: true,
    assignments: state.assignments.filter((a) => a.householdId !== 'hh_elena'),
  }
  const marcusChild = { type: 'child' as const, record: state.children[0]! }
  const marcusWork = { type: 'work' as const, record: state.workRecords[0]! }
  const hatSeparation =
    can(pureAdmin, 'export_household', targetHh) &&
    can(pureAdmin, 'view', { type: 'audit_log', record: state.auditLogs[0]! }) &&
    !can(pureAdmin, 'view', marcusWork) &&
    !can(pureAdmin, 'award_belt', marcusChild) &&
    can(samUnassigned, 'export_household', targetHh) &&
    !can(samUnassigned, 'review_work', marcusWork) &&
    !can(samUnassigned, 'award_belt', marcusChild)

  const signInEmail = {
    id: 'eml_check_signin',
    to: 'elena.demo@family.example',
    householdId: 'hh_elena',
    subject: 'Sign in to SAL0MANder',
    body: 'Simulated one-time sign-in link.',
    kind: 'sign_in_link' as const,
    status: 'delivered' as const,
    sentAt: '2026-11-24T17:05:00Z',
    relatedQuestionId: null,
    relatedRoomInviteId: null,
  }
  const mentorNoSignInLink =
    can(elena, 'view', { type: 'email', record: signInEmail }) &&
    !can(mentorB, 'view', { type: 'email', record: signInEmail }) &&
    !can(samuel, 'view', { type: 'email', record: signInEmail }) &&
    can(mentorB, 'view', { type: 'email', record: state.inbox[0]! })

  const baseQ: Omit<AskQuestion, 'status' | 'parentEmailAcceptedAt' | 'forwardedToMentorAt' | 'parentApprovalStamp' | 'pulledBackAt'> = {
    id: 'ask_chk', householdId: 'hh_elena', childId: 'child_marcus', workRecordId: null,
    source: 'ask_form', text: 'Why does subtracting a negative move right?',
    photoPlaceholder: null, askModeAtSend: 'review',
    submittedFromDeviceId: 'dev_marcus_chromebook', submittedFromNetworkTag: 'home-wifi-elena',
    suspiciousFlags: [], approvalDelaySeconds: null, adultDirectBypass: false,
    createdAt: '2026-11-24T17:10:00Z',
  }
  const qWaiting: AskQuestion = { ...baseQ, status: 'waiting_parent_review', parentEmailAcceptedAt: '2026-11-24T17:10:00Z', forwardedToMentorAt: null, parentApprovalStamp: null, pulledBackAt: null }
  const qHeld: AskQuestion = { ...baseQ, status: 'held_undelivered', parentEmailAcceptedAt: null, forwardedToMentorAt: null, parentApprovalStamp: null, pulledBackAt: null }
  const qUnstamped: AskQuestion = { ...baseQ, status: 'queued_for_mentor', parentEmailAcceptedAt: '2026-11-24T17:10:00Z', forwardedToMentorAt: '2026-11-24T17:11:00Z', parentApprovalStamp: null, pulledBackAt: null }
  const qStamped: AskQuestion = {
    ...baseQ,
    status: 'queued_for_mentor',
    parentEmailAcceptedAt: '2026-11-24T17:10:00Z',
    forwardedToMentorAt: '2026-11-24T17:12:00Z',
    parentApprovalStamp: {
      label: 'Approved by parent, 2026-11-24 17:12 UTC',
      approvedByEmail: 'elena.demo@family.example',
      approvedAt: '2026-11-24T17:12:00Z',
      method: 'button_step_up',
      deviceId: 'dev_elena_phone',
      networkTag: 'cell-elena',
    },
    pulledBackAt: null,
  }
  const qPulledBack: AskQuestion = { ...qStamped, status: 'pulled_back', pulledBackAt: '2026-11-24T17:13:00Z', parentApprovalStamp: null }

  const askGateEnforced =
    can(elena, 'view', { type: 'ask_question', record: qWaiting }) &&
    can(elena, 'forward_question', { type: 'ask_question', record: qWaiting }) &&
    !can(samuel, 'view', { type: 'ask_question', record: qWaiting }) &&
    !can(mentorB, 'view', { type: 'ask_question', record: qWaiting }) &&
    !can(samuel, 'view', { type: 'ask_question', record: qHeld }) &&
    !can(mentorB, 'view', { type: 'ask_question', record: qHeld }) &&
    can(samuel, 'view', { type: 'ask_question', record: qStamped }) &&
    !can(mentorC, 'view', { type: 'ask_question', record: qStamped })

  // Layer 6 + Layer 4: Unstamped or pulled-back teen questions can never open for any mentor.
  const stampAndPullBackRequired =
    !can(samuel, 'view', { type: 'ask_question', record: qUnstamped }) &&
    !can(mentorB, 'view', { type: 'ask_question', record: qUnstamped }) &&
    !can(samuel, 'view', { type: 'ask_question', record: qPulledBack }) &&
    can(samuel, 'view', { type: 'ask_question', record: qStamped })

  // Layer 9 + Acceptance Row #5: Forwarded parent sign-in link reaches ONLY the profile chooser, never parent powers.
  const forwardedLinkRestricted =
    can(elenaForwardedLink, 'view', marcusChild) &&
    !can(elenaForwardedLink, 'forward_question', { type: 'ask_question', record: qWaiting }) &&
    !can(elenaForwardedLink, 'edit_household', targetHh) &&
    !can(elenaForwardedLink, 'edit_child', marcusChild) &&
    !can(elenaForwardedLink, 'change_parent_email', targetHh) &&
    !can(elenaForwardedLink, 'billing_action', targetHh) &&
    !can(elenaForwardedLink, 'manage_devices', targetHh)

  // Layer 8: Append-only approval log visible ONLY to household parent and Mr. Sam (admin).
  const sampleApprovalLog = {
    id: 'aprlog_chk',
    sequence: 1,
    at: '2026-11-24T17:12:00Z',
    householdId: 'hh_elena',
    questionId: 'ask_chk',
    actorKind: 'parent' as const,
    actorLabel: 'elena.demo@family.example',
    event: 'question_approved_button' as const,
    detail: 'Approved by parent, 2026-11-24 17:12 UTC',
    outcome: 'allow' as const,
  }
  const approvalLogScoped =
    can(elena, 'view', { type: 'approval_log', record: sampleApprovalLog }) &&
    can(samuel, 'view', { type: 'approval_log', record: sampleApprovalLog }) &&
    !can(elenaForwardedLink, 'view', { type: 'approval_log', record: sampleApprovalLog }) &&
    !can(priya, 'view', { type: 'approval_log', record: sampleApprovalLog }) &&
    !can(marcus, 'view', { type: 'approval_log', record: sampleApprovalLog }) &&
    !can(mentorB, 'view', { type: 'approval_log', record: sampleApprovalLog }) &&
    !can(mentorC, 'view', { type: 'approval_log', record: sampleApprovalLog })

  const invPending = state.roomInvites.find((r) => r.id === 'inv_marcus_1')!
  const invLeo = state.roomInvites.find((r) => r.id === 'inv_leo_1')!
  const roomInviteScoped =
    !can(marcus, 'view', { type: 'room_invite', record: invPending }) &&
    can(elena, 'approve_room_invite', { type: 'room_invite', record: invPending }) &&
    !can(priya, 'approve_room_invite', { type: 'room_invite', record: invPending }) &&
    can(leo, 'view', { type: 'room_invite', record: invLeo }) &&
    !can(marcus, 'view', { type: 'room_invite', record: invLeo }) &&
    !can(mentorB, 'view', { type: 'room_invite', record: invLeo })

  return [
    { id: 'parent-own-children', label: 'Parent sees only own children (and no mentor drafts)', passed: parentOwnOnly, detail: `Elena sees [${ev.children.join(', ')}]; Priya sees [${pv.children.join(', ')}]; draft hidden.` },
    { id: 'mentor-b-assigned-only', label: 'Mentor B sees only assigned household', passed: mentorBAssignedOnly, detail: `Mentor B sees [${bv.households.join(', ')}] / [${bv.children.join(', ')}]; 0 audit logs.` },
    { id: 'mentor-c-unassigned-empty', label: 'Mentor C (unassigned) sees nothing', passed: mentorCSeesNothing, detail: `Mentor C sees ${cv.households.length} households, ${cv.children.length} kids, ${cv.work.length} work records.` },
    { id: 'child-view-isolated', label: 'Child view cannot see other children, draft feedback, or unapproved replies', passed: childIsolated, detail: `Marcus sees [${mv.children.join(', ')}], ${mv.feedback.length} feedback; Leo sees approved [${lv.feedback.join(', ')}].` },
    { id: 'revoke-mentor-b-immediate', label: "Revoking Mentor B empties Mentor B's view immediately", passed: revokeEmptiesB, detail: `After revoking asgn_b_elena, Mentor B sees ${bAfter.households.length} households, ${bAfter.children.length} kids.` },
    { id: 'export-delete-parent-and-admin-only', label: 'Export and delete allowed only for own parent and admin', passed: exportDeleteScoped, detail: 'Elena (own parent) + Mr. Sam (admin): ALLOW. Priya, Marcus, Mentor B, Mentor C, Anonymous: DENY.' },
    { id: 'child-schema-forbids-pii', label: 'Child schema forbids email, password, last name, photo, video, private channel', passed: rejectedAllForbidden, detail: `Strict schema rejected ${forbidden.length}/${forbidden.length} forbidden fields.` },
    { id: 'admin-hat-no-unassigned-teaching', label: 'Admin hat grants admin actions only; all teaching actions require an active Assignment', passed: hatSeparation, detail: 'Pure admin & unassigned Mr. Sam keep export/audit access but cannot view child work, review, or award belts.' },
    { id: 'mentor-no-signin-link', label: 'Mentor B cannot see a parent sign-in link', passed: mentorNoSignInLink, detail: 'Parent sign-in link: Elena ALLOW; Mentor B & Mr. Sam DENY (mentors see only mentor_reply / friday_note / room_invite).' },
    { id: 'ask-rail-provider-gate', label: 'Held or unforwarded questions never reach Mr. Sam or Mentor B', passed: askGateEnforced, detail: 'Waiting-review & rejected-email questions: Elena ALLOW; Mr. Sam & Mentor B DENY until parent-approved & stamped.' },
    { id: 'room-invite-scoped', label: 'Room invites require own-parent approval and hide uninvited rooms', passed: roomInviteScoped, detail: 'Pending invite hidden from Marcus; Elena ALLOW / Priya DENY approve; Leo room hidden from Marcus & Mentor B.' },
    { id: 'parent-stamp-and-pullback', label: 'Unstamped or pulled-back teen questions cannot open in Mr. Sam queue', passed: stampAndPullBackRequired, detail: 'Missing "Approved by parent" stamp or pulled-back status: Mr. Sam & Mentor B DENY.' },
    { id: 'forwarded-signin-chooser-only', label: 'Forwarded parent sign-in link reaches profile chooser only (never parent powers)', passed: forwardedLinkRestricted, detail: 'Forwarded link sees chooser ALLOW; approve question, settings, billing, email change, devices: DENY.' },
    { id: 'approval-log-parent-and-admin-only', label: 'Append-only approval log visible only to own parent and Mr. Sam (admin)', passed: approvalLogScoped, detail: 'Elena & Mr. Sam ALLOW; forwarded link, Priya, Marcus, Mentor B, Mentor C DENY.' },
  ]
}
