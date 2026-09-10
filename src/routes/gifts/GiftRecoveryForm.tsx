import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { paths } from '@config/routes'
import { restoreGiftLink } from '@/gifts/giftLink'
import styles from './PuzzleGifts.module.css'

export function GiftRecoveryForm({ initialError = '' }: { initialError?: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(initialError)
  const submitted = useRef(false)
  const navigate = useNavigate()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitted.current || !text.trim()) return
    try {
      const local = new URL(restoreGiftLink(text, window.location.origin))
      submitted.current = true
      // React Router supplies the local base path. The pasted origin is never navigated.
      void navigate({ pathname: paths.giftPlay, hash: local.hash }, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This gift could not be opened.')
    }
  }
  return (
    <form className={styles.recovery} onSubmit={submit}>
      <label htmlFor="gift-recovery">Gift link or backup code</label>
      <p id="gift-recovery-help">
        Paste the full link or SAL0-GIFT: code from the sender. This helps when clicking a link
        fails; the game website still needs to be reachable.
      </p>
      <textarea
        id="gift-recovery"
        className={styles.textAnswer}
        rows={4}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        aria-describedby="gift-recovery-help"
        aria-invalid={Boolean(error)}
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
      />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={!text.trim()}>
        Open this gift
      </Button>
    </form>
  )
}
