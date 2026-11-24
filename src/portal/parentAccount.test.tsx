import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildParentActor } from './access'
import {
  AUTO_SHOW_WARNING,
  completeParentConsent,
  listParentReceipts,
  saveChildProfile,
  showFeedbackToChild,
  updateFourSettings,
  withdrawParentConsent,
} from './parentActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'

describe('portal Phase 1 — PR 2 parent account', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('enforces consent gates, parent-only actions, and household-scoped receipts (never admin AuditLog)', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const priya = buildParentActor(seed, 'hh_priya')
    const david = buildParentActor(seed, 'hh_david')

    // Cross-household parent actions are denied
    expect(() => completeParentConsent(adapter, priya, 'hh_elena', 'simulated_form')).toThrow(PortalAccessError)
    expect(() => showFeedbackToChild(adapter, priya, 'fb_marcus_waiting')).toThrow(PortalAccessError)
    expect(() => saveChildProfile(adapter, priya, 'hh_elena', { nickname: 'Nope', level: '6th', firstConversationLine: '' })).toThrow(PortalAccessError)

    // Unconsented household (David) keeps askMode off, autoShow false, and joinRooms false even if requested
    const beforeConsent = updateFourSettings(adapter, david, 'hh_david', 'child_kai', {
      askMode: 'auto', autoShow: true, approvedFunGames: ['moon-gate'], joinRooms: true, emailMode: 'everything',
    })
    expect(beforeConsent.children.find((c) => c.id === 'child_kai')?.askMode).toBe('off')
    expect(beforeConsent.children.find((c) => c.id === 'child_kai')?.autoShow).toBe(false)
    expect(beforeConsent.children.find((c) => c.id === 'child_kai')?.joinRooms).toBe(false)

    // Complete consent -> timestamp recorded -> settings unlock; withdraw -> records withdrawnAt, keeps verifiedAt, forces autoShow=false
    const consented = completeParentConsent(adapter, david, 'hh_david', 'simulated_call', '2026-11-24T15:00:00Z')
    expect(consented.households.find((h) => h.id === 'hh_david')?.consentRecord.verifiedAt).toBe('2026-11-24T15:00:00Z')
    const unlocked = updateFourSettings(adapter, david, 'hh_david', 'child_kai', {
      askMode: 'review', autoShow: true, approvedFunGames: ['neon-dash'], joinRooms: true, emailMode: 'friday_only',
    })
    expect(unlocked.children.find((c) => c.id === 'child_kai')?.askMode).toBe('review')
    expect(unlocked.children.find((c) => c.id === 'child_kai')?.autoShow).toBe(true)
    expect(unlocked.children.find((c) => c.id === 'child_kai')?.approvedGames).toEqual(['act_integer_operations', 'neon-dash'])

    const withdrawn = withdrawParentConsent(adapter, david, 'hh_david', '2026-11-24T15:05:00Z')
    const davidHh = withdrawn.households.find((h) => h.id === 'hh_david')!
    expect(davidHh.consentRecord.verifiedAt).toBe('2026-11-24T15:00:00Z')
    expect(davidHh.consentRecord.withdrawnAt).toBe('2026-11-24T15:05:00Z')
    expect(withdrawn.children.find((c) => c.id === 'child_kai')?.askMode).toBe('off')
    expect(withdrawn.children.find((c) => c.id === 'child_kai')?.autoShow).toBe(false)
    expect(withdrawn.children.find((c) => c.id === 'child_kai')?.joinRooms).toBe(false)
    const davidReceipts = listParentReceipts(withdrawn, david)
    expect(davidReceipts.some((r) => r.label.includes('Consent withdrawn') && r.at === '2026-11-24T15:05:00Z')).toBe(true)

    // Newly created child profiles use opaque random IDs (never containing nickname)
    const withNewKid = saveChildProfile(adapter, elena, 'hh_elena', { nickname: 'Toby', level: '6th', firstConversationLine: 'Hi' })
    const toby = withNewKid.children.find((c) => c.nickname === 'Toby')!
    expect(toby.id).toMatch(/^child_[0-9a-f]{12}$/)
    expect(toby.id.toLowerCase()).not.toContain('toby')

    // Parent receipts expose household consent/approvals only — never admin assign_mentor audit entries
    const receipts = listParentReceipts(withNewKid, elena)
    expect(receipts.some((r) => r.kind === 'consent')).toBe(true)
    expect(receipts.some((r) => r.label.includes('assign_mentor'))).toBe(false)
  })

  it('completes simulated email-link sign-in, Show-to-child, child profile create, 4-item settings, export, and delete in UI', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    // Switch to Parent Account and send simulated sign-in link for Elena
    await user.click(await screen.findByRole('tab', { name: /parent account/i }, { timeout: 10_000 }))
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))
    await user.click(screen.getByRole('button', { name: /open simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /open sign-in link/i }))

    expect(screen.getByText(/Elena’s Membership/i)).toBeVisible()
    // Before tap: waiting reply is hidden in Marcus's child preview
    const marcusPreview = screen.getByTestId('child-preview-child_marcus')
    expect(within(marcusPreview).queryByText(/Great catch checking #4/i)).toBeNull()
    expect(within(marcusPreview).getByText(/ask your parent/i)).toBeVisible()

    // Tap "Show to Marcus" -> immediately visible in child preview & recorded in family receipts
    await user.click(screen.getByRole('button', { name: /show to marcus/i }))
    expect(within(screen.getByTestId('child-preview-child_marcus')).getByText(/Great catch checking #4/i)).toBeVisible()
    expect(screen.getByText(/Showed mentor reply to Marcus/i)).toBeVisible()

    // Friday notes show Marcus only (not Priya's Leo)
    expect(screen.getByText(/Marcus caught his own sign flip/i)).toBeVisible()
    expect(screen.queryByText(/Leo is ready for his green belt/i)).toBeNull()

    // Create a new child profile under Elena's membership
    await user.click(screen.getByRole('tab', { name: /child profiles/i }))
    await user.type(screen.getByLabelText(/first name or nickname/i), 'Toby')
    await user.click(screen.getByRole('button', { name: /create child profile/i }))
    expect(screen.getByText(/Toby \(7th Grade Math\)/i)).toBeVisible()

    // Settings tab displays the five controls + auto-show warning
    await user.click(screen.getByRole('tab', { name: /settings \(5\)/i }))
    expect(screen.getByText(/1\. Questions/i)).toBeVisible()
    expect(screen.getByText(/2\. Show replies/i)).toBeVisible()
    expect(screen.getByText(AUTO_SHOW_WARNING)).toBeVisible()
    expect(screen.getByText(/3\. Games/i)).toBeVisible()
    expect(screen.getByText(/4\. Emails/i)).toBeVisible()
    expect(screen.getByText(/5\. Mr\. Sam’s voice clips/i)).toBeVisible()

    // Export & Delete flow
    await user.click(screen.getByRole('tab', { name: /parent view/i }))
    await user.click(screen.getByRole('button', { name: /export my family data/i }))
    const exported = screen.getByTestId('household-export').textContent ?? ''
    expect(exported).toContain('"parentName": "Elena"')
    expect(exported).not.toContain('fb_marcus_draft')

    await user.click(screen.getByRole('button', { name: /delete my membership/i }))
    await user.click(screen.getByRole('button', { name: /confirm delete \(elena\)/i }))
    expect(screen.getByText(/Parent sign-in \(simulated email link\)/i)).toBeVisible()
  }, 20_000)
})
