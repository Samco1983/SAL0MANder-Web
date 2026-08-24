import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import type { Mission, MissionActionResult } from '@contracts/v1'
import type { MissionControlApi } from '@api/endpoints/missionControl'
import { ConsolePage } from './ConsolePage'

const active: Mission = {
  id: 'mission-active',
  title: 'Fix the public lesson',
  status: 'active',
  updatedAtUtc: '2026-08-23T19:30:00.000Z',
  issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/56',
}

const verified: Mission = {
  id: 'mission-verified',
  title: 'Ship the verified lesson',
  status: 'verified',
  updatedAtUtc: '2026-08-23T19:31:00.000Z',
  issueUrl: 'https://github.com/Samco1983/SAL0MANder-Web/issues/55',
  proof: {
    command: 'npm run verify:deployed',
    artifact: 'd7b9956',
    builder: 'Claude',
    verifier: 'Codex',
    missionRevision: '2026-08-23T19:31:00.000Z',
    verifiedAtUtc: '2026-08-23T19:32:00.000Z',
  },
}

function result(action: 'fast_break' | 'championship'): MissionActionResult {
  return {
    outcome: 'queued',
    action,
    mission: { id: verified.id, title: verified.title, status: verified.status },
    receipt: {
      id: 'receipt-1',
      url: verified.issueUrl,
      receivedAtUtc: '2026-08-23T19:33:00.000Z',
    },
  }
}

function controller(missions: Mission[] = [active, verified]) {
  return {
    list: vi.fn().mockResolvedValue({
      missions,
      fetchedAtUtc: '2026-08-23T19:32:00.000Z',
      source: 'github' as const,
    }),
    dispatch: vi.fn().mockImplementation(({ action }) => Promise.resolve(result(action))),
  } satisfies MissionControlApi
}

function renderPage(api: MissionControlApi | null) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ConsolePage controller={api} />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('V6 owner console', () => {
  it('has exactly two owner commands', async () => {
    renderPage(controller())
    const actions = await screen.findByRole('group', { name: /owner actions/i })

    expect(within(actions).getAllByRole('button')).toHaveLength(2)
    expect(within(actions).getByRole('button', { name: 'Run Fast Break' })).toBeVisible()
    expect(within(actions).getByRole('button', { name: 'Championship' })).toBeVisible()
  })

  it('keeps Championship disabled until the selected mission has independent proof', async () => {
    const user = userEvent.setup()
    const api = controller()
    renderPage(api)

    const select = await screen.findByRole('combobox', { name: 'Mission' })
    const championship = screen.getByRole('button', { name: 'Championship' })
    expect(championship).toBeDisabled()

    await user.selectOptions(select, verified.id)
    expect(championship).toBeEnabled()
    await user.click(championship)

    expect(api.dispatch).toHaveBeenCalledWith({
      action: 'championship',
      mission: { kind: 'existing', id: verified.id, revision: verified.updatedAtUtc },
    })
    expect(await screen.findByRole('link', { name: /open mission log/i })).toHaveAttribute(
      'href',
      verified.issueUrl,
    )
  })

  it('creates a typed outcome through Fast Break without enabling Championship', async () => {
    const user = userEvent.setup()
    const api = controller()
    renderPage(api)

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Mission' }), '__new__')
    await user.type(screen.getByRole('textbox', { name: 'Outcome' }), 'Student opens one lesson')
    expect(screen.getByText(/create the mission with fast break first/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Run Fast Break' }))

    expect(api.dispatch).toHaveBeenCalledWith({
      action: 'fast_break',
      mission: { kind: 'new', title: 'Student opens one lesson' },
    })
    expect(screen.getByRole('button', { name: 'Championship' })).toBeDisabled()
  })

  it('places mission selection before commands in keyboard order', async () => {
    renderPage(controller())

    const select = await screen.findByRole('combobox', { name: 'Mission' })
    const actions = screen.getByRole('group', { name: /owner actions/i })
    expect(select.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('fails closed instead of fabricating a receipt when no dispatcher exists', () => {
    renderPage(null)

    expect(screen.getByText(/protected dispatcher not connected/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Run Fast Break' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Championship' })).toBeDisabled()
    expect(screen.queryByText(/receipt recorded/i)).toBeNull()
  })

  it('fails closed when the Mission Log cannot be loaded', async () => {
    const unavailable = controller()
    unavailable.list.mockRejectedValue(new Error('network failure'))
    renderPage(unavailable)

    expect(await screen.findByText(/mission log unavailable/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Run Fast Break' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Championship' })).toBeDisabled()
    expect(screen.queryByText(/mission log connected/i)).toBeNull()
  })
})
