import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildChildActor, buildMentorActor, buildParentActor } from './access'
import { requestParentStepUpCode } from './approvalLayers'
import { forwardQuestionToMentor, submitAskQuestion } from './askActions'
import {
  addMentorAccount, assignMentorToHousehold, awardBeltPassed,
  buildFridayDrafts, getMembershipCapacity, listQuietKids,
  listTodayAskQueue, sendAllFridayNotes, sendQuietNudge, sendWorkReviewReply,
} from './mentorActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'

describe('portal Phase 1 — PR 5 Mentor view and Admin page', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('enforces assignment scoping, oldest-first Today queue, quiet nudges, human belt awards, Friday notes, and admin-only actions', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const mentorB = buildMentorActor(seed, 'mentor_b')
    const mentorC = buildMentorActor(seed, 'mentor_c')
    const leo = buildChildActor(seed, 'child_leo')
    const priya = buildParentActor(seed, 'hh_priya')

    // Oldest-first Ask queue ordering (only parent-approved & stamped Leo questions visible to Mr. Sam, never Mentor B/C)
    const firstAsk = submitAskQuestion(adapter, leo, 'child_leo', { text: 'First question', deviceId: 'dev_leo_chromebook' }, '2026-11-24T10:00:00Z')
    const firstOtp = requestParentStepUpCode(adapter, 'hh_priya', 'approve_question', firstAsk.question.id, '2026-11-24T10:05:00Z')
    forwardQuestionToMentor(adapter, priya, firstAsk.question.id, { tokenId: firstAsk.approvalTokenId!, stepUpCode: firstOtp.challenge.code, deviceId: 'dev_priya_phone' }, '2026-11-24T10:06:00Z')
    const secondAsk = submitAskQuestion(adapter, leo, 'child_leo', { text: 'Second question', deviceId: 'dev_leo_chromebook' }, '2026-11-24T11:00:00Z')
    const secondOtp = requestParentStepUpCode(adapter, 'hh_priya', 'approve_question', secondAsk.question.id, '2026-11-24T11:05:00Z')
    const afterSecondState = forwardQuestionToMentor(adapter, priya, secondAsk.question.id, { tokenId: secondAsk.approvalTokenId!, stepUpCode: secondOtp.challenge.code, deviceId: 'dev_priya_phone' }, '2026-11-24T11:06:00Z')
    expect(listTodayAskQueue(afterSecondState, samuel).map((q) => q.text)).toEqual(['First question', 'Second question'])
    expect(listTodayAskQueue(afterSecondState, mentorB)).toEqual([])
    expect(listTodayAskQueue(afterSecondState, mentorC)).toEqual([])

    // Quiet list detects 7+ days inactive Nina for assigned Mr. Sam only; nudge goes to parent email
    expect(listQuietKids(afterSecondState, samuel).map((c) => c.id)).toEqual(['child_nina'])
    expect(listQuietKids(afterSecondState, mentorB)).toEqual([])
    expect(() => sendQuietNudge(adapter, mentorB, 'child_nina')).toThrow(PortalAccessError)
    const afterNudge = sendQuietNudge(adapter, samuel, 'child_nina')
    expect(afterNudge.inbox[0]?.to).toBe('priya.demo@family.example')

    // Work review reply goes parent-first (Marcus autoShow=false -> sent_to_parent) and marks work reviewed
    const rev = sendWorkReviewReply(adapter, mentorB, 'work_marcus_u2', 'Nice sign check on #1!')
    expect(rev.shownToChild).toBe(false)
    expect(rev.state.workRecords.find((w) => w.id === 'work_marcus_u2')?.status).toBe('reviewed')

    // Belt award requires active assignment (Mentor B denied on Leo; Mr. Sam allowed and logged)
    expect(() => awardBeltPassed(adapter, mentorB, 'child_leo')).toThrow(PortalAccessError)
    const afterBelt = awardBeltPassed(adapter, samuel, 'child_leo')
    expect(afterBelt.children.find((c) => c.id === 'child_leo')?.currentBelt).toBe('purple')
    expect(afterBelt.auditLogs.some((l) => l.action === 'award_belt' && l.recordId === 'child_leo')).toBe(true)

    // Friday drafts include quiet-kid version for Nina; Send all skips unconsented David (4 verified kids sent)
    const drafts = buildFridayDrafts(afterBelt, samuel)
    expect(drafts.find((d) => d.childId === 'child_nina')?.quiet).toBe(true)
    const fri = sendAllFridayNotes(adapter, samuel, drafts)
    expect(fri.sentCount).toBe(4)

    // Admin actions denied to Mentor B; allowed to Mr. Sam (add mentor, assign, cap 100)
    expect(() => addMentorAccount(adapter, mentorB, { displayName: 'Nope', email: 'nope@sal0mander.example' })).toThrow(PortalAccessError)
    expect(() => assignMentorToHousehold(adapter, mentorB, 'mentor_c', 'hh_elena')).toThrow(PortalAccessError)
    const added = addMentorAccount(adapter, samuel, { displayName: 'Mentor Alex', email: 'mentor.alex@sal0mander.example' })
    const newMentor = added.mentors.find((m) => m.displayName === 'Mentor Alex')!
    const assigned = assignMentorToHousehold(adapter, buildMentorActor(added, 'mentor_samuel'), newMentor.id, 'hh_priya')
    expect(assigned.assignments.some((a) => a.mentorId === newMentor.id && a.householdId === 'hh_priya' && a.revokedAt === null)).toBe(true)
    expect(getMembershipCapacity(assigned)).toEqual({ activeCount: 3, waitlistedCount: 0, cap: 100, remaining: 97 })
  })

  it('navigates Mentor View (Today, Kids, Friday, Scripts, Admin) and enforces Mentor B/C isolation in UI', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    await user.click(await screen.findByRole('tab', { name: /mentor view/i }, { timeout: 10_000 }))

    // Mr. Sam sees Today queue (submitted Marcus set), quiet list (Nina), belt tests due, and Admin tab
    expect(screen.getByText(/Quiet 12 days/i)).toBeVisible()
    expect(screen.getByText(/yellow → green \(3\/4 stripes/i)).toBeVisible()
    expect(screen.getByRole('tab', { name: /^admin$/i })).toBeVisible()

    // Mentor C (unassigned) sees 0 kids and NO Admin tab
    await user.click(screen.getByRole('button', { name: /Mentor Devon \(Mentor C\)/i }))
    expect(screen.queryByRole('tab', { name: /^admin$/i })).toBeNull()
    expect(screen.getByText(/Assigned kids visible:/i)).toHaveTextContent('0')

    // Switch back to Mr. Sam -> Kids page (read-only parent settings + Belt test passed)
    await user.click(screen.getByRole('button', { name: /Mr\. Sam/i }))
    await user.click(screen.getByRole('tab', { name: /kids \(5\)/i }))
    expect(screen.getByText(/Parent settings \(read-only\)/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /belt test passed/i }))
    expect(screen.getByText(/Logged live belt test passed for Marcus/i)).toBeVisible()

    // Friday note builder -> quiet-kid version for Nina + Send all
    await user.click(screen.getByRole('tab', { name: /^friday$/i }))
    expect(screen.getByText(/Quiet-kid version/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /send all friday notes/i }))
    expect(screen.getByText(/Sent 4 Friday note\(s\)/i)).toBeVisible()

    // Script library stub
    await user.click(screen.getByRole('tab', { name: /script library/i }))
    expect(screen.getByText(/Unit 1: Ratios & Proportions/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Unit 2$/i }))
    expect(screen.getByText(/Subtracting a negative moves right/i)).toBeVisible()

    // Admin tab: cap 100, add mentor, audit log visible
    await user.click(screen.getByRole('tab', { name: /^admin$/i }))
    expect(screen.getByText(/Active households: 3 \/ 100/i)).toBeVisible()
    await user.type(screen.getByLabelText(/display name/i), 'Mentor Riley')
    await user.type(screen.getByLabelText(/fictional email/i), 'riley.demo@sal0mander.example')
    await user.click(screen.getByRole('button', { name: /^add mentor$/i }))
    expect(screen.getByText(/Added mentor Mentor Riley/i)).toBeVisible()
    expect(screen.getByTestId('admin-audit-log')).toBeVisible()
  }, 25_000)
})
