import { useState } from 'react'
import type { OpsResult } from '@contracts/v1'
import { Button } from '@components/ui/Button'
import { api } from '@api/client'
import { env } from '@config/env'
import styles from './NudgeButton.module.css'

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'completed'; result: OpsResult }
  | { kind: 'failed'; reason: string }

/**
 * The Launch button. One click, one queue item.
 *
 * Three states and no others: Working, Completed, or Failed with a plain reason
 * and a retry. There is no confirmation step, because a nudge is reversible and
 * bounded — asking twice for something harmless trains the operator to click
 * through prompts, which is exactly the reflex you do not want surviving to the
 * day a prompt actually matters.
 *
 * The protections are real but silent. Rate limiting, the action allowlist, the
 * server-held webhook and duplicate collapsing all live in the edge endpoint. A
 * duplicate is reported as Completed on purpose: the item IS in the queue, and
 * the operator does not need to know which write put it there.
 */
export function NudgeButton({ reason = 'Nudge from the website' }: { reason?: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function launch() {
    // Refuse before the request, not after.
    //
    // With no backend configured the app runs on an in-memory mock, and a mock
    // that answered this route would return a success plus an issue link for an
    // item that does not exist. That is a fabricated external outcome — the
    // precise failure the whole scoring model exists to prevent, and it would be
    // indistinguishable from a real one on screen.
    //
    // Caught in review by the agent that did not write it. Left here as a
    // comment because the temptation to make the happy path demoable locally is
    // going to recur.
    if (!env.api.isConfigured) {
      setState({ kind: 'failed', reason: 'not connected. No queue endpoint is configured yet.' })
      return
    }

    setState({ kind: 'working' })
    try {
      const result = await api.ops.send('nudge', reason)
      if (result.outcome === 'rate_limited') {
        setState({ kind: 'failed', reason: 'Too many launches. Wait a few minutes.' })
        return
      }
      setState({ kind: 'completed', result })
    } catch (error) {
      setState({ kind: 'failed', reason: plainReason(error) })
    }
  }

  const working = state.kind === 'working'

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <Button onClick={launch} disabled={working}>
          {working ? 'Working…' : state.kind === 'failed' ? 'Retry' : 'Launch'}
        </Button>

        {/* Polite: the operator pressed the button and is already looking at it.
            An assertive region would cut a screen reader off mid-sentence to
            announce a status they explicitly asked for. */}
        <p className={styles.status} role="status" aria-live="polite">
          {state.kind === 'working' && 'Working…'}
          {state.kind === 'completed' && (
            <span className={styles.ok}>
              Completed.{' '}
              {state.result.issueUrl ? (
                <a href={state.result.issueUrl} target="_blank" rel="noreferrer">
                  Open the queue item
                </a>
              ) : null}
            </span>
          )}
          {state.kind === 'failed' && <span className={styles.failed}>Failed: {state.reason}</span>}
        </p>
      </div>
    </div>
  )
}

/**
 * Never show a raw error. A stack or a fetch message tells the operator nothing
 * they can act on, and an upstream message can carry the webhook path.
 */
function plainReason(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/network|fetch|timeout|abort/i.test(message)) return 'Could not reach the queue.'
  if (/40[13]/.test(message)) return 'This action is not allowed from here.'
  if (/5\d\d/.test(message)) return 'The queue is down. Try again shortly.'
  return 'Something went wrong. Try again.'
}
