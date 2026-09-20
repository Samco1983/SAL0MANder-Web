import { useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Button } from '@components/ui/Button'
import { env } from '@config/env'
import { buildShareLink } from '@config/routes'
import styles from './StudentPrepPanel.module.css'

const Id = z.string().regex(/^[a-f0-9]{32}$/u)
const hasControl = (value: string, multiline = false) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return (code < 32 && !(multiline && (code === 10 || code === 13 || code === 9))) || code === 127
  })
const Text = (max: number, multiline = false) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !/[<>]/u.test(s) && !hasControl(s, multiline))
export const StudentIntakeSchema = z
  .object({
    gradeCourse: Text(80),
    mathTopic: Text(120),
    goal: Text(300, true),
    learningHelp: Text(300, true),
  })
  .strict()
export type StudentIntake = z.infer<typeof StudentIntakeSchema>
const StudentWorkSchema = z
  .object({
    id: Id,
    learnerId: Id,
    fileName: z.string().min(1).max(120),
    contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    size: z
      .number()
      .int()
      .min(1)
      .max(5 * 1024 * 1024),
    createdAt: z.number().int().nonnegative(),
  })
  .strict()
export type StudentWork = z.infer<typeof StudentWorkSchema>
export const StudentPrepSchema = z
  .object({
    learnerId: Id,
    intake: StudentIntakeSchema.nullable(),
    work: z.array(StudentWorkSchema).max(30),
  })
  .strict()
export type StudentPrep = z.infer<typeof StudentPrepSchema>
export const StudentPrepAssignmentSchema = z
  .object({
    id: Id,
    learnerId: Id,
    learningGoal: z.string().max(240),
    state: z.enum(['assigned', 'revoked']),
  })
  .passthrough()
export type StudentPrepAssignment = z.infer<typeof StudentPrepAssignmentSchema>
const StudentAssignmentListSchema = z
  .object({
    assignments: z.array(StudentPrepAssignmentSchema).max(100),
    hasMore: z.boolean(),
  })
  .strict()
const StudentPracticeLaunchSchema = z
  .object({
    practiceId: Id,
    assignmentId: Id,
    learnerId: Id,
    content: z
      .object({
        activityId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u),
        activityVersionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u),
      })
      .strict(),
  })
  .strict()
export type StudentAssignmentList = z.infer<typeof StudentAssignmentListSchema>
export type StudentPracticeLaunch = z.infer<typeof StudentPracticeLaunchSchema>
export interface StudentPrepClient {
  getPrep(learnerId: string): Promise<StudentPrep>
  saveIntake(learnerId: string, intake: StudentIntake): Promise<StudentIntake>
  uploadWork(learnerId: string, file: File): Promise<StudentWork>
  downloadWork(learnerId: string, workId: string): Promise<Blob>
  listAssignments?(learnerId: string): Promise<StudentAssignmentList>
  startAssignedPractice?(
    learnerId: string,
    assignmentId: string,
    key: string,
  ): Promise<StudentPracticeLaunch>
}
export interface StudentPrepPanelProps {
  /** Explicit authenticated adult/parent account context, never a local player profile. */
  context?: { accountId: string; learnerId: string } | null
  client?: StudentPrepClient | null
  assignments?: readonly StudentPrepAssignment[]
  /** Delegate to the existing assignment/startPractice service and Guest Play integration. */
  onStartPractice?: (assignmentId: string) => Promise<void>
  mode?: 'connected' | 'local-demo'
  /** Presentation only: the server independently enforces configured tutor read-only access. */
  readOnly?: boolean
}
const empty: StudentIntake = { gradeCourse: '', mathTopic: '', goal: '', learningHelp: '' }

export function StudentPrepPanel(props: StudentPrepPanelProps) {
  return (
    <section
      className={styles.panel}
      id="student-preparation"
      aria-labelledby="student-preparation-title"
    >
      <p className={styles.eyebrow}>Before your lesson · Optional</p>
      <h2 id="student-preparation-title">
        {props.readOnly ? 'Learner preparation' : 'Help your tutor plan your lesson'}
      </h2>
      <p>
        {props.readOnly
          ? 'Review this learner’s saved background, schoolwork, and assigned puzzles.'
          : 'Tell your tutor what you are working on, share schoolwork, and find your assigned puzzles. You can book a lesson without completing this step.'}
      </p>
      {props.context?.accountId && Id.safeParse(props.context.learnerId).success && props.client ? (
        <StudentPrepSession
          key={`${props.context.accountId}:${props.context.learnerId}`}
          {...props}
          context={props.context}
          client={props.client}
        />
      ) : (
        <div className={styles.notice} role="status">
          {props.readOnly
            ? 'Select a learner from a class roster to review their preparation. Create a class first if you do not have one yet.'
            : 'No authenticated adult or parent account is connected. Your lesson background and schoolwork cannot be saved here yet. You can still book tutoring and explore puzzle practice.'}
        </div>
      )}
    </section>
  )
}

function StudentPrepSession({
  context,
  client,
  assignments,
  onStartPractice,
  mode = 'connected',
  readOnly = false,
}: StudentPrepPanelProps & {
  context: { accountId: string; learnerId: string }
  client: StudentPrepClient
}) {
  const [prep, setPrep] = useState<StudentPrep | null>(null)
  const [intake, setIntake] = useState<StudentIntake>(empty)
  const [selected, setSelected] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [loadedAssignments, setLoadedAssignments] = useState<StudentPrepAssignment[]>([])
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentReload, setAssignmentReload] = useState(0)
  const [hasMoreAssignments, setHasMoreAssignments] = useState(false)
  const [launch, setLaunch] = useState<StudentPracticeLaunch | null>(null)
  const practiceKeys = useRef(new Map<string, string>())
  const generation = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const learnerId = context.learnerId
  useEffect(() => {
    const current = ++generation.current
    setLoading(true)
    setPrep(null)
    setIntake(empty)
    setMessage('')
    setError('')
    setPending('')
    setSelected(null)
    setLaunch(null)
    practiceKeys.current.clear()
    void client
      .getPrep(learnerId)
      .then((result) => {
        if (current !== generation.current) return
        const parsed = StudentPrepSchema.parse(result)
        if (
          parsed.learnerId !== learnerId ||
          parsed.work.some((work) => work.learnerId !== learnerId)
        )
          throw new Error()
        setPrep(parsed)
        setIntake(parsed.intake ?? empty)
      })
      .catch(() => {
        if (current === generation.current)
          setError('Your preparation could not be loaded. Please try again.')
      })
      .finally(() => {
        if (current === generation.current) setLoading(false)
      })
    return () => {
      generation.current++
    }
  }, [client, learnerId, reload])

  useEffect(() => {
    let active = true
    const current = generation.current
    setLoadedAssignments([])
    setAssignmentError('')
    setHasMoreAssignments(false)
    if (assignments !== undefined) {
      setAssignmentLoading(false)
      return
    }
    if (!client.listAssignments) {
      setAssignmentLoading(false)
      return
    }
    setAssignmentLoading(true)
    void client
      .listAssignments(learnerId)
      .then((result) => {
        if (!active || current !== generation.current) return
        const parsed = StudentAssignmentListSchema.parse(result)
        if (parsed.assignments.some((assignment) => assignment.learnerId !== learnerId))
          throw new Error()
        setLoadedAssignments(parsed.assignments)
        setHasMoreAssignments(parsed.hasMore)
      })
      .catch(() => {
        if (active && current === generation.current)
          setAssignmentError('Assigned puzzles could not be loaded. Please try again.')
      })
      .finally(() => {
        if (active && current === generation.current) setAssignmentLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, learnerId, assignments, assignmentReload, reload])

  async function action(label: string, run: (current: number) => Promise<void>) {
    const current = generation.current
    setPending(label)
    setError('')
    setMessage('')
    try {
      await run(current)
    } catch {
      if (current === generation.current) setError(`${label} did not complete. Please try again.`)
    } finally {
      if (current === generation.current) setPending('')
    }
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    const checked = StudentIntakeSchema.safeParse(intake)
    if (!checked.success) {
      setError('Please use plain text within the field limits.')
      return
    }
    void action('Saving your lesson background', async (current) => {
      const saved = StudentIntakeSchema.parse(await client.saveIntake(learnerId, checked.data))
      if (current !== generation.current) return
      setIntake(saved)
      setPrep((value) => (value ? { ...value, intake: saved } : value))
      setMessage(
        mode === 'local-demo'
          ? 'Lesson background saved in this demo session only.'
          : 'Lesson background saved for your tutor.',
      )
    })
  }
  function choose(file: File | undefined) {
    setMessage('')
    setError('')
    setSelected(null)
    if (!file) return
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Choose a PDF, JPEG, or PNG file up to 5 MB.')
      return
    }
    setSelected(file)
  }
  function upload() {
    if (readOnly || !selected) return
    const file = selected
    void action('Uploading your schoolwork', async (current) => {
      const saved = StudentWorkSchema.parse(await client.uploadWork(learnerId, file))
      if (current !== generation.current) return
      if (saved.learnerId !== learnerId) throw new Error()
      setPrep((value) =>
        value
          ? { ...value, work: [...value.work.filter((work) => work.id !== saved.id), saved] }
          : value,
      )
      setSelected(null)
      if (fileInput.current) fileInput.current.value = ''
      setMessage(
        mode === 'local-demo'
          ? 'Schoolwork saved in this demo session only.'
          : 'Schoolwork uploaded and saved privately for you and your tutor.',
      )
    })
  }
  function download(work: StudentWork) {
    void action('Downloading your schoolwork', async (current) => {
      const blob = await client.downloadWork(learnerId, work.id)
      if (current !== generation.current) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = work.fileName
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    })
  }
  function startAssignment(assignment: StudentPrepAssignment) {
    if (readOnly) return
    if (onStartPractice) {
      void action('Opening your assigned puzzle', async () => {
        await onStartPractice(assignment.id)
      })
      return
    }
    if (!client.startAssignedPractice) return
    const start = client.startAssignedPractice.bind(client)
    const key = practiceKeys.current.get(assignment.id) ?? crypto.randomUUID()
    practiceKeys.current.set(assignment.id, key)
    void action('Starting your assigned practice', async (current) => {
      const started = StudentPracticeLaunchSchema.parse(await start(learnerId, assignment.id, key))
      if (current !== generation.current) return
      if (started.learnerId !== learnerId || started.assignmentId !== assignment.id)
        throw new Error()
      setLaunch(started)
      setMessage(
        mode === 'local-demo'
          ? 'Practice started in this demo session. Continue to your assigned puzzle.'
          : 'Practice started. Continue to your assigned puzzle.',
      )
    })
  }
  const cards = (assignments ?? loadedAssignments).flatMap((item) => {
    const parsed = StudentPrepAssignmentSchema.safeParse(item)
    return parsed.success && parsed.data.learnerId === learnerId && parsed.data.state === 'assigned'
      ? [parsed.data]
      : []
  })
  return (
    <>
      {mode === 'local-demo' && (
        <p className={styles.notice}>
          Local demo: use sample information only. Preparation and uploads disappear when this demo
          is reset.
        </p>
      )}
      <p className={styles.quiet}>
        {readOnly
          ? 'You are viewing this learner’s preparation as the tutor. The adult or parent account manages these details and uploads.'
          : 'An adult or parent manages this learner record. Only that account and the tutor can access saved preparation. Share learning preferences; medical or diagnostic information is not needed.'}
      </p>
      {loading && <p role="status">Loading your lesson preparation…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!loading && !prep && (
        <Button type="button" onClick={() => setReload((n) => n + 1)}>
          Try loading again
        </Button>
      )}
      {prep && (
        <div className={styles.grid}>
          {readOnly ? (
            <div className={styles.form}>
              <h3>Saved lesson background</h3>
              <dl>
                <dt>Grade or course</dt>
                <dd>{prep.intake?.gradeCourse || 'Not shared'}</dd>
                <dt>Math topic</dt>
                <dd>{prep.intake?.mathTopic || 'Not shared'}</dd>
                <dt>Learning goal</dt>
                <dd>{prep.intake?.goal || 'Not shared'}</dd>
                <dt>What helps this learner</dt>
                <dd>{prep.intake?.learningHelp || 'Not shared'}</dd>
              </dl>
            </div>
          ) : (
            <form onSubmit={save} className={styles.form}>
              <h3>Your lesson background</h3>
              <p className={styles.quiet}>Every field is optional.</p>
              <label>
                Grade or course
                <input
                  value={intake.gradeCourse}
                  maxLength={80}
                  disabled={!!pending}
                  placeholder="For example, Grade 8 or Algebra 1"
                  onChange={(e) => {
                    setIntake({ ...intake, gradeCourse: e.target.value })
                    setMessage('')
                  }}
                />
              </label>
              <label>
                Math topic
                <input
                  value={intake.mathTopic}
                  maxLength={120}
                  disabled={!!pending}
                  placeholder="For example, solving equations"
                  onChange={(e) => {
                    setIntake({ ...intake, mathTopic: e.target.value })
                    setMessage('')
                  }}
                />
              </label>
              <label>
                What would you like to work toward?
                <textarea
                  rows={3}
                  value={intake.goal}
                  maxLength={300}
                  disabled={!!pending}
                  onChange={(e) => {
                    setIntake({ ...intake, goal: e.target.value })
                    setMessage('')
                  }}
                />
              </label>
              <label>
                What helps you learn?
                <textarea
                  rows={3}
                  value={intake.learningHelp}
                  maxLength={300}
                  disabled={!!pending}
                  placeholder="For example, worked examples, drawing, or time to think"
                  onChange={(e) => {
                    setIntake({ ...intake, learningHelp: e.target.value })
                    setMessage('')
                  }}
                />
              </label>
              <Button type="submit" disabled={!!pending}>
                Save lesson background
              </Button>
            </form>
          )}
          <div className={styles.form}>
            <h3>Schoolwork for your lesson</h3>
            <p className={styles.quiet}>
              PDF, JPEG, or PNG · Up to 5 MB each · Up to 30 files. Include only the pages you want
              your tutor to review.
            </p>
            {!readOnly && (
              <>
                <label>
                  Choose schoolwork
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    disabled={!!pending || prep.work.length >= 30}
                    onChange={(event) => choose(event.target.files?.[0])}
                  />
                </label>
                {selected && <p>{selected.name} selected. It has not been uploaded yet.</p>}
                <Button
                  type="button"
                  disabled={!selected || !!pending || prep.work.length >= 30}
                  onClick={upload}
                >
                  Upload schoolwork
                </Button>
              </>
            )}
            <h4>Saved schoolwork</h4>
            {prep.work.length === 0 ? (
              <p className={styles.quiet}>No schoolwork has been uploaded.</p>
            ) : (
              <ul className={styles.files}>
                {prep.work.map((work) => (
                  <li key={work.id}>
                    <span>
                      {work.fileName} <small>({Math.ceil(work.size / 1024)} KB)</small>
                    </span>
                    <button
                      type="button"
                      aria-label={`Download ${work.fileName}`}
                      disabled={!!pending}
                      onClick={() => download(work)}
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.assignments}>
            <h3>Your assigned puzzles</h3>
            {assignments === undefined && !client.listAssignments && (
              <p className={styles.quiet}>Assigned puzzles are not connected yet.</p>
            )}
            {assignmentLoading && <p role="status">Loading your assigned puzzles…</p>}
            {assignmentError && (
              <div>
                <p role="alert">{assignmentError}</p>
                {client.listAssignments && (
                  <Button
                    type="button"
                    disabled={assignmentLoading}
                    onClick={() => setAssignmentReload((value) => value + 1)}
                  >
                    Retry assigned puzzles
                  </Button>
                )}
              </div>
            )}
            {hasMoreAssignments && (
              <p className={styles.quiet}>
                Showing your 100 most recent assignments. Ask your tutor about earlier practice.
              </p>
            )}
            {cards.length === 0 &&
            !assignmentLoading &&
            !assignmentError &&
            (assignments !== undefined || client.listAssignments) ? (
              <p className={styles.quiet}>
                No assigned puzzles are available here yet. Your tutor can assign practice after planning
                your lesson.
              </p>
            ) : (
              <ul className={styles.cards}>
                {cards.map((assignment) => (
                  <li key={assignment.id}>
                    <h4>{assignment.learningGoal}</h4>
                    {!readOnly && (
                      <Button
                        type="button"
                        disabled={(!onStartPractice && !client.startAssignedPractice) || !!pending}
                        onClick={() => startAssignment(assignment)}
                      >
                        {onStartPractice ? 'Open assigned puzzle' : 'Start assigned practice'}
                      </Button>
                    )}
                    {launch?.assignmentId === assignment.id && (
                      <a
                        href={buildShareLink(
                          launch.content.activityId,
                          env.sites?.puzzles || env.publicBaseUrl || '',
                        )}
                      >
                        Continue to assigned puzzle
                      </a>
                    )}
                    {!readOnly && !onStartPractice && !client.startAssignedPractice && (
                      <p className={styles.quiet}>Practice opening is not connected yet.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {pending && <p role="status">{pending}…</p>}
    </>
  )
}

/** The host supplies a real token provider. No local profile/role is accepted as authentication. */
export function createStudentPrepClient(options: {
  apiBaseUrl: string
  getAuthorization: () => Promise<string | undefined>
  fetch?: typeof fetch
}): StudentPrepClient {
  const base = new URL(options.apiBaseUrl)
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !base.pathname.endsWith('/api/tutoring/v1') ||
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))
  )
    throw new Error('Invalid student preparation API configuration')
  const fetcher = options.fetch ?? fetch
  async function request(path: string, init: RequestInit = {}) {
    const authorization = await options.getAuthorization()
    if (!authorization || !/^Bearer [A-Za-z0-9_.-]+$/u.test(authorization))
      throw new Error('Account not authenticated')
    const headers = new Headers(init.headers)
    headers.set('Authorization', authorization)
    const response = await fetcher(`${base.href}${path}`, {
      ...init,
      headers,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    })
    if (!response.ok) throw new Error('Student preparation request failed')
    return response
  }
  const learnerPath = (id: string) => `/learners/${Id.parse(id)}`
  return {
    async getPrep(id) {
      return StudentPrepSchema.parse((await (await request(`${learnerPath(id)}/prep`)).json()).data)
    },
    async saveIntake(id, intake) {
      return StudentIntakeSchema.parse(
        (
          await (
            await request(`${learnerPath(id)}/prep/intake`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ intake: StudentIntakeSchema.parse(intake) }),
            })
          ).json()
        ).data,
      )
    },
    async uploadWork(id, file) {
      return StudentWorkSchema.parse(
        (
          await (
            await request(`${learnerPath(id)}/work`, {
              method: 'POST',
              headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
              body: file,
            })
          ).json()
        ).data,
      )
    },
    async downloadWork(id, workId) {
      return (await request(`${learnerPath(id)}/work/${Id.parse(workId)}`)).blob()
    },
    async listAssignments(id) {
      return StudentAssignmentListSchema.parse(
        (await (await request(`${learnerPath(id)}/prep/assignments`)).json()).data,
      )
    },
    async startAssignedPractice(id, assignmentId, key) {
      if (!/^[A-Za-z0-9_-]{16,128}$/u.test(key)) throw new Error('Invalid practice request')
      return StudentPracticeLaunchSchema.parse(
        (
          await (
            await request(
              `${learnerPath(id)}/prep/assignments/${Id.parse(assignmentId)}/practices`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
                body: '{}',
              },
            )
          ).json()
        ).data,
      )
    },
  }
}
