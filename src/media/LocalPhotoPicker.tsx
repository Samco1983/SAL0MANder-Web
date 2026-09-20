import { Button } from '@components/ui/Button'
import type { LocalPhotoState } from './useLocalPhoto'
import styles from './LocalPhotoPicker.module.css'

export function LocalPhotoPicker({
  id,
  state,
  onChoose,
  onClear,
}: {
  id: string
  state: LocalPhotoState
  onChoose: (file: File) => void
  onClear: () => void
}) {
  return (
    <div className={styles.picker}>
      <label htmlFor={id}>Or use your own photo</label>
      <p>JPEG, PNG or WebP, up to 12 MB.</p>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) onChoose(file)
        }}
      />
      {state.preparing && <p role="status">Preparing your photo on this device…</p>}
      {state.photo && (
        <img
          className={styles.preview}
          src={`data:image/png;base64,${state.photo.pngBase64}`}
          alt="Your selection, previewed on this device"
        />
      )}
      {state.error && <p role="alert">{state.error}</p>}
      <p>
        This photo stays on this device. It is not uploaded or approved for sharing. Photo sharing
        is unavailable until a review process is connected.
      </p>
      <p>Closing or reloading this page clears the photo.</p>
      {(state.photo || state.preparing || state.error) && (
        <Button variant="secondary" onClick={onClear}>
          Remove local photo
        </Button>
      )}
    </div>
  )
}
