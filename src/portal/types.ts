import { z } from 'zod'

/**
 * SAL0MANder Tutoring Portal — Phase 1 data model (fictional demo).
 * All types are `z.infer` of strict Zod schemas; `ChildProfileSchema` structurally
 * forbids email, password, lastName, photo, video, and privateChannel.
 *
 * Nov 25 approval layers:
 * - No Auto-send (`AskMode` is `off` | `review` only for teens).
 * - Single-use ~72 h question approval links + fresh 6-digit step-up OTP.
 * - Teen/remembered device blocking + fast/same-device/same-network flags.
 * - "Approved by parent, date and time" stamp required for Mr. Sam to open.
 * - "Was this you?" pull-back + approval lock until parent re-authenticates.
 * - Parent email change requires old-address confirmation + 48 h hold.
 * - Append-only approval log visible to parent and Mr. Sam.
 */

const id = z.string().min(1)
const iso = z.string().min(1)
const mail = z.string().email()

export const ConsentStatusSchema = z.enum(['pending', 'verified', 'withdrawn'])
/** Nov 25 correction #5: Questions are Off / Review first only. Auto-send removed. */
export const AskModeSchema = z.enum(['off', 'review'])
export const EmailModeSchema = z.enum(['everything', 'friday_only'])
export const BeltColorSchema = z.enum(['white', 'yellow', 'green', 'purple', 'black'])
export const MentorRoleSchema = z.enum(['owner', 'admin', 'mentor'])
export const WorkStatusSchema = z.enum(['draft', 'submitted', 'reviewed'])
export const FeedbackStatusSchema = z.enum(['draft', 'sent_to_parent', 'visible_to_child'])
export const DeliveryStatusSchema = z.enum(['draft', 'queued', 'accepted', 'delivered', 'bounced', 'failed'])

export const PendingEmailChangeSchema = z.object({
  id,
  oldEmail: mail,
  newEmail: mail,
  confirmTokenId: id,
  requestedAt: iso,
  oldAddressConfirmedAt: iso.nullable().default(null),
  effectiveAt: iso.nullable().default(null),
  completedAt: iso.nullable().default(null),
  cancelledAt: iso.nullable().default(null),
}).strict()

export const HouseholdSchema = z.object({
  id, parentName: id, parentEmail: mail,
  membershipStatus: z.enum(['active', 'paused', 'waitlisted', 'closed']),
  consentRecord: z.object({
    status: ConsentStatusSchema, noticeVersion: id,
    verifiedAt: iso.nullable(), withdrawnAt: iso.nullable().default(null),
    method: z.enum(['simulated_form', 'simulated_call']).nullable(),
  }).strict(),
  settings: z.object({ emailMode: EmailModeSchema }).strict(),
  approvalsLockedAt: iso.nullable().default(null),
  approvalsLockedReason: z.string().nullable().default(null),
  pendingEmailChange: PendingEmailChangeSchema.nullable().default(null),
  createdAt: iso,
}).strict()

export const ChildProfileSchema = z.object({
  id, householdId: id, nickname: id, level: id, pinHash: id.optional(),
  isAdultLearner: z.boolean().default(false),
  consentStatus: ConsentStatusSchema, askMode: AskModeSchema, autoShow: z.boolean(),
  approvedGames: z.array(z.string()), joinRooms: z.boolean(),
  voiceClipsEnabled: z.boolean().default(true),
  currentBelt: BeltColorSchema, stripesEarned: z.number().int().min(0),
  completedUnitIds: z.array(id).default([]),
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
  openedAt: iso.nullable().default(null),
  closedAt: iso.nullable().default(null),
  activeChildIds: z.array(id).default([]),
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
  'pulled_back',
  'replied',
])

export const ApprovalStampSchema = z.object({
  label: z.string().min(1),
  approvedByEmail: mail,
  approvedAt: iso,
  method: z.enum(['button_step_up', 'verified_email_forward']),
  deviceId: id.nullable().default(null),
  networkTag: id.nullable().default(null),
}).strict()

export const SuspiciousApprovalFlagSchema = z.enum([
  'approved_within_seconds',
  'same_device_as_writer',
  'same_network_as_writer',
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
  submittedFromDeviceId: id.nullable().default(null),
  submittedFromNetworkTag: id.nullable().default(null),
  parentApprovalStamp: ApprovalStampSchema.nullable().default(null),
  suspiciousFlags: z.array(SuspiciousApprovalFlagSchema).default([]),
  approvalDelaySeconds: z.number().int().min(0).nullable().default(null),
  pulledBackAt: iso.nullable().default(null),
  adultDirectBypass: z.boolean().default(false),
  createdAt: iso,
}).strict()

export const ApprovalTokenSchema = z.object({
  tokenId: id,
  questionId: id,
  householdId: id,
  issuedAt: iso,
  expiresAt: iso,
  usedAt: iso.nullable().default(null),
  revokedAt: iso.nullable().default(null),
}).strict()

export const PullBackTokenSchema = z.object({
  tokenId: id,
  questionId: id,
  householdId: id,
  issuedAt: iso,
  usedAt: iso.nullable().default(null),
}).strict()

export const StepUpPurposeSchema = z.enum([
  'approve_question',
  'change_settings',
  'change_parent_email',
  'billing_action',
  'manage_devices',
  'unlock_approvals',
])

export const StepUpChallengeSchema = z.object({
  id,
  householdId: id,
  purpose: StepUpPurposeSchema,
  targetId: id.nullable().default(null),
  code: z.string().regex(/^\d{6}$/),
  sentToEmail: mail,
  issuedAt: iso,
  expiresAt: iso,
  usedAt: iso.nullable().default(null),
}).strict()

export const RegisteredDeviceSchema = z.object({
  id,
  householdId: id,
  label: id,
  deviceKind: z.enum(['parent_device', 'teen_device']),
  rememberedForChildId: id.nullable().default(null),
  networkTag: id,
  registeredAt: iso,
  revokedAt: iso.nullable().default(null),
}).strict()

export const ApprovalLogEventSchema = z.enum([
  'question_sent_to_parent',
  'step_up_code_issued',
  'approval_denied_teen_device',
  'approval_denied_unverified_forwarder',
  'approval_denied_expired_or_used_link',
  'approval_denied_invalid_step_up',
  'approval_denied_locked',
  'question_approved_button',
  'question_approved_email_forward',
  'approval_pulled_back_and_locked',
  'approvals_unlocked',
  'parent_email_change_requested',
  'parent_email_change_old_confirmed',
  'parent_email_change_cancelled',
  'parent_email_change_completed',
  'device_remembered',
  'device_revoked',
  'forwarded_signin_restricted_to_teen',
  'parent_power_denied_without_step_up',
])

/** Append-only approval & security log visible to the household parent and Mr. Sam (admin). */
export const ApprovalLogEntrySchema = z.object({
  id,
  sequence: z.number().int().min(1),
  at: iso,
  householdId: id,
  questionId: id.nullable().default(null),
  actorKind: z.enum(['parent', 'child', 'mentor', 'system']),
  actorLabel: id,
  event: ApprovalLogEventSchema,
  detail: z.string().min(1),
  outcome: z.enum(['allow', 'deny', 'recorded']),
}).strict()

export const SimulatedEmailSchema = z.object({
  id, to: mail, householdId: id.nullable(), subject: id, body: z.string(), sentAt: iso,
  kind: z.enum([
    'sign_in_link',
    'question_review',
    'question_copy',
    'step_up_code',
    'approval_receipt_check',
    'email_change_confirm',
    'email_change_hold',
    'mentor_reply',
    'friday_note',
    'room_invite',
    'delivery_failure',
  ]),
  status: z.enum(['queued', 'accepted', 'delivered', 'rejected', 'bounced']),
  relatedQuestionId: id.nullable().default(null),
  relatedRoomInviteId: id.nullable().optional(),
  approvalTokenId: id.nullable().optional(),
  pullBackTokenId: id.nullable().optional(),
  stepUpCode: z.string().nullable().optional(),
  emailChangeConfirmTokenId: id.nullable().optional(),
}).strict()

export const PortalStateSchema = z.object({
  schemaVersion: z.literal(1),
  households: z.array(HouseholdSchema), children: z.array(ChildProfileSchema),
  mentors: z.array(MentorSchema), assignments: z.array(AssignmentSchema),
  workRecords: z.array(WorkRecordSchema), askQuestions: z.array(AskQuestionSchema).default([]),
  approvalTokens: z.array(ApprovalTokenSchema).default([]),
  pullBackTokens: z.array(PullBackTokenSchema).default([]),
  stepUpChallenges: z.array(StepUpChallengeSchema).default([]),
  devices: z.array(RegisteredDeviceSchema).default([]),
  approvalLogs: z.array(ApprovalLogEntrySchema).default([]),
  feedback: z.array(FeedbackSchema), parentUpdates: z.array(ParentUpdateSchema),
  roomInvites: z.array(RoomInviteSchema), badges: z.array(BadgeSchema),
  points: z.array(PointsSchema), auditLogs: z.array(AuditLogSchema),
  inbox: z.array(SimulatedEmailSchema),
}).strict()

export type AskMode = z.infer<typeof AskModeSchema>
export type EmailMode = z.infer<typeof EmailModeSchema>
export type BeltColor = z.infer<typeof BeltColorSchema>
export type MentorRole = z.infer<typeof MentorRoleSchema>
export type PendingEmailChange = z.infer<typeof PendingEmailChangeSchema>
export type Household = z.infer<typeof HouseholdSchema>
export type ChildProfile = z.infer<typeof ChildProfileSchema>
export type Mentor = z.infer<typeof MentorSchema>
export type Assignment = z.infer<typeof AssignmentSchema>
export type WorkAttempt = z.infer<typeof WorkAttemptSchema>
export type WorkRecord = z.infer<typeof WorkRecordSchema>
export type ApprovalStamp = z.infer<typeof ApprovalStampSchema>
export type SuspiciousApprovalFlag = z.infer<typeof SuspiciousApprovalFlagSchema>
export type AskQuestion = z.infer<typeof AskQuestionSchema>
export type ApprovalToken = z.infer<typeof ApprovalTokenSchema>
export type PullBackToken = z.infer<typeof PullBackTokenSchema>
export type StepUpPurpose = z.infer<typeof StepUpPurposeSchema>
export type StepUpChallenge = z.infer<typeof StepUpChallengeSchema>
export type RegisteredDevice = z.infer<typeof RegisteredDeviceSchema>
export type ApprovalLogEvent = z.infer<typeof ApprovalLogEventSchema>
export type ApprovalLogEntry = z.infer<typeof ApprovalLogEntrySchema>
export type Feedback = z.infer<typeof FeedbackSchema>
export type ParentUpdate = z.infer<typeof ParentUpdateSchema>
export type RoomInvite = z.infer<typeof RoomInviteSchema>
export type Badge = z.infer<typeof BadgeSchema>
export type Points = z.infer<typeof PointsSchema>
export type AuditLog = z.infer<typeof AuditLogSchema>
export type SimulatedEmail = z.infer<typeof SimulatedEmailSchema>
export type PortalState = z.infer<typeof PortalStateSchema>
