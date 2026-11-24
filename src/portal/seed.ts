import { PortalStateSchema, type Assignment, type ChildProfile, type Household, type PortalState } from './types'

const T = '2026-11-20T17:00:00Z'

const hh = (id: string, parentName: string, parentEmail: string, verified: boolean, emailMode: 'everything' | 'friday_only' = 'everything'): Household => ({
  id, parentName, parentEmail, membershipStatus: 'active',
  consentRecord: { status: verified ? 'verified' : 'pending', noticeVersion: '2026-11-24-demo-v1', verifiedAt: verified ? '2026-11-18T16:10:00Z' : null, withdrawnAt: null, method: verified ? 'simulated_form' : null },
  settings: { emailMode }, createdAt: '2026-11-18T16:00:00Z',
})

const kid = (id: string, householdId: string, nickname: string, level: string, overrides: Partial<ChildProfile> = {}): ChildProfile => ({
  id, householdId, nickname, level, consentStatus: 'verified', askMode: 'review', autoShow: false,
  approvedGames: ['act_integer_operations'], joinRooms: false, currentBelt: 'white', stripesEarned: 0,
  firstConversationLine: 'Just getting started.', ...overrides,
})

const asgn = (id: string, mentorId: string, householdId: string): Assignment => ({
  id, mentorId, householdId, assignedByMentorId: 'mentor_samuel', assignedAt: T, revokedAt: null, revokedByMentorId: null,
})

/** Fictional Phase 1 seed: 3 households, 5 kids, Samuel (owner+admin+mentor), Mentor B assigned, Mentor C unassigned. */
export function createSeedState(): PortalState {
  return PortalStateSchema.parse({
    schemaVersion: 1,
    households: [
      hh('hh_elena', 'Elena', 'elena.demo@family.example', true),
      hh('hh_priya', 'Priya', 'priya.demo@family.example', true),
      hh('hh_david', 'David', 'david.demo@family.example', false, 'friday_only'),
    ],
    children: [
      kid('child_marcus', 'hh_elena', 'Marcus', '7th Grade Math', { pinHash: 'demo-pin-1234', currentBelt: 'yellow', stripesEarned: 3, firstConversationLine: 'I want to get fast at negative numbers before the quiz.' }),
      kid('child_sofia', 'hh_elena', 'Sofia', '6th Grade Math', { askMode: 'off', stripesEarned: 1, firstConversationLine: 'Fractions are fine, word problems trip me up.' }),
      kid('child_leo', 'hh_priya', 'Leo', '7th Grade Math', { pinHash: 'demo-pin-4321', askMode: 'auto', autoShow: true, approvedGames: ['act_integer_operations', 'neon-dash'], joinRooms: true, currentBelt: 'green', stripesEarned: 4, firstConversationLine: 'I like spotting patterns and checking why shortcuts work.' }),
      kid('child_nina', 'hh_priya', 'Nina', '8th Grade Math', { firstConversationLine: 'Graphing lines makes more sense when I draw the steps.' }),
      kid('child_kai', 'hh_david', 'Kai', '7th Grade Math', { consentStatus: 'pending', askMode: 'off', approvedGames: [] }),
    ],
    mentors: [
      { id: 'mentor_samuel', displayName: 'Mr. Sam', email: 'sam.demo@sal0mander.example', roles: ['owner', 'admin', 'mentor'], active: true },
      { id: 'mentor_b', displayName: 'Mentor Maya (Mentor B)', email: 'mentor.b@sal0mander.example', roles: ['mentor'], active: true },
      { id: 'mentor_c', displayName: 'Mentor Devon (Mentor C)', email: 'mentor.c@sal0mander.example', roles: ['mentor'], active: true },
    ],
    assignments: [
      asgn('asgn_sam_elena', 'mentor_samuel', 'hh_elena'),
      asgn('asgn_sam_priya', 'mentor_samuel', 'hh_priya'),
      asgn('asgn_sam_david', 'mentor_samuel', 'hh_david'),
      asgn('asgn_b_elena', 'mentor_b', 'hh_elena'),
    ],
    workRecords: [
      {
        id: 'work_marcus_u2', householdId: 'hh_elena', childId: 'child_marcus', activityId: 'act_integer_operations', activityVersionId: 'ver_int_ops_v1', unitId: 'g7_u2_integers', status: 'submitted',
        attempts: [{ attemptId: 'att_marcus_1', startedAt: '2026-11-22T23:00:00Z', submittedAt: '2026-11-22T23:18:00Z', answers: [{ questionId: 'q1', chosenValue: '-5', tries: 1, hintUsed: false, answeredAt: '2026-11-22T23:03:00Z' }], openResponse: 'Subtracting a negative moved right on the number line.' }],
        openResponse: 'Subtracting a negative moved right on the number line.',
        revisions: [{ revision: 1, savedAt: '2026-11-22T23:18:00Z', attemptId: 'att_marcus_1' }], currentRevision: 1,
      },
      {
        id: 'work_sofia_u1', householdId: 'hh_elena', childId: 'child_sofia', activityId: 'act_integer_operations', activityVersionId: 'ver_int_ops_v1', unitId: 'g6_u1_ratios', status: 'draft',
        attempts: [{ attemptId: 'att_sofia_1', startedAt: '2026-11-23T22:00:00Z', submittedAt: null, answers: [], openResponse: '' }],
        openResponse: '', revisions: [{ revision: 1, savedAt: '2026-11-23T22:05:00Z', attemptId: 'att_sofia_1' }], currentRevision: 1,
      },
      {
        id: 'work_leo_u2', householdId: 'hh_priya', childId: 'child_leo', activityId: 'act_integer_operations', activityVersionId: 'ver_int_ops_v1', unitId: 'g7_u2_integers', status: 'reviewed',
        attempts: [{ attemptId: 'att_leo_1', startedAt: '2026-11-21T19:00:00Z', submittedAt: '2026-11-21T19:14:00Z', answers: [], openResponse: 'Two negatives add to a deeper negative.' }],
        openResponse: 'Two negatives add to a deeper negative.',
        revisions: [{ revision: 1, savedAt: '2026-11-21T19:14:00Z', attemptId: 'att_leo_1' }], currentRevision: 1,
      },
    ],
    askQuestions: [],
    feedback: [
      { id: 'fb_marcus_draft', householdId: 'hh_elena', childId: 'child_marcus', workRecordId: 'work_marcus_u2', authorMentorId: 'mentor_samuel', status: 'draft', draftText: '[Placeholder draft] Strong number-line reasoning.', sentText: null, parentNotifiedAt: null, shownToChildAt: null, shownBy: null },
      { id: 'fb_marcus_waiting', householdId: 'hh_elena', childId: 'child_marcus', workRecordId: 'work_marcus_u2', authorMentorId: 'mentor_b', status: 'sent_to_parent', draftText: '[Placeholder draft] Check sign flip.', sentText: 'Great catch checking #4 on the number line.', parentNotifiedAt: '2026-11-24T17:00:00Z', shownToChildAt: null, shownBy: null },
      { id: 'fb_leo_shown', householdId: 'hh_priya', childId: 'child_leo', workRecordId: 'work_leo_u2', authorMentorId: 'mentor_samuel', status: 'visible_to_child', draftText: '[Placeholder draft] Clear explanation.', sentText: 'Clear explanation of adding two negatives — nice work, Leo.', parentNotifiedAt: '2026-11-22T17:00:00Z', shownToChildAt: '2026-11-22T17:00:05Z', shownBy: 'parent_auto_show' },
    ],
    parentUpdates: [
      { id: 'upd_marcus_w1', householdId: 'hh_elena', childId: 'child_marcus', authorMentorId: 'mentor_samuel', weekOf: '2026-11-20', workedOn: 'Integer subtraction (Unit 2).', needsHelp: 'Double-checking double negatives.', tryAtHome: 'Ask Marcus why 3 - (-2) = 5.', humanSentence: 'Marcus caught his own sign flip this week.', deliveryStatus: 'delivered', sentAt: '2026-11-20T22:00:00Z' },
      { id: 'upd_leo_w1', householdId: 'hh_priya', childId: 'child_leo', authorMentorId: 'mentor_samuel', weekOf: '2026-11-20', workedOn: 'Unit 4 check complete.', needsHelp: 'Showing one extra step.', tryAtHome: 'Ask Leo to share his favorite shortcut.', humanSentence: 'Leo is ready for his green belt check.', deliveryStatus: 'delivered', sentAt: '2026-11-20T22:05:00Z' },
    ],
    roomInvites: [
      { id: 'inv_marcus_1', householdId: 'hh_elena', childId: 'child_marcus', mentorId: 'mentor_samuel', gameId: 'moon-gate', roomCode: 'DEMO-418', startsAt: '2026-11-24T23:35:00Z', endsAt: '2026-11-24T23:50:00Z', parentApproval: 'pending', approvedAt: null },
      { id: 'inv_leo_1', householdId: 'hh_priya', childId: 'child_leo', mentorId: 'mentor_samuel', gameId: 'neon-dash', roomCode: 'DEMO-729', startsAt: '2026-11-24T23:35:00Z', endsAt: '2026-11-24T23:50:00Z', parentApproval: 'standing_yes', approvedAt: '2026-11-24T22:00:00Z' },
    ],
    badges: [
      { id: 'bdg_marcus_1', householdId: 'hh_elena', childId: 'child_marcus', kind: 'first_question', label: 'First question', awardedAt: T, awardedBy: 'system' },
      { id: 'bdg_leo_1', householdId: 'hh_priya', childId: 'child_leo', kind: 'explained_it', label: 'Explained it', awardedAt: T, awardedBy: 'mentor_samuel' },
    ],
    points: [
      { id: 'pts_marcus', householdId: 'hh_elena', childId: 'child_marcus', balance: 120, ledger: [{ id: 'pl_m1', amount: 120, reason: 'Completed set (cosmetics only)', createdAt: T }] },
      { id: 'pts_sofia', householdId: 'hh_elena', childId: 'child_sofia', balance: 40, ledger: [] },
      { id: 'pts_leo', householdId: 'hh_priya', childId: 'child_leo', balance: 210, ledger: [] },
      { id: 'pts_nina', householdId: 'hh_priya', childId: 'child_nina', balance: 20, ledger: [] },
      { id: 'pts_kai', householdId: 'hh_david', childId: 'child_kai', balance: 0, ledger: [] },
    ],
    auditLogs: [
      { id: 'aud_1', at: '2026-11-18T16:10:00Z', actorKind: 'parent', actorId: 'hh_elena', action: 'consent_verified', recordType: 'household', recordId: 'hh_elena', householdId: 'hh_elena', outcome: 'recorded' },
      { id: 'aud_2', at: T, actorKind: 'admin', actorId: 'mentor_samuel', action: 'assign_mentor', recordType: 'assignment', recordId: 'asgn_b_elena', householdId: 'hh_elena', outcome: 'allow' },
    ],
    inbox: [
      { id: 'eml_1', to: 'elena.demo@family.example', householdId: 'hh_elena', subject: 'New reply for Marcus (tap Show to share)', body: 'Open your parent view to read Mentor Maya’s reply and tap "Show to Marcus".', kind: 'mentor_reply', status: 'delivered', sentAt: '2026-11-23T17:00:00Z' },
      { id: 'eml_2', to: 'priya.demo@family.example', householdId: 'hh_priya', subject: 'Friday note for Leo — week of Nov 20', body: 'Open your parent view to read Mr. Sam’s 3-line Friday note.', kind: 'friday_note', status: 'delivered', sentAt: '2026-11-20T22:05:00Z' },
    ],
  })
}
