import { useEffect, useState, type FormEvent } from 'react'
import type { GroupClient, GroupClass } from '@/groups/client'
import styles from './GroupBookingPage.module.css'

const activities = [
  {
    id: 'act_integer_operations',
    title: 'Integer Operations',
    goal: 'Build confidence with positive and negative numbers.',
  },
  {
    id: 'act_one_step_inequalities',
    title: 'One-Step Inequalities',
    goal: 'Solve an inequality and explain the direction of the comparison.',
  },
  {
    id: 'act_linear_equations',
    title: 'Linear Equations',
    goal: 'Solve for a variable and explain each step.',
  },
] as const
export function TutorClassPanel({
  client,
  group,
  onLearnerChange,
}: {
  client: GroupClient
  group: GroupClass
  onLearnerChange: (id: string) => void
}) {
  const [learners, setLearners] = useState<{ learnerId: string; reservationId: string }[]>([])
  const [learner, setLearner] = useState('')
  const [activity, setActivity] = useState<string>(activities[0].id)
  const [goal, setGoal] = useState<string>(activities[0].goal)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [keys] = useState(() => new Map<string, { lesson: string; assignment: string }>())
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if (!client.roster) {
      setLoading(false)
      return
    }
    void client
      .roster(group.id)
      .then((result) => {
        if (active) setLearners(result.learners)
      })
      .catch(() => {
        if (active) setError('Could not load this class roster. Try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, group.id, reload])
  async function assign(event: FormEvent) {
    event.preventDefault()
    if (!client.createLesson || !client.assignLesson || !learner) return
    const chosen = activities.find((a) => a.id === activity)
    if (!chosen) return
    setBusy(true)
    setError('')
    setMessage('')
    const fingerprint = JSON.stringify([group.id, learner, activity, goal.trim()])
    const request = keys.get(fingerprint) ?? {
      lesson: crypto.randomUUID(),
      assignment: crypto.randomUUID(),
    }
    keys.set(fingerprint, request)
    try {
      const lesson = await client.createLesson(
        {
          title: chosen.title,
          learningGoal: goal.trim(),
          content: { activityId: chosen.id, activityVersionId: chosen.id + '-v1' },
        },
        request.lesson,
      )
      await client.assignLesson(
        group.id,
        { learnerId: learner, lessonId: lesson.id },
        request.assignment,
      )
      setMessage('Puzzle assigned. It is now available in this learner’s preparation area.')
      onLearnerChange(learner)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment did not complete. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.studio} aria-label="Tutor class roster">
      <div className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Your teaching workspace</p>
          <h2>{group.topic}</h2>
        </div>
        <button
          type="button"
          className={styles.secondary}
          disabled={loading || busy}
          onClick={() => setReload((n) => n + 1)}
        >
          Refresh roster
        </button>
      </div>
      <p>
        Only learners with confirmed payment appear here. Select a learner to review their optional
        background and schoolwork below.
      </p>
      {loading && <p role="status">Loading paid learners…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && learners.length === 0 && <p>No paid learners in this class yet.</p>}
      {learners.length > 0 && (
        <form onSubmit={assign}>
          <div className={styles.formGrid}>
            <label>
              Learner in this class
              <select
                value={learner}
                disabled={busy}
                required
                onChange={(e) => {
                  setLearner(e.target.value)
                  setMessage('')
                  onLearnerChange(e.target.value)
                }}
              >
                <option value="">Choose a paid learner</option>
                {learners.map((item, index) => (
                  <option key={item.learnerId} value={item.learnerId}>
                    Learner {index + 1} · record {item.learnerId.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assign puzzle practice
              <select
                value={activity}
                disabled={busy}
                onChange={(e) => {
                  setActivity(e.target.value)
                  setGoal(activities.find((a) => a.id === e.target.value)?.goal ?? '')
                }}
              >
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Learning goal
              <input
                value={goal}
                maxLength={240}
                required
                disabled={busy}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
          </div>
          <button className={styles.primary} disabled={busy || !learner || !goal.trim()}>
            {busy ? 'Assigning…' : 'Assign puzzle to this learner'}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
    </section>
  )
}
