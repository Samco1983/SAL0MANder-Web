import { useMemo, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildMentorActor, buildParentActor, can, type ParentSessionScope } from '@/portal/access'
import { runAccessChecks } from '@/portal/accessChecks'
import {
  approveQuestionByEmailForward,
  approveQuestionWithLinkAndCode,
  confirmOldEmailForChange,
  pullBackApprovalAndLock,
  requestParentStepUpCode,
} from '@/portal/approvalLayers'
import { respondToRoomInvite } from '@/portal/roomActions'
import { createSeedState } from '@/portal/seed'
import { portalStorage } from '@/portal/storage'
import type { PortalState } from '@/portal/types'
import { ChildProfileView } from './ChildProfileView'
import { MentorView } from './MentorView'
import { ParentAccountView } from './ParentAccountView'
import { RoomStageCard } from './RoomStageCard'
import styles from './PortalPage.module.css'

export const PORTAL_DEMO_BANNER =
  'DEMO — fictional families, local-only storage, simulated email.'

type PortalTab = 'access' | 'parent' | 'child' | 'mentor' | 'inbox'

type SimulatedDeviceChoice = {
  id: string
  label: string
  networkTag: string
  isTeenDevice: boolean
}

const UNREGISTERED_SHARED_LAPTOP: SimulatedDeviceChoice = {
  id: 'dev_shared_home_laptop',
  label: 'Shared home laptop (unregistered, same home Wi-Fi)',
  networkTag: 'home-wifi-elena',
  isTeenDevice: false,
}

export function PortalPage() {
  const [tab, setTab] = useState<PortalTab>('access')
  const [state, setState] = useState<PortalState>(() => portalStorage.load())
  const [signedInSession, setSignedInSession] = useState<{ householdId: string; scope: ParentSessionScope } | null>(null)
  const [lockedChildId, setLockedChildId] = useState<string | null>(null)
  const [activeDeviceId, setActiveDeviceId] = useState<string>('dev_elena_phone')
  const [activeRoom, setActiveRoom] = useState<{ inviteId: string; childId: string } | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [inboxNotice, setInboxNotice] = useState('')
  const [inboxError, setInboxError] = useState('')
  const [inboxOtpInputs, setInboxOtpInputs] = useState<Record<string, string>>({})
  const [forwardFromInputs, setForwardFromInputs] = useState<Record<string, string>>({})

  const checks = useMemo(() => runAccessChecks(createSeedState()), [])
  const passedCount = checks.filter((c) => c.passed).length
  const allPassed = passedCount === checks.length

  const deviceChoices: SimulatedDeviceChoice[] = [
    ...state.devices
      .filter((d) => d.revokedAt === null)
      .map((d) => ({
        id: d.id,
        label: d.label,
        networkTag: d.networkTag,
        isTeenDevice: d.deviceKind === 'teen_device',
      })),
    UNREGISTERED_SHARED_LAPTOP,
  ]
  const activeDevice = deviceChoices.find((d) => d.id === activeDeviceId) ?? deviceChoices[0] ?? UNREGISTERED_SHARED_LAPTOP

  const samuelActor = buildMentorActor(state, 'mentor_samuel')
  const mentorB = buildMentorActor(state, 'mentor_b')
  const mentorBHouseholds = state.households.filter((record) =>
    can(mentorB, 'view', { type: 'household', record }),
  )
  const mentorBRevoked = state.assignments.find((a) => a.id === 'asgn_b_elena')?.revokedAt !== null

  function handleRevokeMentorB() {
    setState(portalStorage.revokeAssignment(samuelActor, 'asgn_b_elena'))
    setStatusMessage('Revoked Mentor B — visible households dropped to 0 immediately.')
  }

  function handleResetSeed() {
    setState(portalStorage.reset())
    setSignedInSession(null)
    setLockedChildId(null)
    setActiveDeviceId('dev_elena_phone')
    setActiveRoom(null)
    setInboxNotice('')
    setInboxError('')
    setStatusMessage('Demo storage reset to clean fictional seed (3 households, 5 kids, 3 mentors).')
  }

  return (
    <AppShell>
      <div className={styles.stack}>
        <p className={styles.demoBanner} role="status">{PORTAL_DEMO_BANNER}</p>

        <div className={styles.headerRow}>
          <h1 className={styles.title}>SAL0MANder Tutoring Portal (Phase 1 Demo)</h1>
          <div className={styles.actions} role="tablist" aria-label="Portal views">
            <Button size="sm" variant={tab === 'access' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'access'} onClick={() => { setTab('access'); setActiveRoom(null) }}>
              Access Checks
            </Button>
            <Button size="sm" variant={tab === 'parent' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'parent'} onClick={() => { setTab('parent'); setActiveRoom(null) }}>
              Parent Account
            </Button>
            <Button size="sm" variant={tab === 'child' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'child'} onClick={() => { setTab('child'); setActiveRoom(null) }}>
              Child Profile
            </Button>
            <Button size="sm" variant={tab === 'mentor' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'mentor'} onClick={() => { setTab('mentor'); setActiveRoom(null) }}>
              Mentor View
            </Button>
            <Button size="sm" variant={tab === 'inbox' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'inbox'} onClick={() => { setTab('inbox'); setActiveRoom(null) }}>
              Simulated Inbox ({state.inbox.length})
            </Button>
          </div>
        </div>

        <div className={styles.checkItem} data-testid="device-simulator-bar">
          <div className={styles.checkMeta}>
            <p className={styles.checkLabel}>Active simulated device (tests Layer 3 teen-device block, Layer 5 flags, Layer 9 Chromebook PIN)</p>
            <p className={styles.checkDetail}>
              Current: <strong>{activeDevice.label}</strong> · Network: <code>{activeDevice.networkTag}</code>
              {activeDevice.isTeenDevice ? ' · Teen-registered device (parent approvals blocked)' : ''}
            </p>
          </div>
          <label className={styles.field}>
            <span>Switch simulated device</span>
            <select
              className={styles.input}
              aria-label="Active simulated device"
              value={activeDevice.id}
              onChange={(e) => setActiveDeviceId(e.target.value)}
            >
              {deviceChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.networkTag})
                </option>
              ))}
            </select>
          </label>
        </div>

        {activeRoom ? (
          <RoomStageCard
            key={activeRoom.inviteId}
            state={state}
            inviteId={activeRoom.inviteId}
            childId={activeRoom.childId}
            onStateChange={setState}
            onClose={() => setActiveRoom(null)}
          />
        ) : null}

        {!activeRoom && tab === 'parent' ? (
          <ParentAccountView
            state={state}
            signedInHouseholdId={signedInSession?.householdId ?? null}
            sessionScope={signedInSession?.scope ?? 'full_parent'}
            activeDeviceId={activeDevice.id}
            activeNetworkTag={activeDevice.networkTag}
            onStateChange={setState}
            onSignOut={() => { setSignedInSession(null); setLockedChildId(null) }}
            onOpenChildProfile={(childId) => { setLockedChildId(childId); setTab('child') }}
            onOpenInbox={() => setTab('inbox')}
            onOpenRoom={(inviteId, childId) => setActiveRoom({ inviteId, childId })}
          />
        ) : null}

        {!activeRoom && tab === 'child' ? (
          <ChildProfileView
            state={state}
            activeDeviceId={activeDevice.id}
            activeNetworkTag={activeDevice.networkTag}
            initialChildId={lockedChildId ?? undefined}
            onStateChange={setState}
            onOpenRoom={(inviteId, childId) => setActiveRoom({ inviteId, childId })}
          />
        ) : null}

        {!activeRoom && tab === 'mentor' ? <MentorView state={state} onStateChange={setState} /> : null}

        {!activeRoom && tab === 'inbox' ? (
          <div className={styles.stack}>
            {inboxNotice ? <p className={styles.statusCallout} role="status">{inboxNotice}</p> : null}
            {inboxError ? <p className={styles.alertCallout} role="alert">{inboxError}</p> : null}
            <Card title="Simulated Email Inbox (in-app only — no real email sent)" headingLevel={2}>
              {state.inbox.length === 0 ? (
                <p className={styles.note}>Inbox is empty.</p>
              ) : (
                <ul className={styles.checkList}>
                  {state.inbox.map((email) => {
                    const pendingQ = email.relatedQuestionId
                      ? state.askQuestions.find((q) => q.id === email.relatedQuestionId && q.status === 'waiting_parent_review')
                      : undefined
                    const linkedRoom = email.relatedRoomInviteId
                      ? state.roomInvites.find((r) => r.id === email.relatedRoomInviteId)
                      : undefined
                    const pullBackTok = email.pullBackTokenId
                      ? state.pullBackTokens.find((t) => t.tokenId === email.pullBackTokenId && t.usedAt === null)
                      : undefined
                    const emailChangePending = email.emailChangeConfirmTokenId && email.householdId
                      ? state.households.find((h) => h.id === email.householdId)?.pendingEmailChange
                      : null
                    const canConfirmOldEmail =
                      emailChangePending &&
                      emailChangePending.confirmTokenId === email.emailChangeConfirmTokenId &&
                      emailChangePending.oldAddressConfirmedAt === null &&
                      emailChangePending.cancelledAt === null

                    return (
                      <li key={email.id} className={styles.checkItem}>
                        <div className={styles.checkMeta}>
                          <p className={styles.checkLabel}>{email.subject}</p>
                          <p className={styles.checkDetail}>To: {email.to} · Status: {email.status} · {email.sentAt}</p>
                          <p className={styles.checkDetail}>{email.body}</p>
                        </div>

                        {email.kind === 'sign_in_link' && email.householdId ? (
                          <div className={styles.actions}>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSignedInSession({ householdId: email.householdId!, scope: 'full_parent' })
                                setTab('parent')
                              }}
                            >
                              Open sign-in link
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSignedInSession({ householdId: email.householdId!, scope: 'profile_chooser_only' })
                                setTab('parent')
                              }}
                            >
                              Open as forwarded link (teen)
                            </Button>
                          </div>
                        ) : null}

                        {email.kind === 'question_review' && pendingQ && email.householdId && email.approvalTokenId ? (
                          <div className={styles.formStack}>
                            <div className={styles.actions}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setInboxError('')
                                  const res = requestParentStepUpCode(portalStorage, email.householdId!, 'approve_question', pendingQ.id)
                                  setState(res.state)
                                  setInboxOtpInputs((prev) => ({ ...prev, [pendingQ.id]: res.challenge.code }))
                                  setInboxNotice(`Sent fresh 6-digit code (${res.challenge.code}) to ${email.to}.`)
                                }}
                              >
                                Send one-time code
                              </Button>
                              <input
                                type="text"
                                aria-label={`One-time code for ${pendingQ.id}`}
                                placeholder="6-digit code"
                                className={styles.input}
                                value={inboxOtpInputs[pendingQ.id] ?? ''}
                                onChange={(e) => setInboxOtpInputs((prev) => ({ ...prev, [pendingQ.id]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  setInboxError('')
                                  try {
                                    const next = approveQuestionWithLinkAndCode(
                                      portalStorage,
                                      buildParentActor(state, email.householdId!),
                                      {
                                        questionId: pendingQ.id,
                                        tokenId: email.approvalTokenId!,
                                        stepUpCode: inboxOtpInputs[pendingQ.id] ?? '',
                                        deviceId: activeDevice.id,
                                        networkTag: activeDevice.networkTag,
                                      },
                                    )
                                    setState(next)
                                    setInboxNotice('Parent approved question with single-use link + fresh code. "Was this you?" email sent.')
                                  } catch (err) {
                                    setState(portalStorage.load())
                                    setInboxError(err instanceof Error ? err.message : 'Approval blocked.')
                                  }
                                }}
                              >
                                Approve with link + code
                              </Button>
                            </div>
                            <div className={styles.actions}>
                              <input
                                type="email"
                                aria-label={`Forward sender email for ${pendingQ.id}`}
                                className={styles.input}
                                value={forwardFromInputs[pendingQ.id] ?? email.to}
                                onChange={(e) => setForwardFromInputs((prev) => ({ ...prev, [pendingQ.id]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setInboxError('')
                                  const fromEmail = forwardFromInputs[pendingQ.id] ?? email.to
                                  try {
                                    const next = approveQuestionByEmailForward(portalStorage, {
                                      questionId: pendingQ.id,
                                      fromEmail,
                                      deviceId: activeDevice.id,
                                      networkTag: activeDevice.networkTag,
                                    })
                                    setState(next)
                                    setInboxNotice(`Verified email forward from ${fromEmail} approved and stamped the question.`)
                                  } catch (err) {
                                    setState(portalStorage.load())
                                    setInboxError(err instanceof Error ? err.message : 'Forward rejected.')
                                  }
                                }}
                              >
                                Forward from this address
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {email.kind === 'approval_receipt_check' && pullBackTok && email.householdId && email.relatedQuestionId ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setInboxError('')
                              const next = pullBackApprovalAndLock(
                                portalStorage,
                                email.householdId!,
                                email.relatedQuestionId!,
                                pullBackTok.tokenId,
                              )
                              setState(next)
                              setInboxNotice('Pulled question back from Mr. Sam and locked household approvals until parent signs in with a fresh code.')
                            }}
                          >
                            Pull back &amp; lock approvals
                          </Button>
                        ) : null}

                        {email.kind === 'email_change_confirm' && canConfirmOldEmail && email.householdId ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setInboxError('')
                              const next = confirmOldEmailForChange(
                                portalStorage,
                                buildParentActor(state, email.householdId!),
                                email.householdId!,
                                email.emailChangeConfirmTokenId!,
                              )
                              setState(next)
                              setInboxNotice('Confirmed from old parent address. Mandatory 48-hour safety hold started.')
                            }}
                          >
                            Confirm from old address (start 48 h hold)
                          </Button>
                        ) : null}

                        {email.kind === 'room_invite' && linkedRoom && email.householdId ? (
                          <div className={styles.actions}>
                            {linkedRoom.parentApproval === 'pending' ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setState(respondToRoomInvite(portalStorage, buildParentActor(state, email.householdId!), linkedRoom.id, 'approved'))
                                  setInboxNotice(`Approved ${linkedRoom.gameId} room (${linkedRoom.roomCode}).`)
                                }}
                              >
                                Approve room (Yes)
                              </Button>
                            ) : null}
                            {(linkedRoom.parentApproval === 'approved' || linkedRoom.parentApproval === 'standing_yes') && !linkedRoom.closedAt ? (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => setActiveRoom({ inviteId: linkedRoom.id, childId: linkedRoom.childId })}>
                                  Open room link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setState(respondToRoomInvite(portalStorage, buildParentActor(state, email.householdId!), linkedRoom.id, 'declined'))
                                    setInboxNotice(`Revoked ${linkedRoom.gameId} room (${linkedRoom.roomCode}).`)
                                  }}
                                >
                                  Revoke (No)
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        ) : null}

        {!activeRoom && tab === 'access' ? (
          <div className={styles.stack}>
            <div className={styles.headerRow}>
              <h2 className={styles.sectionTitle}>Access Checks</h2>
              <span className={`${styles.badge} ${allPassed ? styles.pass : styles.fail}`} data-testid="access-checks-summary">
                {allPassed ? 'PASS' : 'FAIL'} · {passedCount}/{checks.length} checks passed
              </span>
            </div>

            <Card title="Policy assertions (single can(actor, action, record) rule)" headingLevel={2}>
              <ul className={styles.checkList}>
                {checks.map((check) => (
                  <li key={check.id} className={styles.checkItem}>
                    <div className={styles.checkMeta}>
                      <p className={styles.checkLabel}>{check.label}</p>
                      <p className={styles.checkDetail}>{check.detail}</p>
                    </div>
                    <span className={`${styles.badge} ${check.passed ? styles.pass : styles.fail}`}>
                      {check.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Interactive revocation check (local adapter)" headingLevel={2}>
              <p className={styles.note}>
                Mentor B currently sees <strong>{mentorBHouseholds.length}</strong> household(s):{' '}
                {mentorBHouseholds.length > 0 ? mentorBHouseholds.map((h) => h.parentName).join(', ') : 'none (revoked)'}.
              </p>
              <div className={styles.actions}>
                <Button onClick={handleRevokeMentorB} disabled={mentorBRevoked}>Revoke Mentor B as Mr. Sam</Button>
                <Button variant="secondary" onClick={handleResetSeed}>Reset fictional seed</Button>
              </div>
              {statusMessage ? <p className={styles.note} role="status">{statusMessage}</p> : null}
            </Card>

            <div className={styles.grid}>
              <Card title="Seed households & kids" headingLevel={2}>
                <ul className={styles.miniList}>
                  {state.households.map((hh) => (
                    <li key={hh.id}>
                      <strong>{hh.parentName}</strong> ({hh.consentRecord.status}):{' '}
                      {state.children.filter((c) => c.householdId === hh.id).map((c) => `${c.nickname} (${c.currentBelt})`).join(', ')}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Seed mentors" headingLevel={2}>
                <ul className={styles.miniList}>
                  {state.mentors.map((m) => (
                    <li key={m.id}><strong>{m.displayName}</strong> — {m.roles.join(' + ')}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
