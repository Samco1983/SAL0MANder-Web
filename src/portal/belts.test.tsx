import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildChildActor, buildMentorActor } from './access'
import { submitAskQuestion } from './askActions'
import { awardCosmeticPoints, formatParentBeltSentence, getCourseLadder, getNextBeltStep } from './belts'
import { awardBeltPassed, sendWorkReviewReply } from './mentorActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'
import { openOrCreateWorkRecord } from './workActions'

describe('portal Phase 1 — PR 6 belts, stripes, points, badges, and parent sentence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('computes stripes on reviewed work, never auto-awards belts, enforces teach-it for Black, keeps points cosmetics-only, and awards starter badges', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const leo = buildChildActor(seed, 'child_leo')
    const nina = buildChildActor(seed, 'child_nina')

    // Per-course 7th grade config: 7 units = 7 stripes, belts at 2/4/6/7 (Black = teach_it)
    const g7 = getCourseLadder('7th Grade Math')
    expect(g7.units).toHaveLength(7)
    expect(g7.beltThresholds.map((b) => [b.belt, b.stripes, b.testType])).toEqual([
      ['yellow', 2, 'whiteboard'],
      ['green', 4, 'whiteboard'],
      ['purple', 6, 'whiteboard'],
      ['black', 7, 'teach_it'],
    ])

    // Reviewing Marcus's submitted work (with open response) computes +1 stripe (3 -> 4) & grants 'Explained it',
    // crossing green threshold (4), yet NEVER auto-awards green belt!
    const reviewed = sendWorkReviewReply(adapter, samuel, 'work_marcus_u2', 'Great explanation!')
    const marcusAfterReview = reviewed.state.children.find((c) => c.id === 'child_marcus')!
    expect(reviewed.stripeEarned).toBe(true)
    expect(marcusAfterReview.stripesEarned).toBe(4)
    expect(marcusAfterReview.currentBelt).toBe('yellow')
    expect(getNextBeltStep(marcusAfterReview)?.eligible).toBe(true)
    expect(reviewed.state.badges.some((b) => b.childId === 'child_marcus' && b.kind === 'explained_it')).toBe(true)
    expect(formatParentBeltSentence(marcusAfterReview)).toMatch(/Marcus is a yellow belt in 7th Grade Math, 4 units in — ready for the live green belt test\./)

    // Entertainment / cosmetic points NEVER alter stripes or belt
    const afterPts = awardCosmeticPoints(adapter, leo, 'child_leo', 50, 'Finished Neon Dash')
    const leoAfterPts = afterPts.children.find((c) => c.id === 'child_leo')!
    expect(afterPts.points.find((p) => p.childId === 'child_leo')?.balance).toBe(260)
    expect(leoAfterPts.stripesEarned).toBe(4)
    expect(leoAfterPts.currentBelt).toBe('green')

    // First question badge granted on Ask; Came back badge granted after 14+ days away
    const asked = submitAskQuestion(adapter, leo, 'child_leo', { text: 'How do I check sign rules?' })
    expect(asked.state.badges.some((b) => b.childId === 'child_leo' && b.kind === 'first_question')).toBe(true)
    const cameBack = openOrCreateWorkRecord(adapter, nina, 'child_nina', undefined, '2026-11-30T18:00:00Z')
    expect(cameBack.state.badges.some((b) => b.childId === 'child_nina' && b.kind === 'came_back')).toBe(true)

    // Belt award is strictly human-logged; Black belt requires teachItCompleted=true
    const toPurple = awardBeltPassed(adapter, samuel, 'child_leo')
    expect(toPurple.children.find((c) => c.id === 'child_leo')?.currentBelt).toBe('purple')
    expect(() => awardBeltPassed(adapter, samuel, 'child_leo')).toThrow(PortalAccessError)
    const toBlack = awardBeltPassed(adapter, samuel, 'child_leo', { teachItCompleted: true })
    expect(toBlack.children.find((c) => c.id === 'child_leo')?.currentBelt).toBe('black')
    expect(formatParentBeltSentence(toBlack.children.find((c) => c.id === 'child_leo')!)).toMatch(/holds a black belt/i)
  })

  it('shows parent one-sentence belt summary (no chart) and cosmetic-only fun game points in UI', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    // Sign in as Elena -> sees one plain belt sentence for Marcus (no chart)
    await user.click(await screen.findByRole('tab', { name: /parent account/i }, { timeout: 10_000 }))
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))
    await user.click(screen.getByRole('button', { name: /open simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /open sign-in link/i }))
    expect(screen.getByTestId('parent-belt-sentence-child_marcus')).toHaveTextContent(
      /Marcus is a yellow belt in 7th Grade Math, 3 units in\. 1 more unit and Marcus can test for green\./,
    )

    // Child Profile -> Leo plays approved fun game: cosmetic points increase, belt & stripes unchanged
    await user.click(screen.getByRole('tab', { name: /^child profile$/i }))
    await user.click(screen.getByRole('button', { name: /Leo \(green\)/i }))
    expect(screen.getByText(/Points: 210 pts/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /play \(\+10 cosmetic pts\)/i }))
    expect(screen.getByText(/Points: 220 pts/i)).toBeVisible()
    expect(screen.getByText(/Green Belt · 4 \/ 7 stripes/i)).toBeVisible()
  }, 20_000)
})
