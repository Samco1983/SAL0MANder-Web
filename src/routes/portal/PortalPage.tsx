import { useMemo, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildMentorActor, can } from '@/portal/access'
import { runAccessChecks } from '@/portal/accessChecks'
import { createSeedState } from '@/portal/seed'
import { portalStorage } from '@/portal/storage'
import type { PortalState } from '@/portal/types'
import { ChildProfileView } from './ChildProfileView'
import { ParentAccountView } from './ParentAccountView'
import styles from './PortalPage.module.css'

export const PORTAL_DEMO_BANNER =
  'DEMO — fictional families, local-only storage, simulated email.'

type PortalTab = 'access' | 'parent' | 'child' | 'inbox'

export function PortalPage() {
  const [tab, setTab] = useState<PortalTab>('access')
  const [state, setState] = useState<PortalState>(() => portalStorage.load())
  const [signedInHouseholdId, setSignedInHouseholdId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const checks = useMemo(() => runAccessChecks(createSeedState()), [])
  const passedCount = checks.filter((c) => c.passed).length
  const allPassed = passedCount === checks.length

  const mentorB = buildMentorActor(state, 'mentor_b')
  const mentorBHouseholds = state.households.filter((record) =>
    can(mentorB, 'view', { type: 'household', record }),
  )
  const mentorBRevoked = state.assignments.find((a) => a.id === 'asgn_b_elena')?.revokedAt !== null

  function handleRevokeMentorB() {
    setState(portalStorage.revokeAssignment(buildMentorActor(state, 'mentor_samuel'), 'asgn_b_elena'))
    setStatusMessage('Revoked Mentor B — visible households dropped to 0 immediately.')
  }

  function handleResetSeed() {
    setState(portalStorage.reset())
    setSignedInHouseholdId(null)
    setStatusMessage('Demo storage reset to clean fictional seed (3 households, 5 kids, 3 mentors).')
  }

  return (
    <AppShell>
      <div className={styles.stack}>
        <p className={styles.demoBanner} role="status">{PORTAL_DEMO_BANNER}</p>

        <div className={styles.headerRow}>
          <h1 className={styles.title}>SAL0MANder Tutoring Portal (Phase 1 Demo)</h1>
          <div className={styles.actions} role="tablist" aria-label="Portal views">
            <Button size="sm" variant={tab === 'access' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'access'} onClick={() => setTab('access')}>
              Access Checks
            </Button>
            <Button size="sm" variant={tab === 'parent' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'parent'} onClick={() => setTab('parent')}>
              Parent Account
            </Button>
            <Button size="sm" variant={tab === 'child' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'child'} onClick={() => setTab('child')}>
              Child Profile
            </Button>
            <Button size="sm" variant={tab === 'inbox' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'inbox'} onClick={() => setTab('inbox')}>
              Simulated Inbox ({state.inbox.length})
            </Button>
          </div>
        </div>

        {tab === 'parent' ? (
          <ParentAccountView
            state={state}
            signedInHouseholdId={signedInHouseholdId}
            onStateChange={setState}
            onSignOut={() => setSignedInHouseholdId(null)}
            onOpenInbox={() => setTab('inbox')}
          />
        ) : null}

        {tab === 'child' ? <ChildProfileView state={state} onStateChange={setState} /> : null}

        {tab === 'inbox' ? (
          <Card title="Simulated Email Inbox (in-app only — no real email sent)" headingLevel={2}>
            {state.inbox.length === 0 ? (
              <p className={styles.note}>Inbox is empty.</p>
            ) : (
              <ul className={styles.checkList}>
                {state.inbox.map((email) => (
                  <li key={email.id} className={styles.checkItem}>
                    <div className={styles.checkMeta}>
                      <p className={styles.checkLabel}>{email.subject}</p>
                      <p className={styles.checkDetail}>To: {email.to} · Status: {email.status} · {email.sentAt}</p>
                      <p className={styles.checkDetail}>{email.body}</p>
                    </div>
                    {email.kind === 'sign_in_link' && email.householdId ? (
                      <Button size="sm" onClick={() => { setSignedInHouseholdId(email.householdId); setTab('parent') }}>
                        Open sign-in link
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {tab === 'access' ? (
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
