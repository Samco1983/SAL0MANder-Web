import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildChildActor, buildMentorActor, buildParentActor } from './access'
import {
  closeRoomHardEnd, createRoomInvite, getRoomClockStatus,
  joinRoom, leaveRoom, openRoomByMentor, respondToRoomInvite,
} from './roomActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'

describe('portal Phase 1 — PR 7 game room invites and clock lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('blocks scheduled-session overlap, respects standing-yes, refuses uninvited/before-open/after-end joins, supports leave/rejoin, and warns at 60s', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const samuel = buildMentorActor(seed, 'mentor_samuel')
    const elena = buildParentActor(seed, 'hh_elena')
    const priya = buildParentActor(seed, 'hh_priya')
    const marcus = buildChildActor(seed, 'child_marcus')
    const sofia = buildChildActor(seed, 'child_sofia')
    const leo = buildChildActor(seed, 'child_leo')

    // Never opens during a scheduled tutoring window (22:00Z - 23:00Z)
    expect(() =>
      createRoomInvite(adapter, samuel, {
        childId: 'child_marcus', gameId: 'moon-gate',
        startsAt: '2026-11-24T22:15:00Z', endsAt: '2026-11-24T22:30:00Z',
      }),
    ).toThrow(PortalAccessError)

    // Standing-yes respected for Leo (joinRooms=true + neon-dash approved); Marcus starts pending
    const leoRoom = createRoomInvite(adapter, samuel, {
      childId: 'child_leo', gameId: 'neon-dash',
      startsAt: '2026-11-25T01:00:00Z', endsAt: '2026-11-25T01:10:00Z',
    }, '2026-11-25T00:55:00Z')
    expect(leoRoom.invite.parentApproval).toBe('standing_yes')

    const marcusRoom = createRoomInvite(adapter, samuel, {
      childId: 'child_marcus', gameId: 'moon-gate',
      startsAt: '2026-11-25T01:00:00Z', endsAt: '2026-11-25T01:10:00Z',
    }, '2026-11-25T00:55:00Z')
    expect(marcusRoom.invite.parentApproval).toBe('pending')

    // Join refused before parent approval & for uninvited sibling; cross-household parent cannot approve
    expect(() => joinRoom(adapter, marcus, marcusRoom.invite.id, '2026-11-25T01:01:00Z')).toThrow(/not invited or parent has not approved/i)
    expect(() => respondToRoomInvite(adapter, priya, marcusRoom.invite.id, 'approved')).toThrow(PortalAccessError)

    // Parent approves (logged), still refused BEFORE mentor opens
    const approved = respondToRoomInvite(adapter, elena, marcusRoom.invite.id, 'approved', '2026-11-25T00:57:00Z')
    expect(approved.auditLogs.some((l) => l.action === 'approve_room_invite' && l.recordId === marcusRoom.invite.id)).toBe(true)
    expect(() => joinRoom(adapter, marcus, marcusRoom.invite.id, '2026-11-25T01:01:00Z')).toThrow(/not been opened/i)

    // Mentor opens -> Marcus joins, leaves, and rejoins while running; uninvited Sofia still refused
    openRoomByMentor(adapter, samuel, marcusRoom.invite.id, '2026-11-25T01:00:00Z')
    expect(() => joinRoom(adapter, sofia, marcusRoom.invite.id, '2026-11-25T01:01:00Z')).toThrow(/not invited/i)
    const joined = joinRoom(adapter, marcus, marcusRoom.invite.id, '2026-11-25T01:01:00Z')
    expect(joined.invite.activeChildIds).toEqual(['child_marcus'])
    const left = leaveRoom(adapter, marcus, marcusRoom.invite.id, '2026-11-25T01:03:00Z')
    expect(left.invite.activeChildIds).toEqual([])
    const rejoined = joinRoom(adapter, marcus, marcusRoom.invite.id, '2026-11-25T01:04:00Z')
    expect(rejoined.invite.activeChildIds).toEqual(['child_marcus'])

    // Countdown 60-second warning & hard end refusal
    const warn = getRoomClockStatus(rejoined.invite, Date.parse('2026-11-25T01:09:15Z'))
    expect(warn).toEqual({ phase: 'running', remainingSec: 45, sixtySecondWarning: true })
    expect(() => joinRoom(adapter, marcus, marcusRoom.invite.id, '2026-11-25T01:10:00Z')).toThrow(/ended on schedule/i)
    const closed = closeRoomHardEnd(adapter, marcusRoom.invite.id, '2026-11-25T01:10:00Z')
    expect(closed.roomInvites.find((r) => r.id === marcusRoom.invite.id)?.activeChildIds).toEqual([])
    expect(leo).toBeDefined()
  })

  it('walks through mentor invite -> parent email Yes -> mentor open -> email link join, leave/rejoin, 60s warning, and hard-end goodbye in UI', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    // Mentor creates room invite for Marcus
    await user.click(await screen.findByRole('tab', { name: /mentor view/i }, { timeout: 10_000 }))
    await user.click(screen.getByRole('tab', { name: /rooms \(/i }))
    await user.click(screen.getByRole('button', { name: /send room invite \(10 min\)/i }))
    expect(screen.getByText(/Sent moon-gate room invite/i)).toBeVisible()

    // Parent approves from Simulated Inbox, opens link BEFORE mentor opens -> join refused
    await user.click(screen.getByRole('tab', { name: /simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /approve room \(yes\)/i }))
    await user.click(screen.getByRole('button', { name: /open room link/i }))
    await user.click(screen.getByRole('button', { name: /^join room$/i }))
    expect(screen.getByTestId('room-error')).toHaveTextContent(/not been opened by the mentor yet/i)

    // Mentor opens the room -> Parent reopens room link -> Marcus joins, leaves, rejoins -> 60s warning -> hard-end goodbye
    await user.click(screen.getByRole('tab', { name: /mentor view/i }))
    await user.click(screen.getByRole('tab', { name: /rooms \(/i }))
    const openBtns = screen.getAllByRole('button', { name: /open room now/i })
    await user.click(openBtns[0]!)
    await user.click(screen.getByRole('tab', { name: /simulated inbox/i }))
    await user.click(screen.getByRole('button', { name: /open room link/i }))

    await user.click(screen.getByRole('button', { name: /join \/ rejoin room/i }))
    expect(screen.getByTestId('room-countdown')).toHaveTextContent(/Marcus is in the room/i)
    await user.click(screen.getByRole('button', { name: /leave room/i }))
    expect(screen.getByTestId('room-countdown')).toHaveTextContent(/Marcus left/i)
    await user.click(screen.getByRole('button', { name: /join \/ rejoin room/i }))
    expect(screen.getByTestId('room-countdown')).toHaveTextContent(/Marcus is in the room/i)

    await user.click(screen.getByRole('button', { name: /jump to 45s left/i }))
    expect(screen.getByTestId('room-60s-warning')).toHaveTextContent(/60-second warning/i)

    await user.click(screen.getByRole('button', { name: /jump to hard end/i }))
    expect(screen.getByTestId('room-goodbye')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /try joining after end/i }))
    expect(screen.getByTestId('room-error')).toHaveTextContent(/ended on schedule/i)
  }, 25_000)
})
