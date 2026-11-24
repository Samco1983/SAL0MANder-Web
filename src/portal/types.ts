import { z } from 'zod'

/**
 * SAL0MANder Tutoring Portal — Phase 1 data model (fictional demo).
 * All types are `z.infer` of strict Zod schemas; `ChildProfileSchema` structurally
 * forbids email, password, lastName, photo, video, and privateChannel.
 */

const id = z.string().min(1)
const iso = z.string().min(1)
const mail = z.string().email()

export const ConsentStatusSchema = z.enum(['pending', 'verified', 'withdrawn'])
export const AskModeSchema = z.enum(['off', 'review', 'auto'])
export const EmailModeSchema = z.enum(['everything', 'friday_only'])
export const BeltColorSchema = z.enum(['white', 'yellow', 'green', 'purple', 'black'])
export const MentorRoleSchema = z.enum(['owner', 'admin', 'mentor'])
export const WorkStatusSchema = z.enum(['draft', 'submitted', 'reviewed'])
export const FeedbackStatusSchema = z.enum(['draft', 'sent_to_parent', 'visible_to_child'])
export const DeliveryStatusSchema = z.enum(['draft', 'queued', 'accepted', 'delivered', 'bounced', 'failed'])

export const HouseholdSchema = z.object({
  id, parentName: id, parentEmail: mail,
  membershipStatus: z.enum(['active', 'paused', 'waitlisted', 'closed']),
  consentRecord: z.object({
    status: ConsentStatusSchema, noticeVersion: id,
    verifiedAt: iso.nullable(), withdrawnAt: iso.nullable().default(null),
    method: z.enum(['simulated_form', 'simulated_call']).nullable(),
  }).strict(),
  settings: z.object({ emailMode: EmailModeSchema }).strict(),
  createdAt: iso,
}).strict()

export const ChildProfileSchema = z.object({
  id, householdId: id, nickname: id, level: id, pinHash: id.optional(),
  consentStatus: ConsentStatusSchema, askMode: AskModeSchema, autoShow: z.boolean(),
  approvedGames: z.array(z.string()), joinRooms: z.boolean(),
  currentBelt: BeltColorSchema, stripesEarned: z.number().int().min(0),
  firstConversationLine: z.string(),
  lastActiveAt: iso.default('2026-11-24T12:00:00Z'),
}).strict()

export const MentorSchema = z.object({
  id, displayName: id, email: mail, roles: z.array(MentorRoleSchema).min(1), active: z.boolean(),
}).strict()

export const AssignmentSchema = z.object({
  id, mentorId: id, householdId: id, assignedByMentorId: id,
  assignedAt: iso, revokedAt: iso.nullable(), revokedByMentorId: id.nullable(),
}).strict()

export const WorkAttemptSchema = z.object({
  attemptId: id, startedAt: iso, submittedAt: iso.nullable(), openResponse: z.string(),
  answers: z.array(z.object({
    questionId: id, chosenValue: z.string(), tries: z.number().int().min(0),
    hintUsed: z.boolean(), answeredAt: iso,
  }).strict()),
}).strict()

export const WorkRecordSchema = z.object({
  id, householdId: id, childId: id, activityId: id, activityVersionId: id, unitId: id,
  status: WorkStatusSchema, attempts: z.array(WorkAttemptSchema), openResponse: z.string(),
  revisions: z.array(z.object({ revision: z.number().int().min(1), savedAt: iso, attemptId: id }).strict()),
  currentRevision: z.number().int().min(1),
}).strict()

export const FeedbackSchema = z.object({
  id, householdId: id, childId: id, workRecordId: id.nullable(), authorMentorId: id,
  status: FeedbackStatusSchema, draftText: z.string(), sentText: z.string().nullable(),
  parentNotifiedAt: iso.nullable(), shownToChildAt: iso.nullable(),
  shownBy: z.enum(['parent_tap', 'parent_auto_show']).nullable(),
}).strict()

export const ParentUpdateSchema = z.object({
  id, householdId: id, childId: id, authorMentorId: id, weekOf: id,
  workedOn: z.string(), needsHelp: z.string(), tryAtHome: z.string(), humanSentence: z.string(),
  deliveryStatus: DeliveryStatusSchema, sentAt: iso.nullable(),
}).strict()

export const RoomInviteSchema = z.object({
  id, householdId: id, childId: id, mentorId: id, gameId: id, roomCode: id,
  startsAt: iso, endsAt: iso,
  parentApproval: z.enum(['pending', 'approved', 'declined', 'standing_yes']),
  approvedAt: iso.nullable(),
}).strict()

export const BadgeSchema = z.object({
  id, householdId: id, childId: id, label: id, awardedAt: iso, awardedBy: id,
  kind: z.enum(['first_question', 'explained_it', 'came_back', 'taught_at_home', 'belt_test_witness', 'family_night', 'built_from_scratch']),
}).strict()

export const PointsSchema = z.object({
  id, householdId: id, childId: id, balance: z.number().int().min(0),
  ledger: z.array(z.object({ id, amount: z.number().int(), reason: id, createdAt: iso }).strict()),
}).strict()

/** Audit entries store IDs and actions only — never child content. */
export const AuditLogSchema = z.object({
  id, at: iso, actorKind: z.enum(['parent', 'child', 'mentor', 'admin', 'system']),
  actorId: id, action: id, recordType: id, recordId: id,
  householdId: id.nullable(), outcome: z.enum(['allow', 'deny', 'recorded']),
}).strict()

export const AskQuestionStatusSchema = z.enum([
  'waiting_parent_review',
  'held_undelivered',
  'parent_bounced',
  'queued_for_mentor',
  'replied',
])

export const AskQuestionSchema = z.object({
  id, householdId: id, childId: id, workRecordId: id.nullable(),
  source: z.enum(['ask_form', 'worksheet_open_response']),
  text: z.string().min(1),
  photoPlaceholder: z.object({ label: id, nameCovered: z.boolean(), expiresAt: iso }).strict().nullable(),
  askModeAtSend: AskModeSchema,
  status: AskQuestionStatusSchema,
  parentEmailAcceptedAt: iso.nullable(),
  forwardedToMentorAt: iso.nullable(),
  createdAt: iso,
}).strict()

export const SimulatedEmailSchema = z.object({
  id, to: mail, householdId: id.nullable(), subject: id, body: z.string(), sentAt: iso,
  kind: z.enum(['sign_in_link', 'question_review', 'question_copy', 'mentor_reply', 'friday_note', 'room_invite', 'delivery_failure']),
  status: z.enum(['queued', 'accepted', 'delivered', 'rejected', 'bounced']),
  relatedQuestionId: id.nullable().default(null),
}).strict()

export const PortalStateSchema = z.object({
  schemaVersion: z.literal(1),
  households: z.array(HouseholdSchema), children: z.array(ChildProfileSchema),
  mentors: z.array(MentorSchema), assignments: z.array(AssignmentSchema),
  workRecords: z.array(WorkRecordSchema), askQuestions: z.array(AskQuestionSchema).default([]),
  feedback: z.array(FeedbackSchema), parentUpdates: z.array(ParentUpdateSchema),
  roomInvites: z.array(RoomInviteSchema), badges: z.array(BadgeSchema),
  points: z.array(PointsSchema), auditLogs: z.array(AuditLogSchema),
  inbox: z.array(SimulatedEmailSchema),
}).strict()

export type AskMode = z.infer<typeof AskModeSchema>
export type EmailMode = z.infer<typeof EmailModeSchema>
export type BeltColor = z.infer<typeof BeltColorSchema>
export type MentorRole = z.infer<typeof MentorRoleSchema>
export type Household = z.infer<typeof HouseholdSchema>
export type ChildProfile = z.infer<typeof ChildProfileSchema>
export type Mentor = z.infer<typeof MentorSchema>
export type Assignment = z.infer<typeof AssignmentSchema>
export type WorkAttempt = z.infer<typeof WorkAttemptSchema>
export type WorkRecord = z.infer<typeof WorkRecordSchema>
export type AskQuestion = z.infer<typeof AskQuestionSchema>
export type Feedback = z.infer<typeof FeedbackSchema>
export type ParentUpdate = z.infer<typeof ParentUpdateSchema>
export type RoomInvite = z.infer<typeof RoomInviteSchema>
export type Badge = z.infer<typeof BadgeSchema>
export type Points = z.infer<typeof PointsSchema>
export type AuditLog = z.infer<typeof AuditLogSchema>
export type SimulatedEmail = z.infer<typeof SimulatedEmailSchema>
export type PortalState = z.infer<typeof PortalStateSchema>
