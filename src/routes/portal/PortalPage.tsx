import { useMemo, useState } from 'react'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { buildMentorActor, can } from '@/portal/access'
import { runAccessChecks } from '@/portal/accessChecks'
import { createSeedState } from '@/portal/seed'
import { portalStorage } from '@/portal/storage'
import type { PortalState } from '@/portal/types'
import styles from './PortalPage.module.css'

export const PORTAL_DEMO_BANNER =
  'DEMO — fictional families, local-only storage, simulated email.'

export function PortalPage() {
  const [state, setState] = useState<PortalState>(() => portalStorage.load())
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
    const next = portalStorage.revokeAssignment(buildMentorActor(state, 'mentor_samuel'), 'asgn_b_elena')
    setState(next)
    setStatusMessage('Revoked Mentor B — visible households dropped to 0 immediately.')
  }

  function handleResetSeed() {
    setState(portalStorage.reset())
    setStatusMessage('Demo storage reset to clean fictional seed (3 households, 5 kids, 3 mentors).')
  }

  return (
    <AppShell>
      <div className={styles.stack}>
        <p className={styles.demoBanner} role="status">{PORTAL_DEMO_BANNER}</p>

        <div className={styles.headerRow}>
          <h1 className={styles.title}>Tutoring Portal — Access Checks (PR 1)</h1>
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

          <Card title="Simulated email inbox" headingLevel={2}>
            <ul className={styles.miniList}>
              {state.inbox.map((e) => (
                <li key={e.id}><strong>{e.to}</strong>: {e.subject} ({e.status})</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
