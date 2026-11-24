import { can, type PortalActor } from './access'
import { FUN_GAMES } from './parentActions'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import type { PortalState, RoomInvite } from './types'

const FUN_GAME_IDS = new Set<string>(FUN_GAMES.map((g) => g.id))

/** Demo scheduled tutoring blocks — game rooms may NEVER open during scheduled tutoring time. */
export const SCHEDULED_TUTORING_WINDOWS: ReadonlyArray<{ label: string; startsAt: string; endsAt: string }> = [
  { label: 'Tuesday 7th Grade Group Session', startsAt: '2026-11-24T22:00:00Z', endsAt: '2026-11-24T23:00:00Z' },
]

export function overlapsScheduledSession(startsAt: string, endsAt: string): boolean {
  const s = Date.parse(startsAt)
  const e = Date.parse(endsAt)
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return true
  return SCHEDULED_TUTORING_WINDOWS.some((w) => s < Date.parse(w.endsAt) && e > Date.parse(w.startsAt))
}

export type RoomClockStatus = {
  phase: 'before_open' | 'running' | 'ended'
  remainingSec: number
  sixtySecondWarning: boolean
}

export function getRoomClockStatus(invite: RoomInvite, nowMs = Date.now()): RoomClockStatus {
  const endMs = Date.parse(invite.endsAt)
  if (invite.closedAt !== null || (!Number.isNaN(endMs) && nowMs >= endMs)) {
    return { phase: 'ended', remainingSec: 0, sixtySecondWarning: false }
  }
  if (invite.openedAt === null) {
    return { phase: 'before_open', remainingSec: Math.max(0, Math.ceil((endMs - nowMs) / 1000)), sixtySecondWarning: false }
  }
  const remainingSec = Math.max(0, Math.ceil((endMs - nowMs) / 1000))
  return { phase: 'running', remainingSec, sixtySecondWarning: remainingSec <= 60 }
}

export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function createRoomInvite(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  input: { childId: string; gameId: string; startsAt: string; endsAt: string },
  nowIso = new Date().toISOString(),
): { state: PortalState; invite: RoomInvite } {
  const state = adapter.load()
  const child = state.children.find((c) => c.id === input.childId)
  const hh = child ? state.households.find((h) => h.id === child.householdId) : undefined
  if (!child || !hh || child.consentStatus !== 'verified' || hh.consentRecord.status !== 'verified') {
    throw new PortalAccessError('Room invites require a verified household and child profile')
  }
  if (!FUN_GAME_IDS.has(input.gameId)) {
    throw new PortalAccessError('Game rooms are for approved fun games only (never lesson games)')
  }
  if (overlapsScheduledSession(input.startsAt, input.endsAt)) {
    throw new PortalAccessError('Game rooms never open during a scheduled tutoring session')
  }

  const invId = `inv_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const codeNum = (parseInt(invId.slice(-4), 16) % 900) + 100
  const standingYes = child.joinRooms && child.approvedGames.includes(input.gameId)
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  const candidate: RoomInvite = {
    id: invId,
    householdId: hh.id,
    childId: child.id,
    mentorId,
    gameId: input.gameId,
    roomCode: `DEMO-${codeNum}`,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    parentApproval: standingYes ? 'standing_yes' : 'pending',
    approvedAt: standingYes ? nowIso : null,
    openedAt: null,
    closedAt: null,
    activeChildIds: [],
  }
  if (!can(actor, 'manage_room_invite', { type: 'room_invite', record: candidate })) {
    throw new PortalAccessError('Only an assigned mentor may create a game room invite')
  }

  state.roomInvites.unshift(candidate)
  state.inbox.unshift({
    id: `eml_room_${state.inbox.length + 1}`,
    to: hh.parentEmail,
    householdId: hh.id,
    subject: standingYes
      ? `Game room ready for ${child.nickname} (${input.gameId}, standing yes)`
      : `Approve game room for ${child.nickname}? (${input.gameId})`,
    body: standingYes
      ? `Standing yes is on for ${child.nickname}. Open the room link once Mr. Sam opens the room (code ${candidate.roomCode}; ends at ${candidate.endsAt}).`
      : `Mr. Sam invited ${child.nickname} to a ${input.gameId} room (code ${candidate.roomCode}). Tap Yes to allow, then open the room link once Mr. Sam starts it.`,
    kind: 'room_invite',
    status: 'delivered',
    sentAt: nowIso,
    relatedQuestionId: null,
    relatedRoomInviteId: invId,
  })
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'create_room_invite', recordType: 'room_invite', recordId: invId, householdId: hh.id, outcome: 'allow' })
  return { state: adapter.save(state), invite: candidate }
}

export function respondToRoomInvite(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  inviteId: string,
  decision: 'approved' | 'declined',
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const inv = state.roomInvites.find((r) => r.id === inviteId)
  const hh = inv ? state.households.find((h) => h.id === inv.householdId) : undefined
  if (!inv || !hh || !can(actor, 'approve_room_invite', { type: 'room_invite', record: inv }) || hh.consentRecord.status !== 'verified') {
    throw new PortalAccessError('Only the verified household parent may respond to this room invite')
  }
  inv.parentApproval = decision
  inv.approvedAt = decision === 'approved' ? nowIso : null
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'parent', actorId: hh.id, action: decision === 'approved' ? 'approve_room_invite' : 'decline_room_invite', recordType: 'room_invite', recordId: inv.id, householdId: hh.id, outcome: 'allow' })
  return adapter.save(state)
}

export function openRoomByMentor(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  inviteId: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const inv = state.roomInvites.find((r) => r.id === inviteId)
  if (!inv || !can(actor, 'manage_room_invite', { type: 'room_invite', record: inv })) {
    throw new PortalAccessError('Only an assigned mentor may open this room')
  }
  if (inv.closedAt !== null || Date.parse(nowIso) >= Date.parse(inv.endsAt)) {
    throw new PortalAccessError('Cannot open a room that has already ended')
  }
  inv.openedAt = nowIso
  const mentorId = actor.kind === 'mentor' ? actor.mentorId : 'mentor_samuel'
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'mentor', actorId: mentorId, action: 'open_room', recordType: 'room_invite', recordId: inv.id, householdId: inv.householdId, outcome: 'allow' })
  return adapter.save(state)
}

export function joinRoom(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  inviteId: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; invite: RoomInvite } {
  const state = adapter.load()
  const inv = state.roomInvites.find((r) => r.id === inviteId)
  if (!inv || actor.kind !== 'child' || !can(actor, 'view', { type: 'room_invite', record: inv })) {
    throw new PortalAccessError('Join refused: child is not invited or parent has not approved this room')
  }
  const clock = getRoomClockStatus(inv, Date.parse(nowIso))
  if (clock.phase === 'before_open') {
    throw new PortalAccessError('Join refused: room has not been opened by the mentor yet')
  }
  if (clock.phase === 'ended') {
    throw new PortalAccessError('Join refused: room has ended on schedule')
  }
  if (!inv.activeChildIds.includes(actor.childId)) inv.activeChildIds.push(actor.childId)
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'child', actorId: actor.childId, action: 'join_room', recordType: 'room_invite', recordId: inv.id, householdId: inv.householdId, outcome: 'allow' })
  const saved = adapter.save(state)
  return { state: saved, invite: saved.roomInvites.find((r) => r.id === inviteId)! }
}

export function leaveRoom(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  inviteId: string,
  nowIso = new Date().toISOString(),
): { state: PortalState; invite: RoomInvite } {
  const state = adapter.load()
  const inv = state.roomInvites.find((r) => r.id === inviteId)
  if (!inv || actor.kind !== 'child' || !can(actor, 'view', { type: 'room_invite', record: inv })) {
    throw new PortalAccessError('Child is not part of this room')
  }
  inv.activeChildIds = inv.activeChildIds.filter((id) => id !== actor.childId)
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'child', actorId: actor.childId, action: 'leave_room', recordType: 'room_invite', recordId: inv.id, householdId: inv.householdId, outcome: 'allow' })
  const saved = adapter.save(state)
  return { state: saved, invite: saved.roomInvites.find((r) => r.id === inviteId)! }
}

export function closeRoomHardEnd(adapter: PortalStorageAdapter, inviteId: string, nowIso = new Date().toISOString()): PortalState {
  const state = adapter.load()
  const inv = state.roomInvites.find((r) => r.id === inviteId)
  if (!inv) return state
  inv.closedAt = nowIso
  inv.activeChildIds = []
  state.auditLogs.push({ id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'system', actorId: 'room_clock', action: 'room_hard_end', recordType: 'room_invite', recordId: inv.id, householdId: inv.householdId, outcome: 'recorded' })
  return adapter.save(state)
}
