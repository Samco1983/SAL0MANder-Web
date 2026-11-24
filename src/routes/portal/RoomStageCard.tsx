import { useEffect, useState } from 'react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildChildActor } from '@/portal/access'
import { FUN_GAMES } from '@/portal/parentActions'
import {
  closeRoomHardEnd,
  formatCountdown,
  getRoomClockStatus,
  joinRoom,
  leaveRoom,
} from '@/portal/roomActions'
import { portalStorage } from '@/portal/storage'
import type { PortalState } from '@/portal/types'
import styles from './PortalPage.module.css'

const GAME_NAMES: Record<string, string> = Object.fromEntries(FUN_GAMES.map((g) => [g.id, g.label]))

export function RoomStageCard({
  state,
  inviteId,
  childId,
  onStateChange,
  onClose,
}: {
  state: PortalState
  inviteId: string
  childId: string
  onStateChange: (next: PortalState) => void
  onClose: () => void
}) {
  const invite = state.roomInvites.find((r) => r.id === inviteId)
  const child = state.children.find((c) => c.id === childId)
  const [clockMs, setClockMs] = useState(() => {
    const startMs = invite ? Date.parse(invite.openedAt ?? invite.startsAt) : Date.now()
    const endMs = invite ? Date.parse(invite.endsAt) : Date.now()
    const now = Date.now()
    return !Number.isNaN(endMs) && now >= endMs ? startMs : now
  })
  const [roomError, setRoomError] = useState('')

  const status = invite ? getRoomClockStatus(invite, clockMs) : null
  const isJoined = Boolean(invite?.activeChildIds.includes(childId))
  const childActor = buildChildActor(state, childId)

  useEffect(() => {
    if (!invite || status?.phase !== 'running') return
    const timer = window.setInterval(() => setClockMs((ms) => ms + 1000), 1000)
    return () => window.clearInterval(timer)
  }, [invite, status?.phase])

  if (!invite || !child || !status) {
    return (
      <Card title="Game room" headingLevel={2}>
        <p className={styles.warningText} role="alert">Room invite not found or unavailable.</p>
        <Button size="sm" variant="secondary" onClick={onClose}>Back</Button>
      </Card>
    )
  }

  const gameLabel = GAME_NAMES[invite.gameId] ?? invite.gameId
  const nowIso = new Date(clockMs).toISOString()

  function handleJoin() {
    setRoomError('')
    try {
      const res = joinRoom(portalStorage, childActor, invite!.id, nowIso)
      onStateChange(res.state)
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Join refused.')
    }
  }

  function handleLeave() {
    setRoomError('')
    try {
      const res = leaveRoom(portalStorage, childActor, invite!.id, nowIso)
      onStateChange(res.state)
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to leave room.')
    }
  }

  function jumpToWarning() {
    const endMs = Date.parse(invite!.endsAt)
    if (!Number.isNaN(endMs)) setClockMs(endMs - 45_000)
  }

  function jumpToHardEnd() {
    const endMs = Date.parse(invite!.endsAt)
    const endIso = !Number.isNaN(endMs) ? new Date(endMs).toISOString() : new Date().toISOString()
    setClockMs(Date.parse(endIso))
    onStateChange(closeRoomHardEnd(portalStorage, invite!.id, endIso))
  }

  return (
    <Card title={`Placeholder Game Room — ${gameLabel} (code ${invite.roomCode})`} headingLevel={2}>
      <p className={styles.note}>
        Signed in via parent room link as <strong>{child.nickname}</strong> · Fun room only (no chat, no multiplayer backend, never earns belts or stripes).
      </p>

      {status.phase === 'ended' ? (
        <div className={styles.stack} data-testid="room-goodbye">
          <p className={styles.statusCallout} role="status">
            <strong>Goodbye!</strong> This room closed automatically on schedule ({invite.endsAt}). Fun rooms die when the clock hits 0:00 — see you next race!
          </p>
          <div className={styles.actions}>
            <Button size="sm" variant="secondary" onClick={handleJoin}>Try joining after end</Button>
            <Button size="sm" onClick={onClose}>Leave goodbye screen</Button>
          </div>
        </div>
      ) : (
        <div className={styles.stack}>
          <p className={styles.checkLabel} data-testid="room-countdown">
            {status.phase === 'before_open'
              ? 'Status: Waiting for mentor to open the room'
              : `Time remaining: ${formatCountdown(status.remainingSec)} · ${isJoined ? `${child.nickname} is in the room` : `${child.nickname} left (can rejoin while running)`}`}
          </p>

          {status.sixtySecondWarning ? (
            <p className={styles.alertCallout} role="alert" data-testid="room-60s-warning">
              60-second warning: room closes automatically in {formatCountdown(status.remainingSec)}.
            </p>
          ) : null}

          <div className={styles.actions}>
            {!isJoined ? (
              <Button size="sm" onClick={handleJoin}>{status.phase === 'running' ? 'Join / Rejoin room' : 'Join room'}</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={handleLeave}>Leave room</Button>
            )}
            {status.phase === 'running' ? (
              <>
                <Button size="sm" variant="ghost" onClick={jumpToWarning}>Jump to 45s left (60s warning)</Button>
                <Button size="sm" variant="ghost" onClick={jumpToHardEnd}>Jump to hard end (0:00)</Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onClose}>Back</Button>
          </div>
        </div>
      )}

      {roomError ? <p className={styles.alertCallout} role="alert" data-testid="room-error">{roomError}</p> : null}
    </Card>
  )
}
