import { useCopyToClipboard } from '@components/share/useCopyToClipboard'
import { Button } from '@components/ui/Button'
import styles from './ClassroomPage.module.css'

/** Key by code so a previous clipboard operation cannot report success for another meeting. */
export function MeetingCodeCopy({ code }: { code: string }) {
  const { state, copy } = useCopyToClipboard()
  return (
    <div className={styles.codeCopy}>
      <label>
        Meeting code
        <input
          className={styles.meetingId}
          readOnly
          value={code}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <Button type="button" variant="secondary" onClick={() => void copy(code)}>
        Copy meeting code
      </Button>
      {state === 'copied' && <p role="status">Meeting code copied.</p>}
      {state === 'failed' && (
        <p role="status">Copy did not work. Select the code above and copy it manually.</p>
      )}
    </div>
  )
}
