import { useState } from 'react'
import type { OpsResult } from '@contracts/v1'
import { Button } from '@components/ui/Button'
import { api } from '@api/client'
import styles from './NudgeButton.module.css'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; result: OpsResult }
  | { kind: 'failed'; message: string }

/**
 * The launch button: one press puts one validated item in the council's queue.
 *
 * It reaches Make through our own edge endpoint. The browser never learns the
 * webhook URL — a public hook would let a stranger write junk into the GitHub
 * queue the council treats as its source of truth, and polluted evidence is a
 * worse failure than a wasted operation.
 *
 * Deliberately reports `duplicate` as success. Idempotency doing its job is not
 * an error, and showing it as one would train the operator to press again —
 * which is precisely the behaviour idempotency exists to make harmless.
 */
export function NudgeButton({ reason = 'Nudge from the website' }: { reason?: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function send() {
    setState({ kind: 'sending' })
    try {
      const result = await api.ops.send('nudge', reason)
      setState({ kind: 'done', result })
    } catch (error) {
      setState({
        kind: 'failed',
        message: error instanceof Error ? error.message : 'Could not reach the queue.',
      })
    }
  }

  return (
    <div className={styles.wrap}>
      <Button onClick={send} disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Sending…' : 'Nudge the council'}
      </Button>

      {/* Announced politely: the operator pressed the button, so they are already
          looking at it. An assertive live region would interrupt a screen reader
          mid-sentence for a status they asked for. */}
      <p className={styles.status} role="status" aria-live="polite">
        {state.kind === 'done' && <DoneMessage result={state.result} />}
        {state.kind === 'failed' && <span className={styles.failed}>{state.message}</span>}
      </p>
    </div>
  )
}

function DoneMessage({ result }: { result: OpsResult }) {
  if (result.outcome === 'rate_limited') {
    return <span className={styles.failed}>Rate limited — wait a few minutes.</span>
  }
  const label =
    result.outcome === 'duplicate'
      ? 'Already queued — same nudge, no duplicate created.'
      : 'Queued.'
  return (
    <span className={styles.ok}>
      {label}{' '}
      {result.issueUrl ? (
        <a href={result.issueUrl} target="_blank" rel="noreferrer">
          View the issue
        </a>
      ) : null}
    </span>
  )
}
