import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import {
  StudentPrepPanel,
  createStudentPrepClient,
  type StudentPrepClient,
  type StudentWork,
} from './StudentPrepPanel'

const learnerId = 'a'.repeat(32),
  otherId = 'b'.repeat(32)
const context = { accountId: 'parent', learnerId }
const intake = { gradeCourse: '', mathTopic: '', goal: '', learningHelp: '' }
const work: StudentWork = {
  id: 'c'.repeat(32),
  learnerId,
  fileName: 'equations.pdf',
  contentType: 'application/pdf',
  size: 40,
  createdAt: 1,
}
function fixture() {
  return {
    getPrep: vi.fn(async (id: string) => ({ learnerId: id, intake: null, work: [] })),
    saveIntake: vi.fn(async (_id, value) => value),
    uploadWork: vi.fn(async () => work),
    downloadWork: vi.fn(async () => new Blob()),
  } satisfies StudentPrepClient
}
it('does not imply an authenticated account or offer saving by default', () => {
  render(<StudentPrepPanel />)
  expect(screen.getByText(/No authenticated adult or parent account is connected/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Save lesson background' })).toBeNull()
})
it('asks the tutor to select a roster learner without loading preparation before selection', () => {
  const client = {
    ...fixture(),
    listAssignments: vi.fn(async () => ({ assignments: [], hasMore: false })),
  }
  render(<StudentPrepPanel readOnly client={client} />)
  expect(screen.getByRole('status')).toHaveTextContent(
    'Select a learner from a class roster to review their preparation.',
  )
  expect(screen.getByRole('status')).toHaveTextContent('Create a class first')
  expect(screen.queryByText(/No authenticated adult or parent account is connected/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save lesson background' })).toBeNull()
  expect(screen.queryByLabelText('Choose schoolwork')).toBeNull()
  expect(client.getPrep).not.toHaveBeenCalled()
  expect(client.listAssignments).not.toHaveBeenCalled()
})
it('allows all optional fields and only confirms a server-completed save', async () => {
  const user = userEvent.setup(),
    client = fixture()
  let resolve!: (value: typeof intake) => void
  client.saveIntake.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  render(<StudentPrepPanel context={context} client={client} />)
  await user.click(await screen.findByRole('button', { name: 'Save lesson background' }))
  expect(client.saveIntake).toHaveBeenCalledWith(learnerId, intake)
  expect(screen.queryByText('Lesson background saved for your tutor.')).toBeNull()
  await act(async () => {
    resolve(intake)
  })
  expect(screen.getByText('Lesson background saved for your tutor.')).toBeVisible()
})
it('keeps selected files distinct from uploaded work and handles server rejection', async () => {
  const user = userEvent.setup(),
    client = fixture()
  client.uploadWork.mockRejectedValueOnce(new Error('private provider diagnostic'))
  render(<StudentPrepPanel context={context} client={client} />)
  await user.upload(
    await screen.findByLabelText('Choose schoolwork'),
    new File(['%PDF'], 'equations.pdf', { type: 'application/pdf' }),
  )
  expect(screen.getByText(/selected. It has not been uploaded yet/)).toBeVisible()
  expect(client.uploadWork).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Upload schoolwork' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Uploading your schoolwork did not complete',
  )
  expect(screen.getByText('No schoolwork has been uploaded.')).toBeVisible()
  expect(screen.queryByText(/private provider diagnostic/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Upload schoolwork' }))
  expect(
    await screen.findByText('Schoolwork uploaded and saved privately for you and your tutor.'),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Download equations.pdf' })).toBeVisible()
})
it('clears private details on learner/account change and ignores an old in-flight save', async () => {
  const user = userEvent.setup(),
    client = fixture()
  let resolve!: (value: typeof intake) => void
  client.saveIntake.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const view = render(<StudentPrepPanel context={context} client={client} />)
  await user.type(await screen.findByLabelText('Grade or course'), 'Grade 8')
  await user.click(screen.getByRole('button', { name: 'Save lesson background' }))
  view.rerender(
    <StudentPrepPanel context={{ accountId: 'other', learnerId: otherId }} client={client} />,
  )
  expect(await screen.findByLabelText('Grade or course')).toHaveValue('')
  await act(async () => {
    resolve({ ...intake, gradeCourse: 'Grade 8' })
  })
  expect(screen.getByLabelText('Grade or course')).toHaveValue('')
  expect(screen.queryByText('Lesson background saved for your tutor.')).toBeNull()
})
it('shows only this learner’s active assignments and delegates practice to the existing flow', async () => {
  const user = userEvent.setup(),
    start = vi.fn(async () => undefined)
  render(
    <StudentPrepPanel
      context={context}
      client={fixture()}
      onStartPractice={start}
      assignments={[
        { id: 'd'.repeat(32), learnerId, state: 'assigned', learningGoal: 'Practice equations' },
        {
          id: 'e'.repeat(32),
          learnerId: otherId,
          state: 'assigned',
          learningGoal: 'Other student work',
        },
        { id: 'f'.repeat(32), learnerId, state: 'revoked', learningGoal: 'Old assignment' },
      ]}
    />,
  )
  await user.click(await screen.findByRole('button', { name: 'Open assigned puzzle' }))
  expect(start).toHaveBeenCalledWith('d'.repeat(32))
  expect(screen.queryByText('Other student work')).toBeNull()
  expect(screen.queryByText('Old assignment')).toBeNull()
})
it('rejects a cross-learner preparation response', async () => {
  const client = fixture()
  client.getPrep.mockResolvedValueOnce({ learnerId: otherId, intake: null, work: [] })
  render(<StudentPrepPanel context={context} client={client} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  expect(screen.queryByLabelText('Grade or course')).toBeNull()
})
it('requires explicit authorization and sends raw upload bytes with no cookies or redirects', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: work })))
  const authorization = vi.fn(async () => undefined as string | undefined)
  const client = createStudentPrepClient({
    apiBaseUrl: 'https://api.example.test/api/tutoring/v1',
    getAuthorization: authorization,
    fetch: fetcher,
  })
  const file = new File(['sample'], 'equations.pdf', { type: 'application/pdf' })
  await expect(client.uploadWork(learnerId, file)).rejects.toThrow('Account not authenticated')
  expect(fetcher).not.toHaveBeenCalled()
  authorization.mockResolvedValue('Bearer synthetic.token')
  await client.uploadWork(learnerId, file)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  const [, request] = fetcher.mock.calls[0]!
  expect(request).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    body: file,
  })
  expect(new Headers(request?.headers).get('X-File-Name')).toBe('equations.pdf')
})

it('loads real assignments, starts practice through the client, and shows a link only after server success', async () => {
  const user = userEvent.setup()
  const assignmentId = 'd'.repeat(32)
  const launch = {
    practiceId: 'e'.repeat(32),
    assignmentId,
    learnerId,
    content: { activityId: 'demo-activity', activityVersionId: 'av_demo_1' },
  }
  let resolve!: (value: typeof launch) => void
  const start = vi.fn(
    async () =>
      new Promise<typeof launch>((done) => {
        resolve = done
      }),
  )
  const list = vi.fn(async () => ({
    assignments: [
      {
        id: assignmentId,
        learnerId,
        state: 'assigned' as const,
        learningGoal: 'Practice equations',
      },
    ],
    hasMore: false,
  }))
  const client = { ...fixture(), listAssignments: list, startAssignedPractice: start }
  render(<StudentPrepPanel context={context} client={client} />)
  await user.click(await screen.findByRole('button', { name: 'Start assigned practice' }))
  expect(list).toHaveBeenCalledWith(learnerId)
  expect(start).toHaveBeenCalledWith(
    learnerId,
    assignmentId,
    expect.stringMatching(/^[A-Za-z0-9_-]{16,128}$/u),
  )
  expect(screen.queryByRole('link', { name: 'Continue to assigned puzzle' })).toBeNull()
  await act(async () => {
    resolve(launch)
  })
  expect(screen.getByRole('link', { name: 'Continue to assigned puzzle' })).toHaveAttribute(
    'href',
    expect.stringContaining('/play/demo-activity'),
  )
  expect(screen.getByText('Practice started. Continue to your assigned puzzle.')).toBeVisible()
})

it('retains the same idempotency key on a failed practice retry and keeps intake usable when assignment loading fails', async () => {
  const user = userEvent.setup()
  const assignmentId = 'd'.repeat(32)
  const start = vi.fn(async () => {
    throw new Error('provider failure')
  })
  const client = {
    ...fixture(),
    startAssignedPractice: start,
    listAssignments: vi.fn(async () => {
      throw new Error()
    }),
  }
  const assignments = [
    { id: assignmentId, learnerId, state: 'assigned' as const, learningGoal: 'Practice equations' },
  ]
  const view = render(
    <StudentPrepPanel context={context} client={client} assignments={assignments} />,
  )
  await user.click(await screen.findByRole('button', { name: 'Start assigned practice' }))
  await user.click(screen.getByRole('button', { name: 'Start assigned practice' }))
  expect(start.mock.calls[0]).toEqual(start.mock.calls[1])
  expect(screen.queryByRole('link', { name: 'Continue to assigned puzzle' })).toBeNull()
  view.rerender(<StudentPrepPanel context={context} client={client} />)
  expect(
    await screen.findByText('Assigned puzzles could not be loaded. Please try again.'),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Save lesson background' })).toBeEnabled()
})

it('lets the tutor read saved background and download schoolwork without parent write or start controls', async () => {
  const client: StudentPrepClient = {
    ...fixture(),
    getPrep: async (id) => ({
      learnerId: id,
      intake: { ...intake, gradeCourse: 'Grade 8' },
      work: [work],
    }),
  }
  render(
    <StudentPrepPanel
      context={{ accountId: 'sam', learnerId }}
      client={client}
      readOnly
      assignments={[
        { id: 'd'.repeat(32), learnerId, state: 'assigned', learningGoal: 'Practice equations' },
      ]}
    />,
  )
  expect(await screen.findByText('Grade 8')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Download equations.pdf' })).toBeVisible()
  expect(screen.getByText('Practice equations')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Save lesson background' })).toBeNull()
  expect(screen.queryByLabelText('Choose schoolwork')).toBeNull()
  expect(screen.queryByRole('button', { name: /assigned practice|assigned puzzle/iu })).toBeNull()
})

it('rejects a mismatched practice launch response without exposing a puzzle link', async () => {
  const user = userEvent.setup()
  const client: StudentPrepClient = {
    ...fixture(),
    startAssignedPractice: async () => ({
      practiceId: 'e'.repeat(32),
      assignmentId: 'd'.repeat(32),
      learnerId: otherId,
      content: { activityId: 'private-other', activityVersionId: 'v1' },
    }),
  }
  render(
    <StudentPrepPanel
      context={context}
      client={client}
      assignments={[
        { id: 'd'.repeat(32), learnerId, state: 'assigned', learningGoal: 'Practice equations' },
      ]}
    />,
  )
  await user.click(await screen.findByRole('button', { name: 'Start assigned practice' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Starting your assigned practice did not complete',
  )
  expect(screen.queryByRole('link', { name: 'Continue to assigned puzzle' })).toBeNull()
})
