import { useState, type FormEvent } from 'react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildChildActor, buildParentActor, can } from '@/portal/access'
import { forwardQuestionToMentor } from '@/portal/askActions'
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

type ParentSubTab = 'overview' | 'consent' | 'profiles' | 'settings'

export function ParentAccountView({
  state, signedInHouseholdId, onStateChange, onSignOut, onOpenInbox, onOpenRoom,
}: {
  state: PortalState
  signedInHouseholdId: string | null
  onStateChange: (next: PortalState) => void
  onSignOut: () => void
  onOpenInbox: () => void
  onOpenRoom?: (inviteId: string, childId: string) => void
}) {
  const [subTab, setSubTab] = useState<ParentSubTab>('overview')
  const [emailInput, setEmailInput] = useState('elena.demo@family.example')
  const [notice, setNotice] = useState('')
  const [consentMethod, setConsentMethod] = useState<'simulated_form' | 'simulated_call'>('simulated_form')
  const [exportJson, setExportJson] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingChildId, setEditingChildId] = useState<string | undefined>(undefined)
  const [nickname, setNickname] = useState('')
  const [level, setLevel] = useState('7th Grade Math')
  const [pin, setPin] = useState('')
  const [firstLine, setFirstLine] = useState('')
  const [selectedChildId, setSelectedChildId] = useState('')

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

  const parentActor = buildParentActor(state, hh.id)
  const myChildren = state.children.filter((record) => can(parentActor, 'view', { type: 'child', record }))
  const waitingReplies = state.feedback.filter((record) => can(parentActor, 'show_feedback_to_child', { type: 'feedback', record }))
  const waitingQuestions = state.askQuestions.filter((record) => can(parentActor, 'forward_question', { type: 'ask_question', record }))
  const heldQuestions = state.askQuestions.filter((record) => can(parentActor, 'view', { type: 'ask_question', record }) && record.status === 'held_undelivered')
  const myUpdates = state.parentUpdates.filter((record) => can(parentActor, 'view', { type: 'parent_update', record }))
  const myReceipts = listParentReceipts(state, parentActor)
  const activeChild = myChildren.find((c) => c.id === selectedChildId) ?? myChildren[0]

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

      <div className={styles.actions} role="tablist" aria-label="Parent sections">
        {([['overview', 'Parent view'], ['consent', 'Consent'], ['profiles', 'Child profiles'], ['settings', 'Settings (4)']] as const).map(([key, label]) => (
          <Button key={key} type="button" size="sm" variant={subTab === key ? 'primary' : 'secondary'} role="tab" aria-selected={subTab === key} onClick={() => setSubTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {notice ? <p className={styles.statusCallout} role="status">{notice}</p> : null}

      {subTab === 'overview' ? (
        <div className={styles.stack}>
          <Card title={`Questions waiting for your review (${waitingQuestions.length})`} headingLevel={2}>
            {waitingQuestions.length === 0 && heldQuestions.length === 0 ? (
              <p className={styles.note}>No questions waiting to forward right now.</p>
            ) : (
              <ul className={styles.checkList}>
                {waitingQuestions.map((q) => {
                  const kidName = myChildren.find((c) => c.id === q.childId)?.nickname ?? 'your child'
                  return (
                    <li key={q.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>Question from {kidName} ({q.source === 'worksheet_open_response' ? 'open response' : 'Ask form'})</p>
                        <p className={styles.checkDetail}>{q.text}</p>
                        {q.photoPlaceholder ? <p className={styles.note}>Photo placeholder: {q.photoPlaceholder.label} (name covered: {q.photoPlaceholder.nameCovered ? 'yes' : 'no'})</p> : null}
                      </div>
                      <Button size="sm" onClick={() => { onStateChange(forwardQuestionToMentor(portalStorage, parentActor, q.id)); setNotice(`Forwarded ${kidName}'s question to Mr. Sam.`) }}>
                        Forward to Mr. Sam
                      </Button>
                    </li>
                  )
                })}
                {heldQuestions.map((q) => {
                  const kidName = myChildren.find((c) => c.id === q.childId)?.nickname ?? 'your child'
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
                          {approved && onOpenRoom ? (
                            <Button size="sm" variant="secondary" onClick={() => onOpenRoom(inv.id, inv.childId)}>Open room link</Button>
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
                    <p className={styles.checkDetail}>Ask mode: {child.askMode}</p>
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
  onSave: (next: { askMode: AskMode; autoShow: boolean; approvedLessonGames: string[]; approvedFunGames: string[]; joinRooms: boolean; emailMode: EmailMode }) => void
}) {
  const lessonIds = new Set<string>(LESSON_GAMES.map((g) => g.id))
  const [askMode, setAskMode] = useState<AskMode>(child.askMode)
  const [autoShow, setAutoShow] = useState(child.autoShow)
  const [lessonGames, setLessonGames] = useState<string[]>(child.approvedGames.filter((g) => lessonIds.has(g)))
  const [funGames, setFunGames] = useState<string[]>(child.approvedGames.filter((g) => !lessonIds.has(g)))
  const [joinRooms, setJoinRooms] = useState(child.joinRooms)
  const [emailMode, setEmailMode] = useState<EmailMode>(hh.settings.emailMode)
  const [lastId, setLastId] = useState(child.id)

  if (child.id !== lastId) {
    setLastId(child.id); setAskMode(child.askMode); setAutoShow(child.autoShow)
    setLessonGames(child.approvedGames.filter((g) => lessonIds.has(g)))
    setFunGames(child.approvedGames.filter((g) => !lessonIds.has(g))); setJoinRooms(child.joinRooms); setEmailMode(hh.settings.emailMode)
  }

  const consentVerified = hh.consentRecord.status === 'verified'
  const toggleLesson = (id: string) => setLessonGames((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleFun = (id: string) => setFunGames((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Card title="Settings (four controls)" headingLevel={2}>
      {childrenList.length > 1 ? (
        <div className={styles.actions}>
          {childrenList.map((c) => (
            <Button key={c.id} type="button" size="sm" variant={c.id === child.id ? 'primary' : 'secondary'} onClick={() => onSelectChild(c.id)}>{c.nickname}</Button>
          ))}
        </div>
      ) : null}
      <form className={styles.formStack} onSubmit={(e) => { e.preventDefault(); onSave({ askMode, autoShow, approvedLessonGames: lessonGames, approvedFunGames: funGames, joinRooms, emailMode }) }}>
        <fieldset className={styles.fieldset} disabled={!consentVerified}>
          <legend>1. Questions {!consentVerified ? '(locked Off until consent is verified)' : ''}</legend>
          <p className={styles.note}>{ASK_MODE_HELP}</p>
          {(['off', 'review', 'auto'] as const).map((mode) => (
            <label key={mode} className={styles.radioRow}>
              <input type="radio" name="askMode" checked={askMode === mode} onChange={() => setAskMode(mode)} />
              {mode === 'off' ? 'Off' : mode === 'review' ? 'Review first (recommended)' : 'Auto-send (parent first, then Mr. Sam)'}
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
        <div className={styles.actions}><Button type="submit">Save settings</Button></div>
      </form>
    </Card>
  )
}
