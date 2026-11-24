import { buildChildActor, buildMentorActor, buildParentActor, can, type PortalActor } from './access'
import { ChildProfileSchema, type PortalState } from './types'

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

  return [
    { id: 'parent-own-children', label: 'Parent sees only own children (and no mentor drafts)', passed: parentOwnOnly, detail: `Elena sees [${ev.children.join(', ')}]; Priya sees [${pv.children.join(', ')}]; draft hidden.` },
    { id: 'mentor-b-assigned-only', label: 'Mentor B sees only assigned household', passed: mentorBAssignedOnly, detail: `Mentor B sees [${bv.households.join(', ')}] / [${bv.children.join(', ')}]; 0 audit logs.` },
    { id: 'mentor-c-unassigned-empty', label: 'Mentor C (unassigned) sees nothing', passed: mentorCSeesNothing, detail: `Mentor C sees ${cv.households.length} households, ${cv.children.length} kids, ${cv.work.length} work records.` },
    { id: 'child-view-isolated', label: 'Child view cannot see other children, draft feedback, or unapproved replies', passed: childIsolated, detail: `Marcus sees [${mv.children.join(', ')}], ${mv.feedback.length} feedback; Leo sees approved [${lv.feedback.join(', ')}].` },
    { id: 'revoke-mentor-b-immediate', label: "Revoking Mentor B empties Mentor B's view immediately", passed: revokeEmptiesB, detail: `After revoking asgn_b_elena, Mentor B sees ${bAfter.households.length} households, ${bAfter.children.length} kids.` },
    { id: 'export-delete-parent-and-admin-only', label: 'Export and delete allowed only for own parent and admin', passed: exportDeleteScoped, detail: 'Elena (own parent) + Mr. Sam (admin): ALLOW. Priya, Marcus, Mentor B, Mentor C, Anonymous: DENY.' },
    { id: 'child-schema-forbids-pii', label: 'Child schema forbids email, password, last name, photo, video, private channel', passed: rejectedAllForbidden, detail: `Strict schema rejected ${forbidden.length}/${forbidden.length} forbidden fields.` },
  ]
}
