import { can, type PortalActor } from './access'
import { createSeedState } from './seed'
import { PortalStateSchema, type Household, type PortalState } from './types'

const STORAGE_KEY = 'sal0mander.portal.demo.v1'

export interface PortalStorageAdapter {
  load(): PortalState
  save(state: PortalState): PortalState
  reset(): PortalState
  listVisibleHouseholds(actor: PortalActor): Household[]
  revokeAssignment(actor: PortalActor, assignmentId: string, nowIso?: string): PortalState
  exportHousehold(actor: PortalActor, householdId: string): Record<string, unknown>
  deleteHousehold(actor: PortalActor, householdId: string, nowIso?: string): PortalState
}

export class PortalAccessError extends Error {
  constructor(message = 'Access denied by portal policy') {
    super(message)
    this.name = 'PortalAccessError'
  }
}

export class LocalPortalStorageAdapter implements PortalStorageAdapter {
  private memory: PortalState | null = null

  load(): PortalState {
    if (this.memory) return structuredClone(this.memory)
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const parsed = PortalStateSchema.safeParse(JSON.parse(raw))
        if (parsed.success) {
          this.memory = parsed.data
          return structuredClone(parsed.data)
        }
      }
    } catch {
      // Fall back to clean seed if browser storage is unavailable or corrupted.
    }
    return this.reset()
  }

  save(state: PortalState): PortalState {
    const validated = PortalStateSchema.parse(state)
    this.memory = structuredClone(validated)
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated))
    } catch {
      // Keep in-memory state when browser storage is restricted.
    }
    return structuredClone(validated)
  }

  reset(): PortalState {
    return this.save(createSeedState())
  }

  listVisibleHouseholds(actor: PortalActor): Household[] {
    return this.load().households.filter((record) => can(actor, 'view', { type: 'household', record }))
  }

  revokeAssignment(actor: PortalActor, assignmentId: string, nowIso = new Date().toISOString()): PortalState {
    const state = this.load()
    const assignment = state.assignments.find((a) => a.id === assignmentId)
    if (!assignment || !can(actor, 'revoke_mentor', { type: 'assignment', record: assignment })) {
      throw new PortalAccessError('Only an admin may revoke a mentor assignment')
    }
    const actorId = actor.kind === 'mentor' ? actor.mentorId : 'unknown'
    assignment.revokedAt = nowIso
    assignment.revokedByMentorId = actorId
    state.auditLogs.push({
      id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind: 'admin', actorId,
      action: 'revoke_mentor', recordType: 'assignment', recordId: assignment.id,
      householdId: assignment.householdId, outcome: 'allow',
    })
    return this.save(state)
  }

  exportHousehold(actor: PortalActor, householdId: string): Record<string, unknown> {
    const state = this.load()
    const hh = state.households.find((h) => h.id === householdId)
    if (!hh || !can(actor, 'export_household', { type: 'household', record: hh })) {
      throw new PortalAccessError('Export is allowed only for the household parent or an admin')
    }
    return {
      exportedAt: new Date().toISOString(), simulated: true, household: hh,
      children: state.children.filter((c) => c.householdId === householdId),
      workRecords: state.workRecords.filter((w) => w.householdId === householdId),
      feedback: state.feedback.filter((f) => f.householdId === householdId && f.status !== 'draft'),
      parentUpdates: state.parentUpdates.filter((u) => u.householdId === householdId),
      badges: state.badges.filter((b) => b.householdId === householdId),
      points: state.points.filter((p) => p.householdId === householdId),
    }
  }

  deleteHousehold(actor: PortalActor, householdId: string, nowIso = new Date().toISOString()): PortalState {
    const state = this.load()
    const hh = state.households.find((h) => h.id === householdId)
    if (!hh || !can(actor, 'delete_household', { type: 'household', record: hh })) {
      throw new PortalAccessError('Deletion is allowed only for the household parent or an admin')
    }
    const actorKind = actor.kind === 'parent' ? 'parent' : 'admin'
    const actorId = actor.kind === 'parent' ? actor.householdId : actor.kind === 'mentor' ? actor.mentorId : 'unknown'
    const keep = <T extends { householdId: string | null }>(xs: T[]) => xs.filter((x) => x.householdId !== householdId)
    return this.save({
      ...state,
      households: state.households.filter((h) => h.id !== householdId),
      children: keep(state.children), workRecords: keep(state.workRecords),
      feedback: keep(state.feedback), parentUpdates: keep(state.parentUpdates),
      roomInvites: keep(state.roomInvites), badges: keep(state.badges),
      points: keep(state.points), inbox: keep(state.inbox),
      auditLogs: [
        ...state.auditLogs,
        { id: `aud_${state.auditLogs.length + 1}`, at: nowIso, actorKind, actorId, action: 'delete_household', recordType: 'household', recordId: householdId, householdId, outcome: 'allow' },
      ],
    })
  }
}

export const portalStorage: PortalStorageAdapter = new LocalPortalStorageAdapter()
