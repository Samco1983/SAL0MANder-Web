import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import {
  buildChildActor,
  buildForwardedSignInActor,
  buildMentorActor,
  buildParentActor,
  can,
} from './access'
import {
  approveQuestionByEmailForward,
  approveQuestionWithLinkAndCode,
  authorizeParentBillingAction,
  cancelParentEmailChange,
  confirmOldEmailForChange,
  finalizeParentEmailChange,
  listVisibleApprovalLogs,
  openMentorQuestion,
  pullBackApprovalAndLock,
  rememberTeenDevice,
  requestParentEmailChange,
  requestParentStepUpCode,
  revokeRegisteredDevice,
  signInRememberedTeenDevice,
  unlockParentApprovals,
  unlockTeenFromForwardedSignIn,
} from './approvalLayers'
import { submitAskQuestion } from './askActions'
import { listTodayAskQueue } from './mentorActions'
import { saveChildProfile, updateFourSettings } from './parentActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'
import { AskModeSchema } from './types'

describe('portal Phase 1 — Nov 25 sign-in & parent-approval layers (Layers 1–9 + Acceptance Rows 5–6)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('removes Auto-send and enforces Layers 1, 2, 3 (single-use 72 h link tied to 1 question, fresh OTP, no teen-device approvals)', () => {
    // No Auto-send in schema
    expect(AskModeSchema.safeParse('auto').success).toBe(false)
    expect(AskModeSchema.safeParse('review').success).toBe(true)
    expect(AskModeSchema.safeParse('off').success).toBe(true)

    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const marcus = buildChildActor(seed, 'child_marcus')

    const q1 = submitAskQuestion(adapter, marcus, 'child_marcus', {
      text: 'Question 1: why does -3 - (-5) = 2?',
      deviceId: 'dev_marcus_chromebook',
      networkTag: 'home-wifi-elena',
    }, '2026-11-25T10:00:00Z')
    const q2 = submitAskQuestion(adapter, marcus, 'child_marcus', {
      text: 'Question 2: how do I distribute -2(x - 4)?',
      deviceId: 'dev_marcus_chromebook',
      networkTag: 'home-wifi-elena',
    }, '2026-11-25T10:01:00Z')

    const otp1 = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', q1.question.id, '2026-11-25T10:05:00Z')
    const otp2 = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', q2.question.id, '2026-11-25T10:05:00Z')

    // Layer 3: Approving from Marcus's remembered teen Chromebook is ALWAYS blocked (even with valid token + OTP)
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, elena, {
        questionId: q1.question.id,
        tokenId: q1.approvalTokenId!,
        stepUpCode: otp1.challenge.code,
        deviceId: 'dev_marcus_chromebook',
        networkTag: 'home-wifi-elena',
      }, '2026-11-25T10:06:00Z'),
    ).toThrow(/teen-registered device/i)

    // Layer 1: Link for q1 cannot approve q2 (tied to one question)
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, elena, {
        questionId: q2.question.id,
        tokenId: q1.approvalTokenId!,
        stepUpCode: otp2.challenge.code,
        deviceId: 'dev_elena_phone',
      }, '2026-11-25T10:06:00Z'),
    ).toThrow(/tied to a different question/i)

    // Layer 2: Wrong or missing 6-digit step-up code is denied
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, elena, {
        questionId: q1.question.id,
        tokenId: q1.approvalTokenId!,
        stepUpCode: '000000',
        deviceId: 'dev_elena_phone',
      }, '2026-11-25T10:06:00Z'),
    ).toThrow(/Invalid one-time code/i)

    // Layer 1: Expired (>72 h) link is denied
    const expiredOtp = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', q2.question.id, '2026-11-28T10:02:00Z')
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, elena, {
        questionId: q2.question.id,
        tokenId: q2.approvalTokenId!,
        stepUpCode: expiredOtp.challenge.code,
        deviceId: 'dev_elena_phone',
      }, '2026-11-28T10:02:30Z'),
    ).toThrow(/expired/i)

    // Valid approval on Elena's phone succeeds and consumes both link and OTP
    const approved = approveQuestionWithLinkAndCode(adapter, elena, {
      questionId: q1.question.id,
      tokenId: q1.approvalTokenId!,
      stepUpCode: otp1.challenge.code,
      deviceId: 'dev_elena_phone',
    }, '2026-11-25T10:06:00Z')
    expect(approved.askQuestions.find((x) => x.id === q1.question.id)?.status).toBe('queued_for_mentor')

    // Layer 1 single-use check: reusing token or OTP fails even if question status were reset
    const replayOtp = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', q1.question.id, '2026-11-25T10:07:00Z')
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, elena, {
        questionId: q1.question.id,
        tokenId: q1.approvalTokenId!,
        stepUpCode: replayOtp.challenge.code,
        deviceId: 'dev_elena_phone',
      }, '2026-11-25T10:07:10Z'),
    ).toThrow(PortalAccessError)
  })

  it('enforces Layers 4, 5, 6 ("Was this you?" pull-back + lock, fast/same-device/same-network flags, required "Approved by parent" stamp)', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const marcus = buildChildActor(seed, 'child_marcus')
    const samuel = buildMentorActor(seed, 'mentor_samuel')

    // Layer 5: Written on unregistered shared laptop on home Wi-Fi, then approved 5 seconds later on same device + network
    const fastAsk = submitAskQuestion(adapter, marcus, 'child_marcus', {
      text: 'Quick question written on shared laptop',
      deviceId: 'dev_shared_home_laptop',
      networkTag: 'home-wifi-elena',
    }, '2026-11-25T12:00:00Z')
    const fastOtp = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', fastAsk.question.id, '2026-11-25T12:00:02Z')
    const afterFastApprove = approveQuestionWithLinkAndCode(adapter, elena, {
      questionId: fastAsk.question.id,
      tokenId: fastAsk.approvalTokenId!,
      stepUpCode: fastOtp.challenge.code,
      deviceId: 'dev_shared_home_laptop',
      networkTag: 'home-wifi-elena',
    }, '2026-11-25T12:00:05Z')

    const queuedQ = afterFastApprove.askQuestions.find((q) => q.id === fastAsk.question.id)!
    expect(queuedQ.suspiciousFlags).toEqual(['approved_within_seconds', 'same_device_as_writer', 'same_network_as_writer'])
    expect(queuedQ.approvalDelaySeconds).toBe(5)

    // Layer 6: Stamp present -> Mr. Sam can open it; missing stamp -> CANNOT open!
    const opened = openMentorQuestion(afterFastApprove, samuel, queuedQ.id)
    expect(opened.stampLabel).toBe('Approved by parent, 2026-11-25 12:00 UTC')

    const unstampedState = structuredClone(afterFastApprove)
    unstampedState.askQuestions.find((q) => q.id === queuedQ.id)!.parentApprovalStamp = null
    expect(can(samuel, 'view', { type: 'ask_question', record: unstampedState.askQuestions.find((q) => q.id === queuedQ.id)! })).toBe(false)
    expect(listTodayAskQueue(unstampedState, samuel)).toEqual([])
    expect(() => openMentorQuestion(unstampedState, samuel, queuedQ.id)).toThrow(/Approved by parent/i)

    // Layer 4: "Was this you?" email arrived with one-tap pull-back token -> pulls question back from Mr. Sam and locks approvals
    const wtyEmail = afterFastApprove.inbox.find((e) => e.kind === 'approval_receipt_check' && e.relatedQuestionId === queuedQ.id)!
    expect(wtyEmail).toBeDefined()
    expect(wtyEmail.subject).toMatch(/Was this you\?/i)

    const afterPullBack = pullBackApprovalAndLock(adapter, 'hh_elena', queuedQ.id, wtyEmail.pullBackTokenId!, '2026-11-25T12:01:00Z')
    expect(listTodayAskQueue(afterPullBack, samuel)).toEqual([])
    expect(() => openMentorQuestion(afterPullBack, samuel, queuedQ.id)).toThrow(/pulled back/i)
    expect(afterPullBack.households.find((h) => h.id === 'hh_elena')?.approvalsLockedAt).toBe('2026-11-25T12:01:00Z')

    // While locked, even a brand-new question cannot be approved until parent unlocks with a fresh code
    const blockedAsk = submitAskQuestion(adapter, marcus, 'child_marcus', { text: 'Another question while locked' }, '2026-11-25T12:02:00Z')
    const blockedOtp = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', blockedAsk.question.id, '2026-11-25T12:02:30Z')
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, elena, {
        questionId: blockedAsk.question.id,
        tokenId: blockedAsk.approvalTokenId!,
        stepUpCode: blockedOtp.challenge.code,
        deviceId: 'dev_elena_phone',
      }, '2026-11-25T12:03:00Z'),
    ).toThrow(/Approvals are locked/i)

    // Unlocking requires a fresh parent code (and never works from teen device)
    const unlockOtp = requestParentStepUpCode(adapter, 'hh_elena', 'unlock_approvals', null, '2026-11-25T12:04:00Z')
    expect(() => unlockParentApprovals(adapter, elena, 'hh_elena', unlockOtp.challenge.code, 'dev_marcus_chromebook', '2026-11-25T12:04:30Z')).toThrow(/teen-registered device/i)
    const unlocked = unlockParentApprovals(adapter, elena, 'hh_elena', unlockOtp.challenge.code, 'dev_elena_phone', '2026-11-25T12:05:00Z')
    expect(unlocked.households.find((h) => h.id === 'hh_elena')?.approvalsLockedAt).toBeNull()
  })

  it('enforces Layer 7 (parent email change requires old-address confirmation + 48 h hold) and Layer 8 (append-only approval log)', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const priya = buildParentActor(seed, 'hh_priya')
    const marcus = buildChildActor(seed, 'child_marcus')
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const mentorB = buildMentorActor(seed, 'mentor_b')

    const otp = requestParentStepUpCode(adapter, 'hh_elena', 'change_parent_email', null, '2026-11-25T08:00:00Z')
    const requested = requestParentEmailChange(adapter, elena, 'hh_elena', 'elena.new@family.example', otp.challenge.code, 'dev_elena_phone', '2026-11-25T08:01:00Z')
    const confirmEmail = requested.inbox.find((e) => e.kind === 'email_change_confirm')!
    expect(confirmEmail.to).toBe('elena.demo@family.example')

    // Cannot finalize before old address confirms
    expect(() => finalizeParentEmailChange(adapter, 'hh_elena', '2026-11-29T08:01:00Z')).toThrow(/Old parent email address must confirm/i)

    // Confirm from old address -> starts mandatory 48 h hold
    confirmOldEmailForChange(adapter, elena, 'hh_elena', confirmEmail.emailChangeConfirmTokenId!, '2026-11-25T09:00:00Z')

    // Finalizing at 47 h 59 m is DENIED
    expect(() => finalizeParentEmailChange(adapter, 'hh_elena', '2026-11-27T08:59:00Z')).toThrow(/48-hour safety hold/i)
    expect(adapter.load().households.find((h) => h.id === 'hh_elena')?.parentEmail).toBe('elena.demo@family.example')

    // Finalizing at 48 h 01 m SUCCEEDS
    const completed = finalizeParentEmailChange(adapter, 'hh_elena', '2026-11-27T09:01:00Z')
    expect(completed.households.find((h) => h.id === 'hh_elena')?.parentEmail).toBe('elena.new@family.example')

    // Cancel path on Priya's household
    const priyaOtp = requestParentStepUpCode(adapter, 'hh_priya', 'change_parent_email', null, '2026-11-25T10:00:00Z')
    requestParentEmailChange(adapter, priya, 'hh_priya', 'priya.other@family.example', priyaOtp.challenge.code, 'dev_priya_phone', '2026-11-25T10:01:00Z')
    const cancelled = cancelParentEmailChange(adapter, priya, 'hh_priya', '2026-11-25T10:05:00Z')
    expect(cancelled.households.find((h) => h.id === 'hh_priya')?.pendingEmailChange?.cancelledAt).toBe('2026-11-25T10:05:00Z')

    // Layer 8: Append-only approval log visibility & immutability
    const live = adapter.load()
    expect(listVisibleApprovalLogs(live, elena).every((l) => l.householdId === 'hh_elena')).toBe(true)
    expect(listVisibleApprovalLogs(live, samuel).length).toBeGreaterThanOrEqual(listVisibleApprovalLogs(live, elena).length)
    expect(listVisibleApprovalLogs(live, marcus)).toEqual([])
    expect(listVisibleApprovalLogs(live, mentorB)).toEqual([])

    const tampered = structuredClone(live)
    tampered.approvalLogs.pop()
    expect(() => adapter.save(tampered)).toThrow(/append-only/i)

    const mutated = structuredClone(live)
    mutated.approvalLogs[0]!.detail = 'tampered'
    expect(() => adapter.save(mutated)).toThrow(/append-only/i)
  })

  it('enforces Acceptance Row #5 (forwarded sign-in link reaches teen profile + PIN only, never parent powers), Layer 9 (remembered Chromebook + revoke), Acceptance Row #6 (only verified parent email forward releases), and 18+ adult bypass', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const forwardedLink = buildForwardedSignInActor(seed, 'hh_elena')
    const marcus = buildChildActor(seed, 'child_marcus')
    const samuel = buildMentorActor(seed, 'mentor_samuel')

    // Acceptance Row #5: Teen gets parent's forwarded sign-in link -> can open ONLY own teen profile with PIN
    expect(() => unlockTeenFromForwardedSignIn(adapter, forwardedLink, 'child_marcus', '9999')).toThrow(/Incorrect profile PIN/i)
    const teenSession = unlockTeenFromForwardedSignIn(adapter, forwardedLink, 'child_marcus', '1234', '2026-11-25T14:00:00Z')
    expect(teenSession.childActor).toEqual({ kind: 'child', householdId: 'hh_elena', childId: 'child_marcus' })

    // Forwarded link CANNOT approve question, change settings, buy anything, or change parent email
    const q = submitAskQuestion(adapter, marcus, 'child_marcus', { text: 'Need help on equations' }, '2026-11-25T14:01:00Z')
    const fakeOtp = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', q.question.id, '2026-11-25T14:02:00Z')
    expect(() =>
      approveQuestionWithLinkAndCode(adapter, forwardedLink, {
        questionId: q.question.id,
        tokenId: q.approvalTokenId!,
        stepUpCode: fakeOtp.challenge.code,
        deviceId: 'dev_elena_phone',
      }, '2026-11-25T14:03:00Z'),
    ).toThrow(PortalAccessError)
    expect(() =>
      updateFourSettings(adapter, forwardedLink, 'hh_elena', 'child_marcus', {
        askMode: 'off', autoShow: false, approvedFunGames: [], joinRooms: false, emailMode: 'everything',
      }),
    ).toThrow(PortalAccessError)
    const billOtp = requestParentStepUpCode(adapter, 'hh_elena', 'billing_action', null, '2026-11-25T14:03:00Z')
    expect(() => authorizeParentBillingAction(adapter, forwardedLink, 'hh_elena', '$50 lesson', billOtp.challenge.code)).toThrow(PortalAccessError)
    const emailOtp = requestParentStepUpCode(adapter, 'hh_elena', 'change_parent_email', null, '2026-11-25T14:03:00Z')
    expect(() => requestParentEmailChange(adapter, forwardedLink, 'hh_elena', 'teen@school.example', emailOtp.challenge.code)).toThrow(PortalAccessError)

    // Verified parent WITH fresh step-up code CAN authorize purchase
    const paid = authorizeParentBillingAction(adapter, elena, 'hh_elena', '60-min private lesson ($50)', billOtp.challenge.code, 'dev_elena_phone', '2026-11-25T14:04:00Z')
    expect(paid.receipt).toContain('verified by parent step-up code')

    // Acceptance Row #6: Teen forwards question email from their own address -> DENIED; only verified parent address releases it
    expect(() =>
      approveQuestionByEmailForward(adapter, {
        questionId: q.question.id,
        fromEmail: 'marcus.teen@school.example',
        deviceId: 'dev_elena_phone',
      }, '2026-11-25T14:05:00Z'),
    ).toThrow(/verified parent email address/i)
    expect(listTodayAskQueue(adapter.load(), samuel)).toEqual([])

    const afterParentForward = approveQuestionByEmailForward(adapter, {
      questionId: q.question.id,
      fromEmail: 'elena.demo@family.example',
      deviceId: 'dev_elena_phone',
    }, '2026-11-25T14:06:00Z')
    const releasedQ = afterParentForward.askQuestions.find((x) => x.id === q.question.id)!
    expect(releasedQ.status).toBe('queued_for_mentor')
    expect(releasedQ.parentApprovalStamp?.method).toBe('verified_email_forward')
    expect(listTodayAskQueue(afterParentForward, samuel).map((x) => x.id)).toContain(q.question.id)

    // Layer 9: Parent remembers a teen Chromebook -> teen auto-signs-in with PIN -> parent revokes -> blocked immediately
    const devOtp = requestParentStepUpCode(adapter, 'hh_elena', 'manage_devices', null, '2026-11-25T14:10:00Z')
    const rem = rememberTeenDevice(adapter, elena, 'hh_elena', {
      childId: 'child_marcus',
      label: 'Marcus School Chromebook',
      networkTag: 'school-wifi',
      stepUpCode: devOtp.challenge.code,
    }, '2026-11-25T14:11:00Z')
    const signedIn = signInRememberedTeenDevice(rem.state, rem.device.id, '1234')
    expect(signedIn.actor).toEqual({ kind: 'child', householdId: 'hh_elena', childId: 'child_marcus' })

    const afterRevoke = revokeRegisteredDevice(adapter, elena, 'hh_elena', rem.device.id, '2026-11-25T14:15:00Z')
    expect(() => signInRememberedTeenDevice(afterRevoke, rem.device.id, '1234')).toThrow(/revoked/i)

    // Adults (18+): none of the parent-approval layers apply; questions go straight to Mr. Sam
    const withAdult = saveChildProfile(adapter, elena, 'hh_elena', {
      nickname: 'Jordan (18+)',
      level: 'Algebra II',
      firstConversationLine: 'Refreshing algebra for college placement.',
      isAdultLearner: true,
    })
    const adultProfile = withAdult.children.find((c) => c.nickname === 'Jordan (18+)')!
    const adultActor = buildChildActor(withAdult, adultProfile.id)
    const adultAsk = submitAskQuestion(adapter, adultActor, adultProfile.id, { text: 'Direct 18+ question on quadratics' }, '2026-11-25T15:00:00Z')
    expect(adultAsk.question.adultDirectBypass).toBe(true)
    expect(adultAsk.question.status).toBe('queued_for_mentor')
    expect(openMentorQuestion(adultAsk.state, samuel, adultAsk.question.id).stampLabel).toMatch(/Adult learner \(18\+\)/i)
  })

  it('walks through teen-device block, unverified forward denial, verified approval + "Was this you?" pull-back, forwarded sign-in chooser, and append-only approval log in UI', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    // 1. Marcus submits a question from his Chromebook
    await user.click(await screen.findByRole('tab', { name: /child profile/i }, { timeout: 10_000 }))
    await user.selectOptions(screen.getByLabelText(/active simulated device/i), 'dev_marcus_chromebook')
    await user.type(screen.getByLabelText(/your math question/i), 'Why is (-2)(-3) positive?')
    await user.click(screen.getByRole('button', { name: /^send question$/i }))

    // 2. Simulated Inbox: approving on Marcus's teen Chromebook is BLOCKED (Layer 3)
    await user.click(screen.getByRole('tab', { name: /simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /send one-time code/i }))
    await user.click(screen.getByRole('button', { name: /approve with link \+ code/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/teen-registered device/i)

    // 3. Teen tries forwarding from their own address -> REJECTED (Acceptance Row #6)
    await user.selectOptions(screen.getByLabelText(/active simulated device/i), 'dev_elena_phone')
    const fwdInput = screen.getByLabelText(/forward sender email/i)
    await user.clear(fwdInput)
    await user.type(fwdInput, 'marcus.teen@school.example')
    await user.click(screen.getByRole('button', { name: /forward from this address/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/verified parent email address/i)

    // 4. Elena approves on her parent phone -> "Was this you?" email appears -> one-tap Pull back & lock removes from Mr. Sam
    await user.click(screen.getByRole('button', { name: /approve with link \+ code/i }))
    await user.click(screen.getByRole('tab', { name: /mentor view/i }))
    expect(within(screen.getByTestId('mentor-ask-queue')).getByText(/Approved by parent,/i)).toBeVisible()

    await user.click(screen.getByRole('tab', { name: /simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /pull back & lock approvals/i }))
    await user.click(screen.getByRole('tab', { name: /mentor view/i }))
    expect(screen.queryByTestId('mentor-ask-queue')).toBeNull()

    // Admin tab shows the append-only approval log
    await user.click(screen.getByRole('tab', { name: /^admin$/i }))
    expect(screen.getByTestId('admin-approval-log')).toHaveTextContent(/approval_pulled_back_and_locked/i)

    // 5. Forwarded sign-in link opens profile chooser ONLY (Acceptance Row #5) + no Auto-send in parent settings
    await user.click(screen.getByRole('tab', { name: /parent account/i }))
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))
    await user.click(screen.getByRole('button', { name: /open simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /open as forwarded link \(teen\)/i }))
    expect(screen.getByTestId('forwarded-signin-chooser')).toBeVisible()
    expect(screen.queryByRole('tab', { name: /settings/i })).toBeNull()
  }, 30_000)
})
