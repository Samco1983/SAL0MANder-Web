import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildChildActor, buildMentorActor, buildParentActor, can } from './access'
import { requestParentStepUpCode } from './approvalLayers'
import {
  ASK_SEND_DISCLOSURE,
  PARENT_REJECTED_CHILD_NOTICE,
  forwardQuestionToMentor,
  sendMentorReplyDemo,
  submitAskQuestion,
} from './askActions'
import { showFeedbackToChild } from './parentActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'
import { openOrCreateWorkRecord, saveWorkDraft, submitWorkRecord } from './workActions'

describe('portal Phase 1 — PR 4 Ask rail (Nov 25 review-first only)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('enforces consent/askMode gates, Review-first only (no Auto-send), step-up approval, rejection hold, worksheet open-response rail, and Show/auto-show reply rules', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const priya = buildParentActor(seed, 'hh_priya')
    const marcus = buildChildActor(seed, 'child_marcus')
    const sofia = buildChildActor(seed, 'child_sofia')
    const leo = buildChildActor(seed, 'child_leo')
    const nina = buildChildActor(seed, 'child_nina')
    const kai = buildChildActor(seed, 'child_kai')
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const mentorB = buildMentorActor(seed, 'mentor_b')

    // Consent pending (Kai) and askMode=off (Sofia) cannot submit questions
    expect(() => submitAskQuestion(adapter, kai, 'child_kai', { text: 'Help?' })).toThrow(PortalAccessError)
    expect(() => submitAskQuestion(adapter, sofia, 'child_sofia', { text: 'Help?' })).toThrow(PortalAccessError)

    // Delivery-failure hold: parent email rejected -> held_undelivered, NEVER shown to mentors, content-free failure notice only
    const held = submitAskQuestion(adapter, marcus, 'child_marcus', {
      text: 'Secret held math question #7',
      photoPlaceholder: { label: 'Notebook page 2', nameCovered: true },
      simulateParentRejected: true,
    })
    expect(held.question.status).toBe('held_undelivered')
    expect(held.question.parentEmailAcceptedAt).toBeNull()
    expect(held.childNotice).toBe(PARENT_REJECTED_CHILD_NOTICE)
    expect(can(samuel, 'view', { type: 'ask_question', record: held.question })).toBe(false)
    expect(can(mentorB, 'view', { type: 'ask_question', record: held.question })).toBe(false)
    expect(() => sendMentorReplyDemo(adapter, samuel, held.question.id, 'Reply')).toThrow(PortalAccessError)
    const failureEmail = held.state.inbox.find((e) => e.kind === 'delivery_failure')
    expect(failureEmail).toBeDefined()
    expect(failureEmail?.body).not.toContain('Secret held math question')

    // Review-first (Marcus): parent inbox only until parent approves with single-use link + fresh code; cross-household parent denied
    const reviewRes = submitAskQuestion(adapter, marcus, 'child_marcus', {
      text: 'Why does 3 - (-5) equal 8?',
      photoPlaceholder: { label: 'Page 14', nameCovered: true },
      deviceId: 'dev_marcus_chromebook',
    }, '2026-11-25T10:00:00Z')
    expect(reviewRes.question.status).toBe('waiting_parent_review')
    expect(reviewRes.approvalTokenId).not.toBeNull()
    expect(can(samuel, 'view', { type: 'ask_question', record: reviewRes.question })).toBe(false)

    const elenaOtp = requestParentStepUpCode(adapter, 'hh_elena', 'approve_question', reviewRes.question.id, '2026-11-25T10:05:00Z')
    expect(() =>
      forwardQuestionToMentor(adapter, priya, reviewRes.question.id, {
        tokenId: reviewRes.approvalTokenId!,
        stepUpCode: elenaOtp.challenge.code,
        deviceId: 'dev_priya_phone',
      }, '2026-11-25T10:06:00Z'),
    ).toThrow(PortalAccessError)

    const forwarded = forwardQuestionToMentor(adapter, elena, reviewRes.question.id, {
      tokenId: reviewRes.approvalTokenId!,
      stepUpCode: elenaOtp.challenge.code,
      deviceId: 'dev_elena_phone',
    }, '2026-11-25T10:06:00Z')
    const fwdQ = forwarded.askQuestions.find((q) => q.id === reviewRes.question.id)!
    expect(fwdQ.parentApprovalStamp?.label).toContain('Approved by parent, 2026-11-25 10:06 UTC')
    expect(can(samuel, 'view', { type: 'ask_question', record: fwdQ })).toBe(true)

    // Reply for Marcus (autoShow=false): sent_to_parent first, hidden from Marcus until Elena taps Show
    const marcusReply = sendMentorReplyDemo(adapter, samuel, fwdQ.id, 'Move right 5 steps from 3.')
    expect(marcusReply.shownToChild).toBe(false)
    const waitingFb = marcusReply.state.feedback.find((f) => f.sentText === 'Move right 5 steps from 3.')!
    expect(can(marcus, 'view', { type: 'feedback', record: waitingFb })).toBe(false)
    const afterShow = showFeedbackToChild(adapter, elena, waitingFb.id)
    expect(can(marcus, 'view', { type: 'feedback', record: afterShow.feedback.find((f) => f.id === waitingFb.id)! })).toBe(true)

    // Leo (Nov 25: no Auto-send — waits for Priya's approval even though Leo has autoShow=true for replies)
    const leoRes = submitAskQuestion(adapter, leo, 'child_leo', {
      text: 'Does (-2)*(-3) always stay positive?',
      deviceId: 'dev_leo_chromebook',
    }, '2026-11-25T11:00:00Z')
    expect(leoRes.question.status).toBe('waiting_parent_review')
    expect(can(samuel, 'view', { type: 'ask_question', record: leoRes.question })).toBe(false)
    const priyaOtp = requestParentStepUpCode(adapter, 'hh_priya', 'approve_question', leoRes.question.id, '2026-11-25T11:05:00Z')
    forwardQuestionToMentor(adapter, priya, leoRes.question.id, {
      tokenId: leoRes.approvalTokenId!,
      stepUpCode: priyaOtp.challenge.code,
      deviceId: 'dev_priya_phone',
    }, '2026-11-25T11:06:00Z')

    const rejReply = sendMentorReplyDemo(adapter, samuel, leoRes.question.id, 'Held reply text', { simulateParentRejected: true })
    expect(rejReply.held).toBe(true)
    expect(rejReply.shownToChild).toBe(false)
    const okReply = sendMentorReplyDemo(adapter, samuel, leoRes.question.id, 'Yes — opposite of an opposite is positive.')
    expect(okReply.shownToChild).toBe(true)

    // Worksheet open response routes through the exact same Ask rail (Nina -> waiting_parent_review)
    const work = openOrCreateWorkRecord(adapter, nina, 'child_nina')
    saveWorkDraft(adapter, nina, work.record.id, work.record.currentRevision, { answers: [], openResponse: 'I drew a number line for #2.' })
    const sub = submitWorkRecord(adapter, nina, work.record.id)
    const wsQ = sub.state.askQuestions.find((q) => q.workRecordId === work.record.id)!
    expect(wsQ.source).toBe('worksheet_open_response')
    expect(wsQ.status).toBe('waiting_parent_review')
    expect(can(samuel, 'view', { type: 'ask_question', record: wsQ })).toBe(false)
  })

  it('walks through Ask form, rejection hold, parent link+OTP approval, parent stamp in Mentor View, and reply Show in UI', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    await user.click(await screen.findByRole('tab', { name: /child profile/i }, { timeout: 10_000 }))

    // Sofia (askMode=off) and Kai (consent pending) have no Ask form
    await user.click(screen.getByRole('button', { name: /Sofia \(white\)/i }))
    expect(screen.getByText(/Ask Mr\. Sam is turned Off/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Kai \(white\)/i }))
    expect(screen.getByText(/Ask Mr\. Sam stays Off until your parent verifies consent/i)).toBeVisible()

    // Marcus (Review-first): sees disclosure, simulates rejected parent email -> held away from Mr. Sam
    await user.click(screen.getByRole('button', { name: /Marcus \(yellow\)/i }))
    expect(screen.getByText(ASK_SEND_DISCLOSURE)).toBeVisible()
    const box = screen.getByLabelText(/Your math question/i)
    await user.type(box, 'Rejected test question')
    await user.click(screen.getByRole('button', { name: /simulate parent email rejected/i }))
    expect(screen.getByTestId('ask-rail-status')).toHaveTextContent(PARENT_REJECTED_CHILD_NOTICE)

    // Marcus sends a Review-first question with 1 photo placeholder ("cover your name")
    await user.type(box, 'How do I check -6 times 3?')
    await user.click(screen.getByLabelText(/Attach 1 photo of written work/i))
    await user.click(screen.getByRole('button', { name: /^send question$/i }))
    expect(screen.getByTestId('ask-rail-status')).toHaveTextContent(/Sent to your parent first/i)

    // Mentor View: neither rejected nor waiting-approval question is in Mr. Sam's queue yet
    await user.click(screen.getByRole('tab', { name: /mentor view/i }))
    expect(screen.queryByTestId('mentor-ask-queue')).toBeNull()

    // Parent requests fresh one-time code & approves with link + code in Simulated Inbox (on Elena's parent phone)
    await user.click(screen.getByRole('tab', { name: /simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /send one-time code/i }))
    await user.click(screen.getByRole('button', { name: /approve with link \+ code/i }))

    await user.click(screen.getByRole('tab', { name: /mentor view/i }))
    const queue = screen.getByTestId('mentor-ask-queue')
    expect(within(queue).getByText(/How do I check -6 times 3\?/i)).toBeVisible()
    expect(within(queue).getByText(/Approved by parent,/i)).toBeVisible()
    expect(within(queue).queryByText(/Rejected test question/i)).toBeNull()
    await user.click(within(queue).getByRole('button', { name: /send reply \(parent first\)/i }))
    expect(screen.getByText(/waiting for "Show to Marcus"/i)).toBeVisible()
  }, 25_000)
})
