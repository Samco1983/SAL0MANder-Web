import { useState, type FormEvent } from 'react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildMentorActor, can } from '@/portal/access'
import { sendMentorReplyDemo } from '@/portal/askActions'
import { formatParentBeltSentence, getNextBeltStep } from '@/portal/belts'
import {
  SCRIPT_LIBRARY, addMentorAccount, assignMentorToHousehold, awardBadgeByMentor,
  awardBeltPassed, buildFridayDrafts, daysQuiet, getMembershipCapacity, listBeltTestsDue,
  listQuietKids, listTodayAskQueue, listTodayWorkQueue, sendAllFridayNotes,
  sendQuietNudge, sendWorkReviewReply,
} from '@/portal/mentorActions'
import { FUN_GAMES } from '@/portal/parentActions'
import { createRoomInvite, openRoomByMentor } from '@/portal/roomActions'
import { portalStorage } from '@/portal/storage'
import type { PortalState } from '@/portal/types'
import { BELT_MASCOT } from '@/portal/worksheet'
import styles from './PortalPage.module.css'

type MentorSubTab = 'today' | 'kids' | 'friday' | 'rooms' | 'scripts' | 'admin'

export function MentorView({ state, onStateChange }: { state: PortalState; onStateChange: (next: PortalState) => void }) {
  const [selectedMentorId, setSelectedMentorId] = useState('mentor_samuel')
  const [subTab, setSubTab] = useState<MentorSubTab>('today')
  const [selectedKidId, setSelectedKidId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState(SCRIPT_LIBRARY[0]!.unitId)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [humanSentences, setHumanSentences] = useState<Record<string, string>>({})
  const [teachItDone, setTeachItDone] = useState(false)
  const [roomChildId, setRoomChildId] = useState('')
  const [roomGameId, setRoomGameId] = useState<string>(FUN_GAMES[0].id)
  const [newMentorName, setNewMentorName] = useState('')
  const [newMentorEmail, setNewMentorEmail] = useState('')
  const [assignMentorId, setAssignMentorId] = useState('mentor_c')
  const [assignHhId, setAssignHhId] = useState(state.households[0]?.id ?? '')
  const [notice, setNotice] = useState('')

  const mentor = state.mentors.find((m) => m.id === selectedMentorId) ?? state.mentors[0]
  if (!mentor) return <Card title="Mentor view" headingLevel={2}><p className={styles.note}>No mentors configured.</p></Card>

  const actor = buildMentorActor(state, mentor.id)
  const isAdmin = can(actor, 'add_mentor', { type: 'portal_admin', householdId: null })
  const activeTab: MentorSubTab = subTab === 'admin' && !isAdmin ? 'today' : subTab

  const askQueue = listTodayAskQueue(state, actor)
  const workQueue = listTodayWorkQueue(state, actor)
  const quietKids = listQuietKids(state, actor)
  const beltDue = listBeltTestsDue(state, actor)
  const assignedKids = state.children.filter((record) => can(actor, 'view', { type: 'child', record }))
  const activeKid = assignedKids.find((c) => c.id === selectedKidId) ?? assignedKids[0]
  const verifiedAssignedKids = assignedKids.filter((c) => c.consentStatus === 'verified')
  const targetRoomChild = verifiedAssignedKids.find((c) => c.id === roomChildId) ?? verifiedAssignedKids[0]
  const visibleRoomInvites = state.roomInvites.filter((record) => can(actor, 'manage_room_invite', { type: 'room_invite', record }))
  const fridayDrafts = buildFridayDrafts(state, actor).map((d) => ({ ...d, humanSentence: humanSentences[d.childId] ?? d.humanSentence }))
  const activeScript = SCRIPT_LIBRARY.find((s) => s.unitId === selectedUnitId) ?? SCRIPT_LIBRARY[0]!
  const capacity = getMembershipCapacity(state)
  const visibleLogs = state.auditLogs.filter((record) => can(actor, 'view', { type: 'audit_log', record }))

  function handleAddMentor(e: FormEvent) {
    e.preventDefault()
    if (!newMentorName.trim() || !newMentorEmail.trim()) return
    onStateChange(addMentorAccount(portalStorage, actor, { displayName: newMentorName, email: newMentorEmail }))
    setNotice(`Added mentor ${newMentorName.trim()} (unassigned until assigned below).`)
    setNewMentorName(''); setNewMentorEmail('')
  }

  return (
    <div className={styles.stack}>
      <Card title="Demo mentor hat switcher (all teaching views enforce active Assignment)" headingLevel={2}>
        <div className={styles.actions}>
          {state.mentors.map((m) => (
            <Button key={m.id} type="button" size="sm" variant={m.id === mentor.id ? 'primary' : 'secondary'} onClick={() => { setSelectedMentorId(m.id); setNotice('') }}>
              {m.displayName} ({m.roles.join('+')})
            </Button>
          ))}
        </div>
        <p className={styles.note}>
          Viewing as <strong>{mentor.displayName}</strong> · Assigned kids visible: <strong>{assignedKids.length}</strong>
          {isAdmin ? ' · Admin hat enabled' : ' · Mentor hat only (Admin tab hidden)'}
        </p>
      </Card>

      <div className={styles.actions} role="tablist" aria-label="Mentor sections">
        {([['today', `Today (${askQueue.length + workQueue.length})`], ['kids', `Kids (${assignedKids.length})`], ['friday', 'Friday'], ['rooms', `Rooms (${visibleRoomInvites.length})`], ['scripts', 'Script library']] as const).map(([key, label]) => (
          <Button key={key} type="button" size="sm" variant={activeTab === key ? 'primary' : 'secondary'} role="tab" aria-selected={activeTab === key} onClick={() => setSubTab(key)}>
            {label}
          </Button>
        ))}
        {isAdmin ? (
          <Button type="button" size="sm" variant={activeTab === 'admin' ? 'primary' : 'secondary'} role="tab" aria-selected={activeTab === 'admin'} onClick={() => setSubTab('admin')}>
            Admin
          </Button>
        ) : null}
      </div>

      {notice ? <p className={styles.statusCallout} role="status">{notice}</p> : null}

      {activeTab === 'today' ? (
        <div className={styles.stack}>
          <Card title={`Ask queue — oldest first, provider-accepted & forwarded only (${askQueue.length})`} headingLevel={2}>
            {askQueue.length === 0 ? (
              <p className={styles.note}>No queued questions (waiting-review and rejected-email questions stay hidden from mentors).</p>
            ) : (
              <ul className={styles.checkList} data-testid="mentor-ask-queue">
                {askQueue.map((q) => {
                  const kid = state.children.find((c) => c.id === q.childId)
                  const draft = replyDrafts[q.id] ?? `[Placeholder draft] Nice question, ${kid?.nickname ?? 'friend'} — rewrite subtracting a negative as moving right.`
                  return (
                    <li key={q.id} className={styles.childPreview}>
                      <p className={styles.checkLabel}>{kid?.nickname ?? 'Child'} · {q.askModeAtSend} · {q.createdAt}</p>
                      <p className={styles.checkDetail}>{q.text}</p>
                      {q.photoPlaceholder ? <p className={styles.note}>Photo placeholder: {q.photoPlaceholder.label} (name covered: {q.photoPlaceholder.nameCovered ? 'yes' : 'no'})</p> : null}
                      <label className={styles.field}>
                        <span>Reply draft (human click required; parent email first)</span>
                        <input className={styles.input} value={draft} onChange={(e) => setReplyDrafts((p) => ({ ...p, [q.id]: e.target.value }))} />
                      </label>
                      <div className={styles.actions}>
                        <Button size="sm" onClick={() => { const res = sendMentorReplyDemo(portalStorage, actor, q.id, draft); onStateChange(res.state); setNotice(res.message) }}>
                          Send reply (parent first)
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { const res = sendMentorReplyDemo(portalStorage, actor, q.id, draft, { simulateParentRejected: true }); onStateChange(res.state); setNotice(res.message) }}>
                          Simulate reply email rejected
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title={`Submitted work sets — oldest first (${workQueue.length})`} headingLevel={2}>
            {workQueue.length === 0 ? <p className={styles.note}>No submitted sets waiting for review.</p> : (
              <ul className={styles.checkList}>
                {workQueue.map((w) => {
                  const kid = state.children.find((c) => c.id === w.childId)
                  const latest = w.attempts.at(-1)
                  const draft = replyDrafts[w.id] ?? `[Placeholder draft] Solid work on attempt #${w.attempts.length}, ${kid?.nickname ?? 'friend'} — check your sign steps.`
                  return (
                    <li key={w.id} className={styles.childPreview}>
                      <p className={styles.checkLabel}>{kid?.nickname ?? 'Child'} · {w.activityId} · Attempt #{w.attempts.length} ({latest?.answers.length ?? 0} answers)</p>
                      <label className={styles.field}>
                        <span>Feedback draft (no model call; parent email first)</span>
                        <input className={styles.input} value={draft} onChange={(e) => setReplyDrafts((p) => ({ ...p, [w.id]: e.target.value }))} />
                      </label>
                      <Button size="sm" onClick={() => { const res = sendWorkReviewReply(portalStorage, actor, w.id, draft); onStateChange(res.state); setNotice(`Reviewed ${kid?.nickname ?? 'child'}'s set (sent to parent first${res.stripeEarned ? '; +1 stripe computed, belt still human-awarded' : ''}).`) }}>
                        Send work feedback
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <div className={styles.grid}>
            <Card title={`Quiet list — 7+ days inactive (${quietKids.length})`} headingLevel={2}>
              {quietKids.length === 0 ? <p className={styles.note}>No quiet students in your assigned households.</p> : (
                <ul className={styles.checkList}>
                  {quietKids.map((k) => (
                    <li key={k.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>{k.nickname} ({k.level})</p>
                        <p className={styles.checkDetail}>Quiet {daysQuiet(k)} days (last active {k.lastActiveAt.slice(0, 10)})</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => { onStateChange(sendQuietNudge(portalStorage, actor, k.id)); setNotice(`Sent quiet check-in to ${k.nickname}'s parent email.`) }}>
                        Send quiet nudge
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Belt tests due / upcoming (${beltDue.length})`} headingLevel={2}>
              {beltDue.length === 0 ? <p className={styles.note}>No belt tests due for your assigned households.</p> : (
                <ul className={styles.miniList}>
                  {beltDue.map((b) => (
                    <li key={b.child.id}>
                      <strong>{b.child.nickname}</strong> — {b.child.currentBelt} → {b.nextBelt} ({b.child.stripesEarned}/{b.stripesRequired} stripes · {b.ready ? (b.testType === 'teach_it' ? 'Ready for live teach-it test' : 'Ready for live belt test') : '1 stripe away'})
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === 'kids' ? (
        assignedKids.length === 0 ? (
          <Card title="Assigned kids" headingLevel={2}><p className={styles.note}>No assigned households — unassigned mentors see nothing.</p></Card>
        ) : (
          <div className={styles.stack}>
            <div className={styles.actions}>
              {assignedKids.map((k) => (
                <Button key={k.id} type="button" size="sm" variant={k.id === activeKid?.id ? 'primary' : 'secondary'} onClick={() => { setSelectedKidId(k.id); setTeachItDone(false) }}>
                  {k.nickname} ({k.currentBelt})
                </Button>
              ))}
            </div>
            {activeKid ? (() => {
              const kidHh = state.households.find((h) => h.id === activeKid.householdId)
              const kidWork = state.workRecords.filter((record) => record.childId === activeKid.id && can(actor, 'view', { type: 'work', record }))
              const kidReplies = state.feedback.filter((record) => record.childId === activeKid.id && can(actor, 'view', { type: 'feedback', record }))
              const nextStep = getNextBeltStep(activeKid)
              return (
                <div className={styles.grid}>
                  <Card title={`${activeKid.nickname} — Profile & belt test`} headingLevel={2}>
                    <p className={styles.checkLabel}>{activeKid.level} · {BELT_MASCOT[activeKid.currentBelt].label} ({activeKid.stripesEarned} stripes)</p>
                    <p className={styles.statusCallout}>{formatParentBeltSentence(activeKid)}</p>
                    <p className={styles.checkDetail}>“{activeKid.firstConversationLine}”</p>
                    <p className={styles.note}>Approved games: {activeKid.approvedGames.length ? activeKid.approvedGames.join(', ') : 'None'}</p>
                    {nextStep?.testType === 'teach_it' ? (
                      <label className={styles.radioRow}>
                        <input type="checkbox" checked={teachItDone} onChange={(e) => setTeachItDone(e.target.checked)} />
                        Live teach-it test completed (required for Black Belt)
                      </label>
                    ) : null}
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        disabled={!nextStep || (nextStep.testType === 'teach_it' && !teachItDone)}
                        onClick={() => {
                          onStateChange(awardBeltPassed(portalStorage, actor, activeKid.id, { teachItCompleted: teachItDone }))
                          setTeachItDone(false)
                          setNotice(`Logged live belt test passed for ${activeKid.nickname}.`)
                        }}
                      >
                        Belt test passed (human award)
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { onStateChange(awardBadgeByMentor(portalStorage, actor, activeKid.id, 'explained_it')); setNotice(`Awarded 'Explained it' badge to ${activeKid.nickname}.`) }}>
                        Award ‘Explained it’
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { onStateChange(awardBadgeByMentor(portalStorage, actor, activeKid.id, 'came_back')); setNotice(`Awarded 'Came back' badge to ${activeKid.nickname}.`) }}>
                        Award ‘Came back’
                      </Button>
                    </div>
                  </Card>
                  <Card title="Parent settings (read-only)" headingLevel={2}>
                    <ul className={styles.miniList}>
                      <li>Parent: {kidHh?.parentName} · Consent: {kidHh?.consentRecord.status}</li>
                      <li>Questions mode: {activeKid.askMode} · Auto-show replies: {activeKid.autoShow ? 'On' : 'Off'}</li>
                      <li>Join rooms: {activeKid.joinRooms ? 'On' : 'Off'} · Emails: {kidHh?.settings.emailMode}</li>
                      <li>Mr. Sam’s voice clips: {activeKid.voiceClipsEnabled ? 'On' : 'Off'} (written hints always show)</li>
                    </ul>
                  </Card>
                  <Card title={`Work history (${kidWork.length})`} headingLevel={2}>
                    {kidWork.length === 0 ? <p className={styles.note}>No work records yet.</p> : (
                      <ul className={styles.miniList}>{kidWork.map((w) => <li key={w.id}>{w.activityId} — {w.status} ({w.attempts.length} attempt(s))</li>)}</ul>
                    )}
                  </Card>
                  <Card title={`Past replies (${kidReplies.length})`} headingLevel={2}>
                    {kidReplies.length === 0 ? <p className={styles.note}>No replies yet.</p> : (
                      <ul className={styles.miniList}>{kidReplies.map((r) => <li key={r.id}>[{r.status}] {r.sentText ?? r.draftText}</li>)}</ul>
                    )}
                  </Card>
                </div>
              )
            })() : null}
          </div>
        )
      ) : null}

      {activeTab === 'friday' ? (
        <Card title={`Friday note builder (${fridayDrafts.length} assigned kids)`} headingLevel={2}>
          {fridayDrafts.length === 0 ? <p className={styles.note}>No assigned kids to build Friday notes for.</p> : (
            <div className={styles.stack}>
              {fridayDrafts.map((d) => (
                <div key={d.childId} className={styles.childPreview}>
                  <p className={styles.checkLabel}>{d.nickname} — week of {d.weekOf} {d.quiet ? '(Quiet-kid version)' : ''}</p>
                  <p className={styles.checkDetail}>1. Worked on: {d.workedOn}</p>
                  <p className={styles.checkDetail}>2. Needs help: {d.needsHelp}</p>
                  <p className={styles.checkDetail}>3. Try at home: {d.tryAtHome}</p>
                  <label className={styles.field}>
                    <span>Human sentence for {d.nickname}’s parent</span>
                    <input className={styles.input} value={d.humanSentence} onChange={(e) => setHumanSentences((p) => ({ ...p, [d.childId]: e.target.value }))} />
                  </label>
                </div>
              ))}
              <div className={styles.actions}>
                <Button onClick={() => { const res = sendAllFridayNotes(portalStorage, actor, fridayDrafts); onStateChange(res.state); setNotice(`Sent ${res.sentCount} Friday note(s) to parent inbox (unconsented skipped).`) }}>
                  Send all Friday notes
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'rooms' ? (
        <div className={styles.stack}>
          <Card title="Open a game room invite (fun games only — never during scheduled tutoring)" headingLevel={2}>
            {verifiedAssignedKids.length === 0 ? (
              <p className={styles.note}>No verified assigned kids available to invite.</p>
            ) : (
              <div className={styles.formStack}>
                <label className={styles.field}>
                  <span>Assigned child</span>
                  <select className={styles.input} value={targetRoomChild?.id ?? ''} onChange={(e) => setRoomChildId(e.target.value)}>
                    {verifiedAssignedKids.map((c) => <option key={c.id} value={c.id}>{c.nickname} (standing yes: {c.joinRooms ? 'on' : 'off'})</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Fun game</span>
                  <select className={styles.input} value={roomGameId} onChange={(e) => setRoomGameId(e.target.value)}>
                    {FUN_GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </label>
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!targetRoomChild) return
                      const start = new Date(Date.now() + 5_000).toISOString()
                      const end = new Date(Date.now() + 10 * 60_000).toISOString()
                      try {
                        const res = createRoomInvite(portalStorage, actor, { childId: targetRoomChild.id, gameId: roomGameId, startsAt: start, endsAt: end })
                        onStateChange(res.state)
                        setNotice(`Sent ${roomGameId} room invite (${res.invite.roomCode}, ${res.invite.parentApproval}) to parent email.`)
                      } catch (err) {
                        setNotice(err instanceof Error ? err.message : 'Unable to create room invite.')
                      }
                    }}
                  >
                    Send room invite (10 min)
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title={`Assigned room invites (${visibleRoomInvites.length})`} headingLevel={2}>
            {visibleRoomInvites.length === 0 ? <p className={styles.note}>No room invites yet.</p> : (
              <ul className={styles.checkList}>
                {visibleRoomInvites.map((inv) => {
                  const kidName = state.children.find((c) => c.id === inv.childId)?.nickname ?? 'Child'
                  return (
                    <li key={inv.id} className={styles.checkItem}>
                      <div className={styles.checkMeta}>
                        <p className={styles.checkLabel}>{inv.gameId} · {kidName} · code {inv.roomCode} ({inv.parentApproval})</p>
                        <p className={styles.checkDetail}>{inv.closedAt ? 'Closed (hard end)' : inv.openedAt ? `Open since ${inv.openedAt}` : 'Not opened yet'} · ends {inv.endsAt}</p>
                      </div>
                      {!inv.openedAt && !inv.closedAt ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            try {
                              onStateChange(openRoomByMentor(portalStorage, actor, inv.id))
                              setNotice(`Opened room ${inv.roomCode} for ${kidName}.`)
                            } catch (err) {
                              setNotice(err instanceof Error ? err.message : 'Unable to open room.')
                            }
                          }}
                        >
                          Open room now
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'scripts' ? (
        <Card title="Script library (1 page per unit — stub)" headingLevel={2}>
          <div className={styles.actions}>
            {SCRIPT_LIBRARY.map((s) => (
              <Button key={s.unitId} type="button" size="sm" variant={s.unitId === activeScript.unitId ? 'primary' : 'secondary'} onClick={() => setSelectedUnitId(s.unitId)}>
                {s.title.split(':')[0]}
              </Button>
            ))}
          </div>
          <div className={styles.childPreview}>
            <p className={styles.checkLabel}>{activeScript.title}</p>
            <p className={styles.checkDetail}><strong>Explanation:</strong> {activeScript.explanation}</p>
            <p className={styles.checkDetail}><strong>Common mistake:</strong> {activeScript.commonMistake}</p>
            <p className={styles.checkLabel}>Three problems</p>
            <ol className={styles.miniList}>{activeScript.problems.map((p) => <li key={p}>{p}</li>)}</ol>
            <p className={styles.checkLabel}>Reference links</p>
            <ul className={styles.miniList}>{activeScript.links.map((l) => <li key={l.label}>{l.label} — {l.url}</li>)}</ul>
          </div>
        </Card>
      ) : null}

      {activeTab === 'admin' && isAdmin ? (
        <div className={styles.stack}>
          <Card title="Membership cap & waitlist" headingLevel={2}>
            <p className={styles.checkLabel}>Active households: {capacity.activeCount} / {capacity.cap} · Remaining slots: {capacity.remaining} · Waitlist: {capacity.waitlistedCount}</p>
          </Card>

          <div className={styles.grid}>
            <Card title="Add mentor (admin only)" headingLevel={2}>
              <form className={styles.formStack} onSubmit={handleAddMentor}>
                <label className={styles.field}><span>Display name</span><input required className={styles.input} value={newMentorName} onChange={(e) => setNewMentorName(e.target.value)} placeholder="Mentor Alex" /></label>
                <label className={styles.field}><span>Fictional email (.example)</span><input type="email" required className={styles.input} value={newMentorEmail} onChange={(e) => setNewMentorEmail(e.target.value)} placeholder="mentor.alex@sal0mander.example" /></label>
                <Button type="submit" size="sm">Add mentor</Button>
              </form>
            </Card>

            <Card title="Assign / revoke mentor" headingLevel={2}>
              <div className={styles.formStack}>
                <label className={styles.field}>
                  <span>Mentor</span>
                  <select className={styles.input} value={assignMentorId} onChange={(e) => setAssignMentorId(e.target.value)}>
                    {state.mentors.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Household</span>
                  <select className={styles.input} value={assignHhId} onChange={(e) => setAssignHhId(e.target.value)}>
                    {state.households.map((h) => <option key={h.id} value={h.id}>{h.parentName} ({h.id})</option>)}
                  </select>
                </label>
                <Button size="sm" onClick={() => { onStateChange(assignMentorToHousehold(portalStorage, actor, assignMentorId, assignHhId)); setNotice('Assigned mentor to household.') }}>Assign mentor</Button>
              </div>
              <ul className={styles.miniList}>
                {state.assignments.filter((a) => a.revokedAt === null).map((a) => (
                  <li key={a.id}>
                    {state.mentors.find((m) => m.id === a.mentorId)?.displayName ?? a.mentorId} → {state.households.find((h) => h.id === a.householdId)?.parentName ?? a.householdId}{' '}
                    <Button size="sm" variant="ghost" onClick={() => { onStateChange(portalStorage.revokeAssignment(actor, a.id)); setNotice('Revoked assignment immediately.') }}>Revoke</Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title={`Admin audit log — IDs & actions only (${visibleLogs.length})`} headingLevel={2}>
            <ul className={styles.miniList} data-testid="admin-audit-log">
              {visibleLogs.slice(-15).reverse().map((l) => (
                <li key={l.id}>{l.at} · {l.actorKind}:{l.actorId} · {l.action} · {l.recordType}:{l.recordId} ({l.outcome})</li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
