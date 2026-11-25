import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomStageCard } from '@routes/portal/RoomStageCard'
import { buildChildActor, buildMentorActor, buildParentActor } from './access'
import { forwardQuestionToMentor, sendMentorReplyDemo, submitAskQuestion } from './askActions'
import { getCurriculumSet } from './curriculum'
import {
  awardBadgeByMentor,
  awardBeltPassed,
  buildFridayDrafts,
  listBeltTestsDue,
  listMentorWorkRecords,
  listQuietKids,
  listTodayAskQueue,
  listTodayWorkQueue,
  sendAllFridayNotes,
  sendQuietNudge,
  sendWorkReviewReply,
} from './mentorActions'
import { updateFourSettings, withdrawParentConsent } from './parentActions'
import { createRoomInvite, joinRoom, openRoomByMentor, respondToRoomInvite } from './roomActions'
import { LocalPortalStorageAdapter, PortalAccessError, portalStorage } from './storage'
import { openOrCreateWorkRecord, saveWorkDraft, submitWorkRecord } from './workActions'

describe('portal Phase 1 — PR 11 security repair order (G-07, G-06, Codex1, G-03)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    portalStorage.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FIX 1 (G-07): revokes room access at once when parent switches rooms off, withdraws consent, or taps No mid-room', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const elena = buildParentActor(seed, 'hh_elena')
    const priya = buildParentActor(seed, 'hh_priya')
    const marcus = buildChildActor(seed, 'child_marcus')
    const leo = buildChildActor(seed, 'child_leo')

    // (a) Parent switches rooms OFF while Leo is already inside an open standing-yes room
    const leoRoom = createRoomInvite(adapter, samuel, {
      childId: 'child_leo', gameId: 'neon-dash',
      startsAt: '2026-11-26T01:00:00Z', endsAt: '2026-11-26T01:10:00Z',
    }, '2026-11-26T00:55:00Z')
    openRoomByMentor(adapter, samuel, leoRoom.invite.id, '2026-11-26T01:00:00Z')
    const leoIn = joinRoom(adapter, leo, leoRoom.invite.id, '2026-11-26T01:01:00Z')
    expect(leoIn.invite.activeChildIds).toEqual(['child_leo'])

    const afterSwitchOff = updateFourSettings(adapter, priya, 'hh_priya', 'child_leo', {
      askMode: 'auto', autoShow: true, approvedFunGames: ['neon-dash'], joinRooms: false, emailMode: 'everything',
    })
    expect(afterSwitchOff.roomInvites.find((r) => r.id === leoRoom.invite.id)?.activeChildIds).toEqual([])
    expect(() => joinRoom(adapter, leo, leoRoom.invite.id, '2026-11-26T01:02:00Z')).toThrow(PortalAccessError)

    // (b) Parent taps No mid-room on Marcus's already-open approved room -> removes Marcus immediately
    const marcusRoom1 = createRoomInvite(adapter, samuel, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-26T01:00:00Z', endsAt: '2026-11-26T01:10:00Z',
    }, '2026-11-26T00:55:00Z')
    respondToRoomInvite(adapter, elena, marcusRoom1.invite.id, 'approved', '2026-11-26T00:56:00Z')
    openRoomByMentor(adapter, samuel, marcusRoom1.invite.id, '2026-11-26T01:00:00Z')
    joinRoom(adapter, marcus, marcusRoom1.invite.id, '2026-11-26T01:01:00Z')

    const afterMidRoomNo = respondToRoomInvite(adapter, elena, marcusRoom1.invite.id, 'declined', '2026-11-26T01:02:00Z')
    expect(afterMidRoomNo.roomInvites.find((r) => r.id === marcusRoom1.invite.id)?.activeChildIds).toEqual([])
    expect(() => joinRoom(adapter, marcus, marcusRoom1.invite.id, '2026-11-26T01:03:00Z')).toThrow(PortalAccessError)

    // (c) Parent withdraws consent while Marcus is inside an open approved room -> removes Marcus & joinRoom checks consent
    const marcusRoom2 = createRoomInvite(adapter, samuel, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-26T01:00:00Z', endsAt: '2026-11-26T01:10:00Z',
    }, '2026-11-26T00:55:00Z')
    respondToRoomInvite(adapter, elena, marcusRoom2.invite.id, 'approved', '2026-11-26T00:56:00Z')
    openRoomByMentor(adapter, samuel, marcusRoom2.invite.id, '2026-11-26T01:00:00Z')
    joinRoom(adapter, marcus, marcusRoom2.invite.id, '2026-11-26T01:01:00Z')

    const afterWithdraw = withdrawParentConsent(adapter, elena, 'hh_elena', '2026-11-26T01:02:00Z')
    expect(afterWithdraw.roomInvites.find((r) => r.id === marcusRoom2.invite.id)?.activeChildIds).toEqual([])
    expect(() => joinRoom(adapter, marcus, marcusRoom2.invite.id, '2026-11-26T01:03:00Z')).toThrow(PortalAccessError)
  })

  it('FIX 2 (G-06): room stays closed after time ends, persists end at 0:00, uses real time in joinRoom, removes clock rewind, and refuses reload or days-later join', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T01:00:00Z'))

    // (a) A room that ended 3 days ago with closedAt still null MUST NOT rewind the clock on open/reload
    const state = portalStorage.reset()
    const samuel = buildMentorActor(state, 'mentor_samuel')
    const elena = buildParentActor(state, 'hh_elena')
    const marcus = buildChildActor(state, 'child_marcus')

    const oldRoom = createRoomInvite(portalStorage, samuel, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-24T01:00:00Z', endsAt: '2026-11-24T01:10:00Z',
    }, '2026-11-24T00:55:00Z')
    respondToRoomInvite(portalStorage, elena, oldRoom.invite.id, 'approved', '2026-11-24T00:56:00Z')
    openRoomByMentor(portalStorage, samuel, oldRoom.invite.id, '2026-11-24T01:00:00Z')

    let latestState = portalStorage.load()
    const { unmount } = render(
      <RoomStageCard
        state={latestState}
        inviteId={oldRoom.invite.id}
        childId="child_marcus"
        onStateChange={(next) => { latestState = next }}
        onClose={() => {}}
      />,
    )

    // Must immediately show goodbye (NOT rewound countdown), save closedAt, and refuse join using real time
    expect(screen.getByTestId('room-goodbye')).toBeVisible()
    expect(portalStorage.load().roomInvites.find((r) => r.id === oldRoom.invite.id)?.closedAt).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /try joining after end/i }))
    expect(screen.getByTestId('room-error')).toHaveTextContent(/ended on schedule/i)
    unmount()

    // (b) Running room hits 0:00 naturally -> persists closedAt & empties activeChildIds; reloading does NOT restart clock
    const liveRoom = createRoomInvite(portalStorage, samuel, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-27T01:00:00Z', endsAt: '2026-11-27T01:00:03Z',
    }, '2026-11-27T00:59:00Z')
    respondToRoomInvite(portalStorage, elena, liveRoom.invite.id, 'approved', '2026-11-27T00:59:10Z')
    openRoomByMentor(portalStorage, samuel, liveRoom.invite.id, '2026-11-27T01:00:00Z')
    joinRoom(portalStorage, marcus, liveRoom.invite.id, '2026-11-27T01:00:00Z')

    let liveState = portalStorage.load()
    const firstRender = render(
      <RoomStageCard
        state={liveState}
        inviteId={liveRoom.invite.id}
        childId="child_marcus"
        onStateChange={(next) => { liveState = next }}
        onClose={() => {}}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(screen.getByTestId('room-goodbye')).toBeVisible()
    const savedAfterZero = portalStorage.load().roomInvites.find((r) => r.id === liveRoom.invite.id)!
    expect(savedAfterZero.closedAt).not.toBeNull()
    expect(savedAfterZero.activeChildIds).toEqual([])
    firstRender.unmount()

    // Reloading days later keeps it permanently closed and refuses join
    vi.setSystemTime(new Date('2026-12-01T01:00:00Z'))
    render(
      <RoomStageCard
        state={portalStorage.load()}
        inviteId={liveRoom.invite.id}
        childId="child_marcus"
        onStateChange={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByTestId('room-goodbye')).toBeVisible()
    expect(() => joinRoom(portalStorage, marcus, liveRoom.invite.id)).toThrow(PortalAccessError)
  })

  it('FIX 3 (Codex1): revoking a mentor immediately strips access from that mentor\'s existing session on every read and write', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const elena = buildParentActor(seed, 'hh_elena')
    const marcus = buildChildActor(seed, 'child_marcus')

    // Mentor B already has an existing session actor built BEFORE revocation
    const staleMentorBSession = buildMentorActor(seed, 'mentor_b')

    // Prepare a forwarded question and an openable room invite on Elena's household while Mentor B is still assigned
    const asked = submitAskQuestion(adapter, marcus, 'child_marcus', { text: 'Need help on #3' }, '2026-11-25T10:00:00Z')
    forwardQuestionToMentor(adapter, elena, asked.question.id, '2026-11-25T10:01:00Z')
    const room = createRoomInvite(adapter, samuel, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-26T02:00:00Z', endsAt: '2026-11-26T02:10:00Z',
    }, '2026-11-26T01:55:00Z')

    // Sanity check: before revocation, Mentor B's session sees Elena
    expect(adapter.listVisibleHouseholds(staleMentorBSession).map((h) => h.id)).toEqual(['hh_elena'])
    expect(listTodayWorkQueue(adapter.load(), staleMentorBSession).length).toBeGreaterThan(0)
    expect(listTodayAskQueue(adapter.load(), staleMentorBSession).length).toBe(1)

    // Owner revokes Mentor B's assignment
    const afterRevoke = adapter.revokeAssignment(samuel, 'asgn_b_elena', '2026-11-25T10:05:00Z')

    // Existing Mentor B session MUST immediately lose ALL read access (without re-signing in)
    expect(adapter.listVisibleHouseholds(staleMentorBSession)).toEqual([])
    expect(listTodayWorkQueue(afterRevoke, staleMentorBSession)).toEqual([])
    expect(listMentorWorkRecords(afterRevoke, staleMentorBSession)).toEqual([])
    expect(listTodayAskQueue(afterRevoke, staleMentorBSession)).toEqual([])
    expect(listQuietKids(afterRevoke, staleMentorBSession)).toEqual([])
    expect(listBeltTestsDue(afterRevoke, staleMentorBSession)).toEqual([])
    expect(buildFridayDrafts(afterRevoke, staleMentorBSession)).toEqual([])

    // Existing Mentor B session MUST immediately lose ALL write access (without re-signing in)
    expect(() => sendWorkReviewReply(adapter, staleMentorBSession, 'work_marcus_u2', 'Late review')).toThrow(PortalAccessError)
    expect(() => sendMentorReplyDemo(adapter, staleMentorBSession, asked.question.id, 'Late reply')).toThrow(PortalAccessError)
    expect(() => sendQuietNudge(adapter, staleMentorBSession, 'child_marcus')).toThrow(PortalAccessError)
    expect(() => awardBeltPassed(adapter, staleMentorBSession, 'child_marcus')).toThrow(PortalAccessError)
    expect(() => awardBadgeByMentor(adapter, staleMentorBSession, 'child_marcus', 'explained_it')).toThrow(PortalAccessError)
    expect(() => sendAllFridayNotes(adapter, staleMentorBSession, [{
      childId: 'child_marcus', householdId: 'hh_elena', nickname: 'Marcus', quiet: false,
      weekOf: '2026-11-25', workedOn: 'x', needsHelp: 'y', tryAtHome: 'z', humanSentence: 'hi',
    }])).toThrow(PortalAccessError)
    expect(() => createRoomInvite(adapter, staleMentorBSession, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-26T03:00:00Z', endsAt: '2026-11-26T03:10:00Z',
    })).toThrow(PortalAccessError)
    expect(() => openRoomByMentor(adapter, staleMentorBSession, room.invite.id, '2026-11-26T02:00:00Z')).toThrow(PortalAccessError)
  })

  it('FIX 4 (G-03): hides child open responses and typed answers from mentor work views while waiting for parent approval or when Questions are off, until parent forwards', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const elena = buildParentActor(seed, 'hh_elena')
    const priya = buildParentActor(seed, 'hh_priya')
    const marcus = buildChildActor(seed, 'child_marcus')
    const sofia = buildChildActor(seed, 'child_sofia')
    const leo = buildChildActor(seed, 'child_leo')

    // (a) Review-first (Marcus): draft AND waiting-parent-review typed answers + open response must NOT appear in mentor work views until parent forwards
    const marcusSet = openOrCreateWorkRecord(adapter, marcus, 'child_marcus', getCurriculumSet('g7-u1-a')!)
    const afterMarcusDraft = saveWorkDraft(adapter, marcus, marcusSet.record.id, marcusSet.record.currentRevision, {
      answers: [{ questionId: 'g7-u1-a-01', chosenValue: 'SECRET_TYPED_ANSWER_MARCUS', tries: 1, hintUsed: false, answeredAt: '2026-11-25T12:00:00Z' }],
      openResponse: 'SECRET_OPEN_RESPONSE_MARCUS',
    })
    const draftMentorView = listMentorWorkRecords(afterMarcusDraft.state, samuel, 'child_marcus').find((w) => w.id === marcusSet.record.id)!
    expect('openResponse' in draftMentorView).toBe(false)
    expect('chosenValue' in draftMentorView.attempts[0]!.answers[0]!).toBe(false)
    expect(JSON.stringify(draftMentorView)).not.toContain('SECRET_TYPED_ANSWER_MARCUS')
    expect(JSON.stringify(draftMentorView)).not.toContain('SECRET_OPEN_RESPONSE_MARCUS')

    const afterMarcusSubmit = submitWorkRecord(adapter, marcus, marcusSet.record.id, '2026-11-25T12:01:00Z')
    const pendingQ = afterMarcusSubmit.state.askQuestions.find((q) => q.workRecordId === marcusSet.record.id)!
    expect(pendingQ.status).toBe('waiting_parent_review')

    const mentorQueueBeforeFwd = listTodayWorkQueue(afterMarcusSubmit.state, samuel)
    const marcusViewBeforeFwd = mentorQueueBeforeFwd.find((w) => w.id === marcusSet.record.id)!
    expect(marcusViewBeforeFwd).toBeDefined()
    expect('openResponse' in marcusViewBeforeFwd).toBe(false)
    expect('openResponse' in marcusViewBeforeFwd.attempts[0]!).toBe(false)
    expect('chosenValue' in marcusViewBeforeFwd.attempts[0]!.answers[0]!).toBe(false)
    expect(JSON.stringify(marcusViewBeforeFwd)).not.toContain('SECRET_TYPED_ANSWER_MARCUS')
    expect(JSON.stringify(marcusViewBeforeFwd)).not.toContain('SECRET_OPEN_RESPONSE_MARCUS')

    // Once parent forwards, mentor view includes Marcus's open response and typed answers
    const afterFwd = forwardQuestionToMentor(adapter, elena, pendingQ.id, '2026-11-25T12:05:00Z')
    const marcusViewAfterFwd = listTodayWorkQueue(afterFwd, samuel).find((w) => w.id === marcusSet.record.id)!
    expect(marcusViewAfterFwd.openResponse).toBe('SECRET_OPEN_RESPONSE_MARCUS')
    expect(marcusViewAfterFwd.attempts[0]?.answers[0]?.chosenValue).toBe('SECRET_TYPED_ANSWER_MARCUS')

    // (b) Questions OFF (Sofia): mentor view leaves out typed answers and open response permanently
    const sofiaWork = openOrCreateWorkRecord(adapter, sofia, 'child_sofia', getCurriculumSet('g7-u1-a')!)
    saveWorkDraft(adapter, sofia, sofiaWork.record.id, sofiaWork.record.currentRevision, {
      answers: [{ questionId: 'g7-u1-a-01', chosenValue: 'SECRET_TYPED_SOFIA', tries: 1, hintUsed: false, answeredAt: '2026-11-25T12:02:00Z' }],
      openResponse: 'SECRET_OPEN_SOFIA',
    })
    const afterSofiaSubmit = submitWorkRecord(adapter, sofia, sofiaWork.record.id, '2026-11-25T12:03:00Z')
    const sofiaView = listTodayWorkQueue(afterSofiaSubmit.state, samuel).find((w) => w.id === sofiaWork.record.id)!
    const sofiaKidView = listMentorWorkRecords(afterSofiaSubmit.state, samuel, 'child_sofia').find((w) => w.id === sofiaWork.record.id)!
    expect(sofiaView).toBeDefined()
    expect('openResponse' in sofiaView).toBe(false)
    expect('chosenValue' in sofiaView.attempts[0]!.answers[0]!).toBe(false)
    expect(JSON.stringify(sofiaView)).not.toContain('SECRET_TYPED_SOFIA')
    expect(JSON.stringify(sofiaView)).not.toContain('SECRET_OPEN_SOFIA')
    expect(JSON.stringify(sofiaKidView)).not.toContain('SECRET_TYPED_SOFIA')
    expect(JSON.stringify(sofiaKidView)).not.toContain('SECRET_OPEN_SOFIA')

    // (c) Turning Questions OFF for Leo hides even previously queued Ask questions from mentors
    submitAskQuestion(adapter, leo, 'child_leo', { text: 'SECRET_LEO_ASK' }, '2026-11-25T12:04:00Z')
    expect(listTodayAskQueue(adapter.load(), samuel).some((q) => q.text === 'SECRET_LEO_ASK')).toBe(true)
    const afterLeoOff = updateFourSettings(adapter, priya, 'hh_priya', 'child_leo', {
      askMode: 'off', autoShow: false, approvedFunGames: ['neon-dash'], joinRooms: true, emailMode: 'everything',
    })
    expect(listTodayAskQueue(afterLeoOff, samuel).some((q) => q.text === 'SECRET_LEO_ASK')).toBe(false)
  })
})
