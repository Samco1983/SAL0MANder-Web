import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { ClassMeetingResult, GroupClass, GroupClient } from '@/groups/client'
import { ClassMeetingPanel } from './ClassMeetingPanel'

const group = {
  id: 'a'.repeat(32),
  topic: 'Algebra',
  startsAt: 1800000000000,
  timeZone: 'America/Los_Angeles',
} as GroupClass
const joinUrl = 'https://us06web.zoom.us/j/12345678901?pwd=Passcode'
function service() {
  return {
    meeting: vi.fn(async (): Promise<ClassMeetingResult> => ({ classId: group.id, meeting: null })),
    saveMeeting: vi.fn(async (): Promise<ClassMeetingResult> => ({
      classId: group.id,
      meeting: { provider: 'zoom', joinUrl, updatedAt: 123 },
    })),
  }
}

it('opens official setup separately and saves a participant link only after explicit submit', async () => {
  const user = userEvent.setup()
  const api = service()
  render(
    <ClassMeetingPanel client={api as unknown as GroupClient} group={group} accountId="tutor" />,
  )
  const input = await screen.findByRole('textbox', { name: 'Participant join link' })
  await act(async () => {})
  expect(screen.getByRole('link', { name: 'Open Zoom setup' })).toHaveAttribute(
    'href',
    'https://zoom.us/signin',
  )
  expect(screen.getByText(/turn on Waiting Room/)).toBeVisible()
  expect(api.saveMeeting).not.toHaveBeenCalled()
  await user.type(input, joinUrl)
  expect(api.saveMeeting).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Save private meeting link' }))
  expect(api.saveMeeting).toHaveBeenCalledWith(group.id, { provider: 'zoom', joinUrl })
  expect(await screen.findByRole('status')).toHaveTextContent('Meeting link saved privately')
  expect(screen.getByRole('link', { name: 'Open saved participant link' })).toHaveAttribute(
    'href',
    joinUrl,
  )
})

it('rejects host links and keeps failed saves editable without claiming success', async () => {
  const user = userEvent.setup()
  const api = service()
  api.saveMeeting.mockRejectedValue(new Error('Unable to save. Please retry.'))
  render(
    <ClassMeetingPanel client={api as unknown as GroupClient} group={group} accountId="tutor" />,
  )
  const input = await screen.findByRole('textbox', { name: 'Participant join link' })
  await act(async () => {})
  await user.type(input, 'https://zoom.us/s/12345678901?zak=host')
  await user.click(screen.getByRole('button', { name: 'Save private meeting link' }))
  expect(screen.getByRole('alert')).toHaveTextContent(/Host\/start links cannot be saved/)
  expect(api.saveMeeting).not.toHaveBeenCalled()
  await user.clear(input)
  await user.type(input, joinUrl)
  await user.click(screen.getByRole('button', { name: 'Save private meeting link' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to save/)
  expect(input).toHaveValue(joinUrl)
  expect(screen.queryByRole('link', { name: 'Open saved participant link' })).toBeNull()
})

it('clears private meeting state and ignores late results when the class or account changes', async () => {
  let finish!: (value: ClassMeetingResult) => void
  const api = service()
  api.meeting.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const client = api as unknown as GroupClient
  const view = render(<ClassMeetingPanel client={client} group={group} accountId="first" />)
  view.rerender(
    <ClassMeetingPanel
      client={client}
      group={{ ...group, id: 'b'.repeat(32) }}
      accountId="second"
    />,
  )
  await act(async () =>
    finish({ classId: group.id, meeting: { provider: 'zoom', joinUrl, updatedAt: 123 } }),
  )
  expect(screen.queryByRole('link', { name: 'Open saved participant link' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Participant join link' })).toHaveValue('')
})
