import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { PORTAL_DEMO_BANNER } from '@routes/portal/PortalPage'
import { buildChildActor, buildMentorActor, buildParentActor } from './access'
import { runAccessChecks } from './accessChecks'
import { createSeedState } from './seed'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'
import { ChildProfileSchema } from './types'

describe('portal Phase 1 — data model, access policy, and seed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('seeds 3 households, 5 kids, Samuel (owner+admin+mentor), Mentor B assigned, Mentor C unassigned', () => {
    const seed = createSeedState()
    expect(seed.households).toHaveLength(3)
    expect(seed.children).toHaveLength(5)
    expect(seed.mentors.find((m) => m.id === 'mentor_samuel')?.roles).toEqual(['owner', 'admin', 'mentor'])
    expect(seed.assignments.filter((a) => a.mentorId === 'mentor_b' && a.revokedAt === null)).toHaveLength(1)
    expect(seed.assignments.filter((a) => a.mentorId === 'mentor_c' && a.revokedAt === null)).toHaveLength(0)
  })

  it('passes all centralized can() access checks and rejects forbidden child fields', () => {
    const results = runAccessChecks(createSeedState())
    expect(results).toHaveLength(8)
    for (const check of results) expect(check.passed, `${check.id}: ${check.detail}`).toBe(true)

    const child = createSeedState().children[0]!
    for (const bad of ['email', 'password', 'lastName', 'photo', 'video', 'privateChannel']) {
      expect(ChildProfileSchema.safeParse({ ...child, [bad]: 'x' }).success).toBe(false)
    }
  })

  it('enforces can() inside LocalPortalStorageAdapter for revoke, export, and delete', () => {
    const adapter = new LocalPortalStorageAdapter()
    const state = adapter.reset()
    const elena = buildParentActor(state, 'hh_elena')
    const priya = buildParentActor(state, 'hh_priya')
    const marcus = buildChildActor(state, 'child_marcus')
    const samuel = buildMentorActor(state, 'mentor_samuel')
    const mentorB = buildMentorActor(state, 'mentor_b')

    expect(adapter.listVisibleHouseholds(mentorB).map((h) => h.id)).toEqual(['hh_elena'])
    expect(() => adapter.revokeAssignment(mentorB, 'asgn_b_elena')).toThrow(PortalAccessError)
    expect(() => adapter.exportHousehold(priya, 'hh_elena')).toThrow(PortalAccessError)
    expect(() => adapter.exportHousehold(marcus, 'hh_elena')).toThrow(PortalAccessError)
    expect(() => adapter.exportHousehold(mentorB, 'hh_elena')).toThrow(PortalAccessError)
    expect(() => adapter.deleteHousehold(mentorB, 'hh_elena')).toThrow(PortalAccessError)
    expect(adapter.exportHousehold(elena, 'hh_elena').simulated).toBe(true)

    const afterRevoke = adapter.revokeAssignment(samuel, 'asgn_b_elena')
    expect(adapter.listVisibleHouseholds(buildMentorActor(afterRevoke, 'mentor_b'))).toEqual([])

    const afterDelete = adapter.deleteHousehold(samuel, 'hh_david')
    expect(afterDelete.households.some((h) => h.id === 'hh_david')).toBe(false)
    expect(afterDelete.children.some((c) => c.householdId === 'hh_david')).toBe(false)
  })

  it('renders /portal with the DEMO banner, passing Access Checks, and interactive revocation', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    expect(await screen.findByText(PORTAL_DEMO_BANNER, {}, { timeout: 10_000 })).toBeVisible()
    expect(screen.getByTestId('access-checks-summary')).toHaveTextContent(/PASS · 8\/8 checks passed/)
    expect(screen.getByText(/Mentor B currently sees/i)).toHaveTextContent('1 household(s): Elena')

    await user.click(screen.getByRole('button', { name: /revoke mentor b as mr\. sam/i }))
    expect(screen.getByText(/Mentor B currently sees/i)).toHaveTextContent('0 household(s): none')
  }, 15_000)
})
