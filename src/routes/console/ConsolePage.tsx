import { useEffect, useMemo, useState } from 'react'
import type { Mission, MissionActionInput, MissionActionResult, MissionStatus } from '@contracts/v1'
import type { MissionControlApi } from '@api/endpoints/missionControl'
import { api } from '@api/client'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import styles from './ConsolePage.module.css'

const NEW_MISSION = '__new__'

type ActionState =
  | { kind: 'idle' }
  | { kind: 'working'; action: MissionActionInput['action'] }
  | { kind: 'completed'; result: MissionActionResult }
  | { kind: 'failed'; message: string }

const STATUS_LABEL: Record<MissionStatus, string> = {
  queued: 'Queued',
  active: 'Active',
  awaiting_verification: 'Awaiting verification',
  verified: 'Verified',
  rebound: 'Rebound',
  blocked: 'Blocked',
}

export function ConsolePage({
  controller = api.missionControl,
}: {
  controller?: MissionControlApi | null
}) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [selectedId, setSelectedId] = useState(NEW_MISSION)
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(Boolean(controller))
  const [loadFailure, setLoadFailure] = useState('')
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' })

  useEffect(() => {
    if (!controller) return

    const abort = new AbortController()
    controller
      .list(abort.signal)
      .then((log) => {
        setMissions(log.missions)
        setSelectedId(log.missions[0]?.id ?? NEW_MISSION)
        setLoadFailure('')
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setLoadFailure(plainReason(error))
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })

    return () => abort.abort()
  }, [controller])

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedId),
    [missions, selectedId],
  )
  const isNew = selectedId === NEW_MISSION
  const working = actionState.kind === 'working'
  const hasTarget = isNew ? newTitle.trim().length >= 3 : Boolean(selectedMission)
  const championshipReady = Boolean(selectedMission?.status === 'verified' && selectedMission.proof)
  const configured = Boolean(controller)
  const connected = configured && !loadFailure

  async function dispatch(action: MissionActionInput['action']) {
    if (!controller || working || loading || loadFailure || !hasTarget) return
    if (action === 'championship' && (!selectedMission || !championshipReady)) return

    const input: MissionActionInput =
      action === 'championship'
        ? {
            action,
            mission: {
              kind: 'existing',
              id: selectedMission?.id ?? '',
              revision: selectedMission?.updatedAtUtc ?? '',
            },
          }
        : selectedMission
          ? {
              action,
              mission: {
                kind: 'existing',
                id: selectedMission.id,
                revision: selectedMission.updatedAtUtc,
              },
            }
          : { action, mission: { kind: 'new', title: newTitle.trim() } }

    setActionState({ kind: 'working', action })
    try {
      const result = await controller.dispatch(input)
      setActionState({ kind: 'completed', result })
    } catch (error) {
      setActionState({ kind: 'failed', message: plainReason(error) })
    }
  }

  const championshipReason = !configured
    ? 'Connect the protected dispatcher first.'
    : loadFailure
      ? 'Mission Log is unavailable.'
      : isNew
        ? 'Create the mission with Fast Break first.'
        : !championshipReady
          ? 'Championship requires independent, rerunnable verification.'
          : ''

  return (
    <AppShell>
      <section className={styles.page} aria-labelledby="console-title">
        <header className={styles.header}>
          <p className={styles.eyebrow}>Owner console</p>
          <h1 id="console-title">Mission Control</h1>
        </header>

        <div className={styles.missionPanel}>
          <label className={styles.label} htmlFor="mission-select">
            Mission
          </label>
          <select
            id="mission-select"
            className={styles.select}
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setActionState({ kind: 'idle' })
            }}
            disabled={loading}
          >
            {loading ? <option value={NEW_MISSION}>Loading Mission Log...</option> : null}
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.title} - {STATUS_LABEL[mission.status]}
              </option>
            ))}
            {!loading ? <option value={NEW_MISSION}>New mission...</option> : null}
          </select>

          {isNew && !loading ? (
            <div className={styles.newMission}>
              <label className={styles.label} htmlFor="mission-title">
                Outcome
              </label>
              <input
                id="mission-title"
                className={styles.input}
                value={newTitle}
                maxLength={160}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="One user-visible outcome"
                autoComplete="off"
              />
            </div>
          ) : null}

          {selectedMission ? <MissionDetails mission={selectedMission} /> : null}

          <p className={styles.connection} data-connected={connected}>
            {!configured
              ? 'Protected dispatcher not connected'
              : loading
                ? 'Connecting Mission Log...'
                : connected
                  ? 'Mission Log connected'
                  : 'Mission Log unavailable'}
          </p>
        </div>

        <div className={styles.feedback} aria-live="polite" role="status">
          {loadFailure ? <span className={styles.failed}>Mission Log: {loadFailure}</span> : null}
          {!loadFailure && actionState.kind === 'working' ? 'Sending...' : null}
          {actionState.kind === 'completed' ? (
            <span className={styles.completed}>
              Receipt recorded.{' '}
              <a href={actionState.result.receipt.url} target="_blank" rel="noreferrer">
                Open mission log
              </a>
            </span>
          ) : null}
          {actionState.kind === 'failed' ? (
            <span className={styles.failed}>Failed: {actionState.message}</span>
          ) : null}
          {actionState.kind === 'idle' && championshipReason ? (
            <span>{championshipReason}</span>
          ) : null}
        </div>

        <div className={styles.actions} role="group" aria-label="Owner actions">
          <Button
            size="lg"
            onClick={() => dispatch('fast_break')}
            disabled={!connected || !hasTarget || working || loading}
          >
            Run Fast Break
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => dispatch('championship')}
            disabled={!championshipReady || !connected || working}
            title={championshipReason || undefined}
          >
            Championship
          </Button>
        </div>
      </section>
    </AppShell>
  )
}

function MissionDetails({ mission }: { mission: Mission }) {
  return (
    <dl className={styles.details}>
      <div>
        <dt>Status</dt>
        <dd>{STATUS_LABEL[mission.status]}</dd>
      </div>
      <div>
        <dt>Updated</dt>
        <dd>{new Date(mission.updatedAtUtc).toLocaleString()}</dd>
      </div>
      {mission.proof ? (
        <div className={styles.proof}>
          <dt>Proof</dt>
          <dd>
            <code>{mission.proof.command}</code>
            <span>
              {mission.proof.verifier} verified {mission.proof.artifact}
            </span>
          </dd>
        </div>
      ) : null}
      <div>
        <dt>Log</dt>
        <dd>
          <a href={mission.issueUrl} target="_blank" rel="noreferrer">
            Open issue
          </a>
        </dd>
      </div>
    </dl>
  )
}

function plainReason(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/network|fetch|timeout|abort/i.test(message)) return 'Could not reach the dispatcher.'
  if (/40[13]|not allowed|unauthorized/i.test(message)) return 'This action is not allowed here.'
  if (/5\d\d|unavailable/i.test(message)) return 'The dispatcher is unavailable.'
  return 'The request did not complete.'
}
