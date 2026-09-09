import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { newId } from '@contracts/v1'
import type { ActivityDraft } from '@studio/activityDraft'
import { UnityStage } from '@unity/UnityStage'
import { preparePreview, previewProblems, type PreviewBoot } from '@unity/previewBridge'
import styles from './StudioPreview.module.css'

function Player({ preview, onEnd }: { preview: PreviewBoot; onEnd: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog ref={dialog} className={styles.player} aria-label="Activity preview" onCancel={(event) => event.preventDefault()}>
      <header className={styles.toolbar}>
        <div><strong>{preview.config.title}</strong><p>Student preview · Progress is temporary. Reloading starts a fresh attempt.</p></div>
        <Button variant="secondary" onClick={onEnd}>End preview</Button>
      </header>
      <UnityStage preview={preview} audience="student" />
    </dialog>
  )
}

export function StudioPreview({ draft }: { draft: ActivityDraft }) {
  const [, setSearchParams] = useSearchParams()
  const [preview, setPreview] = useState<PreviewBoot | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const problems = previewProblems(draft)

  async function start() {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setPreparing(true)
    setError('')
    try {
      const prepared = await preparePreview(draft, `preview_${newId()}`, controller.signal)
      if (controller.signal.aborted) return
      // Unity reads this before scene startup, so even initial preference/save
      // writers know this instance is a temporary teacher preview.
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set('teacherPreview', '1')
        return next
      }, { replace: true })
      setPreview(prepared)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The preview could not be prepared. Try again.')
    } finally {
      if (!controller.signal.aborted) setPreparing(false)
    }
  }

  function end() {
    setPreview(null)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('teacherPreview')
      return next
    }, { replace: true })
  }

  return (
    <section className={styles.panel} aria-label="Student preview">
      <h2>Try your activity</h2>
      <p>Play with your selected picture, questions and student options in the real game.</p>
      <p>Preview progress is temporary. Resume later is unavailable here. Your draft remains in Teacher Studio; Download backup saves a separate copy.</p>
      {problems.length > 0 && <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      {error && <p role="alert">{error}</p>}
      <Button disabled={preparing || problems.length > 0} onClick={() => void start()}>{preparing ? 'Preparing picture…' : 'Play preview'}</Button>
      {preview && <Player key={preview.requestId} preview={preview} onEnd={end} />}
    </section>
  )
}
