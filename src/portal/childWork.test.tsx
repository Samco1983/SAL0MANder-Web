import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { routes } from '@app/router'
import { paths } from '@config/routes'
import { buildChildActor, buildParentActor } from './access'
import { updateFourSettings } from './parentActions'
import { LocalPortalStorageAdapter, PortalAccessError } from './storage'
import {
  WorkConflictError,
  openOrCreateWorkRecord,
  saveWorkDraft,
  simulateExternalDeviceSave,
  startRedoAttempt,
  submitWorkRecord,
} from './workActions'
import { DEFAULT_PRACTICE_SET } from './worksheet'

describe('portal Phase 1 — PR 3 child profile, worksheet, work record, and lesson-game toggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('allows parent to toggle lesson games OFF while keeping consent, conflict, submit-freeze, and redo rules', () => {
    const adapter = new LocalPortalStorageAdapter()
    const seed = adapter.reset()
    const elena = buildParentActor(seed, 'hh_elena')
    const kai = buildChildActor(seed, 'child_kai')
    const nina = buildChildActor(seed, 'child_nina')

    // PR 2 review fix: parent can toggle lesson game OFF individually (not read-only)
    const lessonOff = updateFourSettings(adapter, elena, 'hh_elena', 'child_marcus', {
      askMode: 'review',
      autoShow: false,
      approvedLessonGames: [],
      approvedFunGames: [],
      joinRooms: false,
      emailMode: 'everything',
    })
    expect(lessonOff.children.find((c) => c.id === 'child_marcus')?.approvedGames).toEqual([])

    // Unconsented child (Kai) cannot open/save practice work
    expect(() => openOrCreateWorkRecord(adapter, kai, 'child_kai')).toThrow(PortalAccessError)

    // Nina creates a draft, saves mid-set, hits optimistic-concurrency conflict, submits (routes parent-first), and redoes
    const opened = openOrCreateWorkRecord(adapter, nina, 'child_nina', DEFAULT_PRACTICE_SET, '2026-11-24T18:00:00Z')
    const saved = saveWorkDraft(adapter, nina, opened.record.id, opened.record.currentRevision, {
      answers: [{ questionId: 'g7-u1-a-01', chosenValue: '5', tries: 1, hintUsed: false, answeredAt: '2026-11-24T18:01:00Z' }],
      openResponse: 'Subtracting -5 is adding 5.',
    })
    simulateExternalDeviceSave(adapter, opened.record.id, '2026-11-24T18:02:00Z')
    expect(() =>
      saveWorkDraft(adapter, nina, opened.record.id, saved.record.currentRevision, { answers: [], openResponse: 'stale' }),
    ).toThrow(WorkConflictError)

    const latestRev = adapter.load().workRecords.find((w) => w.id === opened.record.id)!.currentRevision
    const submitted = submitWorkRecord(adapter, nina, opened.record.id, '2026-11-24T18:03:00Z')
    expect(submitted.record.status).toBe('submitted')
    expect(submitted.record.currentRevision).toBe(latestRev + 1)
    expect(submitted.state.inbox[0]?.to).toBe('priya.demo@family.example')
    expect(submitted.state.inbox[0]?.kind).toBe('question_review')
    expect(submitted.state.feedback.some((f) => f.workRecordId === opened.record.id && f.status === 'draft')).toBe(true)
    expect(() => saveWorkDraft(adapter, nina, opened.record.id, submitted.record.currentRevision, { answers: [], openResponse: '' })).toThrow(PortalAccessError)

    const redone = startRedoAttempt(adapter, nina, opened.record.id, '2026-11-24T18:05:00Z')
    expect(redone.record.attempts).toHaveLength(2)
    expect(redone.record.attempts[0]?.submittedAt).toBe('2026-11-24T18:03:00Z')
    expect(redone.record.attempts[1]?.submittedAt).toBeNull()
  })

  it('renders child profile, enforces visibility, checks hints, persists Continue, simulates failures, submits, and redoes side-by-side', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(routes, { initialEntries: [paths.portal] })
    render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)

    await user.click(await screen.findByRole('tab', { name: /child profile/i }, { timeout: 10_000 }))

    // Marcus profile elements + visibility guarantees
    expect(screen.getByRole('img', { name: /Yellow Belt: Goggles salamander/i })).toBeVisible()
    expect(screen.getByText(/Homework done\? Then let’s go\./i)).toBeVisible()
    expect(screen.getByText(/Next unit:/i)).toHaveTextContent('Unit 4: Expressions')
    expect(screen.getByText(/Mr\. Sam replied Tuesday, ask your parent/i)).toBeVisible()
    expect(screen.getByText(/I want to get fast at negative numbers/i)).toBeVisible()
    expect(screen.getByText(/Points: 120 pts/i)).toBeVisible()
    expect(screen.getByText('First question')).toBeVisible()
    expect(screen.queryByText(/Great catch checking #4/i)).toBeNull()
    expect(screen.queryByText(/DEMO-418/i)).toBeNull()

    // Leo shows approved room invite ("races open at ...") and visible reply; Kai is consent-blocked
    await user.click(screen.getByRole('button', { name: /Leo \(green\)/i }))
    expect(screen.getByText(/races open at 3:35 PM \(code DEMO-729\)/i)).toBeVisible()
    expect(screen.getByText(/Clear explanation of adding two negatives/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Kai \(white\)/i }))
    expect(screen.getByText(/Waiting for parent consent/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull()

    // Sofia opens unfinished set (g7-u1-a), triggers teacher hint on wrong check, corrects answer, autosaves across Continue
    await user.click(screen.getByRole('button', { name: /Sofia \(white\)/i }))
    await user.click(screen.getByRole('button', { name: /continue unfinished set/i }))

    const q1Input = screen.getByLabelText(/1\. -3 \+ 8 = \?/i)
    const q1Item = q1Input.closest('li')!
    await user.type(q1Input, '-11')
    await user.click(within(q1Item).getByRole('button', { name: /^check$/i }))
    expect(within(q1Item).getByText(/Teacher hint: You kept the minus and added the sizes/i)).toBeVisible()

    await user.clear(q1Input)
    await user.type(q1Input, '5')
    await user.click(within(q1Item).getByRole('button', { name: /^check$/i }))
    expect(within(q1Item).getByText(/Correct!/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /back to profile/i }))
    await user.click(screen.getByRole('button', { name: /continue unfinished set/i }))
    expect(screen.getByLabelText(/1\. -3 \+ 8 = \?/i)).toHaveValue('5')

    // Simulate failed save: shows "Not saved, retrying…", preserves typed Q2 answer with zero loss, then recovers on retry
    await user.click(screen.getByRole('button', { name: /simulate failed save/i }))
    expect(screen.getByTestId('worksheet-save-status')).toHaveTextContent(/Not saved, retrying/i)
    const q2Input = screen.getByLabelText(/2\. 6 \+ \(-9\) = \?/i)
    await user.type(q2Input, '-3')
    expect(q2Input).toHaveValue('-3')
    await user.click(screen.getByRole('button', { name: /retry save now/i }))
    expect(screen.getByTestId('worksheet-save-status')).toHaveTextContent(/recovered after retry/i)

    // Simulate conflicting edit: newer wins with visible non-silent alert
    await user.click(screen.getByRole('button', { name: /simulate conflicting edit/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Conflicting edit: newer save/i)

    // Submit freezes attempt, then Redo creates Attempt #2 side by side preserving Attempt #1
    await user.click(screen.getByRole('button', { name: /submit set/i }))
    expect(screen.getByLabelText(/1\. -3 \+ 8 = \?/i)).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /redo \(new attempt side by side\)/i }))
    expect(screen.getByText(/Attempt #2/i)).toBeVisible()
    expect(within(screen.getByTestId('prior-attempts-column')).getByText(/Attempt #1/i)).toBeVisible()
  }, 25_000)
})
