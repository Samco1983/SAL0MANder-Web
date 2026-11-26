import { useState, type FormEvent } from 'react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import {
  buildChildActor,
  buildForwardedSignInActor,
  buildParentActor,
  can,
  type ParentSessionScope,
} from '@/portal/access'
import {
  approveQuestionWithLinkAndCode,
  authorizeParentBillingAction,
  cancelParentEmailChange,
  finalizeParentEmailChange,
  listVisibleApprovalLogs,
  rememberTeenDevice,
  requestParentEmailChange,
  requestParentStepUpCode,
  revokeRegisteredDevice,
  unlockParentApprovals,
  unlockTeenFromForwardedSignIn,
} from '@/portal/approvalLayers'
import { formatParentBeltSentence } from '@/portal/belts'
import {
  ASK_MODE_HELP, AUTO_SHOW_WARNING, CONSENT_NOTICE_POINTS, FUN_GAMES, LESSON_GAMES,
  completeParentConsent, listParentReceipts, requestParentSignInLink, saveChildProfile,
  showFeedbackToChild, updateFourSettings, withdrawParentConsent,
} from '@/portal/parentActions'
import { respondToRoomInvite } from '@/portal/roomActions'
import { portalStorage } from '@/portal/storage'
import type { AskMode, ChildProfile, EmailMode, PortalState } from '@/portal/types'
import styles from './PortalPage.module.css'

type ParentSubTab = 'overview' | 'consent' | 'profiles' | 'settings' | 'security'

export function ParentAccountView({
  state,
  signedInHouseholdId,
  sessionScope = 'full_parent',
  activeDeviceId = 'dev_elena_phone',
  activeNetworkTag = 'cell-elena',
  onStateChange,
  onSignOut,
  onOpenChildProfile,
  onOpenInbox,
  onOpenRoom,
}: {
  state: PortalState
  signedInHouseholdId: string | null
  sessionScope?: ParentSessionScope
  activeDeviceId?: string
  activeNetworkTag?: string
  onStateChange: (next: PortalState) => void
  onSignOut: () => void
  onOpenChildProfile?: (childId: string) => void
  onOpenInbox: () => void
  onOpenRoom?: (inviteId: string, childId: string) => void
}) {
  const [subTab, setSubTab] = useState<ParentSubTab>('overview')
  const [emailInput, setEmailInput] = useState('elena.demo@family.example')
  const [notice, setNotice] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [consentMethod, setConsentMethod] = useState<'simulated_form' | 'simulated_call'>('simulated_form')
  const [exportJson, setExportJson] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingChildId, setEditingChildId] = useState<string | undefined>(undefined)
  const [nickname, setNickname] = useState('')
  const [level, setLevel] = useState('7th Grade Math')
  const [pin, setPin] = useState('')
  const [firstLine, setFirstLine] = useState('')
  const [selectedChildId, setSelectedChildId] = useState('')
  const [chooserPins, setChooserPins] = useState<Record<string, string>>({})
  const [questionOtps, setQuestionOtps] = useState<Record<string, string>>({})
  const [unlockCode, setUnlockCode] = useState('')
  const [newParentEmail, setNewParentEmail] = useState('')
  const [emailChangeOtp, setEmailChangeOtp] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('')
  const [deviceChildId, setDeviceChildId] = useState('')
  const [deviceOtp, setDeviceOtp] = useState('')
  const [billingOtp, setBillingOtp] = useState('')

  const hh = signedInHouseholdId ? state.households.find((h) => h.id === signedInHouseholdId) : undefined

  if (!hh) {
    return (
      <Card title="Parent sign-in (simulated email link)" headingLevel={2}>
        <p className={styles.note}>
          The parent is the account owner. Enter a fictional parent email to send a simulated sign-in link to the in-app Inbox panel (no passwords, no real email).
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            const res = requestParentSignInLink(portalStorage, emailInput)
            onStateChange(res.state)
            setNotice(res.message)
          }}
          className={styles.formStack}
        >
          <label className={styles.field}>
            <span>Parent email</span>
            <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className={styles.input} />
          </label>
          <div className={styles.actions}>
            <Button type="submit">Send sign-in link</Button>
            <Button type="button" variant="secondary" onClick={onOpenInbox}>Open Simulated Inbox</Button>
          </div>
        </form>
        <div className={styles.actions}>
          {state.households.map((h) => (
            <Button key={h.id} type="button" variant="ghost" size="sm" onClick={() => setEmailInput(h.parentEmail)}>
              Use {h.parentName} ({h.consentRecord.status})
            </Button>
          ))}
        </div>
        {notice ? <p className={styles.note} role="status">{notice}</p> : null}
      </Card>
    )
  }

  // Acceptance Row #5: Forwarded parent sign-in link reaches ONLY the profile chooser & teen PIN profile — NEVER parent powers.
  if (sessionScope === 'profile_chooser_only') {
    const chooserActor = buildForwardedSignInActor(state, hh.id)
    const chooserKids = state.children.filter((record) => can(chooserActor, 'view', { type: 'child', record }))
    return (
      <div className={styles.stack} data-testid="forwarded-signin-chooser">
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.sectionTitle}>Profile chooser (teen sign-in only)</h2>
            <p className={styles.note}>
              Opened from a forwarded parent sign-in link. Teens can open ONLY their own profile with their PIN. Approving questions, changing settings, buying anything, or changing the parent email are blocked here and require a fresh one-time code sent to {hh.parentEmail}.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
        </div>
        {errorMsg ? <p className={styles.alertCallout} role="alert">{errorMsg}</p> : null}
        <Card title="Choose your profile (PIN required)" headingLevel={2}>
          <ul className={styles.checkList}>
            {chooserKids.map((child) => (
              <li key={child.id} className={styles.checkItem}>
                <div className={styles.checkMeta}>
                  <p className={styles.checkLabel}>{child.nickname} · {child.level}</p>
                  <p className={styles.checkDetail}>{child.pinHash ? 'Enter your profile PIN to open your own profile.' : 'No PIN set — opens teen profile only.'}</p>
                </div>
                <div className={styles.actions}>
                  {child.pinHash ? (
                    <input
                      type="password"
                      aria-label={`PIN for ${child.nickname}`}
                      placeholder="PIN"
                      className={styles.input}
                      value={chooserPins[child.id] ?? ''}
                      onChange={(e) => setChooserPins((prev) => ({ ...prev, [child.id]: e.target.value }))}
                    />
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      setErrorMsg('')
                      try {
                        const res = unlockTeenFromForwardedSignIn(portalStorage, chooserActor, child.id, chooserPins[child.id] ?? '')
                        onStateChange(res.state)
                        onOpenChildProfile?.(child.id)
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'Unable to open teen profile.')
                      }
                    }}
                  >
                    Open {child.nickname}’s profile
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  const parentActor = buildParentActor(state, hh.id, 'full_parent')
  const myChildren = state.children.filter((record) => can(parentActor, 'view', { type: 'child', record }))
  const waitingReplies = state.feedback.filter((record) => can(parentActor, 'show_feedback_to_child', { type: 'feedback', record }))
  const waitingQuestions = state.askQuestions.filter((record) => can(parentActor, 'forward_question', { type: 'ask_question', record }))
  const heldQuestions = state.askQuestions.filter((record) => can(parentActor, 'view', { type: 'ask_question', record }) && record.status === 'held_undelivered')
  const pulledBackQuestions = state.askQuestions.filter((record) => can(parentActor, 'view', { type: 'ask_question', record }) && record.status === 'pulled_back')
  const myUpdates = state.parentUpdates.filter((record) => can(parentActor, 'view', { type: 'parent_update', record }))
  const myReceipts = listParentReceipts(state, parentActor)
  const myApprovalLogs = listVisibleApprovalLogs(state, parentActor)
  const myDevices = state.devices.filter((record) => can(parentActor, 'view', { type: 'device', record }))
  const activeChild = myChildren.find((c) => c.id === selectedChildId) ?? myChildren[0]
  const targetDeviceChild = myChildren.find((c) => c.id === deviceChildId) ?? myChildren[0]

  function beginEditChild(child: ChildProfile) {
    setEditingChildId(child.id)
    setNickname(child.nickname)
    setLevel(child.level)
    setPin(child.pinHash ? child.pinHash.replace(/^demo-pin-/, '') : '')
    setFirstLine(child.firstConversationLine)
  }

  function handleSaveChild(e: FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) return
    onStateChange(saveChildProfile(portalStorage, parentActor, hh!.id, { id: editingChildId, nickname, level, pin, firstConversationLine: firstLine }))
    setNotice(editingChildId ? `Updated ${nickname.trim()}'s profile.` : `Created child profile for ${nickname.trim()}.`)
    setEditingChildId(undefined); setNickname(''); setPin(''); setFirstLine('')
  }

  return (
    <div className={styles.stack}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>{hh.parentName}’s Membership</h2>
          <p className={styles.note}>
            Signed in as {hh.parentEmail} · Consent: <strong>{hh.consentRecord.status}</strong>
            {hh.consentRecord.verifiedAt ? ` (${hh.consentRecord.verifiedAt})` : ' (complete consent to unlock questions & profiles)'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
      </div>

      {hh.approvalsLockedAt ? (
        <div className={styles.alertCallout} role="alert" data-testid="approvals-locked-banner">
          <p><strong>Approvals locked</strong> ({hh.approvalsLockedAt}): {hh.approvalsLockedReason}</p>
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setErrorMsg('')
                const res = requestParentStepUpCode(portalStorage, hh.id, 'unlock_approvals')
                onStateChange(res.state)
                setUnlockCode(res.challenge.code)
                setNotice(`Sent unlock code (${res.challenge.code}) to ${hh.parentEmail}.`)
              }}
            >
              Send unlock code
            </Button>
            <input
              type="text"
              aria-label="Unlock approvals code"
              placeholder="6-digit code"
              className={styles.input}
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                setErrorMsg('')
                try {
                  onStateChange(unlockParentApprovals(portalStorage, parentActor, hh.id, unlockCode, activeDeviceId))
                  setUnlockCode('')
                  setNotice('Unlocked parent approvals after fresh one-time code verification.')
                } catch (err) {
                  onStateChange(portalStorage.load())
                  setErrorMsg(err instanceof Error ? err.message : 'Unable to unlock approvals.')
                }
              }}
            >
              Unlock approvals
            </Button>
          </div>
        </div>
      ) : null}

      <div className={styles.actions} role="tablist" aria-label="Parent sections">
        {([
          ['overview', 'Parent view'],
          ['consent', 'Consent'],
          ['profiles', 'Child profiles'],
          ['settings', 'Settings (5)'],
          ['security', `Security & devices (${myApprovalLogs.length})`],
        ] as const).map(([key, label]) => (
          <Button key={key} type="button" size="sm" variant={subTab === key ? 'primary' : 'secondary'} role="tab" aria-selected={subTab === key} onClick={() => setSubTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {notice ? <p className={styles.statusCallout} role="status">{notice}</p> : null}
      {errorMsg ? <p className={styles.alertCallout} role="alert">{errorMsg}</p> : null}

      {subTab === 'overview' ? (
        <div className={styles.stack}>
          <Card title={`Questions waiting for your approval (${waitingQuestions.length})`} headingLevel={2}>
            {waitingQuestions.length === 0 && heldQuestions.length === 0 && pulledBackQuestions.length === 0 ? (
              <p className={styles.note}>No questions waiting to approve right now.</p>
            ) : (
              <ul className={styles.checkList}>
                {waitingQuestions.map((q) => {
                  const kidName = myChildren.find((c) => c.id === q.childId)?.nickname ?? 'your teen'
                  const tok = state.approvalTokens.find((t) => t.questionId === q.id && t.usedAt === null && t.revokedAt === null)
                  return (
                    <li key={q.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>Question from {kidName} ({q.source === 'worksheet_open_response' ? 'open response' : 'Ask form'})</p>
                        <p className={styles.checkDetail}>{q.text}</p>
                        {tok ? <p className={styles.note}>Single-use approve link active until {tok.expiresAt} (needs fresh 6-digit code; blocked on teen device).</p> : null}
                        {q.photoPlaceholder ? <p className={styles.note}>Photo placeholder: {q.photoPlaceholder.label} (name covered: {q.photoPlaceholder.nameCovered ? 'yes' : 'no'})</p> : null}
                      </div>
                      <div className={styles.actions}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setErrorMsg('')
                            const res = requestParentStepUpCode(portalStorage, hh.id, 'approve_question', q.id)
                            onStateChange(res.state)
                            setQuestionOtps((prev) => ({ ...prev, [q.id]: res.challenge.code }))
                            setNotice(`Sent fresh 6-digit code (${res.challenge.code}) to ${hh.parentEmail}.`)
                          }}
                        >
                          Send 6-digit code
                        </Button>
                        <input
                          type="text"
                          aria-label={`Approval code for ${q.id}`}
                          placeholder="6-digit code"
                          className={styles.input}
                          value={questionOtps[q.id] ?? ''}
                          onChange={(e) => setQuestionOtps((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          disabled={!tok}
                          onClick={() => {
                            if (!tok) return
                            setErrorMsg('')
                            try {
                              onStateChange(
                                approveQuestionWithLinkAndCode(portalStorage, parentActor, {
                                  questionId: q.id,
                                  tokenId: tok.tokenId,
                                  stepUpCode: questionOtps[q.id] ?? '',
                                  deviceId: activeDeviceId,
                                  networkTag: activeNetworkTag,
                                }),
                              )
                              setNotice(`Approved ${kidName}'s question for Mr. Sam. "Was this you?" email sent to ${hh.parentEmail}.`)
                            } catch (err) {
                              onStateChange(portalStorage.load())
                              setErrorMsg(err instanceof Error ? err.message : 'Approval blocked.')
                            }
                          }}
                        >
                          Approve for Mr. Sam
                        </Button>
                      </div>
                    </li>
                  )
                })}
                {heldQuestions.map((q) => {
                  const kidName = myChildren.find((c) => c.id === q.childId)?.nickname ?? 'your teen'
                  return (
                    <li key={q.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>Held undelivered — {kidName}</p>
                        <p className={styles.checkDetail}>{q.text}</p>
                        <p className={styles.warningText}>Parent email was rejected; held here and never sent to Mr. Sam.</p>
                      </div>
                    </li>
                  )
                })}
                {pulledBackQuestions.map((q) => {
                  const kidName = myChildren.find((c) => c.id === q.childId)?.nickname ?? 'your teen'
                  return (
                    <li key={q.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>Pulled back — {kidName}</p>
                        <p className={styles.checkDetail}>{q.text}</p>
                        <p className={styles.warningText}>Pulled back via “Was this you?” email ({q.pulledBackAt}) and hidden from Mr. Sam.</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title={`Replies waiting for your yes (${waitingReplies.length})`} headingLevel={2}>
            {waitingReplies.length === 0 ? <p className={styles.note}>No replies waiting right now.</p> : (
              <ul className={styles.checkList}>
                {waitingReplies.map((fb) => {
                  const kidName = myChildren.find((c) => c.id === fb.childId)?.nickname ?? 'your child'
                  return (
                    <li key={fb.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>Reply for {kidName}</p>
                        <p className={styles.checkDetail}>{fb.sentText}</p>
                      </div>
                      <Button size="sm" onClick={() => { onStateChange(showFeedbackToChild(portalStorage, parentActor, fb.id)); setNotice(`Shared reply with ${kidName}'s profile.`) }}>
                        Show to {kidName}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {(() => {
            const myInvites = state.roomInvites.filter((record) => can(parentActor, 'view', { type: 'room_invite', record }))
            if (myInvites.length === 0) return null
            return (
              <Card title={`Game room invites (${myInvites.length})`} headingLevel={2}>
                <ul className={styles.checkList}>
                  {myInvites.map((inv) => {
                    const kidName = myChildren.find((c) => c.id === inv.childId)?.nickname ?? 'child'
                    const approved = inv.parentApproval === 'approved' || inv.parentApproval === 'standing_yes'
                    return (
                      <li key={inv.id} className={styles.checkItem}>
                        <div className={styles.checkMeta}>
                          <p className={styles.checkLabel}>{inv.gameId} for {kidName} · code {inv.roomCode} ({inv.parentApproval})</p>
                          <p className={styles.checkDetail}>Ends at {inv.endsAt} · {inv.openedAt ? 'Open now' : 'Waiting for Mr. Sam to open'}</p>
                        </div>
                        <div className={styles.actions}>
                          {inv.parentApproval === 'pending' ? (
                            <>
                              <Button size="sm" onClick={() => { onStateChange(respondToRoomInvite(portalStorage, parentActor, inv.id, 'approved')); setNotice(`Approved ${inv.gameId} room for ${kidName}.`) }}>
                                Approve room (Yes)
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { onStateChange(respondToRoomInvite(portalStorage, parentActor, inv.id, 'declined')); setNotice(`Declined ${inv.gameId} room for ${kidName}.`) }}>
                                Decline
                              </Button>
                            </>
                          ) : null}
                          {approved && !inv.closedAt ? (
                            <>
                              {onOpenRoom ? (
                                <Button size="sm" variant="secondary" onClick={() => onOpenRoom(inv.id, inv.childId)}>Open room link</Button>
                              ) : null}
                              <Button size="sm" variant="ghost" onClick={() => { onStateChange(respondToRoomInvite(portalStorage, parentActor, inv.id, 'declined')); setNotice(`Revoked ${inv.gameId} room for ${kidName} (removed from room).`) }}>
                                Revoke (No)
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })()}

          <Card title="Each child’s profile (as your child sees it)" headingLevel={2}>
            <div className={styles.grid}>
              {myChildren.map((child) => {
                const visibleReplies = state.feedback.filter((record) => can(buildChildActor(state, child.id), 'view', { type: 'feedback', record }))
                const hasWaiting = waitingReplies.some((f) => f.childId === child.id)
                return (
                  <div key={child.id} className={styles.childPreview} data-testid={`child-preview-${child.id}`}>
                    <p className={styles.checkLabel}>{child.nickname} · {child.level}</p>
                    <p className={styles.statusCallout} data-testid={`parent-belt-sentence-${child.id}`}>{formatParentBeltSentence(child)}</p>
                    <p className={styles.checkDetail}>Ask mode: {child.askMode} (no Auto-send)</p>
                    <p className={styles.checkDetail}>“{child.firstConversationLine}”</p>
                    <p className={styles.checkDetail}>Approved games: {child.approvedGames.length ? child.approvedGames.join(', ') : 'Free arcade only until consent'}</p>
                    {hasWaiting ? <p className={styles.warningText}>Mr. Sam replied — ask your parent to check their email and you’ll see it here.</p> : null}
                    {visibleReplies.length > 0 ? (
                      <ul className={styles.miniList}>{visibleReplies.map((r) => <li key={r.id}>Visible reply: {r.sentText}</li>)}</ul>
                    ) : <p className={styles.note}>No replies shown on child’s screen yet.</p>}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Friday notes" headingLevel={2}>
            {myUpdates.length === 0 ? <p className={styles.note}>No Friday notes yet.</p> : (
              <ul className={styles.checkList}>
                {myUpdates.map((u) => (
                  <li key={u.id} className={styles.checkItem}>
                    <div className={styles.checkMeta}>
                      <p className={styles.checkLabel}>{myChildren.find((c) => c.id === u.childId)?.nickname ?? 'Child'} — week of {u.weekOf} ({u.deliveryStatus})</p>
                      <p className={styles.checkDetail}>Worked on: {u.workedOn} · Needs help: {u.needsHelp} · Try at home: {u.tryAtHome}</p>
                      <p className={styles.checkDetail}>Note: {u.humanSentence}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className={styles.grid}>
            <Card title="Your family receipts" headingLevel={2}>
              {myReceipts.length === 0 ? <p className={styles.note}>No consent or approval receipts recorded yet.</p> : (
                <ul className={styles.miniList}>{myReceipts.map((r) => <li key={r.id}>{r.label} — {r.at}</li>)}</ul>
              )}
            </Card>
            <Card title="Export & Delete" headingLevel={2}>
              <div className={styles.actions}>
                <Button variant="secondary" size="sm" onClick={() => { setExportJson(JSON.stringify(portalStorage.exportHousehold(parentActor, hh.id), null, 2)); setNotice('Exported household records in-account (never emailed).') }}>
                  Export my family data
                </Button>
                {!confirmDelete ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>Delete my membership</Button>
                ) : (
                  <Button size="sm" onClick={() => { onStateChange(portalStorage.deleteHousehold(parentActor, hh.id)); setConfirmDelete(false); setExportJson(null); onSignOut() }}>
                    Confirm delete ({hh.parentName})
                  </Button>
                )}
              </div>
              {exportJson ? <pre className={styles.codeBox} data-testid="household-export">{exportJson}</pre> : null}
            </Card>
          </div>
        </div>
      ) : null}

      {subTab === 'consent' ? (
        <Card title="Parental notice & consent (simulated verification)" headingLevel={2}>
          <ul className={styles.miniList}>{CONSENT_NOTICE_POINTS.map((line) => <li key={line}>{line}</li>)}</ul>
          <p className={styles.note}>
            Status: <strong>{hh.consentRecord.status}</strong> · Notice: {hh.consentRecord.noticeVersion}
            {hh.consentRecord.verifiedAt ? ` · Timestamp: ${hh.consentRecord.verifiedAt}` : ''}
          </p>
          <fieldset className={styles.fieldset}>
            <legend>Simulated verifiable consent method</legend>
            <label className={styles.radioRow}><input type="radio" name="consentMethod" checked={consentMethod === 'simulated_form'} onChange={() => setConsentMethod('simulated_form')} />Signed consent form scan (simulated)</label>
            <label className={styles.radioRow}><input type="radio" name="consentMethod" checked={consentMethod === 'simulated_call'} onChange={() => setConsentMethod('simulated_call')} />Short parent verification call (simulated)</label>
          </fieldset>
          <div className={styles.actions}>
            <Button onClick={() => { onStateChange(completeParentConsent(portalStorage, parentActor, hh.id, consentMethod)); setNotice('Recorded verified parental consent with timestamp (simulated).') }}>Record verified consent</Button>
            <Button variant="secondary" onClick={() => { onStateChange(withdrawParentConsent(portalStorage, parentActor, hh.id)); setNotice('Consent withdrawn: Ask Mr. Sam and game rooms are now Off.') }}>Withdraw consent</Button>
          </div>
        </Card>
      ) : null}

      {subTab === 'profiles' ? (
        <div className={styles.grid}>
          <Card title="Child profiles under your membership" headingLevel={2}>
            <ul className={styles.checkList}>
              {myChildren.map((c) => (
                <li key={c.id} className={styles.checkItem}>
                  <div className={styles.checkMeta}>
                    <p className={styles.checkLabel}>{c.nickname} ({c.level})</p>
                    <p className={styles.checkDetail}>PIN: {c.pinHash ? 'Set (child view only)' : 'None'} · {c.firstConversationLine}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => beginEditChild(c)}>Edit</Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={editingChildId ? 'Edit child profile' : 'Add child profile'} headingLevel={2}>
            <form onSubmit={handleSaveChild} className={styles.formStack}>
              <label className={styles.field}><span>First name or nickname (never last name)</span><input required value={nickname} onChange={(e) => setNickname(e.target.value)} className={styles.input} /></label>
              <label className={styles.field}><span>Math level</span><input required value={level} onChange={(e) => setLevel(e.target.value)} className={styles.input} /></label>
              <label className={styles.field}><span>Optional profile PIN (child view only, never parent controls)</span><input value={pin} onChange={(e) => setPin(e.target.value)} className={styles.input} placeholder="Optional 4 digits" /></label>
              <label className={styles.field}><span>First conversation line</span><input value={firstLine} onChange={(e) => setFirstLine(e.target.value)} className={styles.input} placeholder="What they told Mr. Sam" /></label>
              <div className={styles.actions}>
                <Button type="submit">{editingChildId ? 'Save profile changes' : 'Create child profile'}</Button>
                {editingChildId ? <Button type="button" variant="ghost" onClick={() => { setEditingChildId(undefined); setNickname(''); setPin(''); setFirstLine('') }}>Cancel</Button> : null}
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {subTab === 'settings' && activeChild ? (
        <SettingsPanel
          hh={hh}
          childrenList={myChildren}
          child={activeChild}
          onSelectChild={setSelectedChildId}
          onSave={(next) => { onStateChange(updateFourSettings(portalStorage, parentActor, hh.id, activeChild.id, next)); setNotice(`Saved settings for ${activeChild.nickname}.`) }}
        />
      ) : null}

      {subTab === 'security' ? (
        <div className={styles.stack}>
          <Card title={`Remembered devices (${myDevices.length}) — Layer 9`} headingLevel={2}>
            <p className={styles.note}>
              Sign in once on your teen’s Chromebook and remember it for their PIN profile only. Parent approvals are always blocked on teen-registered devices. Revoke any device at any time.
            </p>
            <ul className={styles.checkList}>
              {myDevices.map((d) => {
                const kidName = myChildren.find((c) => c.id === d.rememberedForChildId)?.nickname
                return (
                  <li key={d.id} className={styles.checkItem}>
                    <div className={styles.checkMeta}>
                      <p className={styles.checkLabel}>{d.label} {d.revokedAt ? '(Revoked)' : ''}</p>
                      <p className={styles.checkDetail}>
                        Type: {d.deviceKind} · Network: {d.networkTag}
                        {kidName ? ` · PIN profile: ${kidName}` : ''}
                      </p>
                    </div>
                    {!d.revokedAt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onStateChange(revokeRegisteredDevice(portalStorage, parentActor, hh.id, d.id))
                          setNotice(`Revoked device "${d.label}".`)
                        }}
                      >
                        Revoke device
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {targetDeviceChild ? (
              <div className={styles.formStack}>
                <label className={styles.field}>
                  <span>Remember teen device for</span>
                  <select className={styles.input} value={targetDeviceChild.id} onChange={(e) => setDeviceChildId(e.target.value)}>
                    {myChildren.map((c) => <option key={c.id} value={c.id}>{c.nickname}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Device label</span>
                  <input className={styles.input} value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} placeholder={`${targetDeviceChild.nickname}'s Chromebook`} />
                </label>
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setErrorMsg('')
                      const res = requestParentStepUpCode(portalStorage, hh.id, 'manage_devices')
                      onStateChange(res.state)
                      setDeviceOtp(res.challenge.code)
                      setNotice(`Sent device step-up code (${res.challenge.code}) to ${hh.parentEmail}.`)
                    }}
                  >
                    Send device code
                  </Button>
                  <input
                    type="text"
                    aria-label="Device step-up code"
                    placeholder="6-digit code"
                    className={styles.input}
                    value={deviceOtp}
                    onChange={(e) => setDeviceOtp(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      setErrorMsg('')
                      try {
                        const res = rememberTeenDevice(portalStorage, parentActor, hh.id, {
                          childId: targetDeviceChild.id,
                          label: deviceLabel || `${targetDeviceChild.nickname}'s Chromebook`,
                          networkTag: activeNetworkTag,
                          stepUpCode: deviceOtp,
                        })
                        onStateChange(res.state)
                        setDeviceLabel('')
                        setDeviceOtp('')
                        setNotice(`Remembered "${res.device.label}" for ${targetDeviceChild.nickname}'s PIN profile only.`)
                      } catch (err) {
                        onStateChange(portalStorage.load())
                        setErrorMsg(err instanceof Error ? err.message : 'Unable to remember device.')
                      }
                    }}
                  >
                    Remember this device
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Change parent email (old-address confirmation + 48 h hold) — Layer 7" headingLevel={2}>
            <p className={styles.note}>Current verified parent email: <strong>{hh.parentEmail}</strong></p>
            {hh.pendingEmailChange && !hh.pendingEmailChange.completedAt && !hh.pendingEmailChange.cancelledAt ? (
              <div className={styles.childPreview}>
                <p className={styles.checkLabel}>Pending change to {hh.pendingEmailChange.newEmail}</p>
                <p className={styles.checkDetail}>
                  {hh.pendingEmailChange.oldAddressConfirmedAt
                    ? `Old address confirmed (${hh.pendingEmailChange.oldAddressConfirmedAt}). 48-hour hold until ${hh.pendingEmailChange.effectiveAt}.`
                    : `Waiting for confirmation from old address (${hh.pendingEmailChange.oldEmail}) in Simulated Inbox.`}
                </p>
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setErrorMsg('')
                      try {
                        onStateChange(finalizeParentEmailChange(portalStorage, hh.id))
                        setNotice('Parent email change finalized after 48-hour hold.')
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'Still within 48-hour hold.')
                      }
                    }}
                  >
                    Try finalizing now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onStateChange(cancelParentEmailChange(portalStorage, parentActor, hh.id))
                      setNotice('Cancelled pending parent email change.')
                    }}
                  >
                    Cancel change
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.formStack}>
                <label className={styles.field}>
                  <span>New parent email (fictional .example)</span>
                  <input type="email" className={styles.input} value={newParentEmail} onChange={(e) => setNewParentEmail(e.target.value)} placeholder="new.parent@family.example" />
                </label>
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setErrorMsg('')
                      const res = requestParentStepUpCode(portalStorage, hh.id, 'change_parent_email')
                      onStateChange(res.state)
                      setEmailChangeOtp(res.challenge.code)
                      setNotice(`Sent email-change code (${res.challenge.code}) to ${hh.parentEmail}.`)
                    }}
                  >
                    Send email-change code
                  </Button>
                  <input
                    type="text"
                    aria-label="Email change step-up code"
                    placeholder="6-digit code"
                    className={styles.input}
                    value={emailChangeOtp}
                    onChange={(e) => setEmailChangeOtp(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      setErrorMsg('')
                      try {
                        onStateChange(requestParentEmailChange(portalStorage, parentActor, hh.id, newParentEmail, emailChangeOtp, activeDeviceId))
                        setNewParentEmail('')
                        setEmailChangeOtp('')
                        setNotice('Sent old-address confirmation email to Simulated Inbox. 48-hour hold starts after old-address yes.')
                      } catch (err) {
                        onStateChange(portalStorage.load())
                        setErrorMsg(err instanceof Error ? err.message : 'Email change blocked.')
                      }
                    }}
                  >
                    Request email change
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Simulated purchase step-up check (Acceptance Row #5)" headingLevel={2}>
            <p className={styles.note}>Buying a lesson requires a verified parent + fresh one-time code sent to {hh.parentEmail} (never reachable from a forwarded link or teen device).</p>
            <div className={styles.actions}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setErrorMsg('')
                  const res = requestParentStepUpCode(portalStorage, hh.id, 'billing_action')
                  onStateChange(res.state)
                  setBillingOtp(res.challenge.code)
                  setNotice(`Sent billing verification code (${res.challenge.code}) to ${hh.parentEmail}.`)
                }}
              >
                Send billing code
              </Button>
              <input
                type="text"
                aria-label="Billing step-up code"
                placeholder="6-digit code"
                className={styles.input}
                value={billingOtp}
                onChange={(e) => setBillingOtp(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  setErrorMsg('')
                  try {
                    const res = authorizeParentBillingAction(portalStorage, parentActor, hh.id, '60-minute private lesson ($50)', billingOtp, activeDeviceId)
                    onStateChange(res.state)
                    setBillingOtp('')
                    setNotice(res.receipt)
                  } catch (err) {
                    onStateChange(portalStorage.load())
                    setErrorMsg(err instanceof Error ? err.message : 'Purchase blocked.')
                  }
                }}
              >
                Authorize simulated $50 lesson
              </Button>
            </div>
          </Card>

          <Card title={`Append-only approval log (${myApprovalLogs.length}) — Layer 8`} headingLevel={2}>
            {myApprovalLogs.length === 0 ? (
              <p className={styles.note}>No approval or security events recorded yet.</p>
            ) : (
              <ul className={styles.miniList} data-testid="parent-approval-log">
                {myApprovalLogs.slice().reverse().map((entry) => (
                  <li key={entry.id}>
                    #{entry.sequence} · {entry.at} · <strong>{entry.event}</strong> ({entry.outcome}) — {entry.detail}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function SettingsPanel({
  hh, childrenList, child, onSelectChild, onSave,
}: {
  hh: PortalState['households'][number]
  childrenList: ChildProfile[]
  child: ChildProfile
  onSelectChild: (id: string) => void
  onSave: (next: { askMode: AskMode; autoShow: boolean; approvedLessonGames: string[]; approvedFunGames: string[]; joinRooms: boolean; emailMode: EmailMode; voiceClipsEnabled: boolean }) => void
}) {
  const lessonIds = new Set<string>(LESSON_GAMES.map((g) => g.id))
  const [askMode, setAskMode] = useState<AskMode>(child.askMode)
  const [autoShow, setAutoShow] = useState(child.autoShow)
  const [lessonGames, setLessonGames] = useState<string[]>(child.approvedGames.filter((g) => lessonIds.has(g)))
  const [funGames, setFunGames] = useState<string[]>(child.approvedGames.filter((g) => !lessonIds.has(g)))
  const [joinRooms, setJoinRooms] = useState(child.joinRooms)
  const [emailMode, setEmailMode] = useState<EmailMode>(hh.settings.emailMode)
  const [voiceClipsEnabled, setVoiceClipsEnabled] = useState(child.voiceClipsEnabled ?? true)
  const [lastId, setLastId] = useState(child.id)

  if (child.id !== lastId) {
    setLastId(child.id); setAskMode(child.askMode); setAutoShow(child.autoShow)
    setLessonGames(child.approvedGames.filter((g) => lessonIds.has(g)))
    setFunGames(child.approvedGames.filter((g) => !lessonIds.has(g))); setJoinRooms(child.joinRooms)
    setEmailMode(hh.settings.emailMode); setVoiceClipsEnabled(child.voiceClipsEnabled ?? true)
  }

  const consentVerified = hh.consentRecord.status === 'verified'
  const toggleLesson = (id: string) => setLessonGames((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleFun = (id: string) => setFunGames((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Card title="Settings (five controls)" headingLevel={2}>
      {childrenList.length > 1 ? (
        <div className={styles.actions}>
          {childrenList.map((c) => (
            <Button key={c.id} type="button" size="sm" variant={c.id === child.id ? 'primary' : 'secondary'} onClick={() => onSelectChild(c.id)}>{c.nickname}</Button>
          ))}
        </div>
      ) : null}
      <form className={styles.formStack} onSubmit={(e) => { e.preventDefault(); onSave({ askMode, autoShow, approvedLessonGames: lessonGames, approvedFunGames: funGames, joinRooms, emailMode, voiceClipsEnabled }) }}>
        <fieldset className={styles.fieldset} disabled={!consentVerified}>
          <legend>1. Questions {!consentVerified ? '(locked Off until consent is verified)' : ''}</legend>
          <p className={styles.note}>{ASK_MODE_HELP}</p>
          {(['off', 'review'] as const).map((mode) => (
            <label key={mode} className={styles.radioRow}>
              <input type="radio" name="askMode" checked={askMode === mode} onChange={() => setAskMode(mode)} />
              {mode === 'off' ? 'Off' : 'Review first (parent email first — no Auto-send)'}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>2. Show replies</legend>
          <label className={styles.radioRow}><input type="radio" name="showReplies" checked={!autoShow} onChange={() => setAutoShow(false)} />I tap each reply</label>
          <label className={styles.radioRow}><input type="radio" name="showReplies" checked={autoShow} onChange={() => setAutoShow(true)} />Automatically</label>
          <p className={styles.warningText}>{AUTO_SHOW_WARNING}</p>
        </fieldset>
        <fieldset className={styles.fieldset} disabled={!consentVerified}>
          <legend>3. Games</legend>
          {LESSON_GAMES.map((g) => (
            <label key={g.id} className={styles.radioRow}><input type="checkbox" checked={consentVerified && lessonGames.includes(g.id)} onChange={() => toggleLesson(g.id)} />{g.label} — on by default</label>
          ))}
          <p className={styles.note}>Fun games (off by default — entertainment games never earn belts or stripes):</p>
          {FUN_GAMES.map((g) => (
            <label key={g.id} className={styles.radioRow}><input type="checkbox" checked={funGames.includes(g.id)} onChange={() => toggleFun(g.id)} />{g.label}</label>
          ))}
          <label className={styles.radioRow}><input type="checkbox" checked={joinRooms} onChange={(e) => setJoinRooms(e.target.checked)} />Join Mr. Sam’s rooms (off by default)</label>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>4. Emails</legend>
          <label className={styles.radioRow}><input type="radio" name="emailMode" checked={emailMode === 'everything'} onChange={() => setEmailMode('everything')} />Everything (replies + Friday note)</label>
          <label className={styles.radioRow}><input type="radio" name="emailMode" checked={emailMode === 'friday_only'} onChange={() => setEmailMode('friday_only')} />Friday note only</label>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>5. Mr. Sam’s voice clips</legend>
          <label className={styles.radioRow}><input type="radio" name="voiceClipsEnabled" checked={voiceClipsEnabled} onChange={() => setVoiceClipsEnabled(true)} />On (default — click to play, never auto-plays)</label>
          <label className={styles.radioRow}><input type="radio" name="voiceClipsEnabled" checked={!voiceClipsEnabled} onChange={() => setVoiceClipsEnabled(false)} />Off</label>
          <p className={styles.note}>Written hints always show under a wrong answer regardless of this setting.</p>
        </fieldset>
        <div className={styles.actions}><Button type="submit">Save settings</Button></div>
      </form>
    </Card>
  )
}
