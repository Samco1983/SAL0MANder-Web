import type {
  AskQuestion, Assignment, AuditLog, Badge, ChildProfile, Feedback, Household,
  MentorRole, ParentUpdate, Points, PortalState, RoomInvite, SimulatedEmail, WorkRecord,
} from './types'

/**
 * Single centralized deny-by-default access policy: `can(actor, action, target)`.
 * Phase 1 enforces it in the local adapter and UI; Phase 2 enforces it server-side.
 */
export type PortalAction =
  | 'view' | 'edit_household' | 'create_child' | 'edit_child' | 'save_work' | 'submit_work' | 'start_redo'
  | 'submit_question' | 'forward_question'
  | 'review_work' | 'author_feedback' | 'show_feedback_to_child' | 'send_parent_update'
  | 'award_belt' | 'manage_room_invite' | 'approve_room_invite'
  | 'add_mentor' | 'assign_mentor' | 'revoke_mentor' | 'export_household' | 'delete_household'

export type PortalActor =
  | { kind: 'anonymous' }
  | { kind: 'parent'; householdId: string; parentEmail: string }
  | { kind: 'child'; householdId: string; childId: string }
  | { kind: 'mentor'; mentorId: string; roles: ReadonlyArray<MentorRole>; active: boolean; assignments: ReadonlyArray<Assignment> }

export type AccessTarget =
  | { type: 'household'; record: Household }
  | { type: 'child'; record: ChildProfile }
  | { type: 'work'; record: WorkRecord }
  | { type: 'ask_question'; record: AskQuestion }
  | { type: 'feedback'; record: Feedback }
  | { type: 'parent_update'; record: ParentUpdate }
  | { type: 'room_invite'; record: RoomInvite }
  | { type: 'badge'; record: Badge }
  | { type: 'points'; record: Points }
  | { type: 'assignment'; record: Assignment }
  | { type: 'audit_log'; record: AuditLog }
  | { type: 'email'; record: SimulatedEmail }
  | { type: 'portal_admin'; householdId: null }

const targetHh = (t: AccessTarget): string | null =>
  t.type === 'household' ? t.record.id : t.type === 'portal_admin' ? null : t.record.householdId

function hasActiveAssignment(actor: Extract<PortalActor, { kind: 'mentor' }>, hhId: string | null): boolean {
  return hhId !== null && actor.assignments.some((a) => a.mentorId === actor.mentorId && a.householdId === hhId && a.revokedAt === null)
}

export function can(actor: PortalActor, action: PortalAction, target: AccessTarget): boolean {
  if (actor.kind === 'anonymous') return false
  const hhId = targetHh(target)

  if (actor.kind === 'parent') {
    if (hhId !== actor.householdId) return false
    if (action === 'view') {
      if (target.type === 'audit_log' || target.type === 'assignment') return false
      return target.type === 'feedback' ? target.record.status !== 'draft' : true
    }
    if (
      action === 'edit_household' ||
      action === 'create_child' ||
      action === 'export_household' ||
      action === 'delete_household'
    ) {
      return target.type === 'household'
    }
    if (action === 'edit_child') return target.type === 'child'
    if (action === 'show_feedback_to_child') return target.type === 'feedback' && target.record.status === 'sent_to_parent'
    if (action === 'forward_question') return target.type === 'ask_question' && target.record.status === 'waiting_parent_review'
    if (action === 'approve_room_invite') return target.type === 'room_invite'
    return false
  }

  if (actor.kind === 'child') {
    if (hhId !== actor.householdId) return false
    if (action === 'view') {
      if (target.type === 'child') return target.record.id === actor.childId
      if (target.type === 'work' || target.type === 'ask_question' || target.type === 'badge' || target.type === 'points') {
        return target.record.childId === actor.childId
      }
      if (target.type === 'feedback') return target.record.childId === actor.childId && target.record.status === 'visible_to_child'
      if (target.type === 'room_invite') {
        return target.record.childId === actor.childId && (target.record.parentApproval === 'approved' || target.record.parentApproval === 'standing_yes')
      }
      return false
    }
    if (action === 'submit_question') {
      return target.type === 'child' && target.record.id === actor.childId && target.record.consentStatus === 'verified' && target.record.askMode !== 'off'
    }
    if (action === 'save_work' || action === 'submit_work') {
      return target.type === 'work' && target.record.childId === actor.childId && target.record.status === 'draft'
    }
    if (action === 'start_redo') {
      return target.type === 'work' && target.record.childId === actor.childId && target.record.status !== 'draft'
    }
    return false
  }

  if (!actor.active) return false
  const isAdmin = actor.roles.includes('admin') || actor.roles.includes('owner')
  const isMentor = actor.roles.includes('mentor')
  const assigned = isMentor && hasActiveAssignment(actor, hhId)

  if (action === 'view') {
    if (target.type === 'audit_log' || target.type === 'assignment') return isAdmin
    if (target.type === 'household') return isAdmin || assigned
    if (target.type === 'ask_question') {
      return assigned && target.record.parentEmailAcceptedAt !== null && (target.record.status === 'queued_for_mentor' || target.record.status === 'replied')
    }
    if (target.type === 'email') {
      return assigned && (
        target.record.kind === 'mentor_reply' ||
        target.record.kind === 'friday_note' ||
        target.record.kind === 'room_invite'
      )
    }
    return assigned
  }
  if (action === 'review_work') return target.type === 'work' && assigned
  if (action === 'author_feedback') return target.type === 'feedback' && assigned
  if (action === 'send_parent_update') return target.type === 'parent_update' && assigned
  if (action === 'award_belt') return target.type === 'child' && assigned
  if (action === 'manage_room_invite') return target.type === 'room_invite' && assigned
  if (action === 'add_mentor') return isAdmin && target.type === 'portal_admin'
  if (action === 'assign_mentor' || action === 'revoke_mentor') return isAdmin && (target.type === 'assignment' || target.type === 'household')
  if (action === 'export_household' || action === 'delete_household') return isAdmin && target.type === 'household'
  return false
}

export function buildParentActor(state: PortalState, householdId: string): PortalActor {
  const hh = state.households.find((h) => h.id === householdId)
  return hh ? { kind: 'parent', householdId: hh.id, parentEmail: hh.parentEmail } : { kind: 'anonymous' }
}

export function buildChildActor(state: PortalState, childId: string): PortalActor {
  const child = state.children.find((c) => c.id === childId)
  return child ? { kind: 'child', householdId: child.householdId, childId: child.id } : { kind: 'anonymous' }
}

export function buildMentorActor(state: PortalState, mentorId: string): PortalActor {
  const m = state.mentors.find((x) => x.id === mentorId)
  return m ? { kind: 'mentor', mentorId: m.id, roles: m.roles, active: m.active, assignments: state.assignments } : { kind: 'anonymous' }
}
